/**
 * Utility functions for multi-category stock allocation.
 *
 * Data format:
 *   stockCategories = {
 *     "VTI": [{ categoryId: "1", percentage: 100 }],
 *     "VT":  [{ categoryId: "1", percentage: 60 }, { categoryId: "3", percentage: 25 }, { categoryId: "4", percentage: 15 }]
 *   }
 */

/**
 * Migrates old string-format stockCategories to the new array format.
 * Old: { "VTI": "1" }  →  New: { "VTI": [{ categoryId: "1", percentage: 100 }] }
 * Idempotent: already-migrated data passes through unchanged.
 */
export function migrateStockCategories(stockCategories) {
  if (!stockCategories || typeof stockCategories !== 'object') return {};

  const migrated = {};
  for (const [symbol, value] of Object.entries(stockCategories)) {
    if (typeof value === 'string') {
      // Old format — single category string
      migrated[symbol] = value ? [{ categoryId: value, percentage: 100 }] : [];
    } else if (Array.isArray(value)) {
      // Already in new format
      migrated[symbol] = value;
    } else {
      // Unknown format — skip
      migrated[symbol] = [];
    }
  }
  return migrated;
}

/**
 * Returns the allocations array for a symbol.
 * Defaults to [{ categoryId: 'uncategorized', percentage: 100 }] when unmapped.
 */
export function getStockCategoryAllocations(stockCategories, symbol) {
  const allocs = stockCategories[symbol];
  if (Array.isArray(allocs) && allocs.length > 0) return allocs;
  return [{ categoryId: 'uncategorized', percentage: 100 }];
}

/**
 * Distributes a dollar value across categories proportionally.
 * Returns { categoryId: dollarAmount, ... }
 */
export function distributeToCategoriesByValue(stockCategories, symbol, dollarValue) {
  const allocs = getStockCategoryAllocations(stockCategories, symbol);
  const result = {};
  for (const { categoryId, percentage } of allocs) {
    result[categoryId] = (result[categoryId] || 0) + dollarValue * (percentage / 100);
  }
  return result;
}

/**
 * Distributes a model portfolio percentage across categories proportionally.
 * Returns { categoryId: percentagePoints, ... }
 */
export function distributeToCategoriesByPercentage(stockCategories, symbol, pct) {
  const allocs = getStockCategoryAllocations(stockCategories, symbol);
  const result = {};
  for (const { categoryId, percentage } of allocs) {
    result[categoryId] = (result[categoryId] || 0) + pct * (percentage / 100);
  }
  return result;
}

/**
 * Counts how many stocks reference a given category (at any percentage).
 */
export function countStocksInCategory(stockCategories, categoryId) {
  let count = 0;
  for (const allocs of Object.values(stockCategories)) {
    if (Array.isArray(allocs) && allocs.some(a => a.categoryId === categoryId)) {
      count++;
    }
  }
  return count;
}

/**
 * Removes a category from all stocks and redistributes percentages proportionally
 * among remaining categories. If it was the sole category, the stock becomes unmapped (empty array).
 * Returns a new stockCategories object.
 */
export function removeCategoryFromAllStocks(stockCategories, categoryId) {
  const updated = {};
  for (const [symbol, allocs] of Object.entries(stockCategories)) {
    if (!Array.isArray(allocs)) {
      updated[symbol] = allocs;
      continue;
    }

    const hasCategory = allocs.some(a => a.categoryId === categoryId);
    if (!hasCategory) {
      updated[symbol] = allocs;
      continue;
    }

    const remaining = allocs.filter(a => a.categoryId !== categoryId);
    if (remaining.length === 0) {
      // Was the sole category — stock becomes unmapped
      updated[symbol] = [];
    } else {
      // Redistribute proportionally
      const remainingTotal = remaining.reduce((sum, a) => sum + a.percentage, 0);
      if (remainingTotal > 0) {
        updated[symbol] = remaining.map(a => ({
          categoryId: a.categoryId,
          percentage: Math.round((a.percentage / remainingTotal) * 10000) / 100
        }));
        // Fix rounding so it sums to exactly 100
        const sum = updated[symbol].reduce((s, a) => s + a.percentage, 0);
        if (Math.abs(sum - 100) > 0.001 && updated[symbol].length > 0) {
          updated[symbol][0].percentage += 100 - sum;
          updated[symbol][0].percentage = Math.round(updated[symbol][0].percentage * 100) / 100;
        }
      } else {
        updated[symbol] = [];
      }
    }
  }
  return updated;
}

/**
 * Validates that an allocations array sums to 100% (within tolerance).
 */
export function validateCategoryAllocations(allocations) {
  if (!Array.isArray(allocations) || allocations.length === 0) return false;
  const sum = allocations.reduce((s, a) => s + (a.percentage || 0), 0);
  return Math.abs(sum - 100) < 0.01;
}

/**
 * Returns a single-category allocation array.
 */
export function setSingleCategory(categoryId) {
  return [{ categoryId, percentage: 100 }];
}
