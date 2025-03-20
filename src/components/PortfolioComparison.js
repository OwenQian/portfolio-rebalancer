import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Row, Col, Form, Button, Alert, Badge, InputGroup, Modal } from 'react-bootstrap';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { formatDollarAmount, formatNumber } from '../utils/formatters';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const PortfolioComparison = ({ 
  modelPortfolios, 
  accounts, 
  categories, 
  stockCategories, 
  stockPrices 
}) => {
  const [selectedModelPortfolio, setSelectedModelPortfolio] = useState('');
  const [modelAllocation, setModelAllocation] = useState({});
  const [currentAllocation, setCurrentAllocation] = useState({});
  const [simulatedAllocation, setSimulatedAllocation] = useState({});
  const [deviations, setDeviations] = useState({});
  const [simulatedDeviations, setSimulatedDeviations] = useState({});
  const [rebalanceActions, setRebalanceActions] = useState([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [specificRebalancingSuggestions, setSpecificRebalancingSuggestions] = useState([]);
  const [showSpecificSuggestions] = useState(false);
  
  // What-if analysis states
  const [showWhatIfAnalysis, setShowWhatIfAnalysis] = useState(false);
  const [whatIfCategory, setWhatIfCategory] = useState('');
  const [whatIfAction, setWhatIfAction] = useState('buy');
  const [whatIfAmount, setWhatIfAmount] = useState('');
  const [whatIfDirty, setWhatIfDirty] = useState(false);
  const [whatIfTrades, setWhatIfTrades] = useState([]);
  const [currentTrade, setCurrentTrade] = useState({
    category: '',
    action: 'buy',
    amount: ''
  });

  // Sell-Buy rebalancing state
  const [showSellBuyRebalancing, setShowSellBuyRebalancing] = useState(false);
  
  // Buy-only rebalancing states
  const [showBuyOnlyRebalancing, setShowBuyOnlyRebalancing] = useState(false);
  const [newInvestmentAmount, setNewInvestmentAmount] = useState('');
  const [buyOnlySuggestions, setBuyOnlySuggestions] = useState([]);
  const [selectedTrades, setSelectedTrades] = useState({});
  const [recalculatedSuggestions, setRecalculatedSuggestions] = useState([]);

  // Add these state variables near the top with other states
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [jsonExportData, setJsonExportData] = useState(null);
  const [csvExportData, setCsvExportData] = useState(null);

  // Generate random colors for categories
  const generateColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 137) % 360; // Use golden angle approximation for good distribution
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
  };

  // Calculate model portfolio allocation by category
  const calculateModelAllocation = useCallback((portfolioId) => {
    if (!portfolioId) return {};

    const selectedPortfolio = modelPortfolios.find(p => p.name === portfolioId);
    if (!selectedPortfolio) return {};

    const allocation = {};
    let totalPercentage = 0;

    // Initialize categories
    categories.forEach(category => {
      allocation[category.id] = 0;
    });
    allocation['uncategorized'] = 0;

    // Calculate allocations by category
    selectedPortfolio.stocks.forEach(stock => {
      const categoryId = stockCategories[stock.symbol] || 'uncategorized';
      allocation[categoryId] = (allocation[categoryId] || 0) + stock.percentage;
      totalPercentage += stock.percentage;
    });

    // Normalize to 100% if needed
    if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.01) {
      Object.keys(allocation).forEach(categoryId => {
        allocation[categoryId] = (allocation[categoryId] / totalPercentage) * 100;
      });
    }

    return allocation;
  }, [categories, modelPortfolios, stockCategories]);

  // Calculate current portfolio allocation by category
  const calculateCurrentAllocation = useCallback(() => {
    const allocation = {};
    let totalValue = 0;

    // Initialize categories
    categories.forEach(category => {
      allocation[category.id] = 0;
    });
    allocation['uncategorized'] = 0;

    // Calculate values by category
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        totalValue += value;

        const categoryId = stockCategories[position.symbol] || 'uncategorized';
        allocation[categoryId] = (allocation[categoryId] || 0) + value;
      });
    });

    // Convert to percentages
    if (totalValue > 0) {
      Object.keys(allocation).forEach(categoryId => {
        allocation[categoryId] = (allocation[categoryId] / totalValue) * 100;
      });
    }

    // Save total portfolio value for rebalancing calculations
    setTotalPortfolioValue(totalValue);

    return allocation;
  }, [accounts, categories, stockCategories, stockPrices]);
  
  // Calculate deviations between model and current allocations
  const calculateDeviations = useCallback((model, current) => {
    const deviations = {};
    
    categories.forEach(category => {
      const modelAlloc = model[category.id] || 0;
      const currentAlloc = current[category.id] || 0;
      deviations[category.id] = currentAlloc - modelAlloc;
    });
    
    deviations['uncategorized'] = (current['uncategorized'] || 0) - (model['uncategorized'] || 0);
    
    return deviations;
  }, [categories]);

  // Simulate allocation changes based on multiple trades
  const simulateAllocationChange = useCallback(() => {
    if (whatIfTrades.length === 0) {
      // Reset to current allocation if no trades
      setSimulatedAllocation(currentAllocation);
      setSimulatedDeviations(deviations);
      return;
    }
    
    // Create a copy of the current allocation values (not percentages)
    const categoryValues = {};
    let newTotalValue = totalPortfolioValue;
    
    // Convert percentages to dollar values
    Object.keys(currentAllocation).forEach(categoryId => {
      categoryValues[categoryId] = (currentAllocation[categoryId] / 100) * totalPortfolioValue;
    });
    
    // Apply all trades
    whatIfTrades.forEach(trade => {
      const amount = parseFloat(trade.amount);
      if (!trade.category || !trade.amount || isNaN(amount) || amount <= 0) return;
      
      const isBuying = trade.action === 'buy';
      
      if (isBuying) {
        categoryValues[trade.category] = (categoryValues[trade.category] || 0) + amount;
        newTotalValue += amount;
      } else {
        // Selling - make sure we don't sell more than we have
        const currentCategoryValue = (currentAllocation[trade.category] / 100) * totalPortfolioValue;
        if (amount > currentCategoryValue) {
          // Can't sell more than what exists in the category
          categoryValues[trade.category] = 0;
          newTotalValue -= currentCategoryValue;
        } else {
          categoryValues[trade.category] = currentCategoryValue - amount;
          newTotalValue -= amount;
        }
      }
    });
    
    // Calculate new percentages based on new total value
    const newAllocation = {};
    if (newTotalValue > 0) {
      Object.keys(categoryValues).forEach(categoryId => {
        newAllocation[categoryId] = (categoryValues[categoryId] / newTotalValue) * 100;
      });
    }
    
    // Calculate new deviations
    const newDeviations = calculateDeviations(modelAllocation, newAllocation);
    
    setSimulatedAllocation(newAllocation);
    setSimulatedDeviations(newDeviations);
    setWhatIfDirty(true);
  }, [whatIfTrades, currentAllocation, deviations, calculateDeviations, modelAllocation, totalPortfolioValue]);

  // Reset simulation to current allocation
  const resetSimulation = useCallback(() => {
    setWhatIfTrades([]);
    setCurrentTrade({
      category: '',
      action: 'buy',
      amount: ''
    });
    setSimulatedAllocation(currentAllocation);
    setSimulatedDeviations(deviations);
    setWhatIfDirty(false);
  }, [currentAllocation, deviations]);

  // Add current trade to the list
  const addTrade = () => {
    if (currentTrade.category && currentTrade.amount) {
      setWhatIfTrades([...whatIfTrades, { ...currentTrade }]);
      setCurrentTrade({
        category: '',
        action: 'buy',
        amount: ''
      });
    }
  };

  // Remove a trade
  const removeTrade = (index) => {
    const newTrades = whatIfTrades.filter((_, i) => i !== index);
    setWhatIfTrades(newTrades);
  };

  // Quick add amount to current trade
  const quickAddAmount = (amount) => {
    setCurrentTrade(prev => ({
      ...prev,
      amount: (parseFloat(prev.amount) || 0) + amount
    }));
  };

  // Run simulation when trades change
  useEffect(() => {
    if (showWhatIfAnalysis) {
      simulateAllocationChange();
    }
  }, [whatIfTrades, showWhatIfAnalysis, simulateAllocationChange]);

  // Generate rebalance suggestions
  const generateRebalanceSuggestions = () => {
    if (!selectedModelPortfolio) return [];
    
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
            shares: position.shares,
            value,
            price,
            category: stockCategories[symbol] || 'uncategorized'
          };
        } else {
          symbolTotals[symbol].value += value;
          symbolTotals[symbol].shares += position.shares;
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
    
    // First handle all sells (overweight positions)
    Object.keys(deviations).forEach(categoryId => {
      const deviation = deviations[categoryId];
      if (deviation > 0.5) { // Only sell if meaningfully overweight
        const amount = (deviation / 100) * totalValue;
        const categoryName = categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
        
        if (categorizedSymbols[categoryId] && categorizedSymbols[categoryId].length > 0) {
          const positionToSell = categorizedSymbols[categoryId][0]; // Smallest position first
          const sharesToSell = Math.floor(amount / positionToSell.price);
          
          if (sharesToSell > 0) {
            suggestions.push({
              category: categoryName,
              action: `SELL ${positionToSell.symbol}`,
              percent: deviation.toFixed(2),
              amount: sharesToSell * positionToSell.price
            });
          }
        }
      }
    });
    
    // Then handle all buys (underweight positions)
    Object.keys(deviations).forEach(categoryId => {
      const deviation = deviations[categoryId];
      if (deviation < -0.5) { // Only buy if meaningfully underweight
        const amount = (Math.abs(deviation) / 100) * totalValue;
        const categoryName = categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
        
        // Find positions that already exist in this category (if any)
        if (categorizedSymbols[categoryId] && categorizedSymbols[categoryId].length > 0) {
          // Sort in descending order for buying (largest position first)
          const buyPositions = [...categorizedSymbols[categoryId]].sort((a, b) => b.value - a.value);
          const positionToBuy = buyPositions[0]; // Largest position first
          const sharesToBuy = Math.floor(amount / positionToBuy.price);
          
          if (sharesToBuy > 0) {
            suggestions.push({
              category: categoryName,
              action: `BUY ${positionToBuy.symbol}`,
              percent: Math.abs(deviation).toFixed(2),
              amount: sharesToBuy * positionToBuy.price
            });
          }
        } else {
          // If no positions exist in this category, look for stocks in model portfolio
          const modelStocksInCategory = modelPortfolioObj.stocks.filter(
            stock => stockCategories[stock.symbol] === categoryId
          );
          
          if (modelStocksInCategory.length > 0) {
            // Sort by percentage allocation in model (descending)
            modelStocksInCategory.sort((a, b) => b.percentage - a.percentage);
            const recommendedStock = modelStocksInCategory[0];
            const price = stockPrices[recommendedStock.symbol] || 0;
            
            if (price > 0) {
              const sharesToBuy = Math.floor(amount / price);
              if (sharesToBuy > 0) {
                suggestions.push({
                  category: categoryName,
                  action: `BUY ${recommendedStock.symbol}`,
                  percent: Math.abs(deviation).toFixed(2),
                  amount: sharesToBuy * price
                });
              }
            }
          }
        }
      }
    });
    
    return suggestions;
  };

  // Generate specific stock-level rebalancing suggestions
  const generateSpecificSuggestions = useCallback(() => {
    if (!selectedModelPortfolio || totalPortfolioValue <= 0) return [];
    
    const selectedPortfolio = modelPortfolios.find(p => p.name === selectedModelPortfolio);
    if (!selectedPortfolio) return [];
    
    const suggestions = [];
    const modelStocks = new Map(selectedPortfolio.stocks.map(stock => [stock.symbol, stock.percentage]));
    
    // Get current portfolio stock values
    const currentStockValues = {};
    let currentTotalValue = 0;
    
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        
        if (currentStockValues[position.symbol]) {
          currentStockValues[position.symbol].value += value;
          currentStockValues[position.symbol].shares += position.shares;
        } else {
          currentStockValues[position.symbol] = { 
            value, 
            shares: position.shares,
            price
          };
        }
        
        currentTotalValue += value;
      });
    });
    
    // Stocks to sell (reduce)
    Object.entries(currentStockValues).forEach(([symbol, data]) => {
      const modelPercentage = modelStocks.get(symbol) || 0;
      const currentPercentage = (data.value / currentTotalValue) * 100;
      
      if (currentPercentage > modelPercentage + 1) {
        // Overweight - need to reduce
        const targetValue = (modelPercentage / 100) * currentTotalValue;
        const excessValue = data.value - targetValue;
        const sharesToSell = Math.floor(excessValue / data.price);
        
        if (sharesToSell > 0) {
          suggestions.push({
            symbol,
            action: 'Sell',
            shares: sharesToSell,
            value: (sharesToSell * data.price).toFixed(2),
            category: categories.find(cat => cat.id === stockCategories[symbol])?.name || 'Uncategorized',
            currentPercentage: currentPercentage.toFixed(2),
            targetPercentage: modelPercentage.toFixed(2),
            deviation: (currentPercentage - modelPercentage).toFixed(2)
          });
        }
      }
    });
    
    // Stocks to buy (increase) or add
    selectedPortfolio.stocks.forEach(modelStock => {
      const { symbol, percentage } = modelStock;
      const currentData = currentStockValues[symbol];
      
      const targetValue = (percentage / 100) * currentTotalValue;
      const currentValue = currentData?.value || 0;
      
      if (targetValue > currentValue + 100) { // Only suggest if difference is significant
        const additionalValue = targetValue - currentValue;
        const price = currentData?.price || stockPrices[symbol] || 0;
        
        if (price > 0) {
          const sharesToBuy = Math.floor(additionalValue / price);
          
          if (sharesToBuy > 0) {
            const currentPercentage = currentValue > 0 ? (currentValue / currentTotalValue) * 100 : 0;
            
            suggestions.push({
              symbol,
              action: 'Buy',
              shares: sharesToBuy,
              value: (sharesToBuy * price).toFixed(2),
              category: categories.find(cat => cat.id === stockCategories[symbol])?.name || 'Uncategorized',
              currentPercentage: currentPercentage.toFixed(2),
              targetPercentage: percentage.toFixed(2),
              deviation: (currentPercentage - percentage).toFixed(2)
            });
          }
        }
      }
    });
    
    // Sort by action (buys first) then by value (highest first)
    return suggestions.sort((a, b) => {
      if (a.action !== b.action) {
        return a.action === 'Buy' ? -1 : 1;
      }
      return parseFloat(b.value) - parseFloat(a.value);
    });
  }, [accounts, categories, modelPortfolios, selectedModelPortfolio, stockCategories, stockPrices, totalPortfolioValue, calculateDeviations]);

  // Generate buy-only rebalancing suggestions
  const generateBuyOnlySuggestions = useCallback((investmentAmount) => {
    if (!selectedModelPortfolio || totalPortfolioValue <= 0 || !investmentAmount) return [];
    
    const amount = parseFloat(investmentAmount);
    if (isNaN(amount) || amount <= 0) return [];
    
    const selectedPortfolio = modelPortfolios.find(p => p.name === selectedModelPortfolio);
    if (!selectedPortfolio) return [];
    
    const suggestions = [];
    const futureTotalValue = totalPortfolioValue + amount;
    
    // Get current portfolio stock values and percentages
    const currentStockValues = {};
    
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        
        if (currentStockValues[position.symbol]) {
          currentStockValues[position.symbol].value += value;
          currentStockValues[position.symbol].shares += position.shares;
        } else {
          currentStockValues[position.symbol] = { 
            value, 
            shares: position.shares,
            price,
            percentage: (value / totalPortfolioValue) * 100,
            category: stockCategories[position.symbol] || 'uncategorized'
          };
        }
      });
    });
    
    // First, check which categories are underweight
    const underweightCategories = [];
    categories.forEach(category => {
      const modelAlloc = modelAllocation[category.id] || 0;
      const currentAlloc = currentAllocation[category.id] || 0;
      const deviation = currentAlloc - modelAlloc;
      
      if (deviation < -0.5) { // More than 0.5% underweight
        underweightCategories.push({
          id: category.id,
          name: category.name,
          modelAllocation: modelAlloc,
          currentAllocation: currentAlloc,
          deviation,
          shortfall: ((modelAlloc / 100) * futureTotalValue) - ((currentAlloc / 100) * totalPortfolioValue)
        });
      }
    });
    
    // Check uncategorized
    const uncategorizedModelAlloc = modelAllocation['uncategorized'] || 0;
    const uncategorizedCurrentAlloc = currentAllocation['uncategorized'] || 0;
    const uncategorizedDeviation = uncategorizedCurrentAlloc - uncategorizedModelAlloc;
    
    if (uncategorizedDeviation < -0.5) {
      underweightCategories.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        modelAllocation: uncategorizedModelAlloc,
        currentAllocation: uncategorizedCurrentAlloc,
        deviation: uncategorizedDeviation,
        shortfall: ((uncategorizedModelAlloc / 100) * futureTotalValue) - ((uncategorizedCurrentAlloc / 100) * totalPortfolioValue)
      });
    }
    
    // If no categories are underweight, return empty results
    if (underweightCategories.length === 0) {
      return {suggestions: [], projections: null};
    }
    
    // Calculate total shortfall across all underweight categories
    const totalCategoryShortfall = underweightCategories.reduce((sum, cat) => sum + cat.shortfall, 0);
    
    // Allocate investment amount across underweight categories
    const categoryAllocations = {};
    underweightCategories.forEach(category => {
      const allocationWeight = category.shortfall / totalCategoryShortfall;
      categoryAllocations[category.id] = allocationWeight * amount;
    });
    
    // Create a sorted array of underweight positions, but only in underweight categories
    const underweightPositions = [];
    
    selectedPortfolio.stocks.forEach(modelStock => {
      const { symbol, percentage } = modelStock;
      const categoryId = stockCategories[symbol] || 'uncategorized';
      
      // Only consider stocks in underweight categories
      if (!categoryAllocations[categoryId]) return;
      
      const currentData = currentStockValues[symbol] || { 
        value: 0, 
        shares: 0, 
        price: stockPrices[symbol] || 0, 
        percentage: 0,
        category: categoryId
      };
      
      // Skip if price is unknown or zero
      if (currentData.price <= 0) return;
      
      // Calculate the target value based on future total portfolio value
      const targetFutureValue = (percentage / 100) * futureTotalValue;
      const currentDeviation = currentData.percentage - percentage;
      
      // Include positions from underweight categories
      underweightPositions.push({
        symbol,
        currentValue: currentData.value,
        targetFutureValue,
        shortfall: targetFutureValue - currentData.value,
        price: currentData.price,
        deviation: currentDeviation,
        modelPercentage: percentage,
        currentPercentage: currentData.percentage,
        category: categoryId
      });
    });
    
    // Sort by highest deviation within each category (most underweight first)
    underweightPositions.sort((a, b) => a.deviation - b.deviation);
    
    // Project future allocations after buy-only rebalancing
    const projectedStockValues = {};
    Object.keys(currentStockValues).forEach(symbol => {
      projectedStockValues[symbol] = {...currentStockValues[symbol]};
    });
    
    // Distribute the investment amount by category
    const remainingCategoryAmount = {...categoryAllocations};
    
    // Process each category separately
    Object.entries(categoryAllocations).forEach(([categoryId, categoryAmount]) => {
      // Filter positions for this category
      const categoryPositions = underweightPositions.filter(p => p.category === categoryId);
      
      if (categoryPositions.length === 0) return;
      
      // Calculate total shortfall for this category
      const totalPositionShortfall = categoryPositions.reduce((sum, pos) => sum + pos.shortfall, 0);
      
      // Distribute investment for this category
      let remainingAmount = categoryAmount;
      
      categoryPositions.forEach(position => {
        // Calculate allocation based on proportional shortfall within the category
        const allocationWeight = position.shortfall / totalPositionShortfall;
        let allocationAmount = Math.min(allocationWeight * categoryAmount, position.shortfall, remainingAmount);
        
        // Round down to nearest whole share
        const sharesToBuy = Math.floor(allocationAmount / position.price);
        const actualAmount = sharesToBuy * position.price;
        
        if (sharesToBuy > 0 && actualAmount > 0) {
          remainingAmount -= actualAmount;
          remainingCategoryAmount[categoryId] -= actualAmount;
          
          // Update projected stock values
          if (projectedStockValues[position.symbol]) {
            projectedStockValues[position.symbol].value += actualAmount;
            projectedStockValues[position.symbol].shares += sharesToBuy;
          } else {
            projectedStockValues[position.symbol] = {
              value: actualAmount,
              shares: sharesToBuy,
              price: position.price,
              percentage: 0, // Will calculate after all purchases
              category: position.category
            };
          }
          
          // Add to suggestions
          const categoryName = categories.find(c => c.id === position.category)?.name || 'Uncategorized';
          
          suggestions.push({
            symbol: position.symbol,
            shares: sharesToBuy,
            value: actualAmount.toFixed(2),
            price: String(position.price),
            category: categoryName,
            currentPercentage: position.currentPercentage.toFixed(2),
            targetPercentage: position.modelPercentage.toFixed(2),
            deviation: position.deviation.toFixed(2),
            allocationPercent: ((actualAmount / amount) * 100).toFixed(1),
            categoryId: position.category
          });
        }
      });
      
      // If there's still money left in this category, allocate to the most underweight position
      if (remainingAmount > 50 && categoryPositions.length > 0) {
        const mostUnderweight = categoryPositions[0];
        const additionalShares = Math.floor(remainingAmount / mostUnderweight.price);
        
        if (additionalShares > 0) {
          const actualAmount = additionalShares * mostUnderweight.price;
          const categoryName = categories.find(c => c.id === mostUnderweight.category)?.name || 'Uncategorized';
          
          // Update projected stock values
          if (projectedStockValues[mostUnderweight.symbol]) {
            projectedStockValues[mostUnderweight.symbol].value += actualAmount;
            projectedStockValues[mostUnderweight.symbol].shares += additionalShares;
          } else {
            projectedStockValues[mostUnderweight.symbol] = {
              value: actualAmount,
              shares: additionalShares,
              price: mostUnderweight.price,
              percentage: 0, // Will calculate after all purchases
              category: mostUnderweight.category
            };
          }
          
          const existingSuggestion = suggestions.find(s => s.symbol === mostUnderweight.symbol);
          
          if (existingSuggestion) {
            // Update existing suggestion
            existingSuggestion.shares += additionalShares;
            const newValue = parseFloat(existingSuggestion.value) + actualAmount;
            existingSuggestion.value = newValue.toFixed(2);
            existingSuggestion.allocationPercent = ((newValue / amount) * 100).toFixed(1);
          } else {
            // Create new suggestion
            suggestions.push({
              symbol: mostUnderweight.symbol,
              shares: additionalShares,
              value: actualAmount.toFixed(2),
              price: String(mostUnderweight.price),
              category: categoryName,
              currentPercentage: mostUnderweight.currentPercentage.toFixed(2),
              targetPercentage: mostUnderweight.modelPercentage.toFixed(2),
              deviation: mostUnderweight.deviation.toFixed(2),
              allocationPercent: ((actualAmount / amount) * 100).toFixed(1),
              categoryId: mostUnderweight.category
            });
          }
          
          // Update remaining amounts
          remainingAmount -= actualAmount;
          remainingCategoryAmount[categoryId] -= actualAmount;
        }
      }
    });
    
    // Calculate projected percentages after purchases
    Object.keys(projectedStockValues).forEach(symbol => {
      projectedStockValues[symbol].percentage = (projectedStockValues[symbol].value / futureTotalValue) * 100;
    });
    
    // Add projected allocation data to each suggestion
    suggestions.forEach(suggestion => {
      const symbol = suggestion.symbol;
      if (projectedStockValues[symbol]) {
        suggestion.projectedPercentage = projectedStockValues[symbol].percentage.toFixed(2);
        suggestion.projectedDeviation = (projectedStockValues[symbol].percentage - parseFloat(suggestion.targetPercentage)).toFixed(2);
      }
    });
    
    // Add the projected allocation by category
    const projectedCategoryAllocation = {};
    categories.forEach(category => {
      projectedCategoryAllocation[category.id] = 0;
    });
    projectedCategoryAllocation['uncategorized'] = 0;
    
    Object.entries(projectedStockValues).forEach(([symbol, data]) => {
      const categoryId = data.category || stockCategories[symbol] || 'uncategorized';
      projectedCategoryAllocation[categoryId] = (projectedCategoryAllocation[categoryId] || 0) + data.percentage;
    });
    
    // Store this for display in a separate state variable
    const projectionsData = {
      categoryAllocation: projectedCategoryAllocation,
      deviations: calculateDeviations(modelAllocation, projectedCategoryAllocation),
      totalValue: futureTotalValue
    };
    
    // Return both suggestions and projected allocations
    return {suggestions, projections: projectionsData};
  }, [accounts, categories, currentAllocation, modelAllocation, modelPortfolios, selectedModelPortfolio, stockCategories, stockPrices, totalPortfolioValue, calculateDeviations]);

  // Update calculations when model portfolio selection changes
  useEffect(() => {
    if (selectedModelPortfolio) {
      const model = calculateModelAllocation(selectedModelPortfolio);
      const current = calculateCurrentAllocation();
      
      setModelAllocation(model);
      setCurrentAllocation(current);
      setSimulatedAllocation(current);
      const newDeviations = calculateDeviations(model, current);
      setDeviations(newDeviations);
      setSimulatedDeviations(newDeviations);
      setWhatIfDirty(false);
    }
  }, [selectedModelPortfolio, calculateModelAllocation, calculateCurrentAllocation, calculateDeviations]);

  // Update rebalance actions when deviations change
  useEffect(() => {
    if (selectedModelPortfolio && Object.keys(deviations).length > 0) {
      const suggestions = generateRebalanceSuggestions();
      setRebalanceActions(suggestions);
      
      // Only calculate simulated allocation if sell-buy rebalancing is shown
      if (showSellBuyRebalancing) {
        // Calculate simulated allocation after applying all trades
        const categoryValues = {};
        let newTotalValue = totalPortfolioValue;
        
        // Initialize category values based on current allocation
        Object.keys(currentAllocation).forEach(categoryId => {
          categoryValues[categoryId] = (currentAllocation[categoryId] / 100) * totalPortfolioValue;
        });
        
        // First apply all sell trades (they affect the total value)
        suggestions.forEach(suggestion => {
          if (suggestion.action.startsWith('SELL')) {
            const categoryName = suggestion.category;
            const categoryId = categories.find(c => c.name === categoryName)?.id || 'uncategorized';
            const amount = suggestion.amount;
            
            // Reduce category value and total value
            categoryValues[categoryId] = Math.max(0, categoryValues[categoryId] - amount);
            newTotalValue -= amount;
          }
        });
        
        // Then apply all buy trades
        suggestions.forEach(suggestion => {
          if (suggestion.action.startsWith('BUY')) {
            const categoryName = suggestion.category;
            const categoryId = categories.find(c => c.name === categoryName)?.id || 'uncategorized';
            const amount = suggestion.amount;
            
            // Increase category value and total value
            categoryValues[categoryId] = (categoryValues[categoryId] || 0) + amount;
            newTotalValue += amount;
          }
        });
        
        // Calculate new percentages based on final total value
        const simulatedCategoryValues = {};
        if (newTotalValue > 0) {
          Object.keys(categoryValues).forEach(categoryId => {
            simulatedCategoryValues[categoryId] = (categoryValues[categoryId] / newTotalValue) * 100;
          });
        }
        
        // Calculate new deviations
        const newDeviations = calculateDeviations(modelAllocation, simulatedCategoryValues);
        
        setSimulatedAllocation(simulatedCategoryValues);
        setSimulatedDeviations(newDeviations);
      }
    }
  }, [deviations, totalPortfolioValue, selectedModelPortfolio, categories, modelAllocation, calculateDeviations, currentAllocation, showSellBuyRebalancing]);
  
  // Memoize generateRebalanceSuggestions and generateSpecificSuggestions
  const memoizedGenerateRebalanceSuggestions = useCallback(() => {
    return generateRebalanceSuggestions();
  }, [selectedModelPortfolio, totalPortfolioValue, deviations, accounts, categories, modelPortfolios, stockCategories, stockPrices]);
  
  const memoizedGenerateSpecificSuggestions = useCallback(() => {
    return generateSpecificSuggestions();
  }, [accounts, categories, modelPortfolios, selectedModelPortfolio, stockCategories, stockPrices, totalPortfolioValue, calculateDeviations]);
  
  // Calculate buy-only rebalancing suggestions when investment amount changes
  useEffect(() => {
    if (showBuyOnlyRebalancing && newInvestmentAmount) {
      const { suggestions, projections } = generateBuyOnlySuggestions(newInvestmentAmount);
      setBuyOnlySuggestions(suggestions);
      
      // Initialize all suggestions as selected
      const initialSelections = {};
      suggestions.forEach((suggestion, index) => {
        initialSelections[index] = true;
      });
      setSelectedTrades(initialSelections);
      setRecalculatedSuggestions(suggestions);
      
      if (projections) {
        setSimulatedAllocation(projections.categoryAllocation);
        setSimulatedDeviations(projections.deviations);
      }
    }
  }, [newInvestmentAmount, showBuyOnlyRebalancing, generateBuyOnlySuggestions]);

  // Handle changes in buy-only trade selection
  const handleTradeSelectionChange = (index, checked) => {
    const newSelectedTrades = { ...selectedTrades, [index]: checked };
    setSelectedTrades(newSelectedTrades);
    
    // Filter to only selected trades
    const selectedSuggestions = buyOnlySuggestions.filter((_, i) => newSelectedTrades[i]);
    
    // If we have at least one selected trade, reallocate funds
    if (selectedSuggestions.length > 0) {
      const recalculatedSuggestions = reallocateRemainingFunds(selectedSuggestions);
      setRecalculatedSuggestions(recalculatedSuggestions);
      
      // Update each suggestion's projected values based on recalculated data
      updateSuggestionProjections(recalculatedSuggestions);
      
      // Recalculate overall projections for the portfolio
      recalculateProjectionsForSelectedTrades(recalculatedSuggestions);
    } else {
      // No selections, reset to empty
      setRecalculatedSuggestions([]);
      setSimulatedAllocation(currentAllocation);
      setSimulatedDeviations(deviations);
    }
  };
  
  // Update projected allocation percentages for each suggestion
  const updateSuggestionProjections = (suggestions) => {
    if (suggestions.length === 0) return suggestions;
    
    const amount = parseFloat(newInvestmentAmount);
    if (isNaN(amount) || amount <= 0) return suggestions;
    
    const futureTotalValue = totalPortfolioValue + suggestions.reduce(
      (sum, s) => sum + parseFloat(s.value), 0
    );
    
    // Get current portfolio stock values with projections
    const projectedStockValues = {};
    
    // Initialize with current values
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        
        if (projectedStockValues[position.symbol]) {
          projectedStockValues[position.symbol].value += value;
          projectedStockValues[position.symbol].shares += position.shares;
        } else {
          projectedStockValues[position.symbol] = { 
            value, 
            shares: position.shares,
            price,
            percentage: 0,
            category: stockCategories[position.symbol] || 'uncategorized'
          };
        }
      });
    });
    
    // Add selected trades to projected values
    suggestions.forEach(suggestion => {
      const symbol = suggestion.symbol;
      const price = parseFloat(suggestion.price);
      const shares = suggestion.shares;
      const value = price * shares;
      
      if (projectedStockValues[symbol]) {
        projectedStockValues[symbol].value += value;
        projectedStockValues[symbol].shares += shares;
      } else {
        projectedStockValues[symbol] = {
          value,
          shares,
          price,
          percentage: 0,
          category: suggestion.categoryId
        };
      }
    });
    
    // Calculate projected percentages for each stock
    Object.keys(projectedStockValues).forEach(symbol => {
      projectedStockValues[symbol].percentage = 
        (projectedStockValues[symbol].value / futureTotalValue) * 100;
    });
    
    // Update each suggestion with its new projected percentage
    const updatedSuggestions = [...suggestions];
    updatedSuggestions.forEach(suggestion => {
      const symbol = suggestion.symbol;
      if (projectedStockValues[symbol]) {
        suggestion.projectedPercentage = projectedStockValues[symbol].percentage.toFixed(2);
        suggestion.projectedDeviation = (
          projectedStockValues[symbol].percentage - parseFloat(suggestion.targetPercentage)
        ).toFixed(2);
      }
    });
    
    return updatedSuggestions;
  };
  
  // Reallocate unused funds to remaining selected trades
  const reallocateRemainingFunds = (selectedSuggestions) => {
    if (selectedSuggestions.length === 0) return [];
    
    const amount = parseFloat(newInvestmentAmount);
    if (isNaN(amount) || amount <= 0) return selectedSuggestions;
    
    // Sum up currently allocated funds
    const currentlyAllocated = selectedSuggestions.reduce((sum, s) => sum + parseFloat(s.value), 0);
    
    // Calculate how much is still available to allocate
    const remainingFunds = amount - currentlyAllocated;
    
    // If nothing to reallocate or only one suggestion, return original
    if (remainingFunds <= 0 || selectedSuggestions.length === 0) {
      return updateSuggestionProjections(selectedSuggestions);
    }
    
    // Create a deep copy of selected suggestions
    const enhancedSuggestions = JSON.parse(JSON.stringify(selectedSuggestions));
    
    // Group by category to maintain category allocation strategy
    const suggestionsByCategory = {};
    enhancedSuggestions.forEach(suggestion => {
      if (!suggestionsByCategory[suggestion.categoryId]) {
        suggestionsByCategory[suggestion.categoryId] = [];
      }
      suggestionsByCategory[suggestion.categoryId].push(suggestion);
    });
    
    // Calculate shortfall by category
    const categoryShortfall = {};
    let totalShortfall = 0;
    
    Object.entries(suggestionsByCategory).forEach(([categoryId, suggestions]) => {
      // Find original category's allocation amount
      const categoryForId = categories.find(c => c.id === categoryId) || { name: 'Uncategorized' };
      const underweightCategory = findUnderweightCategory(categoryId, categoryForId.name);
      
      if (underweightCategory) {
        const originalAllocation = underweightCategory.shortfall;
        const currentlyUsed = suggestions.reduce((sum, s) => sum + parseFloat(s.value), 0);
        const shortfall = Math.max(0, originalAllocation - currentlyUsed);
        
        categoryShortfall[categoryId] = shortfall;
        totalShortfall += shortfall;
      }
    });
    
    // If no shortfall or no categories to allocate to, return original
    if (totalShortfall <= 0) {
      return updateSuggestionProjections(enhancedSuggestions);
    }
    
    // Distribute remaining funds proportionally based on category shortfall
    const categoryAllocation = {};
    Object.entries(categoryShortfall).forEach(([categoryId, shortfall]) => {
      const allocationWeight = shortfall / totalShortfall;
      categoryAllocation[categoryId] = Math.min(allocationWeight * remainingFunds, shortfall);
    });
    
    // Add additional shares to each position based on category allocation
    Object.entries(suggestionsByCategory).forEach(([categoryId, suggestions]) => {
      const additionalFunds = categoryAllocation[categoryId] || 0;
      
      if (additionalFunds <= 0 || suggestions.length === 0) return;
      
      // Sort by most underweight first (lowest deviation)
      suggestions.sort((a, b) => parseFloat(a.deviation) - parseFloat(b.deviation));
      
      // For each position in the category, try to add more shares
      let remainingCategoryFunds = additionalFunds;
      let positionIndex = 0;
      
      while (remainingCategoryFunds > 0 && positionIndex < suggestions.length) {
        const suggestion = suggestions[positionIndex];
        const price = parseFloat(suggestion.price);
        
        if (price > 0 && remainingCategoryFunds >= price) {
          // Calculate how many additional shares we can buy
          const additionalShares = Math.floor(remainingCategoryFunds / price);
          
          if (additionalShares > 0) {
            const additionalValue = additionalShares * price;
            remainingCategoryFunds -= additionalValue;
            
            // Update the suggestion
            suggestion.shares += additionalShares;
            suggestion.value = (parseFloat(suggestion.value) + additionalValue).toFixed(2);
            
            // Update allocation percentage
            const newAllocationPercent = (parseFloat(suggestion.value) / amount) * 100;
            suggestion.allocationPercent = newAllocationPercent.toFixed(1);
          }
        }
        
        positionIndex++;
        
        // If we've gone through all positions but still have funds, start again
        if (positionIndex >= suggestions.length && remainingCategoryFunds >= Math.min(...suggestions.map(s => parseFloat(s.price)))) {
          positionIndex = 0;
        } else if (positionIndex >= suggestions.length) {
          break;
        }
      }
    });
    
    // Calculate and update projected percentages
    return updateSuggestionProjections(enhancedSuggestions);
  };
  
  // Helper function to find underweight category information
  const findUnderweightCategory = (categoryId, categoryName) => {
    const modelAlloc = modelAllocation[categoryId] || 0;
    const currentAlloc = currentAllocation[categoryId] || 0;
    const deviation = currentAlloc - modelAlloc;
    
    if (deviation < -0.5) {
      const futureTotalValue = totalPortfolioValue + parseFloat(newInvestmentAmount);
      return {
        id: categoryId,
        name: categoryName,
        modelAllocation: modelAlloc,
        currentAllocation: currentAlloc,
        deviation,
        shortfall: ((modelAlloc / 100) * futureTotalValue) - ((currentAlloc / 100) * totalPortfolioValue)
      };
    }
    
    return null;
  };
  
  // Recalculate projected allocations based on selected trades
  const recalculateProjectionsForSelectedTrades = (selectedSuggestions) => {
    if (!selectedModelPortfolio || selectedSuggestions.length === 0) {
      // Reset to current allocation if no selections
      setSimulatedAllocation(currentAllocation);
      setSimulatedDeviations(deviations);
      return;
    }
    
    const amount = parseFloat(newInvestmentAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    const futureTotalValue = totalPortfolioValue + selectedSuggestions.reduce(
      (sum, s) => sum + parseFloat(s.value), 0
    );
    
    // Get current portfolio stock values
    const projectedStockValues = {};
    
    // Initialize with current values
    accounts.forEach(account => {
      account.positions.forEach(position => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        
        if (projectedStockValues[position.symbol]) {
          projectedStockValues[position.symbol].value += value;
          projectedStockValues[position.symbol].shares += position.shares;
        } else {
          projectedStockValues[position.symbol] = { 
            value, 
            shares: position.shares,
            price,
            percentage: 0, // Will calculate after adding purchases
            category: stockCategories[position.symbol] || 'uncategorized'
          };
        }
      });
    });
    
    // Add selected trades to projected values
    selectedSuggestions.forEach(suggestion => {
      const symbol = suggestion.symbol;
      const price = parseFloat(suggestion.price);
      const shares = suggestion.shares;
      const value = price * shares;
      
      if (projectedStockValues[symbol]) {
        projectedStockValues[symbol].value += value;
        projectedStockValues[symbol].shares += shares;
      } else {
        projectedStockValues[symbol] = {
          value,
          shares,
          price,
          percentage: 0, // Will calculate below
          category: suggestion.categoryId
        };
      }
    });
    
    // Calculate projected percentages
    Object.keys(projectedStockValues).forEach(symbol => {
      projectedStockValues[symbol].percentage = 
        (projectedStockValues[symbol].value / futureTotalValue) * 100;
    });
    
    // Calculate projected allocation by category
    const projectedCategoryAllocation = {};
    categories.forEach(category => {
      projectedCategoryAllocation[category.id] = 0;
    });
    projectedCategoryAllocation['uncategorized'] = 0;
    
    Object.entries(projectedStockValues).forEach(([symbol, data]) => {
      const categoryId = data.category;
      projectedCategoryAllocation[categoryId] = 
        (projectedCategoryAllocation[categoryId] || 0) + data.percentage;
    });
    
    // Update projected deviations
    const newDeviations = calculateDeviations(modelAllocation, projectedCategoryAllocation);
    
    // Update state
    setSimulatedAllocation(projectedCategoryAllocation);
    setSimulatedDeviations(newDeviations);
  };

  // Prepare data for the charts
  const getChartData = (allocations, title) => {
    return {
      labels: categories.map(cat => cat.name).concat(['Uncategorized']),
      datasets: [
        {
          label: title,
          data: categories.map(cat => allocations[cat.id] || 0).concat([allocations['uncategorized'] || 0]),
          backgroundColor: generateColors(categories.length + 1),
          borderWidth: 1,
        },
      ],
    };
  };

  // Modify the export functions
  const prepareJsonExport = () => {
    if (!selectedModelPortfolio) return;
    
    // Get the selected model portfolio object
    const modelPortfolioObj = modelPortfolios.find(p => p.name === selectedModelPortfolio);
    if (!modelPortfolioObj) return;
    
    const data = {
      modelPortfolio: selectedModelPortfolio,
      exportDate: new Date().toISOString(),
      allocations: {
        model: modelAllocation,
        current: currentAllocation,
        deviation: deviations
      },
      rebalanceSuggestions: memoizedGenerateRebalanceSuggestions(),
      currentHoldings: accounts.flatMap(account => {
        return account.positions.map(position => {
          const symbol = position.symbol;
          const price = stockPrices[symbol] || 0;
          const value = position.shares * price;
          const percentage = totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0;
          
          return {
            symbol,
            account: account.name,
            category: categories.find(c => c.id === stockCategories[symbol])?.name || 'Uncategorized',
            shares: position.shares,
            price,
            value,
            percentage
          };
        });
      }),
      modelHoldings: modelPortfolioObj.stocks.map(stock => {
        return {
          symbol: stock.symbol,
          category: categories.find(c => c.id === stockCategories[stock.symbol])?.name || 'Uncategorized',
          percentage: stock.percentage
        };
      })
    };
    
    setJsonExportData(data);
    setShowJsonModal(true);
  };

  const downloadJson = () => {
    if (!jsonExportData) return;
    
    const blob = new Blob([JSON.stringify(jsonExportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-comparison-${selectedModelPortfolio.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowJsonModal(false);
  };

  const prepareCsvExport = () => {
    const suggestions = memoizedGenerateRebalanceSuggestions();
    if (suggestions.length === 0) {
      alert('No rebalancing suggestions available to export.');
      return;
    }
    
    // Calculate shares for each suggestion
    const suggestionsWithShares = suggestions.map(suggestion => {
      const symbol = suggestion.action.split(' ')[1];  // Extract symbol from "BUY AAPL" or "SELL AAPL"
      const shares = symbol && stockPrices[symbol] 
        ? Math.floor(suggestion.amount / stockPrices[symbol])
        : 0;
      return {
        ...suggestion,
        shares,
        symbol
      };
    });
    
    const headers = ['Category', 'Symbol', 'Action', 'Shares', 'Amount', 'Percentage'];
    const csvRows = [
      headers.join(','),
      ...suggestionsWithShares.map(suggestion => {
        return [
          `"${suggestion.category}"`,
          `"${suggestion.symbol || ''}"`,
          `"${suggestion.action}"`,
          suggestion.shares,
          parseFloat(suggestion.amount).toFixed(2),
          suggestion.percent
        ].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    setCsvExportData(csvContent);
    setShowCsvModal(true);
  };

  const downloadCsv = () => {
    if (!csvExportData) return;
    
    const blob = new Blob([csvExportData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebalance-suggestions-${selectedModelPortfolio.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowCsvModal(false);
  };

  // Handle exporting buy-only suggestions to CSV
  const exportBuyOnlySuggestionsToCsv = () => {
    if (!selectedModelPortfolio || recalculatedSuggestions.length === 0) {
      alert('No buy-only rebalancing data to export');
      return;
    }
    
    // Helper function to convert array of objects to CSV
    const convertToCSV = (objArray) => {
      const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
      let str = '';
      
      // Add header row
      const headers = Object.keys(array[0]);
      str += headers.join(',') + '\r\n';
      
      // Add data rows
      for (let i = 0; i < array.length; i++) {
        let line = '';
        for (let j = 0; j < headers.length; j++) {
          if (line !== '') line += ',';
          // Wrap values with commas in quotes
          const value = array[i][headers[j]];
          line += typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }
        str += line + '\r\n';
      }
      
      return str;
    };
    
    // Format buy-only data for CSV (only selected trades)
    const buyOnlyData = recalculatedSuggestions.map(item => ({
      Symbol: item.symbol,
      Category: item.category,
      'Shares to Buy': item.shares,
      'Investment Amount': `$${formatNumber(item.value)}`,
      'Percent of New Money': `${item.allocationPercent}%`,
      'Current Allocation': `${item.currentPercentage}%`,
      'Target Allocation': `${item.targetPercentage}%`,
      'Deviation': `${item.deviation}%`
    }));
    
    const csvString = convertToCSV(buyOnlyData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `buy-only-rebalance-${selectedModelPortfolio.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          boxWidth: 12,
          font: {
            size: 11
          },
          padding: 8
        },
        display: true,
        maxWidth: 120
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw.toFixed(2) || 0;
            return `${label}: ${value}%`;
          }
        }
      }
    }
  };

  return (
    <div>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">Portfolio Comparison</h2>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Select Model Portfolio for Comparison</Form.Label>
            <Form.Select
              value={selectedModelPortfolio}
              onChange={(e) => setSelectedModelPortfolio(e.target.value)}
            >
              <option value="">-- Select a model portfolio --</option>
              {modelPortfolios.map((portfolio, index) => (
                <option key={index} value={portfolio.name}>
                  {portfolio.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {selectedModelPortfolio ? (
            <>
              {accounts.length === 0 ? (
                <Alert variant="warning">
                  You need to add accounts and positions to compare with your model portfolio.
                </Alert>
              ) : totalPortfolioValue === 0 ? (
                <Alert variant="warning">
                  Your current portfolio has no value. Please update stock prices or add positions.
                </Alert>
              ) : (
                <>
                  <Row className="mb-4">
                    <Col>
                      <div className="d-flex justify-content-between">
                        <div>
                          <Button 
                            variant={showWhatIfAnalysis ? "secondary" : "info"}
                            size="sm"
                            onClick={() => {
                              setShowWhatIfAnalysis(!showWhatIfAnalysis);
                              if (showBuyOnlyRebalancing) setShowBuyOnlyRebalancing(false);
                              if (showSellBuyRebalancing) setShowSellBuyRebalancing(false);
                            }}
                            className="me-2"
                          >
                            {showWhatIfAnalysis ? "Hide What-If Analysis" : "What-If Analysis"}
                          </Button>
                          <Button 
                            variant={showSellBuyRebalancing ? "secondary" : "info"}
                            size="sm"
                            onClick={() => {
                              setShowSellBuyRebalancing(!showSellBuyRebalancing);
                              if (showWhatIfAnalysis) setShowWhatIfAnalysis(false);
                              if (showBuyOnlyRebalancing) setShowBuyOnlyRebalancing(false);
                              if (!showSellBuyRebalancing) {
                                setSimulatedAllocation(currentAllocation);
                                setSimulatedDeviations(deviations);
                              }
                            }}
                            className="me-2"
                          >
                            {showSellBuyRebalancing ? "Hide Sell-Buy Rebalance" : "Sell-Buy Rebalance"}
                          </Button>
                          <Button 
                            variant={showBuyOnlyRebalancing ? "secondary" : "info"}
                            size="sm"
                            onClick={() => {
                              setShowBuyOnlyRebalancing(!showBuyOnlyRebalancing);
                              if (showWhatIfAnalysis) setShowWhatIfAnalysis(false);
                              if (showSellBuyRebalancing) setShowSellBuyRebalancing(false);
                              if (!showBuyOnlyRebalancing) {
                                // When turning on buy-only rebalancing, reset simulated allocation
                                setNewInvestmentAmount('');
                                setBuyOnlySuggestions([]);
                              } else {
                                // When turning off buy-only rebalancing, reset back to current allocation
                                setSimulatedAllocation(currentAllocation);
                                setSimulatedDeviations(deviations);
                              }
                            }}
                          >
                            {showBuyOnlyRebalancing ? "Hide Buy-Only Rebalancing" : "Buy-Only Rebalancing"}
                          </Button>
                        </div>
                        <div>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-2"
                            onClick={prepareJsonExport}
                          >
                            Export to JSON
                          </Button>
                          <Button 
                            variant="outline-success" 
                            size="sm"
                            onClick={prepareCsvExport}
                          >
                            Export to CSV
                          </Button>
                        </div>
                      </div>
                    </Col>
                  </Row>
                  
                  {showWhatIfAnalysis && (
                    <Card className="mb-4 bg-light">
                      <Card.Body>
                        <h5 className="mb-3">What-If Analysis</h5>
                        <p className="small">
                          Simulate how buying or selling assets in specific categories would change your portfolio allocation.
                        </p>
                        <Row>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Category</Form.Label>
                              <Form.Select
                                value={currentTrade.category}
                                onChange={(e) => setCurrentTrade(prev => ({ ...prev, category: e.target.value }))}
                              >
                                <option value="">Select category</option>
                                {categories.map(category => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                                <option value="uncategorized">Uncategorized</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={2}>
                            <Form.Group className="mb-3">
                              <Form.Label>Action</Form.Label>
                              <Form.Select
                                value={currentTrade.action}
                                onChange={(e) => setCurrentTrade(prev => ({ ...prev, action: e.target.value }))}
                              >
                                <option value="buy">Buy</option>
                                <option value="sell">Sell</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>Amount ($)</Form.Label>
                              <InputGroup>
                                <InputGroup.Text>$</InputGroup.Text>
                                <Form.Control
                                  type="number"
                                  placeholder="e.g., 10000"
                                  value={currentTrade.amount}
                                  onChange={(e) => setCurrentTrade(prev => ({ ...prev, amount: e.target.value }))}
                                  min="0"
                                  step="100"
                                />
                              </InputGroup>
                            </Form.Group>
                          </Col>
                          <Col md={3} className="d-flex align-items-end mb-3">
                            <Button 
                              variant="primary"
                              size="sm"
                              onClick={addTrade}
                              disabled={!currentTrade.category || !currentTrade.amount}
                              className="me-2"
                            >
                              Add Trade
                            </Button>
                            <Button 
                              variant="outline-secondary" 
                              size="sm"
                              onClick={resetSimulation}
                            >
                              Reset All
                            </Button>
                          </Col>
                        </Row>

                        <Row className="mb-3">
                          <Col>
                            <div className="d-flex gap-2">
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => quickAddAmount(10000)}
                              >
                                +$10,000
                              </Button>
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => quickAddAmount(25000)}
                              >
                                +$25,000
                              </Button>
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => quickAddAmount(100000)}
                              >
                                +$100,000
                              </Button>
                            </div>
                          </Col>
                        </Row>

                        {whatIfTrades.length > 0 && (
                          <div className="table-responsive mb-3">
                            <Table striped bordered hover size="sm">
                              <thead>
                                <tr>
                                  <th>Category</th>
                                  <th>Action</th>
                                  <th>Amount</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {whatIfTrades.map((trade, index) => (
                                  <tr key={index}>
                                    <td>{categories.find(c => c.id === trade.category)?.name || 'Uncategorized'}</td>
                                    <td>{trade.action === 'buy' ? 'Buy' : 'Sell'}</td>
                                    <td>${formatNumber(trade.amount)}</td>
                                    <td>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => removeTrade(index)}
                                      >
                                        Remove
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="table-secondary">
                                  <td colSpan="2"><strong>Total Impact</strong></td>
                                  <td colSpan="2">
                                    <strong>
                                      ${formatNumber(
                                        whatIfTrades.reduce((sum, trade) => {
                                          const amount = parseFloat(trade.amount) || 0;
                                          return sum + (trade.action === 'buy' ? amount : -amount);
                                        }, 0)
                                      )}
                                    </strong>
                                  </td>
                                </tr>
                              </tbody>
                            </Table>
                          </div>
                        )}
                        
                        {whatIfDirty && (
                          <Alert variant="info">
                            <strong>Simulation Result:</strong> Your portfolio would be $
                            {formatNumber(
                              totalPortfolioValue + whatIfTrades.reduce((sum, trade) => {
                                const amount = parseFloat(trade.amount) || 0;
                                return sum + (trade.action === 'buy' ? amount : -amount);
                              }, 0)
                            )}
                            {' '}after applying all trades.
                          </Alert>
                        )}
                      </Card.Body>
                    </Card>
                  )}
                  
                  {showSellBuyRebalancing && (
                    <Card className="mb-4 bg-light">
                      <Card.Body>
                        <h5 className="mb-3">Sell-Buy Rebalancing</h5>
                        <p className="small">
                          This shows specific trades needed to rebalance your portfolio by selling overweight positions and buying underweight positions.
                        </p>
                        
                        {rebalanceActions.length > 0 ? (
                          <>
                            <div className="d-flex justify-content-end mb-2">
                              <Button 
                                variant="outline-success" 
                                size="sm"
                                onClick={prepareCsvExport}
                              >
                                Export to CSV
                              </Button>
                            </div>
                            <div className="table-responsive">
                              <Table striped bordered hover size="sm">
                                <thead>
                                  <tr>
                                    <th>Category</th>
                                    <th>Action</th>
                                    <th>Shares</th>
                                    <th>Amount</th>
                                    <th>Percentage</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rebalanceActions.map((suggestion, index) => {
                                    const symbol = suggestion.action.split(' ')[1];  // Extract symbol from "BUY AAPL" or "SELL AAPL"
                                    const shares = symbol && stockPrices[symbol] 
                                      ? Math.floor(suggestion.amount / stockPrices[symbol])
                                      : 0;
                                    
                                    return (
                                      <tr key={index} className={suggestion.action.startsWith('SELL') ? 'table-danger' : 'table-success'}>
                                        <td>{suggestion.category}</td>
                                        <td>{suggestion.action}</td>
                                        <td>{shares}</td>
                                        <td>${formatNumber(suggestion.amount)}</td>
                                        <td>{suggestion.percent}%</td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="table-secondary">
                                    <td colSpan={3}><strong>Total Value</strong></td>
                                    <td colSpan={2}>
                                      <strong>
                                        ${formatNumber(
                                          rebalanceActions.reduce((sum, s) => sum + s.amount, 0)
                                        )}
                                      </strong>
                                    </td>
                                  </tr>
                                </tbody>
                              </Table>
                            </div>
                            <Alert variant="info" className="mt-3">
                              <strong>Note:</strong> The suggestions above show specific trades that will help bring your portfolio closer to the target allocation. Sell trades are listed first, followed by buy trades.
                            </Alert>

                            <h5 className="mt-4 mb-3">Projected Portfolio After Rebalancing</h5>
                            <p className="small">
                              This shows how your portfolio would look after implementing all the suggested sell and buy trades above.
                            </p>
                            
                            <Row>
                              <Col md={6}>
                                <h6 className="text-center mb-3">Model Portfolio</h6>
                                <div className="comparison-chart-container">
                                  <Pie data={getChartData(modelAllocation, 'Model Allocation')} options={chartOptions} />
                                </div>
                              </Col>
                              <Col md={6}>
                                <h6 className="text-center mb-3">Projected Portfolio</h6>
                                <div className="comparison-chart-container">
                                  <Pie 
                                    data={getChartData(simulatedAllocation, 'Projected Allocation')} 
                                    options={chartOptions} 
                                  />
                                </div>
                              </Col>
                            </Row>

                            <h6 className="mt-4 mb-2">Projected Allocation Comparison</h6>
                            <div className="table-responsive">
                              <Table striped bordered hover size="sm" className="comparison-table">
                                <thead>
                                  <tr>
                                    <th>Category</th>
                                    <th>Model Allocation</th>
                                    <th>Current Allocation</th>
                                    <th>Projected Allocation</th>
                                    <th>Current Difference</th>
                                    <th>Projected Difference</th>
                                    <th>Improvement</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {categories.map(category => {
                                    const modelAlloc = modelAllocation[category.id] || 0;
                                    const currentAlloc = currentAllocation[category.id] || 0;
                                    const projectedAlloc = simulatedAllocation[category.id] || 0;
                                    const currentDiff = deviations[category.id] || 0;
                                    const projectedDiff = simulatedDeviations[category.id] || 0;
                                    const improvement = Math.abs(currentDiff) - Math.abs(projectedDiff);
                                    const rowClass = Math.abs(projectedDiff) < Math.abs(currentDiff) ? 'table-success' : '';

                                    return (
                                      <tr key={category.id} className={rowClass}>
                                        <td>{category.name}</td>
                                        <td>{formatNumber(modelAlloc)}%</td>
                                        <td>{formatNumber(currentAlloc)}%</td>
                                        <td>{formatNumber(projectedAlloc)}%</td>
                                        <td>{currentDiff > 0 ? '+' : ''}{formatNumber(currentDiff)}%</td>
                                        <td>{projectedDiff > 0 ? '+' : ''}{formatNumber(projectedDiff)}%</td>
                                        <td className={improvement > 0 ? 'text-success' : (improvement < 0 ? 'text-danger' : '')}>
                                          {improvement > 0 ? '+' : ''}{formatNumber(improvement)}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr className={Math.abs(simulatedDeviations['uncategorized'] || 0) < Math.abs(deviations['uncategorized'] || 0) ? 'table-success' : ''}>
                                    <td>Uncategorized</td>
                                    <td>{formatNumber(modelAllocation['uncategorized'] || 0)}%</td>
                                    <td>{formatNumber(currentAllocation['uncategorized'] || 0)}%</td>
                                    <td>{formatNumber(simulatedAllocation['uncategorized'] || 0)}%</td>
                                    <td>
                                      {(deviations['uncategorized'] || 0) > 0 ? '+' : ''}
                                      {formatNumber(deviations['uncategorized'] || 0)}%
                                    </td>
                                    <td>
                                      {(simulatedDeviations['uncategorized'] || 0) > 0 ? '+' : ''}
                                      {formatNumber(simulatedDeviations['uncategorized'] || 0)}%
                                    </td>
                                    <td className={(Math.abs(deviations['uncategorized'] || 0) - Math.abs(simulatedDeviations['uncategorized'] || 0)) > 0 ? 'text-success' : 'text-danger'}>
                                      {(Math.abs(deviations['uncategorized'] || 0) - Math.abs(simulatedDeviations['uncategorized'] || 0)) > 0 ? '+' : ''}
                                      {formatNumber(Math.abs(deviations['uncategorized'] || 0) - Math.abs(simulatedDeviations['uncategorized'] || 0))}%
                                    </td>
                                  </tr>
                                </tbody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <Alert variant="warning">
                            No rebalancing suggestions could be generated. This may be because:
                            <ul className="mb-0 mt-2">
                              <li>Your portfolio is already well-balanced</li>
                              <li>Stock price information is missing</li>
                              <li>The deviations are too small to warrant trades</li>
                            </ul>
                          </Alert>
                        )}
                      </Card.Body>
                    </Card>
                  )}
                  
                  {showBuyOnlyRebalancing && (
                    <Card className="mb-4 bg-light">
                      <Card.Body>
                        <h5 className="mb-3">Buy-Only Rebalancing</h5>
                        <p className="small">
                          This strategy helps you rebalance toward your target allocation using only new money, without selling any positions.
                        </p>
                        <Row className="align-items-end">
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>New Investment Amount ($)</Form.Label>
                              <InputGroup>
                                <InputGroup.Text>$</InputGroup.Text>
                                <Form.Control
                                  type="number"
                                  placeholder="e.g., 10000"
                                  value={newInvestmentAmount}
                                  onChange={(e) => setNewInvestmentAmount(e.target.value)}
                                  min="0"
                                  step="500"
                                />
                              </InputGroup>
                            </Form.Group>
                          </Col>
                          <Col md={6} className="mb-3">
                            <div className="d-flex gap-2">
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => setNewInvestmentAmount(
                                  (parseFloat(newInvestmentAmount) || 0) + 10000
                                )}
                              >
                                +$10,000
                              </Button>
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => setNewInvestmentAmount(
                                  (parseFloat(newInvestmentAmount) || 0) + 25000
                                )}
                              >
                                +$25,000
                              </Button>
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => setNewInvestmentAmount(
                                  (parseFloat(newInvestmentAmount) || 0) + 100000
                                )}
                              >
                                +$100,000
                              </Button>
                              <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => setNewInvestmentAmount('')}
                              >
                                Reset
                              </Button>
                            </div>
                          </Col>
                        </Row>
                        
                        {buyOnlySuggestions.length > 0 && (
                          <>
                            <p className="mb-3">
                              <strong>Investment Distribution: </strong>
                              Showing how to allocate ${formatNumber(newInvestmentAmount)} across underweight positions to move toward your target allocation.
                              Select or deselect trades to see how different combinations affect your portfolio allocation.
                            </p>
                            <div className="d-flex justify-content-between mb-2">
                              <div>
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm"
                                  className="me-2"
                                  onClick={() => {
                                    const newSelectedTrades = {};
                                    buyOnlySuggestions.forEach((_, index) => {
                                      newSelectedTrades[index] = true;
                                    });
                                    setSelectedTrades(newSelectedTrades);
                                    
                                    // Use original suggestions when all are selected
                                    const updatedSuggestions = updateSuggestionProjections(buyOnlySuggestions);
                                    setRecalculatedSuggestions(updatedSuggestions);
                                    recalculateProjectionsForSelectedTrades(updatedSuggestions);
                                  }}
                                >
                                  Select All
                                </Button>
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTrades({});
                                    setRecalculatedSuggestions([]);
                                    
                                    // Reset to current allocation when none are selected
                                    setSimulatedAllocation(currentAllocation);
                                    setSimulatedDeviations(deviations);
                                  }}
                                >
                                  Deselect All
                                </Button>
                              </div>
                              <Button 
                                variant="outline-success" 
                                size="sm"
                                onClick={exportBuyOnlySuggestionsToCsv}
                              >
                                Export to CSV
                              </Button>
                            </div>
                            <div className="table-responsive">
                              <Table striped bordered hover size="sm">
                                <thead>
                                  <tr>
                                    <th>Include</th>
                                    <th>Symbol</th>
                                    <th>Category</th>
                                    <th>Shares to Buy</th>
                                    <th>Investment</th>
                                    <th>% of New Money</th>
                                    <th>Current %</th>
                                    <th>Target %</th>
                                    <th>Deviation</th>
                                    <th>Projected %</th>
                                    <th>Projected Deviation</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {buyOnlySuggestions.map((suggestion, index) => {
                                    // Find corresponding recalculated suggestion
                                    const recalculated = selectedTrades[index] 
                                      ? recalculatedSuggestions.find(s => s.symbol === suggestion.symbol)
                                      : null;
                                      
                                    return (
                                      <tr key={index} className={selectedTrades[index] ? '' : 'table-secondary'}>
                                        <td>
                                          <Form.Check
                                            type="checkbox"
                                            checked={selectedTrades[index] || false}
                                            onChange={(e) => handleTradeSelectionChange(index, e.target.checked)}
                                            aria-label={`Select trade for ${suggestion.symbol}`}
                                          />
                                        </td>
                                        <td>
                                          <strong>{suggestion.symbol}</strong>
                                        </td>
                                        <td>{suggestion.category}</td>
                                        <td>{selectedTrades[index] ? (recalculated ? recalculated.shares : suggestion.shares) : "-"}</td>
                                        <td>{selectedTrades[index] ? `$${recalculated ? formatNumber(recalculated.value) : formatNumber(suggestion.value)}` : "-"}</td>
                                        <td>{selectedTrades[index] ? `${recalculated ? recalculated.allocationPercent : suggestion.allocationPercent}%` : "-"}</td>
                                        <td>{suggestion.currentPercentage}%</td>
                                        <td>{suggestion.targetPercentage}%</td>
                                        <td className={parseFloat(suggestion.deviation) < 0 ? 'text-danger' : 'text-success'}>
                                          {suggestion.deviation}%
                                        </td>
                                        <td>
                                          {selectedTrades[index] ? (
                                            recalculated ? recalculated.projectedPercentage : suggestion.projectedPercentage
                                          ) : (
                                            suggestion.currentPercentage
                                          )}%
                                        </td>
                                        <td>
                                          {selectedTrades[index] ? (
                                            <Badge 
                                              bg={parseFloat(recalculated ? recalculated.projectedDeviation : suggestion.projectedDeviation) > 0 ? "warning" : "info"}
                                            >
                                              {parseFloat(recalculated ? recalculated.projectedDeviation : suggestion.projectedDeviation) > 0 ? "+" : ""}
                                              {recalculated ? recalculated.projectedDeviation : suggestion.projectedDeviation}%
                                            </Badge>
                                          ) : (
                                            <Badge 
                                              bg={parseFloat(suggestion.deviation) > 0 ? "warning" : "info"}
                                            >
                                              {suggestion.deviation}%
                                            </Badge>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="table-secondary">
                                    <td colSpan={3}><strong>Selected Total</strong></td>
                                    <td>
                                      <strong>
                                        ${formatNumber(
                                          recalculatedSuggestions.reduce((sum, s) => sum + parseFloat(s.value), 0)
                                        )}
                                      </strong>
                                    </td>
                                    <td>
                                      <strong>
                                        {formatNumber(
                                          recalculatedSuggestions.reduce((sum, s) => sum + parseFloat(s.allocationPercent), 0)
                                        )}%
                                      </strong>
                                    </td>
                                    <td colSpan={6}></td>
                                  </tr>
                                </tbody>
                              </Table>
                            </div>
                            {recalculatedSuggestions.reduce((sum, s) => sum + parseFloat(s.value), 0) < parseFloat(newInvestmentAmount) && (
                              <Alert variant="info" className="mt-3">
                                <strong>Note:</strong> ${formatNumber(parseFloat(newInvestmentAmount) - recalculatedSuggestions.reduce((sum, s) => sum + parseFloat(s.value), 0))} of your investment amount is unused based on your selected trades.
                              </Alert>
                            )}
                            
                            {recalculatedSuggestions.length > 0 && 
                             Object.values(selectedTrades).includes(false) && 
                             Math.abs(recalculatedSuggestions.reduce((sum, s) => sum + parseFloat(s.value), 0) - parseFloat(newInvestmentAmount)) < 1 && (
                              <Alert variant="success" className="mt-3">
                                <strong>Reallocation:</strong> The investment amount has been automatically reallocated among your selected trades to maximize portfolio balance.
                              </Alert>
                            )}
                            
                            <h5 className="mt-4 mb-3">Projected Portfolio After Rebalancing</h5>
                            <p className="small">
                              This shows how your portfolio would look after implementing the buy-only rebalancing strategy with ${formatNumber(newInvestmentAmount)} in new investments.
                            </p>
                            
                            <Row>
                              <Col md={6}>
                                <h6 className="text-center mb-3">Model Portfolio</h6>
                                <div className="comparison-chart-container">
                                  <Pie data={getChartData(modelAllocation, 'Model Allocation')} options={chartOptions} />
                                </div>
                              </Col>
                              <Col md={6}>
                                <h6 className="text-center mb-3">Projected Portfolio</h6>
                                <div className="comparison-chart-container">
                                  <Pie 
                                    data={getChartData(simulatedAllocation, 'Projected Allocation')} 
                                    options={chartOptions} 
                                  />
                                </div>
                              </Col>
                            </Row>
                            
                            <h6 className="mt-4 mb-2">Projected Allocation Comparison</h6>
                            <div className="table-responsive">
                              <Table striped bordered hover size="sm" className="comparison-table">
                                <thead>
                                  <tr>
                                    <th>Category</th>
                                    <th>Model Allocation</th>
                                    <th>Current Allocation</th>
                                    <th>Projected Allocation</th>
                                    <th>Current Difference</th>
                                    <th>Projected Difference</th>
                                    <th>Improvement</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {categories.map(category => {
                                    const modelAlloc = modelAllocation[category.id] || 0;
                                    const currentAlloc = currentAllocation[category.id] || 0;
                                    const projectedAlloc = simulatedAllocation[category.id] || 0;
                                    const currentDiff = deviations[category.id] || 0;
                                    const projectedDiff = simulatedDeviations[category.id] || 0;
                                    const improvement = Math.abs(currentDiff) - Math.abs(projectedDiff);
                                    const rowClass = Math.abs(projectedDiff) < Math.abs(currentDiff) ? 'table-success' : '';

                                    return (
                                      <tr key={category.id} className={rowClass}>
                                        <td>{category.name}</td>
                                        <td>{formatNumber(modelAlloc)}%</td>
                                        <td>{formatNumber(currentAlloc)}%</td>
                                        <td>{formatNumber(projectedAlloc)}%</td>
                                        <td>{currentDiff > 0 ? '+' : ''}{formatNumber(currentDiff)}%</td>
                                        <td>{projectedDiff > 0 ? '+' : ''}{formatNumber(projectedDiff)}%</td>
                                        <td className={improvement > 0 ? 'text-success' : (improvement < 0 ? 'text-danger' : '')}>
                                          {improvement > 0 ? '+' : ''}{formatNumber(improvement)}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr className={Math.abs(simulatedDeviations['uncategorized'] || 0) < Math.abs(deviations['uncategorized'] || 0) ? 'table-success' : ''}>
                                    <td>Uncategorized</td>
                                    <td>{formatNumber(modelAllocation['uncategorized'] || 0)}%</td>
                                    <td>{formatNumber(currentAllocation['uncategorized'] || 0)}%</td>
                                    <td>{formatNumber(simulatedAllocation['uncategorized'] || 0)}%</td>
                                    <td>
                                      {(deviations['uncategorized'] || 0) > 0 ? '+' : ''}
                                      {formatNumber(deviations['uncategorized'] || 0)}%
                                    </td>
                                    <td>
                                      {(simulatedDeviations['uncategorized'] || 0) > 0 ? '+' : ''}
                                      {formatNumber(simulatedDeviations['uncategorized'] || 0)}%
                                    </td>
                                    <td className={(Math.abs(deviations['uncategorized'] || 0) - Math.abs(simulatedDeviations['uncategorized'] || 0)) > 0 ? 'text-success' : 'text-danger'}>
                                      {(Math.abs(deviations['uncategorized'] || 0) - Math.abs(simulatedDeviations['uncategorized'] || 0)) > 0 ? '+' : ''}
                                      {formatNumber(Math.abs(deviations['uncategorized'] || 0) - Math.abs(simulatedDeviations['uncategorized'] || 0))}%
                                    </td>
                                  </tr>
                                </tbody>
                              </Table>
                            </div>
                          </>
                        )}
                        
                        {newInvestmentAmount && buyOnlySuggestions.length === 0 && (
                          <Alert variant="warning">
                            No buy-only rebalancing suggestions could be generated. This may be because:
                            <ul className="mb-0 mt-2">
                              <li>Your portfolio is already well-balanced</li>
                              <li>The investment amount is too small to purchase any shares</li>
                              <li>Stock price information is missing for underweight assets</li>
                            </ul>
                          </Alert>
                        )}
                      </Card.Body>
                    </Card>
                  )}
                
                  <Row>
                    <Col md={6}>
                      <h5 className="text-center mb-3">Model Portfolio</h5>
                      <div className="comparison-chart-container">
                        <Pie data={getChartData(modelAllocation, 'Model Allocation')} options={chartOptions} />
                      </div>
                    </Col>
                    <Col md={6}>
                      <h5 className="text-center mb-3">{whatIfDirty ? 'Simulated Portfolio' : 'Current Portfolio'}</h5>
                      <div className="comparison-chart-container">
                        <Pie 
                          data={getChartData(
                            whatIfDirty ? simulatedAllocation : currentAllocation, 
                            whatIfDirty ? 'Simulated Allocation' : 'Current Allocation'
                          )} 
                          options={chartOptions} 
                        />
                      </div>
                    </Col>
                  </Row>

                  <h5 className="mt-4 mb-3">Allocation Comparison</h5>
                  <div className="table-responsive">
                    <Table striped bordered hover className="comparison-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Model Allocation</th>
                          <th>{whatIfDirty ? 'Current' : 'Current'} Allocation</th>
                          {whatIfDirty && <th>Simulated Allocation</th>}
                          <th>{whatIfDirty ? 'Current Difference' : 'Difference'}</th>
                          {whatIfDirty && <th>Simulated Difference</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(category => {
                          const modelAlloc = modelAllocation[category.id] || 0;
                          const currentAlloc = currentAllocation[category.id] || 0;
                          const simulatedAlloc = simulatedAllocation[category.id] || 0;
                          const diff = deviations[category.id] || 0;
                          const simDiff = simulatedDeviations[category.id] || 0;
                          const rowClass = Math.abs(diff) > 5 ? (diff > 0 ? 'table-danger' : 'table-success') : '';
                          const simRowClass = whatIfDirty && Math.abs(simDiff) < Math.abs(diff) ? 'table-success' : '';

                          return (
                            <tr key={category.id} className={whatIfDirty ? simRowClass : rowClass}>
                              <td>{category.name}</td>
                              <td>{formatNumber(modelAlloc)}%</td>
                              <td>{formatNumber(currentAlloc)}%</td>
                              {whatIfDirty && <td>{formatNumber(simulatedAlloc)}%</td>}
                              <td>{diff > 0 ? '+' : ''}{formatNumber(diff)}%</td>
                              {whatIfDirty && <td>{simDiff > 0 ? '+' : ''}{formatNumber(simDiff)}%</td>}
                            </tr>
                          );
                        })}
                        <tr className={Math.abs(simulatedDeviations['uncategorized'] || 0) < Math.abs(deviations['uncategorized'] || 0) ? 'table-success' : ''}>
                          <td>Uncategorized</td>
                          <td>{formatNumber(modelAllocation['uncategorized'] || 0)}%</td>
                          <td>{formatNumber(currentAllocation['uncategorized'] || 0)}%</td>
                          {whatIfDirty && <td>{formatNumber(simulatedAllocation['uncategorized'] || 0)}%</td>}
                          <td>
                            {(deviations['uncategorized'] || 0) > 0 ? '+' : ''}
                            {formatNumber(deviations['uncategorized'] || 0)}%
                          </td>
                          {whatIfDirty && (
                            <td>
                              {(simulatedDeviations['uncategorized'] || 0) > 0 ? '+' : ''}
                              {formatNumber(simulatedDeviations['uncategorized'] || 0)}%
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
            </>
          ) : (
            <Alert variant="info">
              Please select a model portfolio to compare with your current holdings.
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* JSON Export Modal */}
      <Modal show={showJsonModal} onHide={() => setShowJsonModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>JSON Export Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {jsonExportData ? JSON.stringify(jsonExportData, null, 2) : ''}
            </pre>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowJsonModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={downloadJson}>
            Download JSON
          </Button>
        </Modal.Footer>
      </Modal>

      {/* CSV Export Modal */}
      <Modal show={showCsvModal} onHide={() => setShowCsvModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>CSV Export Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <Table striped bordered hover size="sm">
              <tbody>
                {csvExportData?.split('\n').map((row, index) => (
                  <tr key={index}>
                    {row.split(',').map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell.replace(/"/g, '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCsvModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={downloadCsv}>
            Download CSV
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PortfolioComparison;
