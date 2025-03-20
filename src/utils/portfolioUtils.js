/**
 * Utility functions for portfolio calculations and rebalancing
 */

/**
 * Calculates portfolio allocations and deviations between a model portfolio and current holdings
 * @param {Object} params - Parameters needed for calculations
 * @param {Array} params.modelPortfolios - List of model portfolios
 * @param {Array} params.accounts - List of accounts with positions
 * @param {Array} params.categories - List of investment categories
 * @param {Object} params.stockCategories - Map of stock symbols to category IDs
 * @param {Object} params.stockPrices - Map of stock symbols to current prices
 * @param {string} params.selectedModelPortfolio - Name of the selected model portfolio
 * @returns {Object} Object containing model allocation, current allocation, deviations, and total portfolio value
 */
export function calculateAllocations(params) {
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

/**
 * Generates rebalancing suggestions based on deviations between model portfolio and current holdings
 * @param {Object} params - Parameters needed for rebalancing calculations
 * @param {string} params.selectedModelPortfolio - Name of the selected model portfolio
 * @param {Array} params.modelPortfolios - List of model portfolios
 * @param {Array} params.accounts - List of accounts with positions
 * @param {Array} params.categories - List of investment categories
 * @param {Object} params.stockCategories - Map of stock symbols to category IDs
 * @param {Object} params.stockPrices - Map of stock symbols to current prices
 * @param {Object} params.deviations - Deviations between model and current allocations by category
 * @param {number} params.totalPortfolioValue - Total portfolio value
 * @returns {Array} List of rebalancing suggestions
 */
export function generateRebalanceSuggestions(params) {
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