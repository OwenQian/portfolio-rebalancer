import {
  migrateStockCategories,
  getStockCategoryAllocations,
  distributeToCategoriesByValue,
  distributeToCategoriesByPercentage,
  countStocksInCategory,
  removeCategoryFromAllStocks,
  validateCategoryAllocations,
  setSingleCategory,
} from '../utils/categoryUtils';

describe('categoryUtils', () => {
  describe('migrateStockCategories', () => {
    it('converts old string format to array format', () => {
      const old = { VTI: '1', VXUS: '3' };
      const result = migrateStockCategories(old);
      expect(result).toEqual({
        VTI: [{ categoryId: '1', percentage: 100 }],
        VXUS: [{ categoryId: '3', percentage: 100 }],
      });
    });

    it('passes through new array format unchanged', () => {
      const newFormat = {
        VTI: [{ categoryId: '1', percentage: 100 }],
        VT: [
          { categoryId: '1', percentage: 60 },
          { categoryId: '3', percentage: 25 },
          { categoryId: '4', percentage: 15 },
        ],
      };
      const result = migrateStockCategories(newFormat);
      expect(result).toEqual(newFormat);
    });

    it('is idempotent (running on new format is a no-op)', () => {
      const newFormat = {
        VTI: [{ categoryId: '1', percentage: 100 }],
      };
      expect(migrateStockCategories(migrateStockCategories(newFormat))).toEqual(newFormat);
    });

    it('handles empty string values', () => {
      const data = { VTI: '' };
      const result = migrateStockCategories(data);
      expect(result).toEqual({ VTI: [] });
    });

    it('handles null/undefined input', () => {
      expect(migrateStockCategories(null)).toEqual({});
      expect(migrateStockCategories(undefined)).toEqual({});
    });

    it('handles mixed old and new format', () => {
      const mixed = {
        VTI: '1',
        VT: [{ categoryId: '1', percentage: 60 }, { categoryId: '3', percentage: 40 }],
      };
      const result = migrateStockCategories(mixed);
      expect(result.VTI).toEqual([{ categoryId: '1', percentage: 100 }]);
      expect(result.VT).toEqual([
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 40 },
      ]);
    });
  });

  describe('getStockCategoryAllocations', () => {
    const stockCategories = {
      VTI: [{ categoryId: '1', percentage: 100 }],
      VT: [
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 40 },
      ],
    };

    it('returns allocations for a mapped symbol', () => {
      expect(getStockCategoryAllocations(stockCategories, 'VTI')).toEqual([
        { categoryId: '1', percentage: 100 },
      ]);
    });

    it('returns multi-category allocations', () => {
      expect(getStockCategoryAllocations(stockCategories, 'VT')).toHaveLength(2);
    });

    it('returns uncategorized default for unmapped symbol', () => {
      expect(getStockCategoryAllocations(stockCategories, 'AAPL')).toEqual([
        { categoryId: 'uncategorized', percentage: 100 },
      ]);
    });

    it('returns uncategorized for empty array', () => {
      const cats = { VTI: [] };
      expect(getStockCategoryAllocations(cats, 'VTI')).toEqual([
        { categoryId: 'uncategorized', percentage: 100 },
      ]);
    });
  });

  describe('distributeToCategoriesByValue', () => {
    const stockCategories = {
      VT: [
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 25 },
        { categoryId: '4', percentage: 15 },
      ],
    };

    it('distributes dollar value proportionally', () => {
      const result = distributeToCategoriesByValue(stockCategories, 'VT', 10000);
      expect(result['1']).toBeCloseTo(6000);
      expect(result['3']).toBeCloseTo(2500);
      expect(result['4']).toBeCloseTo(1500);
    });

    it('handles single-category stock', () => {
      const cats = { VTI: [{ categoryId: '1', percentage: 100 }] };
      const result = distributeToCategoriesByValue(cats, 'VTI', 5000);
      expect(result).toEqual({ '1': 5000 });
    });

    it('handles unmapped symbol (goes to uncategorized)', () => {
      const result = distributeToCategoriesByValue(stockCategories, 'AAPL', 1000);
      expect(result).toEqual({ uncategorized: 1000 });
    });

    it('handles zero value', () => {
      const result = distributeToCategoriesByValue(stockCategories, 'VT', 0);
      expect(result['1']).toBe(0);
    });
  });

  describe('distributeToCategoriesByPercentage', () => {
    const stockCategories = {
      VT: [
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 40 },
      ],
    };

    it('distributes percentage proportionally', () => {
      const result = distributeToCategoriesByPercentage(stockCategories, 'VT', 50);
      expect(result['1']).toBeCloseTo(30); // 50 * 60%
      expect(result['3']).toBeCloseTo(20); // 50 * 40%
    });

    it('handles single-category stock', () => {
      const cats = { VTI: [{ categoryId: '1', percentage: 100 }] };
      const result = distributeToCategoriesByPercentage(cats, 'VTI', 60);
      expect(result).toEqual({ '1': 60 });
    });
  });

  describe('countStocksInCategory', () => {
    const stockCategories = {
      VTI: [{ categoryId: '1', percentage: 100 }],
      VOO: [{ categoryId: '1', percentage: 100 }],
      VT: [
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 40 },
      ],
      VXUS: [{ categoryId: '3', percentage: 100 }],
    };

    it('counts single-category stocks', () => {
      expect(countStocksInCategory(stockCategories, '1')).toBe(3); // VTI, VOO, VT
    });

    it('counts multi-category stock references', () => {
      expect(countStocksInCategory(stockCategories, '3')).toBe(2); // VT, VXUS
    });

    it('returns 0 for unused category', () => {
      expect(countStocksInCategory(stockCategories, '99')).toBe(0);
    });
  });

  describe('removeCategoryFromAllStocks', () => {
    it('removes category and redistributes proportionally', () => {
      const cats = {
        VT: [
          { categoryId: '1', percentage: 60 },
          { categoryId: '3', percentage: 25 },
          { categoryId: '4', percentage: 15 },
        ],
      };
      const result = removeCategoryFromAllStocks(cats, '3');
      // After removing '3' (25%), remaining 60+15=75, redistributed: 60/75*100=80, 15/75*100=20
      expect(result.VT).toHaveLength(2);
      expect(result.VT.find(a => a.categoryId === '1').percentage).toBeCloseTo(80, 0);
      expect(result.VT.find(a => a.categoryId === '4').percentage).toBeCloseTo(20, 0);
      // Sum should be 100
      const sum = result.VT.reduce((s, a) => s + a.percentage, 0);
      expect(sum).toBeCloseTo(100, 1);
    });

    it('removes sole category leaving empty array', () => {
      const cats = { VTI: [{ categoryId: '1', percentage: 100 }] };
      const result = removeCategoryFromAllStocks(cats, '1');
      expect(result.VTI).toEqual([]);
    });

    it('does not affect stocks without the category', () => {
      const cats = {
        VTI: [{ categoryId: '1', percentage: 100 }],
        VXUS: [{ categoryId: '3', percentage: 100 }],
      };
      const result = removeCategoryFromAllStocks(cats, '3');
      expect(result.VTI).toEqual([{ categoryId: '1', percentage: 100 }]);
      expect(result.VXUS).toEqual([]);
    });
  });

  describe('validateCategoryAllocations', () => {
    it('returns true for valid allocations summing to 100', () => {
      expect(validateCategoryAllocations([
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 40 },
      ])).toBe(true);
    });

    it('returns true for single 100% allocation', () => {
      expect(validateCategoryAllocations([
        { categoryId: '1', percentage: 100 },
      ])).toBe(true);
    });

    it('returns false for allocations not summing to 100', () => {
      expect(validateCategoryAllocations([
        { categoryId: '1', percentage: 60 },
        { categoryId: '3', percentage: 30 },
      ])).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(validateCategoryAllocations([])).toBe(false);
    });

    it('returns false for non-array', () => {
      expect(validateCategoryAllocations(null)).toBe(false);
    });

    it('accepts small rounding tolerance', () => {
      expect(validateCategoryAllocations([
        { categoryId: '1', percentage: 33.33 },
        { categoryId: '2', percentage: 33.34 },
        { categoryId: '3', percentage: 33.33 },
      ])).toBe(true);
    });
  });

  describe('setSingleCategory', () => {
    it('returns single-category allocation array', () => {
      expect(setSingleCategory('5')).toEqual([{ categoryId: '5', percentage: 100 }]);
    });
  });
});
