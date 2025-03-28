import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Row,
  Col,
  Form,
  Button,
  Alert,
  Badge,
  InputGroup,
  Modal,
} from "react-bootstrap";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { formatDollarAmount, formatNumber } from "../utils/formatters";

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const PortfolioComparison = ({
  modelPortfolios,
  accounts,
  categories,
  stockCategories,
  stockPrices,
}) => {
  const [selectedModelPortfolio, setSelectedModelPortfolio] = useState("");
  const [modelAllocation, setModelAllocation] = useState({});
  const [currentAllocation, setCurrentAllocation] = useState({});
  const [simulatedAllocation, setSimulatedAllocation] = useState({});
  const [deviations, setDeviations] = useState({});
  const [simulatedDeviations, setSimulatedDeviations] = useState({});
  const [rebalanceActions, setRebalanceActions] = useState([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [specificRebalancingSuggestions, setSpecificRebalancingSuggestions] =
    useState([]);
  const [showSpecificSuggestions] = useState(false);

  // What-if analysis states
  const [showWhatIfAnalysis, setShowWhatIfAnalysis] = useState(false);
  const [whatIfCategory, setWhatIfCategory] = useState("");
  const [whatIfAction, setWhatIfAction] = useState("buy");
  const [whatIfAmount, setWhatIfAmount] = useState("");
  const [whatIfDirty, setWhatIfDirty] = useState(false);
  const [whatIfTrades, setWhatIfTrades] = useState([]);
  const [currentTrade, setCurrentTrade] = useState({
    category: "",
    action: "buy",
    amount: "",
  });

  // Sell-Buy rebalancing state
  const [showSellBuyRebalancing, setShowSellBuyRebalancing] = useState(false);

  // Buy-only rebalancing states
  const [showBuyOnlyRebalancing, setShowBuyOnlyRebalancing] = useState(false);
  const [newInvestmentAmount, setNewInvestmentAmount] = useState("");
  const [buyOnlySuggestions, setBuyOnlySuggestions] = useState([]);
  const [selectedTrades, setSelectedTrades] = useState({});
  const [recalculatedSuggestions, setRecalculatedSuggestions] = useState([]);
  const [buyOnlyUnallocatedAmount, setBuyOnlyUnallocatedAmount] = useState(0); // <-- Added state
  const [isCalculatingNeeded, setIsCalculatingNeeded] = useState(false); // <-- Added state

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
  const calculateModelAllocation = useCallback(
    (portfolioId) => {
      if (!portfolioId) return {};

      const selectedPortfolio = modelPortfolios.find(
        (p) => p.name === portfolioId
      );
      if (!selectedPortfolio) return {};

      const allocation = {};
      let totalPercentage = 0;

      // Initialize categories
      categories.forEach((category) => {
        allocation[category.id] = 0;
      });
      allocation["uncategorized"] = 0;

      // Calculate allocations by category
      selectedPortfolio.stocks.forEach((stock) => {
        const categoryId = stockCategories[stock.symbol] || "uncategorized";
        allocation[categoryId] =
          (allocation[categoryId] || 0) + stock.percentage;
        totalPercentage += stock.percentage;
      });

      // Normalize to 100% if needed
      if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.01) {
        Object.keys(allocation).forEach((categoryId) => {
          allocation[categoryId] =
            (allocation[categoryId] / totalPercentage) * 100;
        });
      }

      return allocation;
    },
    [categories, modelPortfolios, stockCategories]
  );

  // Calculate current portfolio allocation by category
  const calculateCurrentAllocation = useCallback(() => {
    const allocation = {};
    let totalValue = 0;

    // Initialize categories
    categories.forEach((category) => {
      allocation[category.id] = 0;
    });
    allocation["uncategorized"] = 0;

    // Calculate values by category
    accounts.forEach((account) => {
      account.positions.forEach((position) => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        totalValue += value;

        const categoryId = stockCategories[position.symbol] || "uncategorized";
        allocation[categoryId] = (allocation[categoryId] || 0) + value;
      });
    });

    // Convert to percentages
    if (totalValue > 0) {
      Object.keys(allocation).forEach((categoryId) => {
        allocation[categoryId] = (allocation[categoryId] / totalValue) * 100;
      });
    }

    // Save total portfolio value for rebalancing calculations
    setTotalPortfolioValue(totalValue);

    return allocation;
  }, [accounts, categories, stockCategories, stockPrices]);

  // Calculate deviations between model and current allocations
  const calculateDeviations = useCallback(
    (model, current) => {
      const deviations = {};

      const allCategoryIds = new Set([
        ...categories.map((c) => c.id),
        "uncategorized",
        ...Object.keys(model),
        ...Object.keys(current),
      ]);

      allCategoryIds.forEach((categoryId) => {
        const modelAlloc = model[categoryId] || 0;
        const currentAlloc = current[categoryId] || 0;
        deviations[categoryId] = currentAlloc - modelAlloc;
      });

      return deviations;
    },
    [categories]
  );

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
    Object.keys(currentAllocation).forEach((categoryId) => {
      categoryValues[categoryId] =
        (currentAllocation[categoryId] / 100) * totalPortfolioValue;
    });

    // Apply all trades
    whatIfTrades.forEach((trade) => {
      const amount = parseFloat(trade.amount);
      if (!trade.category || !trade.amount || isNaN(amount) || amount <= 0)
        return;

      const isBuying = trade.action === "buy";

      if (isBuying) {
        categoryValues[trade.category] =
          (categoryValues[trade.category] || 0) + amount;
        newTotalValue += amount;
      } else {
        // Selling - make sure we don't sell more than we have
        const currentCategoryValue = categoryValues[trade.category] || 0; // Use the value, not percentage calculation
        if (amount >= currentCategoryValue) {
          // Can't sell more than what exists in the category
          newTotalValue -= currentCategoryValue;
          categoryValues[trade.category] = 0;
        } else {
          categoryValues[trade.category] = currentCategoryValue - amount;
          newTotalValue -= amount;
        }
      }
    });

    // Calculate new percentages based on new total value
    const newAllocation = {};
    if (newTotalValue > 0) {
      Object.keys(categoryValues).forEach((categoryId) => {
        newAllocation[categoryId] =
          (categoryValues[categoryId] / newTotalValue) * 100;
      });
    }

    // Calculate new deviations
    const newDeviations = calculateDeviations(modelAllocation, newAllocation);

    setSimulatedAllocation(newAllocation);
    setSimulatedDeviations(newDeviations);
    setWhatIfDirty(true);
  }, [
    whatIfTrades,
    currentAllocation,
    deviations,
    calculateDeviations,
    modelAllocation,
    totalPortfolioValue,
  ]);

  // Reset simulation to current allocation
  const resetSimulation = useCallback(() => {
    setWhatIfTrades([]);
    setCurrentTrade({
      category: "",
      action: "buy",
      amount: "",
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
        category: "",
        action: "buy",
        amount: "",
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
    setCurrentTrade((prev) => ({
      ...prev,
      amount: (parseFloat(prev.amount) || 0) + amount,
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
    const modelPortfolioObj = modelPortfolios.find(
      (p) => p.name === selectedModelPortfolio
    );
    if (!modelPortfolioObj) return [];

    // Calculate current positions by symbol across all accounts
    const symbolTotals = {};
    accounts.forEach((account) => {
      account.positions.forEach((position) => {
        const symbol = position.symbol;
        const price = stockPrices[symbol] || 0;
        const value = position.shares * price;

        if (!symbolTotals[symbol]) {
          symbolTotals[symbol] = {
            symbol,
            shares: position.shares,
            value,
            price,
            category: stockCategories[symbol] || "uncategorized",
          };
        } else {
          symbolTotals[symbol].value += value;
          symbolTotals[symbol].shares += position.shares;
        }
      });
    });

    // Group symbols by category for decision making
    const categorizedSymbols = {};
    Object.values(symbolTotals).forEach((item) => {
      if (!categorizedSymbols[item.category]) {
        categorizedSymbols[item.category] = [];
      }
      categorizedSymbols[item.category].push(item);
    });

    // Sort each category's symbols by value (ascending for selling, descending for buying)
    Object.keys(categorizedSymbols).forEach((category) => {
      categorizedSymbols[category].sort((a, b) => a.value - b.value); // Ascending for selling lowest value first
    });

    // First handle all sells (overweight positions)
    Object.keys(deviations).forEach((categoryId) => {
      const deviation = deviations[categoryId];
      if (deviation > 0.5) {
        // Only sell if meaningfully overweight
        const amountToAdjust = (deviation / 100) * totalValue;
        const categoryName =
          categories.find((c) => c.id === categoryId)?.name || "Uncategorized";

        if (
          categorizedSymbols[categoryId] &&
          categorizedSymbols[categoryId].length > 0
        ) {
          // Try to sell smallest positions first to reach the target reduction
          let amountSold = 0;
          for (const positionToSell of categorizedSymbols[categoryId]) {
            if (amountSold >= amountToAdjust) break;
            const sellAmountForThis = Math.min(
              positionToSell.value,
              amountToAdjust - amountSold
            );
            if (sellAmountForThis > 0 && positionToSell.price > 0) {
              const sharesToSell = Math.floor(
                sellAmountForThis / positionToSell.price
              );
              if (sharesToSell > 0) {
                const actualSoldValue = sharesToSell * positionToSell.price;
                suggestions.push({
                  category: categoryName,
                  action: `SELL ${positionToSell.symbol}`,
                  percent: deviation.toFixed(2), // This percent is for the category deviation
                  amount: actualSoldValue,
                });
                amountSold += actualSoldValue;
              }
            }
          }
        }
      }
    });

    // Then handle all buys (underweight positions)
    Object.keys(deviations).forEach((categoryId) => {
      const deviation = deviations[categoryId];
      if (deviation < -0.5) {
        // Only buy if meaningfully underweight
        const amountToAdjust = (Math.abs(deviation) / 100) * totalValue;
        const categoryName =
          categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
        let amountBought = 0;

        // Find positions that already exist in this category (if any)
        if (
          categorizedSymbols[categoryId] &&
          categorizedSymbols[categoryId].length > 0
        ) {
          // Sort in descending order for buying (largest position first)
          const buyPositions = [...categorizedSymbols[categoryId]].sort(
            (a, b) => b.value - a.value
          );

          for (const positionToBuy of buyPositions) {
            if (amountBought >= amountToAdjust) break;
            // Allocate proportionally or just to the largest? Let's try largest first.
            const buyAmountForThis = amountToAdjust - amountBought; // Try to buy the remaining amount needed
            if (buyAmountForThis > 0 && positionToBuy.price > 0) {
              const sharesToBuy = Math.floor(
                buyAmountForThis / positionToBuy.price
              );
              if (sharesToBuy > 0) {
                const actualBuyValue = sharesToBuy * positionToBuy.price;
                suggestions.push({
                  category: categoryName,
                  action: `BUY ${positionToBuy.symbol}`,
                  percent: Math.abs(deviation).toFixed(2),
                  amount: actualBuyValue,
                });
                amountBought += actualBuyValue;
                // Since we bought the target amount (or close to it), break for this category
                break;
              }
            }
          }
        }

        // If not enough bought (or no existing position), look for model stocks
        if (amountBought < amountToAdjust - 1) {
          // Allow small tolerance
          const modelStocksInCategory = modelPortfolioObj.stocks.filter(
            (stock) => stockCategories[stock.symbol] === categoryId
          );

          if (modelStocksInCategory.length > 0) {
            // Sort by percentage allocation in model (descending)
            modelStocksInCategory.sort((a, b) => b.percentage - a.percentage);
            const recommendedStock = modelStocksInCategory[0]; // Buy the highest % model stock
            const price = stockPrices[recommendedStock.symbol] || 0;
            const amountToBuy = amountToAdjust - amountBought;

            if (price > 0 && amountToBuy > 0) {
              const sharesToBuy = Math.floor(amountToBuy / price);
              if (sharesToBuy > 0) {
                suggestions.push({
                  category: categoryName,
                  action: `BUY ${recommendedStock.symbol}`,
                  percent: Math.abs(deviation).toFixed(2),
                  amount: sharesToBuy * price,
                });
                amountBought += sharesToBuy * price;
              }
            }
          }
        }
      }
    });

    return suggestions;
  };

  // Generate specific stock-level rebalancing suggestions (Corrected .toFixed call)
  const generateSpecificSuggestions = useCallback(() => {
    // --- Start of function is the same ---
    if (!selectedModelPortfolio || totalPortfolioValue <= 0) return [];
    const selectedPortfolio = modelPortfolios.find(
      (p) => p.name === selectedModelPortfolio
    );
    if (!selectedPortfolio) return [];
    const suggestions = [];
    const modelStocks = new Map(
      selectedPortfolio.stocks.map((stock) => [stock.symbol, stock.percentage])
    );
    const currentStockValues = {};
    let currentTotalValue = 0;
    accounts.forEach((account) => {
      /* ... aggregate current stock values ... */
      account.positions.forEach((position) => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        if (currentStockValues[position.symbol]) {
          currentStockValues[position.symbol].value += value;
          currentStockValues[position.symbol].shares += position.shares;
        } else {
          currentStockValues[position.symbol] = {
            symbol: position.symbol,
            value,
            shares: position.shares,
            price: price,
            category: stockCategories[position.symbol] || "uncategorized",
          };
        }
        // Use the latest price if > 0? Or first price? Let's use latest valid price.
        if (price > 0) currentStockValues[position.symbol].price = price;
        currentTotalValue += value;
      });
    });

    // Stocks to sell (reduce)
    Object.values(currentStockValues).forEach((data) => {
      const symbol = data.symbol;
      const modelPercentage = modelStocks.get(symbol) || 0;
      const currentPercentage =
        currentTotalValue > 0 ? (data.value / currentTotalValue) * 100 : 0;
      // Ensure price is a valid number
      const price =
        typeof data.price === "number" && data.price > 0 ? data.price : 0;

      if (currentPercentage > modelPercentage + 1 && price > 0) {
        const targetValue = (modelPercentage / 100) * currentTotalValue;
        const excessValue = data.value - targetValue;
        const sharesToSell = Math.floor(excessValue / price);

        if (sharesToSell > 0) {
          const sellValue = sharesToSell * price; // Calculate value first
          // ***** START CORRECTION *****
          const formattedSellValue = !isNaN(sellValue)
            ? sellValue.toFixed(2)
            : "0.00"; // Format safely
          // ***** END CORRECTION *****

          suggestions.push({
            symbol,
            action: "Sell",
            shares: sharesToSell,
            value: formattedSellValue, // Use formatted value
            category:
              categories.find((cat) => cat.id === data.category)?.name ||
              "Uncategorized",
            currentPercentage: currentPercentage.toFixed(2),
            targetPercentage: modelPercentage.toFixed(2),
            deviation: (currentPercentage - modelPercentage).toFixed(2),
          });
        }
      }
    });

    // Stocks to buy (increase) or add
    selectedPortfolio.stocks.forEach((modelStock) => {
      const { symbol, percentage } = modelStock;
      const currentData = currentStockValues[symbol];
      // Ensure price is a valid number
      const price =
        typeof currentData?.price === "number" && currentData.price > 0
          ? currentData.price
          : typeof stockPrices[symbol] === "number" && stockPrices[symbol] > 0
          ? stockPrices[symbol]
          : 0;
      const categoryId = stockCategories[symbol] || "uncategorized";

      const targetValue = (percentage / 100) * currentTotalValue;
      const currentValue = currentData?.value || 0;
      const currentPercentage =
        currentTotalValue > 0 ? (currentValue / currentTotalValue) * 100 : 0;

      if (
        targetValue > currentValue + 100 &&
        currentPercentage < percentage - 1 &&
        price > 0
      ) {
        const additionalValue = targetValue - currentValue;
        const sharesToBuy = Math.floor(additionalValue / price);

        if (sharesToBuy > 0) {
          const buyValue = sharesToBuy * price; // Calculate value first
          // ***** START CORRECTION *****
          const formattedBuyValue = !isNaN(buyValue)
            ? buyValue.toFixed(2)
            : "0.00"; // Format safely
          // ***** END CORRECTION *****

          suggestions.push({
            symbol,
            action: "Buy",
            shares: sharesToBuy,
            value: formattedBuyValue, // Use formatted value
            category:
              categories.find((cat) => cat.id === categoryId)?.name ||
              "Uncategorized",
            currentPercentage: currentPercentage.toFixed(2),
            targetPercentage: percentage.toFixed(2),
            deviation: (currentPercentage - percentage).toFixed(2),
          });
        }
      }
    });

    // Sort...
    return suggestions.sort((a, b) => {
      /* ... sorting ... */
      if (a.action !== b.action) {
        return a.action === "Buy" ? -1 : 1;
      }
      return (
        Math.abs(parseFloat(b.deviation)) - Math.abs(parseFloat(a.deviation))
      );
    });
  }, [
    accounts,
    categories,
    modelPortfolios,
    selectedModelPortfolio,
    stockCategories,
    stockPrices,
    totalPortfolioValue,
  ]);

  // Generate buy-only rebalancing suggestions (IMPROVED ALLOCATION LOOP)
  const generateBuyOnlySuggestions = useCallback((investmentAmount) => {
    console.log("--- generateBuyOnlySuggestions START ---");
    console.log("Input Amount:", investmentAmount);
    console.log("Total Portfolio Value:", totalPortfolioValue);

    // --- Initial Checks (same as before) ---
    if (!selectedModelPortfolio || totalPortfolioValue <= 0 || !investmentAmount) { /* ... */ return { suggestions: [], projections: null, unallocatedAmount: parseFloat(investmentAmount) || 0 }; }
    const amount = parseFloat(investmentAmount);
    if (isNaN(amount) || amount <= 0) { /* ... */ return { suggestions: [], projections: null, unallocatedAmount: amount || 0 }; }
    const selectedPortfolio = modelPortfolios.find(p => p.name === selectedModelPortfolio);
    if (!selectedPortfolio) { /* ... */ return { suggestions: [], projections: null, unallocatedAmount: amount }; }

    // --- Setup (same as before) ---
    let remainingInvestment = amount;
    let currentTotalValueDynamic = totalPortfolioValue;
    const currentCategoryValues = {};
    const allCatIds = new Set([...Object.keys(currentAllocation || {}), ...Object.keys(modelAllocation || {})]);
    allCatIds.forEach(catId => { currentCategoryValues[catId] = ((currentAllocation[catId] || 0) / 100) * totalPortfolioValue; });
    const currentStockValues = {};
    accounts.forEach(account => { /* ... aggregate stock values with parseFloat ... */
        account.positions.forEach(position => {
            const symbol = position.symbol;
            const rawPrice = stockPrices[symbol];
            const parsedPrice = parseFloat(rawPrice);
            const isValidPrice = !isNaN(parsedPrice) && parsedPrice > 0;
             //if (!isValidPrice) console.warn(`[BuyOnly] Price issue for existing stock: ${symbol} (Raw: ${rawPrice})`);
            const value = isValidPrice ? parsedPrice * position.shares : 0;
            const categoryId = stockCategories[symbol] || 'uncategorized';
            if (!currentStockValues[symbol]) { currentStockValues[symbol] = { value: 0, shares: 0, price: isValidPrice ? parsedPrice : 0, category: categoryId, symbol: symbol }; }
            currentStockValues[symbol].value += value;
            currentStockValues[symbol].shares += position.shares;
            if (currentStockValues[symbol].price <= 0 && isValidPrice) { currentStockValues[symbol].price = parsedPrice; }
        });
     });
    Object.values(currentStockValues).forEach(stock => { stock.percentage = totalPortfolioValue > 0 ? (stock.value / totalPortfolioValue) * 100 : 0; });
    const projectedCategoryValues = { ...currentCategoryValues };
    const buyCandidates = [];
    const modelStocksMap = new Map(selectedPortfolio.stocks.map(s => [s.symbol, s]));

    // --- Candidate Generation (same as before, using parsed prices) ---
    console.log("[BuyOnly] Generating candidates...");
    Object.values(currentStockValues).forEach(stockData => { /* ... add existing ... */
        const modelStock = modelStocksMap.get(stockData.symbol);
        const stockPrice = stockData.price;
        const isValidStockPrice = stockPrice > 0;
        if (modelStock && isValidStockPrice) {
            const categoryId = stockData.category;
            const currentCatAlloc = currentAllocation[categoryId] || 0;
            const targetCatAlloc = modelAllocation[categoryId] || 0;
            const isUnderweight = currentCatAlloc < targetCatAlloc - 0.1;
             // console.log(`[BuyOnly Cand-Existing] ${stockData.symbol}...`);
            if (isUnderweight) { buyCandidates.push({ symbol: stockData.symbol, price: stockPrice, categoryId: categoryId, modelStockPercentage: modelStock.percentage, modelCategoryPercentage: targetCatAlloc }); }
        }
     });
    selectedPortfolio.stocks.forEach(stock => { /* ... add new ... */
        if (!currentStockValues[stock.symbol]) {
             const rawPrice = stockPrices[stock.symbol];
             const parsedPrice = parseFloat(rawPrice);
             const isValidPrice = !isNaN(parsedPrice) && parsedPrice > 0;
             if (isValidPrice) {
                const categoryId = stockCategories[stock.symbol] || 'uncategorized';
                const currentCatAlloc = currentAllocation[categoryId] || 0;
                const targetCatAlloc = modelAllocation[categoryId] || 0;
                const isUnderweight = currentCatAlloc < targetCatAlloc - 0.1;
                // console.log(`[BuyOnly Cand-New] ${stock.symbol}...`);
                 if (isUnderweight) { buyCandidates.push({ symbol: stock.symbol, price: parsedPrice, categoryId: categoryId, modelStockPercentage: stock.percentage, modelCategoryPercentage: targetCatAlloc }); }
             }
        }
     });
    let uniqueCandidates = Array.from(new Map(buyCandidates.map(c => [c.symbol, c])).values());
    console.log(`[BuyOnly] Found ${uniqueCandidates.length} unique candidates.`);
    if (uniqueCandidates.length === 0) console.error("[BuyOnly Error] No valid buy candidates found.");

    // --- Allocation Loop (REVISED LOGIC) ---
    const allocationResults = {};
    let iteration = 0;
    // Increase MAX_ITERATIONS slightly, but it should finish much faster now
    const MAX_ITERATIONS = uniqueCandidates.length * 5 + 20; // e.g., 4*5+20 = 40
    let safetyBreak = false;

    console.log("[BuyOnly] --- Starting Efficient Allocation Loop ---");
    while (remainingInvestment > 1 && uniqueCandidates.length > 0 && iteration < MAX_ITERATIONS) {
        iteration++;
        let allocatedInLoop = false;

        // 1. Sort candidates to find the highest priority
         uniqueCandidates.sort((a, b) => { /* ... same sorting logic ... */
             const currentTotalVal = currentTotalValueDynamic > 0 ? currentTotalValueDynamic : 1;
             const catDevA = ((projectedCategoryValues[a.categoryId]||0) / currentTotalVal * 100) - a.modelCategoryPercentage;
             const catDevB = ((projectedCategoryValues[b.categoryId]||0) / currentTotalVal * 100) - b.modelCategoryPercentage;
             if (Math.abs(catDevA - catDevB) > 0.01) { return catDevA - catDevB; }
             const currentProjValA = (currentStockValues[a.symbol]?.value || 0) + (allocationResults[a.symbol]?.value || 0);
             const currentProjValB = (currentStockValues[b.symbol]?.value || 0) + (allocationResults[b.symbol]?.value || 0);
             const stockPercentageA = currentTotalVal > 0 ? (currentProjValA / currentTotalVal * 100) : 0;
             const stockPercentageB = currentTotalVal > 0 ? (currentProjValB / currentTotalVal * 100) : 0;
             const stockDevA = stockPercentageA - a.modelStockPercentage;
             const stockDevB = stockPercentageB - b.modelStockPercentage;
             return stockDevA - stockDevB;
         });

         // 2. Process the highest priority candidate
         const candidate = uniqueCandidates[0];
         const { symbol, price, categoryId, modelCategoryPercentage } = candidate;

         // Basic validity check
         if (price <= 0) {
             console.log(`[BuyOnly Loop ${iteration}] Removing candidate ${symbol} due to invalid price ${price}.`);
             uniqueCandidates.shift(); // Remove invalid candidate
             continue; // Try next iteration
         }
         if (remainingInvestment < price) {
              console.log(`[BuyOnly Loop ${iteration}] Not enough remaining funds (${remainingInvestment.toFixed(2)}) to buy ${symbol} at ${price.toFixed(2)}. Exiting loop.`);
              break; // Can't afford top candidate, likely done
         }

         // 3. Calculate Category Headroom
         const projectedCatValue = projectedCategoryValues[categoryId] || 0;
         const targetRatio = modelCategoryPercentage / 100;
         let maxInvestmentInCategory = Infinity; // Max amount $ to add to category
         if (targetRatio < 0.9999) {
             // Formula: x = (Target% * TotalValue - CurrentCatValue) / (1 - Target%)
             maxInvestmentInCategory = (targetRatio * currentTotalValueDynamic - projectedCatValue) / (1 - targetRatio);
             maxInvestmentInCategory = Math.max(0, maxInvestmentInCategory); // Ensure non-negative
         } else {
            // Handle 100% target - essentially infinite headroom if not already there
            maxInvestmentInCategory = Math.max(0, amount); // Limited by total investment theoretically
         }

         console.log(`[BuyOnly Loop ${iteration}] Checking ${symbol} ($${price.toFixed(2)}). Cat ${categoryId} Headroom: ~$${maxInvestmentInCategory.toFixed(2)}. Remaining Funds: $${remainingInvestment.toFixed(2)}.`);

         // Check if category is already full (headroom is negligible)
         if (maxInvestmentInCategory < 0.01) {
             console.log(`[BuyOnly Loop ${iteration}] Category ${categoryId} is full. Removing candidate ${symbol}.`);
             uniqueCandidates.shift(); // Remove this candidate
             continue; // Go to next iteration with remaining candidates
         }

         // 4. Calculate max shares to buy
         const maxAffordableShares = Math.floor(remainingInvestment / price);
         const maxSharesForCategory = Math.floor(maxInvestmentInCategory / price);

         // Number of shares is limited by funds and category room
         let sharesToBuy = Math.min(maxAffordableShares, maxSharesForCategory);

         // Ensure we buy at least one share if possible
         if (sharesToBuy <= 0 && remainingInvestment >= price && maxInvestmentInCategory >= price) {
             sharesToBuy = 1; // Force at least one if affordable and headroom exists
         }

         console.log(`[BuyOnly Loop ${iteration}] Max Shares: Affordable=${maxAffordableShares}, CategoryLimit=${maxSharesForCategory}. Actual Shares to Buy = ${sharesToBuy}`);

         // 5. Perform the buy if possible
         if (sharesToBuy > 0) {
             const investmentThisStep = sharesToBuy * price;

             // Final check: Ensure this doesn't push category % over target (using calculated values)
             // This check is somewhat redundant given maxSharesForCategory, but good safety
             const valueAfterBuy = projectedCatValue + investmentThisStep;
             const totalAfterBuy = currentTotalValueDynamic + investmentThisStep;
             const percentAfterBuy = totalAfterBuy > 0 ? (valueAfterBuy / totalAfterBuy) * 100 : 0;

             if (percentAfterBuy <= modelCategoryPercentage + 0.1) { // Allow slightly larger tolerance for multi-share buys
                 console.log(`[BuyOnly Loop ${iteration}] ---> YES: Buying ${sharesToBuy} shares of ${symbol} for $${investmentThisStep.toFixed(2)}.`);

                 // Update totals
                 projectedCategoryValues[categoryId] = valueAfterBuy;
                 currentTotalValueDynamic = totalAfterBuy;
                 remainingInvestment -= investmentThisStep;

                 // Record purchase
                 if (!allocationResults[symbol]) {
                     allocationResults[symbol] = { shares: 0, value: 0, categoryId: categoryId, price: price };
                 }
                 allocationResults[symbol].shares += sharesToBuy;
                 allocationResults[symbol].value += investmentThisStep;

                 allocatedInLoop = true;
                 // Don't break loop, let while loop condition handle next iteration (re-sort needed)
             } else {
                 console.log(`[BuyOnly Loop ${iteration}] ---> NO ${symbol}: Buying ${sharesToBuy} shares would exceed category limit (${percentAfterBuy.toFixed(2)}% > ${modelCategoryPercentage}%). Removing candidate.`);
                 // If buying multiple shares failed, buying 1 might also fail, or might be inefficient.
                 // Remove the candidate for this run to avoid infinite loops on edge cases.
                  uniqueCandidates.shift();
             }

         } else {
            // Can't buy any shares of the top candidate (either too expensive, no room, or no remaining funds)
            console.log(`[BuyOnly Loop ${iteration}] Cannot buy any shares of ${symbol}. Removing candidate.`);
            uniqueCandidates.shift(); // Remove candidate and try the next one in the next iteration
         }

    } // End while loop

    console.log("[BuyOnly] --- Efficient Allocation Loop END ---");
    if (iteration >= MAX_ITERATIONS) { console.warn("[BuyOnly] Efficient Allocation loop reached max iterations."); safetyBreak = true; }
    if (uniqueCandidates.length == 0 && remainingInvestment > 1) { console.log("[BuyOnly] Ran out of candidates with funds remaining."); }


    // --- Format Suggestions (same as before) ---
    console.log("[BuyOnly] Formatting final suggestions...");
     const finalSuggestions = Object.entries(allocationResults).map(([symbol, data]) => {
         const categoryName = categories.find(c => c.id === data.categoryId)?.name || 'Uncategorized';
         const modelStockInfo = modelStocksMap.get(symbol);
         const currentStockData = currentStockValues[symbol];
         const currentStockPercent = currentStockData ? currentStockData.percentage : 0;
         const targetStockPercent = modelStockInfo ? modelStockInfo.percentage : 0;
         const numericValue = data.value;
         const formattedValue = !isNaN(numericValue) ? numericValue.toFixed(2) : '0.00';
         const numericPrice = data.price;
         return {
             symbol: symbol, shares: data.shares, value: formattedValue, price: String(numericPrice), category: categoryName, categoryId: data.categoryId,
             currentPercentage: currentStockPercent.toFixed(2), targetPercentage: targetStockPercent.toFixed(2), deviation: (currentStockPercent - targetStockPercent).toFixed(2),
             allocationPercent: amount > 0 && !isNaN(numericValue) ? ((numericValue / amount) * 100).toFixed(1) : '0.0',
         };
     });


    // --- Final Projections (same as before) ---
     const projectedCategoryAllocation = {};
     const allProjCatIds = new Set([...categories.map(c => c.id), 'uncategorized', ...Object.keys(projectedCategoryValues)]);
     allProjCatIds.forEach(catId => {
         projectedCategoryAllocation[catId] = 0;
         if (currentTotalValueDynamic > 0) { projectedCategoryAllocation[catId] = ((projectedCategoryValues[catId] || 0) / currentTotalValueDynamic) * 100; }
     });
     finalSuggestions.forEach(suggestion => {
       const currentStockValue = currentStockValues[suggestion.symbol]?.value || 0;
       const suggestionValueNum = parseFloat(suggestion.value);
       const finalStockValue = currentStockValue + (isNaN(suggestionValueNum) ? 0 : suggestionValueNum);
       const finalStockPercent = currentTotalValueDynamic > 0 ? (finalStockValue / currentTotalValueDynamic) * 100 : 0;
       suggestion.projectedPercentage = finalStockPercent.toFixed(2);
       const targetPercNum = parseFloat(suggestion.targetPercentage);
       suggestion.projectedDeviation = (!isNaN(targetPercNum) ? (finalStockPercent - targetPercNum) : finalStockPercent).toFixed(2);
     });
     const projectionsData = {
         categoryAllocation: projectedCategoryAllocation,
         deviations: calculateDeviations(modelAllocation, projectedCategoryAllocation),
         totalValue: currentTotalValueDynamic,
     };
     finalSuggestions.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

     console.log(`[BuyOnly] Generated ${finalSuggestions.length} suggestions.`);
     console.log(`[BuyOnly] Final Unallocated Amount: ${remainingInvestment.toFixed(2)}`);
     console.log("--- generateBuyOnlySuggestions END ---");
     const finalUnallocated = Math.max(0, remainingInvestment);
     return { suggestions: finalSuggestions, projections: projectionsData, unallocatedAmount: finalUnallocated };

  }, [accounts, categories, currentAllocation, modelAllocation, modelPortfolios, selectedModelPortfolio, stockCategories, stockPrices, totalPortfolioValue, calculateDeviations]);

  // Update calculations when model portfolio selection changes
  useEffect(() => {
    if (selectedModelPortfolio) {
      const model = calculateModelAllocation(selectedModelPortfolio);
      const current = calculateCurrentAllocation();

      setModelAllocation(model);
      setCurrentAllocation(current);
      setSimulatedAllocation(current); // Initialize simulated to current
      const newDeviations = calculateDeviations(model, current);
      setDeviations(newDeviations);
      setSimulatedDeviations(newDeviations); // Initialize simulated deviations
      setWhatIfDirty(false);
      // Reset other modes if portfolio changes
      setShowWhatIfAnalysis(false);
      setShowSellBuyRebalancing(false);
      setShowBuyOnlyRebalancing(false);
      setNewInvestmentAmount("");
      setBuyOnlySuggestions([]);
      setRecalculatedSuggestions([]);
      setBuyOnlyUnallocatedAmount(0);
      setSelectedTrades({});
    }
  }, [
    selectedModelPortfolio,
    calculateModelAllocation,
    calculateCurrentAllocation,
    calculateDeviations,
  ]);

  // Update rebalance actions when deviations change (for Sell-Buy mode)
  useEffect(() => {
    if (selectedModelPortfolio && Object.keys(deviations).length > 0) {
      const suggestions = memoizedGenerateRebalanceSuggestions(); // Use memoized version
      setRebalanceActions(suggestions);

      // Only calculate simulated allocation if sell-buy rebalancing is shown
      if (showSellBuyRebalancing) {
        // Calculate simulated allocation after applying all generated trades
        const categoryValues = {};
        let newTotalValue = totalPortfolioValue;

        // Initialize category values based on current allocation
        Object.keys(currentAllocation).forEach((categoryId) => {
          categoryValues[categoryId] =
            (currentAllocation[categoryId] / 100) * totalPortfolioValue;
        });

        // Apply all sell trades first (they affect the total value available for buys)
        let cashFromSales = 0;
        suggestions.forEach((suggestion) => {
          if (suggestion.action.startsWith("SELL")) {
            const categoryName = suggestion.category;
            const categoryId =
              categories.find((c) => c.name === categoryName)?.id ||
              "uncategorized";
            const amount = suggestion.amount;

            // Reduce category value and total value
            const currentCatValue = categoryValues[categoryId] || 0;
            const actualSellAmount = Math.min(amount, currentCatValue); // Don't sell more than exists
            categoryValues[categoryId] = currentCatValue - actualSellAmount;
            newTotalValue -= actualSellAmount;
            cashFromSales += actualSellAmount;
          }
        });

        // Then apply all buy trades using cash from sales (or assuming external funding if buys > sells)
        let cashForBuys = cashFromSales; // Simplification: assume buys are funded by sells
        suggestions.forEach((suggestion) => {
          if (suggestion.action.startsWith("BUY")) {
            const categoryName = suggestion.category;
            const categoryId =
              categories.find((c) => c.name === categoryName)?.id ||
              "uncategorized";
            const amount = suggestion.amount;

            // For this simulation, assume we have the funds
            categoryValues[categoryId] =
              (categoryValues[categoryId] || 0) + amount;
            newTotalValue += amount; // Total value increases by buy amount
          }
        });

        // Calculate new percentages based on final total value
        const simulatedCategoryPercentages = {};
        if (newTotalValue > 0) {
          Object.keys(categoryValues).forEach((categoryId) => {
            simulatedCategoryPercentages[categoryId] =
              (categoryValues[categoryId] / newTotalValue) * 100;
          });
        }

        // Calculate new deviations
        const newDeviations = calculateDeviations(
          modelAllocation,
          simulatedCategoryPercentages
        );

        setSimulatedAllocation(simulatedCategoryPercentages);
        setSimulatedDeviations(newDeviations);
      } else if (!showWhatIfAnalysis && !showBuyOnlyRebalancing) {
        // If no other mode is active, reset simulation to current
        setSimulatedAllocation(currentAllocation);
        setSimulatedDeviations(deviations);
      }
    }
  }, [
    deviations,
    totalPortfolioValue,
    selectedModelPortfolio,
    categories,
    modelAllocation,
    calculateDeviations,
    currentAllocation,
    showSellBuyRebalancing,
    showWhatIfAnalysis,
    showBuyOnlyRebalancing,
  ]); // Added dependencies

  // Memoize generateRebalanceSuggestions and generateSpecificSuggestions
  const memoizedGenerateRebalanceSuggestions = useCallback(() => {
    return generateRebalanceSuggestions();
  }, [
    selectedModelPortfolio,
    totalPortfolioValue,
    deviations,
    accounts,
    categories,
    modelPortfolios,
    stockCategories,
    stockPrices,
  ]);

  const memoizedGenerateSpecificSuggestions = useCallback(() => {
    return generateSpecificSuggestions();
  }, [
    accounts,
    categories,
    modelPortfolios,
    selectedModelPortfolio,
    stockCategories,
    stockPrices,
    totalPortfolioValue,
  ]);

  // Calculate buy-only rebalancing suggestions when investment amount changes
  useEffect(() => {
    if (showBuyOnlyRebalancing && newInvestmentAmount) {
      // Destructure the result including unallocatedAmount
      const { suggestions, projections, unallocatedAmount } =
        generateBuyOnlySuggestions(newInvestmentAmount);
      setBuyOnlySuggestions(suggestions);
      setBuyOnlyUnallocatedAmount(unallocatedAmount); // Store unallocated amount

      // Initialize all suggestions as selected
      const initialSelections = {};
      suggestions.forEach((suggestion, index) => {
        initialSelections[index] = true;
      });
      setSelectedTrades(initialSelections);
      setRecalculatedSuggestions(suggestions); // Start with initially calculated ones

      if (projections) {
        setSimulatedAllocation(projections.categoryAllocation);
        setSimulatedDeviations(projections.deviations);
      } else {
        // Reset if no projections
        setSimulatedAllocation(currentAllocation);
        setSimulatedDeviations(deviations);
      }
    } else if (showBuyOnlyRebalancing) {
      // Clear suggestions if amount is cleared or zero
      setBuyOnlySuggestions([]);
      setRecalculatedSuggestions([]);
      setBuyOnlyUnallocatedAmount(0);
      setSelectedTrades({});
      // Reset simulation to current when clearing amount
      setSimulatedAllocation(currentAllocation);
      setSimulatedDeviations(deviations);
    }
  }, [
    newInvestmentAmount,
    showBuyOnlyRebalancing,
    generateBuyOnlySuggestions,
    currentAllocation,
    deviations,
  ]); // Added currentAllocation/deviations

  // Handle changes in buy-only trade selection (SIMPLIFIED)
  const handleTradeSelectionChange = (index, checked) => {
    const newSelectedTrades = { ...selectedTrades, [index]: checked };
    setSelectedTrades(newSelectedTrades);

    // Filter to only selected trades from the *original* suggestions
    const selectedSuggestions = buyOnlySuggestions.filter(
      (_, i) => newSelectedTrades[i]
    );

    // Update the list of what's displayed as 'recalculated' (which are now just the selected ones)
    // Note: We will recalculate projections within recalculateProjectionsForSelectedTrades

    // Recalculate overall projections for the portfolio based ONLY on selected trades
    recalculateProjectionsForSelectedTrades(selectedSuggestions);
  };

  // Recalculate projected allocations based on selected trades (Updates recalculateSuggestions state)
  const recalculateProjectionsForSelectedTrades = (selectedSuggestions) => {
    if (!selectedModelPortfolio) {
      // Reset to current allocation if no model selected
      setSimulatedAllocation(currentAllocation);
      setSimulatedDeviations(deviations);
      setRecalculatedSuggestions([]); // Clear suggestions display
      return;
    }

    // Calculate the total value added ONLY by the selected suggestions
    const valueAddedBySelected = selectedSuggestions.reduce(
      (sum, s) => sum + parseFloat(s.value),
      0
    );

    // The future total value is current + only the value of selected trades
    const futureTotalValue = totalPortfolioValue + valueAddedBySelected;

    // Get current portfolio stock values for projection base
    const projectedStockValues = {};
    // Initialize with current values
    accounts.forEach((account) => {
      account.positions.forEach((position) => {
        const price = stockPrices[position.symbol] || 0;
        const value = price * position.shares;
        const categoryId = stockCategories[position.symbol] || "uncategorized";

        if (projectedStockValues[position.symbol]) {
          projectedStockValues[position.symbol].value += value;
          projectedStockValues[position.symbol].shares += position.shares;
        } else {
          projectedStockValues[position.symbol] = {
            value,
            shares: position.shares,
            price,
            percentage: 0, // Will calculate after adding purchases
            category: categoryId,
            symbol: position.symbol, // Keep symbol
          };
        }
      });
    });

    // Add selected trades to projected values
    selectedSuggestions.forEach((suggestion) => {
      const symbol = suggestion.symbol;
      const price = parseFloat(suggestion.price);
      const shares = suggestion.shares;
      const value = price * shares; // Use calculated value to avoid rounding issues

      if (projectedStockValues[symbol]) {
        projectedStockValues[symbol].value += value;
        projectedStockValues[symbol].shares += shares;
      } else {
        // This case should be rare if suggestions are based on existing/model stocks
        projectedStockValues[symbol] = {
          value,
          shares,
          price,
          percentage: 0, // Will calculate below
          category: suggestion.categoryId,
          symbol: symbol,
        };
      }
    });

    // Calculate projected percentages for each stock
    Object.values(projectedStockValues).forEach((stockData) => {
      stockData.percentage =
        futureTotalValue > 0 ? (stockData.value / futureTotalValue) * 100 : 0;
    });

    // --- Update individual suggestion projections ---
    // We need to update the 'projectedPercentage' and 'projectedDeviation' within the selectedSuggestions
    // and store this updated list in 'recalculatedSuggestions' state.
    const updatedRecalculatedSuggestions = selectedSuggestions.map(
      (suggestion) => {
        const symbol = suggestion.symbol;
        const modelTarget = parseFloat(suggestion.targetPercentage);
        let projectedPerc = 0;
        if (projectedStockValues[symbol]) {
          projectedPerc = projectedStockValues[symbol].percentage;
        }
        return {
          ...suggestion,
          projectedPercentage: projectedPerc.toFixed(2),
          projectedDeviation: (projectedPerc - modelTarget).toFixed(2),
        };
      }
    );
    setRecalculatedSuggestions(updatedRecalculatedSuggestions); // Update state with correct projections

    // Calculate projected allocation by category
    const projectedCategoryAllocation = {};
    const allProjCatIds = new Set([
      ...categories.map((c) => c.id),
      "uncategorized",
      ...Object.values(projectedStockValues).map((s) => s.category),
    ]);
    allProjCatIds.forEach((catId) => {
      projectedCategoryAllocation[catId] = 0;
    });

    // Sum percentages by category from projected stock values
    Object.values(projectedStockValues).forEach((data) => {
      const categoryId = data.category;
      projectedCategoryAllocation[categoryId] =
        (projectedCategoryAllocation[categoryId] || 0) + data.percentage;
    });

    // Update projected deviations
    const newDeviations = calculateDeviations(
      modelAllocation,
      projectedCategoryAllocation
    );

    // Update state
    setSimulatedAllocation(projectedCategoryAllocation);
    setSimulatedDeviations(newDeviations);
  };

  // --- START: NEW calculateInvestmentToTarget ---
  const calculateInvestmentToTarget = useCallback(() => {
    if (!selectedModelPortfolio || totalPortfolioValue <= 0) {
      alert(
        "Please select a model portfolio and ensure current portfolio value is positive."
      );
      return;
    }
    if (
      !modelAllocation ||
      Object.keys(modelAllocation).length === 0 ||
      !currentAllocation ||
      Object.keys(currentAllocation).length === 0
    ) {
      alert("Model or current allocation data is missing. Cannot calculate.");
      return;
    }

    setIsCalculatingNeeded(true);

    let calculatedAmount = 0;
    let iterations = 0;
    const MAX_CALC_ITERATIONS = 100;
    const TOLERANCE = 1.0; // Stop when difference is less than $1

    // Get current values in dollars
    const currentValues = {};
    const allCalcCatIds = new Set([
      ...categories.map((c) => c.id),
      "uncategorized",
      ...Object.keys(modelAllocation),
      ...Object.keys(currentAllocation),
    ]);
    allCalcCatIds.forEach((catId) => {
      currentValues[catId] =
        ((currentAllocation[catId] || 0) / 100) * totalPortfolioValue;
    });

    // Identify underweight categories
    const underweightCats = [];
    allCalcCatIds.forEach((catId) => {
      const modelPerc = modelAllocation[catId] || 0;
      const currentPerc = currentAllocation[catId] || 0;
      if (modelPerc > currentPerc) {
        underweightCats.push({
          id: catId,
          currentVal: currentValues[catId] || 0,
          targetPercent: modelPerc,
        });
      }
    });

    if (underweightCats.length === 0) {
      alert(
        "All categories are at or above their target allocation. No additional investment needed based on this calculation."
      );
      setNewInvestmentAmount("0"); // Set to 0
      setIsCalculatingNeeded(false);
      return;
    }

    // Iteratively approximate the needed amount
    // TargetValue = Target% * (CurrentTotal + NeededAmount)
    // Shortfall = TargetValue - CurrentValue
    // Sum(Shortfalls) = NeededAmount (approximately)
    // Let N = NeededAmount. N = Sum [ max(0, (Target%_i * (TotalValue + N)) - CurrentValue_i) ]
    let previousN = -1;
    while (iterations < MAX_CALC_ITERATIONS) {
      iterations++;
      const futureTotal = totalPortfolioValue + calculatedAmount; // Use current guess for N
      let currentTotalShortfall = 0;

      underweightCats.forEach((cat) => {
        const targetValue = (cat.targetPercent / 100) * futureTotal;
        const shortfall = Math.max(0, targetValue - cat.currentVal);
        currentTotalShortfall += shortfall;
      });

      // Check for convergence: is the new calculated shortfall close to the guessed amount?
      if (Math.abs(currentTotalShortfall - calculatedAmount) < TOLERANCE) {
        calculatedAmount = currentTotalShortfall; // Final amount
        break;
      }

      // Check for oscillation or non-convergence (if change is tiny)
      if (previousN !== -1 && Math.abs(calculatedAmount - previousN) < 0.01) {
        console.warn(
          "Calculation might not be converging stably. Using current estimate."
        );
        calculatedAmount = currentTotalShortfall; // Use the current calculated shortfall
        break;
      }

      previousN = calculatedAmount;
      // Update guess for next iteration using the calculated total shortfall
      calculatedAmount = currentTotalShortfall;

      // Prevent negative amount if something went wrong
      if (calculatedAmount < 0) calculatedAmount = 0;
    }

    if (iterations >= MAX_CALC_ITERATIONS) {
      console.warn(
        "Maximum iterations reached for calculating needed investment."
      );
    }

    const finalAmount = Math.round(calculatedAmount);
    setNewInvestmentAmount(String(finalAmount));
    setIsCalculatingNeeded(false);
  }, [
    selectedModelPortfolio,
    totalPortfolioValue,
    modelAllocation,
    currentAllocation,
    categories,
  ]); // Dependencies
  // --- END: NEW calculateInvestmentToTarget ---

  // Prepare data for the charts
  const getChartData = (allocations, title) => {
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const colors = generateColors(categories.length + 1); // Generate enough colors

    let colorIndex = 0;
    categories.forEach((cat) => {
      if (allocations[cat.id] > 0.01) {
        // Only include categories with meaningful allocation
        labels.push(cat.name);
        data.push(allocations[cat.id] || 0);
        backgroundColors.push(colors[colorIndex % colors.length]);
        colorIndex++;
      }
    });

    if (allocations["uncategorized"] > 0.01) {
      labels.push("Uncategorized");
      data.push(allocations["uncategorized"] || 0);
      backgroundColors.push(colors[colorIndex % colors.length]);
    }

    return {
      labels: labels,
      datasets: [
        {
          label: title,
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 1,
        },
      ],
    };
  };

  // Modify the export functions
  const prepareJsonExport = () => {
    if (!selectedModelPortfolio) return;

    // Get the selected model portfolio object
    const modelPortfolioObj = modelPortfolios.find(
      (p) => p.name === selectedModelPortfolio
    );
    if (!modelPortfolioObj) return;

    const data = {
      modelPortfolio: selectedModelPortfolio,
      exportDate: new Date().toISOString(),
      allocations: {
        model: modelAllocation,
        current: currentAllocation,
        deviation: deviations,
        // Include simulated if relevant
        ...(((showWhatIfAnalysis && whatIfDirty) ||
          showSellBuyRebalancing ||
          (showBuyOnlyRebalancing && recalculatedSuggestions.length > 0)) && {
          simulated: simulatedAllocation,
        }),
        ...(((showWhatIfAnalysis && whatIfDirty) ||
          showSellBuyRebalancing ||
          (showBuyOnlyRebalancing && recalculatedSuggestions.length > 0)) && {
          simulatedDeviation: simulatedDeviations,
        }),
      },
      totalPortfolioValue: totalPortfolioValue,
      rebalanceSuggestions: memoizedGenerateRebalanceSuggestions(), // General suggestions
      specificStockSuggestions: memoizedGenerateSpecificSuggestions(), // Specific suggestions
      currentHoldings: accounts.flatMap((account) => {
        return account.positions.map((position) => {
          const symbol = position.symbol;
          const price = stockPrices[symbol] || 0;
          const value = position.shares * price;
          const percentage =
            totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0;
          const categoryId = stockCategories[symbol] || "uncategorized";

          return {
            symbol,
            account: account.name,
            category:
              categories.find((c) => c.id === categoryId)?.name ||
              "Uncategorized",
            categoryId: categoryId,
            shares: position.shares,
            price,
            value,
            percentage,
          };
        });
      }),
      modelHoldings: modelPortfolioObj.stocks.map((stock) => {
        const categoryId = stockCategories[stock.symbol] || "uncategorized";
        return {
          symbol: stock.symbol,
          category:
            categories.find((c) => c.id === categoryId)?.name ||
            "Uncategorized",
          categoryId: categoryId,
          percentage: stock.percentage,
        };
      }),
      // Include active rebalancing mode suggestions
      ...(showBuyOnlyRebalancing &&
        recalculatedSuggestions.length > 0 && {
          buyOnlySelectedTrades: recalculatedSuggestions,
        }),
      ...(showBuyOnlyRebalancing && {
        buyOnlyInvestmentAmount: newInvestmentAmount,
      }),
      ...(showBuyOnlyRebalancing && {
        buyOnlyUnallocatedAmount: buyOnlyUnallocatedAmount,
      }),
    };

    setJsonExportData(data);
    setShowJsonModal(true);
  };

  const downloadJson = () => {
    if (!jsonExportData) return;

    const blob = new Blob([JSON.stringify(jsonExportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-comparison-${selectedModelPortfolio.replace(
      /\s+/g,
      "-"
    )}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowJsonModal(false);
  };

  const prepareCsvExport = () => {
    let csvContent = "";
    let exportMode = "general"; // Default

    if (showBuyOnlyRebalancing && recalculatedSuggestions.length > 0) {
      exportMode = "buyOnly";
      // For buy-only mode, use the selected/recalculated suggestions
      const headers = [
        "Symbol",
        "Category",
        "Shares to Buy",
        "Investment Amount",
        "Percent of New Money",
        "Current %",
        "Target %",
        "Deviation",
        "Projected %",
        "Projected Deviation",
      ];
      const csvRows = [
        headers.join(","),
        ...recalculatedSuggestions.map((suggestion) => {
          return [
            `"${suggestion.symbol}"`,
            `"${suggestion.category}"`,
            suggestion.shares,
            parseFloat(suggestion.value).toFixed(2),
            `${suggestion.allocationPercent}%`, // Use parseFloat to handle potential strings
            `${suggestion.currentPercentage}%`,
            `${suggestion.targetPercentage}%`,
            `${suggestion.deviation}%`,
            `${suggestion.projectedPercentage}%`,
            `${suggestion.projectedDeviation}%`,
          ].join(",");
        }),
      ];
      // Add summary rows
      csvRows.push(""); // Blank line
      csvRows.push(
        `Total Investment Amount:,${parseFloat(
          newInvestmentAmount || 0
        ).toFixed(2)}`
      );
      const totalInvested = recalculatedSuggestions.reduce(
        (sum, s) => sum + parseFloat(s.value),
        0
      );
      csvRows.push(`Total Selected Investment:,${totalInvested.toFixed(2)}`);
      csvRows.push(
        `Unallocated Amount:,${buyOnlyUnallocatedAmount.toFixed(2)}`
      );

      csvContent = csvRows.join("\n");
    } else if (showSellBuyRebalancing && rebalanceActions.length > 0) {
      exportMode = "sellBuy";
      // For sell-buy rebalancing mode, use the rebalanceActions
      const suggestions = rebalanceActions;

      // Calculate shares for each suggestion and get category information
      const suggestionsWithDetails = suggestions.map((suggestion) => {
        const parts = suggestion.action.split(" ");
        const actionType = parts[0]; // BUY or SELL
        const symbol = parts[1]; // AAPL
        const price = stockPrices[symbol] || 0;
        const shares = price > 0 ? Math.floor(suggestion.amount / price) : 0;
        const categoryId = stockCategories[symbol] || "uncategorized";
        const categoryName =
          categories.find((c) => c.id === categoryId)?.name || "Uncategorized";

        return {
          symbol,
          category: categoryName,
          action: suggestion.action,
          shares,
          amount: suggestion.amount,
          currentCategoryPercentage: (
            currentAllocation[categoryId] || 0
          ).toFixed(2),
          targetCategoryPercentage: (modelAllocation[categoryId] || 0).toFixed(
            2
          ),
          deviation: (
            (currentAllocation[categoryId] || 0) -
            (modelAllocation[categoryId] || 0)
          ).toFixed(2),
          projectedCategoryPercentage: (
            simulatedAllocation[categoryId] || 0
          ).toFixed(2),
          projectedDeviation: (
            (simulatedAllocation[categoryId] || 0) -
            (modelAllocation[categoryId] || 0)
          ).toFixed(2),
        };
      });

      const headers = [
        "Symbol",
        "Category",
        "Action",
        "Shares",
        "Amount",
        "Current Category %",
        "Target Category %",
        "Deviation",
        "Projected Category %",
        "Projected Deviation",
      ];

      const csvRows = [
        headers.join(","),
        ...suggestionsWithDetails.map((suggestion) => {
          return [
            `"${suggestion.symbol}"`,
            `"${suggestion.category}"`,
            `"${suggestion.action}"`,
            suggestion.shares,
            parseFloat(suggestion.amount).toFixed(2),
            `${suggestion.currentCategoryPercentage}%`,
            `${suggestion.targetCategoryPercentage}%`,
            `${suggestion.deviation}%`,
            `${suggestion.projectedCategoryPercentage}%`,
            `${suggestion.projectedDeviation}%`,
          ].join(",");
        }),
      ];
      // Add summary rows
      csvRows.push(""); // Blank line
      const totalSell = suggestionsWithDetails
        .filter((s) => s.action.startsWith("SELL"))
        .reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const totalBuy = suggestionsWithDetails
        .filter((s) => s.action.startsWith("BUY"))
        .reduce((sum, s) => sum + parseFloat(s.amount), 0);
      csvRows.push(`Total Sell Value:,${totalSell.toFixed(2)}`);
      csvRows.push(`Total Buy Value:,${totalBuy.toFixed(2)}`);
      csvRows.push(`Net Cash Flow:,${(totalSell - totalBuy).toFixed(2)}`);

      csvContent = csvRows.join("\n");
    } else {
      // Default: Export specific stock suggestions if no mode is active or suggestions exist
      const specificSuggestions = memoizedGenerateSpecificSuggestions();
      if (specificSuggestions.length > 0) {
        exportMode = "specific";
        const headers = [
          "Symbol",
          "Category",
          "Action",
          "Shares",
          "Value",
          "Current Stock %",
          "Target Stock %",
          "Deviation",
        ];
        const csvRows = [
          headers.join(","),
          ...specificSuggestions.map((s) =>
            [
              `"${s.symbol}"`,
              `"${s.category}"`,
              `"${s.action}"`,
              s.shares,
              parseFloat(s.value).toFixed(2),
              `${s.currentPercentage}%`,
              `${s.targetPercentage}%`,
              `${s.deviation}%`,
            ].join(",")
          ),
        ];
        csvContent = csvRows.join("\n");
      } else {
        alert(
          "No rebalancing suggestions available to export for the current view."
        );
        return;
      }
    }

    setCsvExportData(csvContent);
    setShowCsvModal(true);
  };

  const downloadCsv = () => {
    if (!csvExportData) return;

    const blob = new Blob([csvExportData], { type: "text/csv;charset=utf-8;" }); // Added charset
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    let filename = `rebalance-suggestions-${selectedModelPortfolio.replace(
      /\s+/g,
      "-"
    )}-${new Date().toISOString().split("T")[0]}.csv`;
    // Optional: Adjust filename based on mode if needed
    // if (exportMode === 'buyOnly') filename = ...
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowCsvModal(false);
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        align: "center",
        labels: {
          boxWidth: 12,
          font: {
            size: 11,
          },
          padding: 8,
          // Filter out labels with 0 value if needed (can make chart cleaner)
          filter: (legendItem, chartData) => {
            const meta = chartData.datasets[0]._meta;
            // Find the data value corresponding to the legend item
            if (meta) {
              const datasetIndex = 0; // Assuming one dataset
              const index = legendItem.index;
              // This access might change with chart.js versions
              // A safer way might be to look up the value in the original data based on label
              const value = chartData.datasets[datasetIndex].data[index];
              return value > 0.01; // Only show if > 0.01%
            }
            return true; // Default show if meta not found
          },
        },
        display: true,
        maxWidth: 120,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.raw;
            // Ensure value is a number before calling toFixed
            const formattedValue =
              typeof value === "number" ? value.toFixed(2) : "N/A";
            return `${label}: ${formattedValue}%`;
          },
        },
      },
    },
  };

  // Determine which allocation/deviations to show in the main comparison table/charts
  const displayAllocation =
    (showWhatIfAnalysis && whatIfDirty) ||
    showSellBuyRebalancing ||
    (showBuyOnlyRebalancing &&
      (recalculatedSuggestions.length > 0 ||
        parseFloat(newInvestmentAmount || 0) > 0))
      ? simulatedAllocation
      : currentAllocation;
  const displayDeviations =
    (showWhatIfAnalysis && whatIfDirty) ||
    showSellBuyRebalancing ||
    (showBuyOnlyRebalancing &&
      (recalculatedSuggestions.length > 0 ||
        parseFloat(newInvestmentAmount || 0) > 0))
      ? simulatedDeviations
      : deviations;
  const displayLabel =
    showWhatIfAnalysis && whatIfDirty
      ? "Simulated"
      : showSellBuyRebalancing ||
        (showBuyOnlyRebalancing &&
          (recalculatedSuggestions.length > 0 ||
            parseFloat(newInvestmentAmount || 0) > 0))
      ? "Projected"
      : "Current";

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
                  You need to add accounts and positions to compare with your
                  model portfolio.
                </Alert>
              ) : totalPortfolioValue === 0 ? (
                <Alert variant="warning">
                  Your current portfolio has no value. Please update stock
                  prices or add positions.
                </Alert>
              ) : (
                <>
                  <Row className="mb-4">
                    <Col>
                      <div className="d-flex justify-content-between flex-wrap gap-2">
                        {" "}
                        {/* Added flex-wrap and gap */}
                        <div>
                          <Button
                            variant={showWhatIfAnalysis ? "secondary" : "info"}
                            size="sm"
                            onClick={() => {
                              setShowWhatIfAnalysis(!showWhatIfAnalysis);
                              setShowSellBuyRebalancing(false);
                              setShowBuyOnlyRebalancing(false);
                              // Reset simulation if hiding
                              if (showWhatIfAnalysis) resetSimulation();
                            }}
                            className="me-2 mb-1" // Added margin bottom
                          >
                            {showWhatIfAnalysis
                              ? "Hide What-If Analysis"
                              : "What-If Analysis"}
                          </Button>
                          <Button
                            variant={
                              showSellBuyRebalancing ? "secondary" : "info"
                            }
                            size="sm"
                            onClick={() => {
                              setShowSellBuyRebalancing(
                                !showSellBuyRebalancing
                              );
                              setShowWhatIfAnalysis(false);
                              setShowBuyOnlyRebalancing(false);
                              // Reset simulation if hiding or switching
                              setSimulatedAllocation(currentAllocation);
                              setSimulatedDeviations(deviations);
                            }}
                            className="me-2 mb-1" // Added margin bottom
                          >
                            {showSellBuyRebalancing
                              ? "Hide Sell-Buy Rebalance"
                              : "Sell-Buy Rebalance"}
                          </Button>
                          <Button
                            variant={
                              showBuyOnlyRebalancing ? "secondary" : "info"
                            }
                            size="sm"
                            onClick={() => {
                              setShowBuyOnlyRebalancing(
                                !showBuyOnlyRebalancing
                              );
                              setShowWhatIfAnalysis(false);
                              setShowSellBuyRebalancing(false);
                              // Reset simulation and buy-only state if hiding
                              if (showBuyOnlyRebalancing) {
                                setNewInvestmentAmount("");
                                setBuyOnlySuggestions([]);
                                setRecalculatedSuggestions([]);
                                setBuyOnlyUnallocatedAmount(0);
                                setSelectedTrades({});
                                setSimulatedAllocation(currentAllocation);
                                setSimulatedDeviations(deviations);
                              }
                            }}
                            className="mb-1" // Added margin bottom
                          >
                            {showBuyOnlyRebalancing
                              ? "Hide Buy-Only Rebalancing"
                              : "Buy-Only Rebalancing"}
                          </Button>
                        </div>
                        <div>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2 mb-1" // Added margin bottom
                            onClick={prepareJsonExport}
                          >
                            Export to JSON
                          </Button>
                          <Button
                            variant="outline-success"
                            size="sm"
                            className="mb-1" // Added margin bottom
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
                          Simulate how buying or selling assets in specific
                          categories would change your portfolio allocation.
                        </p>
                        {/* What-If Input Rows */}
                        <Row>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label>Category</Form.Label>
                              <Form.Select
                                value={currentTrade.category}
                                onChange={(e) =>
                                  setCurrentTrade((prev) => ({
                                    ...prev,
                                    category: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Select category</option>
                                {categories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                                <option value="uncategorized">
                                  Uncategorized
                                </option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={2}>
                            <Form.Group className="mb-3">
                              <Form.Label>Action</Form.Label>
                              <Form.Select
                                value={currentTrade.action}
                                onChange={(e) =>
                                  setCurrentTrade((prev) => ({
                                    ...prev,
                                    action: e.target.value,
                                  }))
                                }
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
                                  onChange={(e) =>
                                    setCurrentTrade((prev) => ({
                                      ...prev,
                                      amount: e.target.value,
                                    }))
                                  }
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
                              disabled={
                                !currentTrade.category ||
                                !currentTrade.amount ||
                                parseFloat(currentTrade.amount) <= 0
                              }
                              className="me-2"
                            >
                              Add Trade
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={resetSimulation}
                              disabled={whatIfTrades.length === 0}
                            >
                              Reset All
                            </Button>
                          </Col>
                        </Row>

                        {/* Quick Add Buttons */}
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

                        {/* Trades Table */}
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
                                    <td>
                                      {categories.find(
                                        (c) => c.id === trade.category
                                      )?.name || "Uncategorized"}
                                    </td>
                                    <td>
                                      {trade.action === "buy" ? "Buy" : "Sell"}
                                    </td>
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
                                {/* Total Impact Row - Optional */}
                                {/*
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
                                */}
                              </tbody>
                            </Table>
                          </div>
                        )}

                        {/* Simulation Result Alert */}
                        {whatIfDirty && (
                          <Alert variant="info">
                            <strong>Simulation Result:</strong> See updated
                            charts and table below. Projected total portfolio
                            value: $
                            {formatNumber(
                              totalPortfolioValue +
                                whatIfTrades.reduce((sum, trade) => {
                                  const amount = parseFloat(trade.amount) || 0;
                                  const isBuy = trade.action === "buy";
                                  // More careful calculation considering selling limits
                                  if (!isBuy) {
                                    const catValue =
                                      (currentAllocation[trade.category] /
                                        100) *
                                      totalPortfolioValue;
                                    return sum - Math.min(amount, catValue);
                                  }
                                  return sum + amount;
                                }, 0)
                            )}
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
                          This shows suggested trades to rebalance your
                          portfolio by selling overweight positions and buying
                          underweight positions. Results are simulated below.
                        </p>

                        {rebalanceActions.length > 0 ? (
                          <>
                            <div className="table-responsive">
                              <Table striped bordered hover size="sm">
                                <thead>
                                  <tr>
                                    <th>Category</th>
                                    <th>Action</th>
                                    <th>Shares</th>
                                    <th>Amount</th>
                                    {/* <th>Category Deviation</th> */}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rebalanceActions.map((suggestion, index) => {
                                    const symbol =
                                      suggestion.action.split(" ")[1]; // Extract symbol
                                    const price = stockPrices[symbol] || 0;
                                    const shares =
                                      price > 0
                                        ? Math.floor(suggestion.amount / price)
                                        : 0;

                                    return (
                                      <tr
                                        key={index}
                                        className={
                                          suggestion.action.startsWith("SELL")
                                            ? "table-danger"
                                            : "table-success"
                                        }
                                      >
                                        <td>{suggestion.category}</td>
                                        <td>{suggestion.action}</td>
                                        <td>{shares > 0 ? shares : "-"}</td>
                                        <td>
                                          ${formatNumber(suggestion.amount)}
                                        </td>
                                        {/* <td>{suggestion.percent}%</td> */}
                                      </tr>
                                    );
                                  })}
                                  {/* Totals Row */}
                                  <tr className="table-secondary">
                                    <td colSpan={2}>
                                      <strong>Total Sell Value</strong>
                                    </td>
                                    <td colSpan={2} className="text-end">
                                      {" "}
                                      {/* Align right */}
                                      <strong>
                                        $
                                        {formatNumber(
                                          rebalanceActions
                                            .filter((s) =>
                                              s.action.startsWith("SELL")
                                            )
                                            .reduce(
                                              (sum, s) => sum + s.amount,
                                              0
                                            )
                                        )}
                                      </strong>
                                    </td>
                                  </tr>
                                  <tr className="table-secondary">
                                    <td colSpan={2}>
                                      <strong>Total Buy Value</strong>
                                    </td>
                                    <td colSpan={2} className="text-end">
                                      {" "}
                                      {/* Align right */}
                                      <strong>
                                        $
                                        {formatNumber(
                                          rebalanceActions
                                            .filter((s) =>
                                              s.action.startsWith("BUY")
                                            )
                                            .reduce(
                                              (sum, s) => sum + s.amount,
                                              0
                                            )
                                        )}
                                      </strong>
                                    </td>
                                  </tr>
                                </tbody>
                              </Table>
                            </div>
                            <Alert variant="info" className="mt-3">
                              <strong>Note:</strong> These suggestions aim to
                              bring your category allocations closer to the
                              target. See the projected results below.
                            </Alert>

                            {/* Projected View for Sell-Buy */}
                            <h5 className="mt-4 mb-3">
                              Projected Portfolio After Sell-Buy Rebalancing
                            </h5>
                            <Row>
                              <Col md={6}>
                                <h6 className="text-center mb-3">
                                  Model Portfolio
                                </h6>
                                <div className="comparison-chart-container">
                                  <Pie
                                    data={getChartData(
                                      modelAllocation,
                                      "Model Allocation"
                                    )}
                                    options={chartOptions}
                                  />
                                </div>
                              </Col>
                              <Col md={6}>
                                <h6 className="text-center mb-3">
                                  Projected Portfolio
                                </h6>
                                <div className="comparison-chart-container">
                                  <Pie
                                    data={getChartData(
                                      simulatedAllocation,
                                      "Projected Allocation"
                                    )}
                                    options={chartOptions}
                                  />
                                </div>
                              </Col>
                            </Row>
                            <h6 className="mt-4 mb-2">
                              Projected Allocation Comparison (Sell-Buy)
                            </h6>
                            <div className="table-responsive">
                              <Table
                                striped
                                bordered
                                hover
                                size="sm"
                                className="comparison-table"
                              >
                                <thead>
                                  <tr>
                                    <th>Category</th>
                                    <th>Model %</th>
                                    <th>Current %</th>
                                    <th>Projected %</th>
                                    <th>Current Diff.</th>
                                    <th>Projected Diff.</th>
                                    <th>Improvement</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    ...categories,
                                    {
                                      id: "uncategorized",
                                      name: "Uncategorized",
                                    },
                                  ].map((category) => {
                                    const modelAlloc =
                                      modelAllocation[category.id] || 0;
                                    const currentAlloc =
                                      currentAllocation[category.id] || 0;
                                    const projectedAlloc =
                                      simulatedAllocation[category.id] || 0;
                                    const currentDiff =
                                      deviations[category.id] || 0;
                                    const projectedDiff =
                                      simulatedDeviations[category.id] || 0;
                                    const improvement =
                                      Math.abs(currentDiff) -
                                      Math.abs(projectedDiff);
                                    const rowClass =
                                      Math.abs(projectedDiff) <
                                      Math.abs(currentDiff)
                                        ? "table-success"
                                        : improvement < -0.01
                                        ? "table-warning"
                                        : "";

                                    return (
                                      <tr
                                        key={category.id}
                                        className={rowClass}
                                      >
                                        <td>{category.name}</td>
                                        <td>{formatNumber(modelAlloc)}%</td>
                                        <td>{formatNumber(currentAlloc)}%</td>
                                        <td>{formatNumber(projectedAlloc)}%</td>
                                        <td>
                                          {currentDiff >= 0 ? "+" : ""}
                                          {formatNumber(currentDiff)}%
                                        </td>
                                        <td>
                                          {projectedDiff >= 0 ? "+" : ""}
                                          {formatNumber(projectedDiff)}%
                                        </td>
                                        <td
                                          className={
                                            improvement > 0.01
                                              ? "text-success"
                                              : improvement < -0.01
                                              ? "text-danger"
                                              : ""
                                          }
                                        >
                                          {improvement >= 0 ? "+" : ""}
                                          {formatNumber(improvement)}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <Alert variant="warning">
                            No significant sell/buy rebalancing suggestions
                            generated. Your portfolio might be close to the
                            target, or required trades are too small.
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
                          This strategy helps you rebalance toward your target
                          allocation using only new money, without selling any
                          positions. Funds are allocated to underweight
                          categories/stocks, stopping if a category hits its
                          target.
                        </p>
                        <Row className="align-items-end">
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>New Investment Amount ($)</Form.Label>
                              <InputGroup>
                                <InputGroup.Text>$</InputGroup.Text>
                                <Form.Control
                                  type="number"
                                  placeholder="Enter amount or Calc Needed"
                                  value={newInvestmentAmount}
                                  onChange={(e) =>
                                    setNewInvestmentAmount(e.target.value)
                                  }
                                  min="0"
                                  step="500"
                                />
                                {/* Add Button Here */}
                                <Button
                                  variant="outline-primary"
                                  onClick={calculateInvestmentToTarget}
                                  disabled={
                                    isCalculatingNeeded ||
                                    !selectedModelPortfolio
                                  }
                                  title="Calculate approximate amount needed to reach target %s for underweight categories"
                                >
                                  {isCalculatingNeeded
                                    ? "Calculating..."
                                    : "Calc Needed"}
                                </Button>
                              </InputGroup>
                            </Form.Group>
                          </Col>
                          <Col md={6} className="mb-3">
                            <div className="d-flex gap-2 flex-wrap">
                              {" "}
                              {/* Added flex-wrap */}
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() =>
                                  setNewInvestmentAmount((prev) =>
                                    String((parseFloat(prev) || 0) + 10000)
                                  )
                                }
                              >
                                +$10,000
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() =>
                                  setNewInvestmentAmount((prev) =>
                                    String((parseFloat(prev) || 0) + 25000)
                                  )
                                }
                              >
                                +$25,000
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() =>
                                  setNewInvestmentAmount((prev) =>
                                    String((parseFloat(prev) || 0) + 100000)
                                  )
                                }
                              >
                                +$100,000
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => setNewInvestmentAmount("")}
                              >
                                Reset Amount
                              </Button>
                            </div>
                          </Col>
                        </Row>

                        {/* Only show table section if amount is entered */}
                        {parseFloat(newInvestmentAmount || 0) > 0 ? (
                          <>
                            {buyOnlySuggestions.length > 0 ? (
                              <>
                                <p className="mb-3">
                                  <strong>Investment Distribution: </strong>
                                  Showing how to allocate $
                                  {formatNumber(newInvestmentAmount)} across
                                  underweight positions. $
                                  {formatNumber(buyOnlyUnallocatedAmount)} may
                                  be unallocated if adding it would overweight
                                  categories. Select/deselect trades to see
                                  projected impact.
                                </p>
                                <div className="d-flex justify-content-between mb-2 flex-wrap gap-2">
                                  {" "}
                                  {/* Added wrap + gap */}
                                  <div>
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      className="me-2"
                                      onClick={() => {
                                        const newSelectedTrades = {};
                                        buyOnlySuggestions.forEach(
                                          (_, index) => {
                                            newSelectedTrades[index] = true;
                                          }
                                        );
                                        setSelectedTrades(newSelectedTrades);
                                        // Trigger recalculation with all suggestions
                                        recalculateProjectionsForSelectedTrades(
                                          buyOnlySuggestions
                                        );
                                      }}
                                      disabled={buyOnlySuggestions.length === 0}
                                    >
                                      Select All
                                    </Button>
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedTrades({});
                                        setRecalculatedSuggestions([]);
                                        // Recalculate projections for empty set (resets to current)
                                        recalculateProjectionsForSelectedTrades(
                                          []
                                        );
                                      }}
                                      disabled={
                                        recalculatedSuggestions.length === 0
                                      }
                                    >
                                      Deselect All
                                    </Button>
                                  </div>
                                  {/* Unallocated Amount Display */}
                                  {buyOnlyUnallocatedAmount > 1 && (
                                    <Badge bg="info" className="p-2">
                                      Unallocated: $
                                      {formatNumber(buyOnlyUnallocatedAmount)}
                                    </Badge>
                                  )}
                                </div>
                                <div className="table-responsive">
                                  <Table striped bordered hover size="sm">
                                    <thead>
                                      <tr>
                                        <th>Include</th>
                                        <th>Symbol</th>
                                        <th>Category</th>
                                        <th>Shares</th>
                                        <th>Investment</th>
                                        <th>% of New $</th>
                                        <th>Current %</th>
                                        <th>Target %</th>
                                        <th>Deviation</th>
                                        <th>Projected %</th>
                                        <th>Projected Dev.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {/* Map over the ORIGINAL suggestions to always show all rows */}
                                      {buyOnlySuggestions.length > 0 ? (
                                        buyOnlySuggestions.map(
                                          (suggestion, index) => {
                                            // Check if this original suggestion is currently selected
                                            const isSelected = selectedTrades[index] || false;

                                            // Find the corresponding data in recalculatedSuggestions IF it's selected
                                            // This contains the updated projection values based on the current selection set
                                            const projectedData = isSelected
                                              ? recalculatedSuggestions.find(
                                                  (recalcSuggestion) =>
                                                    // Match based on symbol and original value/shares for better uniqueness
                                                    recalcSuggestion.symbol === suggestion.symbol &&
                                                    recalcSuggestion.shares === suggestion.shares &&
                                                    recalcSuggestion.value === suggestion.value
                                                )
                                              : null;

                                            // Use projected data if available, otherwise fallback or show '-'
                                            const displayProjectedPerc = projectedData ? projectedData.projectedPercentage : '-';
                                            const displayProjectedDev = projectedData ? projectedData.projectedDeviation : '-';
                                            const displayAllocationPerc = projectedData ? projectedData.allocationPercent : '0.0'; // Show 0% if deselected

                                            return (
                                              <tr key={index} className={!isSelected ? 'table-light text-muted' : ''}>
                                                <td>
                                                  <Form.Check
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) =>
                                                      handleTradeSelectionChange(
                                                        index, // Use the original index
                                                        e.target.checked
                                                      )
                                                    }
                                                    aria-label={`Select trade for ${suggestion.symbol}`}
                                                  />
                                                </td>
                                                <td>
                                                  <strong>
                                                    {suggestion.symbol}
                                                  </strong>
                                                </td>
                                                <td>{suggestion.category}</td>
                                                {/* Display original suggestion data */}
                                                <td>{suggestion.shares}</td>
                                                <td className="text-end">
                                                  ${formatNumber(suggestion.value)}
                                                </td>
                                                {/* Display allocation % based on selection */}
                                                <td className="text-end">
                                                  {displayAllocationPerc}%
                                                </td>
                                                {/* Display original current/target/deviation */}
                                                <td className="text-end">
                                                  {suggestion.currentPercentage}%
                                                </td>
                                                <td className="text-end">
                                                  {suggestion.targetPercentage}%
                                                </td>
                                                <td
                                                  className={`text-end ${
                                                    !isSelected ? '' : // Only color if selected
                                                    parseFloat(suggestion.deviation) < 0
                                                      ? "text-danger"
                                                      : "text-success"
                                                  }`}
                                                >
                                                  {suggestion.deviation}%
                                                </td>
                                                {/* Use updated projection values if selected, else '-' */}
                                                <td className="text-end">
                                                  {displayProjectedPerc}{displayProjectedPerc !== '-' ? '%' : ''}
                                                </td>
                                                <td className="text-end">
                                                  {displayProjectedDev !== '-' ? (
                                                    <Badge
                                                      bg={
                                                        Math.abs(parseFloat(displayProjectedDev)) < 0.1
                                                          ? "success"
                                                          : parseFloat(displayProjectedDev) > 0
                                                          ? "warning text-dark"
                                                          : "info"
                                                      }
                                                      pill
                                                    >
                                                      {parseFloat(displayProjectedDev) >= 0 ? "+" : ""}
                                                      {displayProjectedDev}%
                                                    </Badge>
                                                  ) : (
                                                    '-' // Show dash if not selected/projected
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          }
                                        )
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan="11"
                                            className="text-center"
                                          >
                                            {/* Adjust message based on whether amount was entered */}
                                            {parseFloat(newInvestmentAmount || 0) > 0
                                              ? "No suggestions generated for this amount."
                                              : "Enter an investment amount."}
                                          </td>
                                        </tr>
                                      )}
                                      {/* Total Row - Ensure this still sums correctly based on recalculatedSuggestions */}
                                      {recalculatedSuggestions.length > 0 && ( // Only show total if something is selected
                                        <tr className="table-secondary">
                                          <td colSpan={3}>
                                            <strong>Selected Total</strong>
                                          </td>
                                          <td>{/* Sum shares if needed */}</td>
                                          <td className="text-end">
                                            <strong>
                                              $
                                              {formatNumber(
                                                recalculatedSuggestions.reduce(
                                                  (sum, s) =>
                                                    sum + parseFloat(s.value),
                                                  0
                                                )
                                              )}
                                            </strong>
                                          </td>
                                          <td className="text-end">
                                            <strong>
                                              {/* Recalculate % of *original* amount based on selected */}
                                              {formatNumber(
                                                parseFloat(newInvestmentAmount) >
                                                  0
                                                  ? (recalculatedSuggestions.reduce(
                                                      (sum, s) =>
                                                        sum + parseFloat(s.value),
                                                      0
                                                    ) /
                                                      parseFloat(
                                                        newInvestmentAmount
                                                      )) *
                                                      100
                                                  : 0
                                              )}
                                              %
                                            </strong>
                                          </td>
                                          <td colSpan={5}></td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </Table>
                                </div>
                              </>
                            ) : (
                              <Alert variant="warning" className="mt-3">
                                No buy suggestions could be generated for this
                                amount. Possible reasons: portfolio is balanced,
                                amount is too small, or missing price data for
                                underweight stocks. $
                                {formatNumber(buyOnlyUnallocatedAmount)} is
                                unallocated.
                              </Alert>
                            )}

                            {/* Projected View for Buy-Only */}
                            {/* Only show projection if there was an investment amount and EITHER suggestions or unallocated amount > 0 */}
                            {(buyOnlySuggestions.length > 0 ||
                              buyOnlyUnallocatedAmount > 0) && (
                              <>
                                <h5 className="mt-4 mb-3">
                                  Projected Portfolio After Buy-Only Rebalancing
                                </h5>
                                <Row>
                                  <Col md={6}>
                                    <h6 className="text-center mb-3">
                                      Model Portfolio
                                    </h6>
                                    <div className="comparison-chart-container">
                                      <Pie
                                        data={getChartData(
                                          modelAllocation,
                                          "Model Allocation"
                                        )}
                                        options={chartOptions}
                                      />
                                    </div>
                                  </Col>
                                  <Col md={6}>
                                    <h6 className="text-center mb-3">
                                      Projected Portfolio
                                    </h6>
                                    <div className="comparison-chart-container">
                                      <Pie
                                        data={getChartData(
                                          simulatedAllocation,
                                          "Projected Allocation"
                                        )}
                                        options={chartOptions}
                                      />
                                    </div>
                                  </Col>
                                </Row>
                                <h6 className="mt-4 mb-2">
                                  Projected Allocation Comparison (Buy-Only)
                                </h6>
                                <div className="table-responsive">
                                  <Table
                                    striped
                                    bordered
                                    hover
                                    size="sm"
                                    className="comparison-table"
                                  >
                                    <thead>
                                      <tr>
                                        <th>Category</th>
                                        <th>Model %</th>
                                        <th>Current %</th>
                                        <th>Projected %</th>
                                        <th>Current Diff.</th>
                                        <th>Projected Diff.</th>
                                        <th>Improvement</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[
                                        ...categories,
                                        {
                                          id: "uncategorized",
                                          name: "Uncategorized",
                                        },
                                      ].map((category) => {
                                        const modelAlloc =
                                          modelAllocation[category.id] || 0;
                                        const currentAlloc =
                                          currentAllocation[category.id] || 0;
                                        const projectedAlloc =
                                          simulatedAllocation[category.id] || 0;
                                        const currentDiff =
                                          deviations[category.id] || 0;
                                        const projectedDiff =
                                          simulatedDeviations[category.id] || 0;
                                        const improvement =
                                          Math.abs(currentDiff) -
                                          Math.abs(projectedDiff);
                                        // Highlight rows where projection is closer to target than current
                                        const rowClass =
                                          Math.abs(projectedDiff) <
                                          Math.abs(currentDiff) - 0.01
                                            ? "table-success"
                                            : improvement < -0.01
                                            ? "table-warning"
                                            : "";

                                        return (
                                          <tr
                                            key={category.id}
                                            className={rowClass}
                                          >
                                            <td>{category.name}</td>
                                            <td className="text-end">
                                              {formatNumber(modelAlloc)}%
                                            </td>
                                            <td className="text-end">
                                              {formatNumber(currentAlloc)}%
                                            </td>
                                            <td className="text-end">
                                              {formatNumber(projectedAlloc)}%
                                            </td>
                                            <td className="text-end">
                                              {currentDiff >= 0 ? "+" : ""}
                                              {formatNumber(currentDiff)}%
                                            </td>
                                            <td className="text-end">
                                              {projectedDiff >= 0 ? "+" : ""}
                                              {formatNumber(projectedDiff)}%
                                            </td>
                                            <td
                                              className={`text-end ${
                                                improvement > 0.01
                                                  ? "text-success"
                                                  : improvement < -0.01
                                                  ? "text-danger"
                                                  : ""
                                              }`}
                                            >
                                              {improvement >= 0 ? "+" : ""}
                                              {formatNumber(improvement)}%
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </Table>
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <Alert variant="secondary" className="mt-3">
                            Enter a new investment amount or use "Calc Needed"
                            to see buy-only suggestions.
                          </Alert>
                        )}
                      </Card.Body>
                    </Card>
                  )}

                  {/* Main Comparison Charts & Table */}
                  <Row>
                    <Col md={6}>
                      <h5 className="text-center mb-3">Model Portfolio</h5>
                      <div className="comparison-chart-container">
                        <Pie
                          data={getChartData(
                            modelAllocation,
                            "Model Allocation"
                          )}
                          options={chartOptions}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <h5 className="text-center mb-3">
                        {displayLabel} Portfolio
                      </h5>
                      <div className="comparison-chart-container">
                        <Pie
                          data={getChartData(
                            displayAllocation,
                            `${displayLabel} Allocation`
                          )}
                          options={chartOptions}
                        />
                      </div>
                    </Col>
                  </Row>

                  <h5 className="mt-4 mb-3">
                    {displayLabel} Allocation Comparison
                  </h5>
                  <div className="table-responsive">
                    <Table striped bordered hover className="comparison-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Model %</th>
                          {/* Show Current always, unless it's the same as display */}
                          {displayAllocation !== currentAllocation && (
                            <th>Current %</th>
                          )}
                          <th>{displayLabel} %</th>
                          {/* Show Current Diff always? */}
                          <th>Current Diff.</th>
                          {/* Only show displayDiff if different from current diff */}
                          {displayDeviations !== deviations && (
                            <th>{displayLabel} Diff.</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...categories,
                          { id: "uncategorized", name: "Uncategorized" },
                        ].map((category) => {
                          const modelAlloc = modelAllocation[category.id] || 0;
                          const currentAlloc =
                            currentAllocation[category.id] || 0;
                          const dispAlloc = displayAllocation[category.id] || 0;
                          const currentDiff = deviations[category.id] || 0;
                          const dispDiff = displayDeviations[category.id] || 0;

                          // Calculate improvement for What-If scenario
                          const improvement = Math.abs(currentDiff) - Math.abs(dispDiff);

                          // Determine row class based on mode and improvement
                          let rowClass = "";
                          if (showWhatIfAnalysis && whatIfDirty) {
                            // What-If Mode: Color based on improvement
                            if (improvement > 0.01) { // Improved (closer to target)
                              rowClass = "table-success";
                            } else if (improvement < -0.01) { // Worsened (further from target)
                              rowClass = "table-danger";
                            }
                            // No significant change or already at target, no specific color needed here
                            // unless you want to keep the old warning/info logic as a fallback
                          } else {
                            // Default Mode (or other modes): Highlight based on the displayed difference magnitude
                            if (Math.abs(dispDiff) > 5) {
                              rowClass = dispDiff > 0 ? "table-warning" : "table-info";
                            }
                          }

                          return (
                            <tr key={category.id} className={rowClass}>
                              <td>{category.name}</td>
                              <td className="text-end">
                                {formatNumber(modelAlloc)}%
                              </td>
                              {displayAllocation !== currentAllocation && (
                                <td className="text-end">
                                  {formatNumber(currentAlloc)}%
                                </td>
                              )}
                              <td className="text-end">
                                {formatNumber(dispAlloc)}%
                              </td>
                              <td className="text-end">
                                {currentDiff >= 0 ? "+" : ""}
                                {formatNumber(currentDiff)}%
                              </td>
                              {displayDeviations !== deviations && (
                                <td className="text-end">
                                  {dispDiff >= 0 ? "+" : ""}
                                  {formatNumber(dispDiff)}%
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
            </>
          ) : (
            <Alert variant="info">
              Please select a model portfolio to compare with your current
              holdings.
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* JSON Export Modal */}
      <Modal
        show={showJsonModal}
        onHide={() => setShowJsonModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>JSON Export Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {" "}
              {/* Added wordBreak */}
              {jsonExportData
                ? JSON.stringify(jsonExportData, null, 2)
                : "Loading..."}
            </pre>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowJsonModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={downloadJson}
            disabled={!jsonExportData}
          >
            Download JSON
          </Button>
        </Modal.Footer>
      </Modal>

      {/* CSV Export Modal */}
      <Modal
        show={showCsvModal}
        onHide={() => setShowCsvModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>CSV Export Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            {/* Comment out the raw preformatted view
            <pre style={{ whiteSpace: "pre", overflowX: "auto" }}>
              {csvExportData || "Loading..."}
            </pre>
            */}
            {/* Render CSV data as a table */}
            {csvExportData ? (
              <Table striped bordered hover size="sm">
                <tbody>
                  {csvExportData.split('\n').map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.split(',').map((cell, cellIndex) => {
                        // Basic unquoting: remove leading/trailing double quotes
                        const cellContent = cell.replace(/^"(.*)"$/, '$1');
                        // Use <th> for the first row (header)
                        return rowIndex === 0 ? (
                          <th key={cellIndex}>{cellContent}</th>
                        ) : (
                          <td key={cellIndex}>{cellContent}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              "Loading..." // Show loading text if data isn't ready
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCsvModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={downloadCsv}
            disabled={!csvExportData}
          >
            Download CSV
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PortfolioComparison;
