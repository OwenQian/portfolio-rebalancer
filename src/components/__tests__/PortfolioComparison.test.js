import React from 'react';
import '@testing-library/jest-dom';
import { calculateAllocations, generateRebalanceSuggestions } from '../../utils/portfolioUtils';
import { migrateStockCategories } from '../../utils/categoryUtils';

// Unit tests for the rebalancing algorithm
describe('Portfolio Rebalancing Algorithm', () => {
  // Test data in new multi-category format
  const mockModelPortfolios = [
    {
      name: 'Test Model',
      stocks: [
        { symbol: 'AAPL', percentage: 40 },  // Tech
        { symbol: 'MSFT', percentage: 40 },  // Tech
        { symbol: 'JPM', percentage: 20 }    // Finance
      ]
    }
  ];

  const mockAccounts = [
    {
      name: 'Brokerage',
      positions: [
        { symbol: 'AAPL', shares: 10 },  // $1500
        { symbol: 'MSFT', shares: 2 },   // $400
        { symbol: 'JPM', shares: 5 }     // $650
      ]
    },
    {
      name: 'IRA',
      positions: [
        { symbol: 'AAPL', shares: 5 },   // $750
        { symbol: 'VTI', shares: 10 }    // $2200
      ]
    }
  ];

  const mockCategories = [
    { id: 'tech', name: 'Technology' },
    { id: 'finance', name: 'Financial' },
    { id: 'etf', name: 'ETF' }
  ];

  // New multi-category format
  const mockStockCategories = {
    'AAPL': [{ categoryId: 'tech', percentage: 100 }],
    'MSFT': [{ categoryId: 'tech', percentage: 100 }],
    'JPM': [{ categoryId: 'finance', percentage: 100 }],
    'VTI': [{ categoryId: 'etf', percentage: 100 }]
  };

  const mockStockPrices = {
    'AAPL': 150,
    'MSFT': 200,
    'JPM': 130,
    'VTI': 220
  };

  test('generates correct rebalance suggestions based on position values', () => {
    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Test Model'
    });

    const suggestions = generateRebalanceSuggestions({
      selectedModelPortfolio: 'Test Model',
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue
    });

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBeTruthy();

    const techSuggestion = suggestions.find(s => s.category === 'Technology');
    const financeSuggestion = suggestions.find(s => s.category === 'Financial');
    const etfSuggestion = suggestions.find(s => s.category === 'ETF');

    // ETF should have a SELL suggestion
    expect(etfSuggestion).toBeDefined();
    expect(etfSuggestion.action).toContain('SELL');
    expect(etfSuggestion.symbol).toBe('VTI');

    // Technology should have a BUY suggestion for MSFT (most underweight: 7.3% current vs 40% target)
    expect(techSuggestion).toBeDefined();
    expect(techSuggestion.action).toContain('BUY');
    expect(techSuggestion.symbol).toBe('MSFT');

    // Finance should have a BUY suggestion for JPM
    expect(financeSuggestion).toBeDefined();
    expect(financeSuggestion.action).toContain('BUY');
    expect(financeSuggestion.symbol).toBe('JPM');
  });

  test('handles empty accounts gracefully', () => {
    const { deviations } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: [],
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Test Model'
    });

    const suggestions = generateRebalanceSuggestions({
      selectedModelPortfolio: 'Test Model',
      modelPortfolios: mockModelPortfolios,
      accounts: [],
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue: 0
    });

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBeTruthy();
    expect(suggestions.length).toBe(0);
  });

  test('handles missing model portfolio gracefully', () => {
    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Non-existent Model'
    });

    const suggestions = generateRebalanceSuggestions({
      selectedModelPortfolio: 'Non-existent Model',
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue
    });

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBeTruthy();
    expect(suggestions.length).toBe(0);
  });

  test('backward compatibility: old string format is migrated and works', () => {
    const oldFormat = {
      'AAPL': 'tech',
      'MSFT': 'tech',
      'JPM': 'finance',
      'VTI': 'etf'
    };
    const migrated = migrateStockCategories(oldFormat);

    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: migrated,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Test Model'
    });

    const suggestions = generateRebalanceSuggestions({
      selectedModelPortfolio: 'Test Model',
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: migrated,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue
    });

    expect(suggestions.length).toBeGreaterThan(0);
    const etfSuggestion = suggestions.find(s => s.category === 'ETF');
    expect(etfSuggestion).toBeDefined();
    expect(etfSuggestion.action).toContain('SELL');
  });

  test('buys the most underweight stock in a category (ETF + individual stock)', () => {
    // VTI 50% + GOOG 10%, both in "US Large Cap"
    // VTI is at ~55%, GOOG is at ~3% → should suggest BUY GOOG (most underweight)
    const testModelPortfolios = [
      {
        name: 'Mixed Model',
        stocks: [
          { symbol: 'VTI', percentage: 50 },
          { symbol: 'GOOG', percentage: 10 },
          { symbol: 'BND', percentage: 40 }
        ]
      }
    ];

    const testAccounts = [
      {
        name: 'Brokerage',
        positions: [
          { symbol: 'VTI', shares: 55 },   // $5500 = 55%
          { symbol: 'GOOG', shares: 2 },    // $300 = 3%
          { symbol: 'BND', shares: 42 }     // $4200 = 42%
        ]
      }
    ];

    const testCategories = [
      { id: 'uslc', name: 'US Large Cap' },
      { id: 'bond', name: 'Bonds' }
    ];

    const testStockCategories = {
      'VTI': [{ categoryId: 'uslc', percentage: 100 }],
      'GOOG': [{ categoryId: 'uslc', percentage: 100 }],
      'BND': [{ categoryId: 'bond', percentage: 100 }]
    };

    const testStockPrices = {
      'VTI': 100,
      'GOOG': 150,
      'BND': 100
    };

    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: testModelPortfolios,
      accounts: testAccounts,
      categories: testCategories,
      stockCategories: testStockCategories,
      stockPrices: testStockPrices,
      selectedModelPortfolio: 'Mixed Model'
    });

    const suggestions = generateRebalanceSuggestions({
      selectedModelPortfolio: 'Mixed Model',
      modelPortfolios: testModelPortfolios,
      accounts: testAccounts,
      categories: testCategories,
      stockCategories: testStockCategories,
      stockPrices: testStockPrices,
      deviations,
      totalPortfolioValue
    });

    // US Large Cap is underweight (58% current vs 60% target)
    // Within that category, GOOG is far more underweight (3% vs 10% target) than VTI (55% vs 50%)
    const uslcSuggestion = suggestions.find(s => s.category === 'US Large Cap');
    if (uslcSuggestion) {
      expect(uslcSuggestion.action).toContain('BUY');
      expect(uslcSuggestion.symbol).toBe('GOOG');
    }
  });

  test('sells the most overweight stock in a category', () => {
    // VTI target 30%, GOOG target 10%, both "US Large Cap"
    // VTI at 45% (overweight by 15), GOOG at 15% (overweight by 5)
    // → should suggest SELL VTI first (most overweight)
    const testModelPortfolios = [
      {
        name: 'Overweight Model',
        stocks: [
          { symbol: 'VTI', percentage: 30 },
          { symbol: 'GOOG', percentage: 10 },
          { symbol: 'BND', percentage: 60 }
        ]
      }
    ];

    const testAccounts = [
      {
        name: 'Brokerage',
        positions: [
          { symbol: 'VTI', shares: 45 },   // $4500 = 45%
          { symbol: 'GOOG', shares: 10 },   // $1500 = 15%
          { symbol: 'BND', shares: 40 }     // $4000 = 40%
        ]
      }
    ];

    const testCategories = [
      { id: 'uslc', name: 'US Large Cap' },
      { id: 'bond', name: 'Bonds' }
    ];

    const testStockCategories = {
      'VTI': [{ categoryId: 'uslc', percentage: 100 }],
      'GOOG': [{ categoryId: 'uslc', percentage: 100 }],
      'BND': [{ categoryId: 'bond', percentage: 100 }]
    };

    const testStockPrices = {
      'VTI': 100,
      'GOOG': 150,
      'BND': 100
    };

    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: testModelPortfolios,
      accounts: testAccounts,
      categories: testCategories,
      stockCategories: testStockCategories,
      stockPrices: testStockPrices,
      selectedModelPortfolio: 'Overweight Model'
    });

    const suggestions = generateRebalanceSuggestions({
      selectedModelPortfolio: 'Overweight Model',
      modelPortfolios: testModelPortfolios,
      accounts: testAccounts,
      categories: testCategories,
      stockCategories: testStockCategories,
      stockPrices: testStockPrices,
      deviations,
      totalPortfolioValue
    });

    // US Large Cap is overweight (60% current vs 40% target)
    // VTI is more overweight (45% vs 30% = +15) than GOOG (15% vs 10% = +5)
    const uslcSellSuggestion = suggestions.find(s => s.category === 'US Large Cap' && s.action.includes('SELL'));
    expect(uslcSellSuggestion).toBeDefined();
    expect(uslcSellSuggestion.action).toContain('SELL VTI');
  });

  test('multi-category stock splits allocation correctly', () => {
    const multiCatStockCategories = {
      'VT': [
        { categoryId: 'us', percentage: 60 },
        { categoryId: 'intl', percentage: 30 },
        { categoryId: 'em', percentage: 10 },
      ],
    };

    const multiCatCategories = [
      { id: 'us', name: 'US' },
      { id: 'intl', name: 'International' },
      { id: 'em', name: 'Emerging' },
    ];

    const multiCatAccounts = [
      {
        name: 'Brokerage',
        positions: [{ symbol: 'VT', shares: 100 }]
      }
    ];

    const multiCatPrices = { 'VT': 100 }; // Total value = $10,000

    const multiCatModelPortfolios = [
      {
        name: 'Global',
        stocks: [{ symbol: 'VT', percentage: 100 }]
      }
    ];

    const { modelAllocation, currentAllocation, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: multiCatModelPortfolios,
      accounts: multiCatAccounts,
      categories: multiCatCategories,
      stockCategories: multiCatStockCategories,
      stockPrices: multiCatPrices,
      selectedModelPortfolio: 'Global'
    });

    // Model allocation should be split: 60% US, 30% Intl, 10% EM
    expect(modelAllocation['us']).toBeCloseTo(60);
    expect(modelAllocation['intl']).toBeCloseTo(30);
    expect(modelAllocation['em']).toBeCloseTo(10);

    // Current allocation should be the same since 100% of portfolio is VT
    expect(currentAllocation['us']).toBeCloseTo(60);
    expect(currentAllocation['intl']).toBeCloseTo(30);
    expect(currentAllocation['em']).toBeCloseTo(10);

    expect(totalPortfolioValue).toBe(10000);
  });
});
