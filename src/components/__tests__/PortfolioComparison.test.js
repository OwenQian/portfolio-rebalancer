import React from 'react';
import '@testing-library/jest-dom';
import PortfolioComparison from '../PortfolioComparison';

// Isolated rebalancing algorithm extracted from PortfolioComparison.js
function rebalancingAlgorithm(params) {
  const {
    selectedModelPortfolio,
    modelPortfolios,
    accounts,
    categories,
    stockCategories,
    stockPrices,
    deviations,
    totalPortfolioValue
  } = params;
  
  // Early returns for invalid scenarios
  if (!selectedModelPortfolio) return [];
  if (!totalPortfolioValue || totalPortfolioValue <= 0) return []; // If there's no portfolio value, nothing to rebalance
  
  const totalValue = totalPortfolioValue;
  const suggestions = [];
  
  // Get the selected model portfolio object
  const modelPortfolioObj = modelPortfolios.find(p => p.name === selectedModelPortfolio);
  if (!modelPortfolioObj) return [];
  
  // Calculate current positions by symbol across all accounts
  const symbolTotals = {};
  accounts.forEach(account => {
    account.positions.forEach(position => {
      const symbol = position.symbol;
      const price = stockPrices[symbol] || 0;
      const value = position.shares * price;
      
      if (!symbolTotals[symbol]) {
        symbolTotals[symbol] = {
          symbol,
          value,
          category: stockCategories[symbol] || 'uncategorized'
        };
      } else {
        symbolTotals[symbol].value += value;
      }
    });
  });
  
  // Group symbols by category for decision making
  const categorizedSymbols = {};
  Object.values(symbolTotals).forEach(item => {
    if (!categorizedSymbols[item.category]) {
      categorizedSymbols[item.category] = [];
    }
    categorizedSymbols[item.category].push(item);
  });
  
  // Sort each category's symbols by value (ascending for selling, descending for buying)
  Object.keys(categorizedSymbols).forEach(category => {
    categorizedSymbols[category].sort((a, b) => a.value - b.value); // Ascending for selling lowest value first
  });
  
  // For each category with a deviation, recommend specific positions to buy or sell
  Object.keys(deviations).forEach(categoryId => {
    const deviation = deviations[categoryId];
    if (Math.abs(deviation) < 0.5) return; // Skip if deviation is minimal
    
    const amount = (Math.abs(deviation) / 100) * totalValue;
    const categoryName = categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
    
    if (deviation > 0) {
      // Category is overweight - need to sell
      // Choose the position with the smallest total equity in this category
      if (categorizedSymbols[categoryId] && categorizedSymbols[categoryId].length > 0) {
        const positionToSell = categorizedSymbols[categoryId][0]; // Smallest position first
        suggestions.push({
          category: categoryName,
          action: `SELL ${positionToSell.symbol}`,
          percent: deviation.toFixed(2),
          amount,
          symbol: positionToSell.symbol
        });
      } else {
        // Fallback if no specific position found
        suggestions.push({
          category: categoryName,
          action: 'SELL',
          percent: deviation.toFixed(2),
          amount
        });
      }
    } else {
      // Category is underweight - need to buy
      // Find positions that already exist in this category (if any)
      if (categorizedSymbols[categoryId] && categorizedSymbols[categoryId].length > 0) {
        // Sort in descending order for buying (largest position first)
        const buyPositions = [...categorizedSymbols[categoryId]].sort((a, b) => b.value - a.value);
        const positionToBuy = buyPositions[0]; // Largest position first
        suggestions.push({
          category: categoryName,
          action: `BUY ${positionToBuy.symbol}`,
          percent: Math.abs(deviation).toFixed(2),
          amount,
          symbol: positionToBuy.symbol
        });
      } else {
        // If no positions exist in this category, look for stocks in model portfolio
        const modelStocksInCategory = modelPortfolioObj.stocks.filter(
          stock => stockCategories[stock.symbol] === categoryId
        );
        
        if (modelStocksInCategory.length > 0) {
          // Sort by percentage allocation in model (descending)
          modelStocksInCategory.sort((a, b) => b.percentage - a.percentage);
          const recommendedStock = modelStocksInCategory[0];
          suggestions.push({
            category: categoryName,
            action: `BUY ${recommendedStock.symbol}`,
            percent: Math.abs(deviation).toFixed(2),
            amount,
            symbol: recommendedStock.symbol
          });
        } else {
          // Fallback if no specific position found
          suggestions.push({
            category: categoryName,
            action: 'BUY',
            percent: Math.abs(deviation).toFixed(2),
            amount
          });
        }
      }
    }
  });
  
  return suggestions;
}

