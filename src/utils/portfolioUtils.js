/**
 * Utility functions for portfolio calculations and rebalancing
 */
import {
  distributeToCategoriesByPercentage,
  distributeToCategoriesByValue,
  getStockCategoryAllocations,
} from './categoryUtils';

/**
 * Calculates portfolio allocations and deviations between a model portfolio and current holdings
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

    // Calculate allocations by category — distribute each stock's percentage across its categories
    selectedPortfolio.stocks.forEach(stock => {
      const distributed = distributeToCategoriesByPercentage(stockCategories, stock.symbol, stock.percentage);
      for (const [catId, pct] of Object.entries(distributed)) {
        modelAllocation[catId] = (modelAllocation[catId] || 0) + pct;
      }
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

  // Calculate values by category — distribute each position's value across its categories
  accounts.forEach(account => {
    // Subtract margin balance from total value (margin is borrowed money)
    if (account.marginBalance) {
      totalValue -= account.marginBalance;
    }

    account.positions.forEach(position => {
      const price = stockPrices[position.symbol] || 0;
      const value = price * position.shares;
      totalValue += value;

      const distributed = distributeToCategoriesByValue(stockCategories, position.symbol, value);
      for (const [catId, amt] of Object.entries(distributed)) {
        currentAllocation[catId] = (currentAllocation[catId] || 0) + amt;
      }
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
  if (!totalPortfolioValue || totalPortfolioValue <= 0) return [];

  const totalValue = totalPortfolioValue;
  const suggestions = [];

  // Get the selected model portfolio object
  const modelPortfolioObj = modelPortfolios.find(p => p.name === selectedModelPortfolio);
  if (!modelPortfolioObj) return [];

  // Build per-stock target percentages from model portfolio
  const modelStocksMap = {};
  modelPortfolioObj.stocks.forEach(stock => {
    modelStocksMap[stock.symbol] = stock.percentage;
  });

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
          allocations: getStockCategoryAllocations(stockCategories, symbol)
        };
      } else {
        symbolTotals[symbol].value += value;
      }
    });
  });

  // Group symbols by category for decision making
  // A multi-category stock appears in each of its categories with proportional value
  const categorizedSymbols = {};
  Object.values(symbolTotals).forEach(item => {
    const currentPct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    const targetPct = modelStocksMap[item.symbol] || 0;
    const stockDeviation = currentPct - targetPct;

    for (const { categoryId, percentage } of item.allocations) {
      if (!categorizedSymbols[categoryId]) {
        categorizedSymbols[categoryId] = [];
      }
      categorizedSymbols[categoryId].push({
        ...item,
        categoryValue: item.value * (percentage / 100),
        stockDeviation
      });
    }
  });

  // For each category with a deviation, recommend specific positions to buy or sell
  Object.keys(deviations).forEach(categoryId => {
    const deviation = deviations[categoryId];
    if (Math.abs(deviation) < 0.5) return; // Skip if deviation is minimal

    const amount = (Math.abs(deviation) / 100) * totalValue;
    const categoryName = categories.find(c => c.id === categoryId)?.name || 'Uncategorized';

    if (deviation > 0) {
      // Category is overweight - need to sell
      if (categorizedSymbols[categoryId] && categorizedSymbols[categoryId].length > 0) {
        // Sort by stockDeviation descending: most overweight stock sold first
        const sellPositions = [...categorizedSymbols[categoryId]].sort((a, b) => b.stockDeviation - a.stockDeviation);
        const positionToSell = sellPositions[0];
        suggestions.push({
          category: categoryName,
          action: `SELL ${positionToSell.symbol}`,
          percent: deviation.toFixed(2),
          amount,
          symbol: positionToSell.symbol
        });
      } else {
        suggestions.push({
          category: categoryName,
          action: 'SELL',
          percent: deviation.toFixed(2),
          amount
        });
      }
    } else {
      // Category is underweight - need to buy
      if (categorizedSymbols[categoryId] && categorizedSymbols[categoryId].length > 0) {
        // Sort by stockDeviation ascending: most underweight stock bought first
        const buyPositions = [...categorizedSymbols[categoryId]].sort((a, b) => a.stockDeviation - b.stockDeviation);
        const positionToBuy = buyPositions[0];
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
          stock => {
            const allocs = getStockCategoryAllocations(stockCategories, stock.symbol);
            return allocs.some(a => a.categoryId === categoryId);
          }
        );

        if (modelStocksInCategory.length > 0) {
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