// Helper to calculate portfolio allocations and deviations
function calculateAllocations(params) {
  const { modelPortfolios, accounts, categories, stockCategories, stockPrices, selectedModelPortfolio } = params;
  
  // Calculate model allocation
  const modelAllocation = {};
  const selectedPortfolio = modelPortfolios.find(p => p.name === selectedModelPortfolio);
  
  if (selectedPortfolio) {
    // Initialize categories
    categories.forEach(category => {
      modelAllocation[category.id] = 0;
    });
    modelAllocation['uncategorized'] = 0;
    
    // Calculate allocations by category
    selectedPortfolio.stocks.forEach(stock => {
      const categoryId = stockCategories[stock.symbol] || 'uncategorized';
      modelAllocation[categoryId] = (modelAllocation[categoryId] || 0) + stock.percentage;
    });
  }
  
  // Calculate current allocation
  const currentAllocation = {};
  let totalValue = 0;
  
  // Initialize categories
  categories.forEach(category => {
    currentAllocation[category.id] = 0;
  });
  currentAllocation['uncategorized'] = 0;
  
  // Calculate values by category
  accounts.forEach(account => {
    account.positions.forEach(position => {
      const price = stockPrices[position.symbol] || 0;
      const value = price * position.shares;
      totalValue += value;
      
      const categoryId = stockCategories[position.symbol] || 'uncategorized';
      currentAllocation[categoryId] = (currentAllocation[categoryId] || 0) + value;
    });
  });
  
  // Convert to percentages
  if (totalValue > 0) {
    Object.keys(currentAllocation).forEach(categoryId => {
      currentAllocation[categoryId] = (currentAllocation[categoryId] / totalValue) * 100;
    });
  }
  
  // Calculate deviations
  const deviations = {};
  categories.forEach(category => {
    const modelAlloc = modelAllocation[category.id] || 0;
    const currentAlloc = currentAllocation[category.id] || 0;
    deviations[category.id] = currentAlloc - modelAlloc;
  });
  deviations['uncategorized'] = (currentAllocation['uncategorized'] || 0) - (modelAllocation['uncategorized'] || 0);
  
  return { modelAllocation, currentAllocation, deviations, totalPortfolioValue: totalValue };
}

// Unit tests for the rebalancing algorithm
describe('Portfolio Rebalancing Algorithm', () => {
  // Test data
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
  
  const mockStockCategories = {
    'AAPL': 'tech',
    'MSFT': 'tech',
    'JPM': 'finance',
    'VTI': 'etf'
  };
  
  const mockStockPrices = {
    'AAPL': 150,
    'MSFT': 200,
    'JPM': 130,
    'VTI': 220
  };

  test('generates correct rebalance suggestions based on position values', () => {
    // First calculate allocations and deviations
    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts, 
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Test Model'
    });
    
    // Then generate rebalance suggestions
    const suggestions = rebalancingAlgorithm({
      selectedModelPortfolio: 'Test Model',
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue
    });
    
    // Calculate total portfolio value: AAPL(15 * 150) + MSFT(2 * 200) + JPM(5 * 130) + VTI(10 * 220) = $5500
    // Expected allocations:
    // - Tech: 80% of $5500 = $4400, Current = $2650 (AAPL + MSFT), Underweight by $1750
    // - Finance: 20% of $5500 = $1100, Current = $650 (JPM), Underweight by $450 
    // - ETF: 0% of $5500 = $0, Current = $2200 (VTI), Overweight by $2200

    // Verify suggestions exist
    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBeTruthy();
    
    // There should be suggestions for each category with significant deviation
    const techSuggestion = suggestions.find(s => s.category === 'Technology');
    const financeSuggestion = suggestions.find(s => s.category === 'Financial');
    const etfSuggestion = suggestions.find(s => s.category === 'ETF');
    
    // ETF should have a SELL suggestion
    expect(etfSuggestion).toBeDefined();
    expect(etfSuggestion.action).toContain('SELL');
    expect(etfSuggestion.symbol).toBe('VTI');
    
    // Technology should have a BUY suggestion for AAPL (highest value position)
    expect(techSuggestion).toBeDefined();
    expect(techSuggestion.action).toContain('BUY');
    expect(techSuggestion.symbol).toBe('AAPL');
    
    // Finance should have a BUY suggestion for JPM
    expect(financeSuggestion).toBeDefined();
    expect(financeSuggestion.action).toContain('BUY');
    expect(financeSuggestion.symbol).toBe('JPM');
  });
  
  test('handles empty accounts gracefully', () => {
    // First calculate allocations and deviations with empty accounts
    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: [],
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Test Model'
    });
    
    // With empty accounts, we should see model allocations but zero current allocations 
    console.log("Empty accounts test - deviations:", deviations);
    console.log("Empty accounts test - totalPortfolioValue:", totalPortfolioValue);
    
    // When totalPortfolioValue is 0, the algorithm should not calculate dollar amounts
    // or if it does, they would be 0, which shouldn't trigger suggestions
    
    // Then generate rebalance suggestions
    const suggestions = rebalancingAlgorithm({
      selectedModelPortfolio: 'Test Model',
      modelPortfolios: mockModelPortfolios,
      accounts: [],
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue: 0  // Explicitly set to 0 to handle the zero portfolio case
    });
    
    console.log("Empty accounts test - suggestions:", suggestions);
    
    // With a zero portfolio value, we shouldn't get any suggestions
    // since any percentage of $0 is still $0
    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBeTruthy();
    expect(suggestions.length).toBe(0);
  });
  
  test('handles missing model portfolio gracefully', () => {
    // First calculate allocations and deviations with non-existent model
    const { deviations, totalPortfolioValue } = calculateAllocations({
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      selectedModelPortfolio: 'Non-existent Model'
    });
    
    // Then generate rebalance suggestions
    const suggestions = rebalancingAlgorithm({
      selectedModelPortfolio: 'Non-existent Model',
      modelPortfolios: mockModelPortfolios,
      accounts: mockAccounts,
      categories: mockCategories,
      stockCategories: mockStockCategories,
      stockPrices: mockStockPrices,
      deviations,
      totalPortfolioValue
    });
    
    // Should return an empty array or similar non-breaking value
    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBeTruthy();
    expect(suggestions.length).toBe(0);
  });
}); 