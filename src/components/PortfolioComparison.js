import React, { useState, useEffect } from 'react';
import { Card, Table, Row, Col, Form, Button, Alert, Badge } from 'react-bootstrap';
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
  const [deviations, setDeviations] = useState({});
  const [rebalanceActions, setRebalanceActions] = useState([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [specificRebalancingSuggestions, setSpecificRebalancingSuggestions] = useState([]);
  const [showSpecificSuggestions, setShowSpecificSuggestions] = useState(false);

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
  const calculateModelAllocation = (portfolioId) => {
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
  };

  // Calculate current portfolio allocation by category
  const calculateCurrentAllocation = () => {
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
  };

  // Calculate deviations between model and current allocations
  const calculateDeviations = (model, current) => {
    const deviations = {};
    
    categories.forEach(category => {
      const modelAlloc = model[category.id] || 0;
      const currentAlloc = current[category.id] || 0;
      deviations[category.id] = currentAlloc - modelAlloc;
    });
    
    deviations['uncategorized'] = (current['uncategorized'] || 0) - (model['uncategorized'] || 0);
    
    return deviations;
  };

  // Generate rebalancing suggestions
  const generateRebalanceActions = () => {
    if (!selectedModelPortfolio || totalPortfolioValue <= 0) return [];
    
    const actions = [];
    
    categories.forEach(category => {
      const deviation = deviations[category.id] || 0;
      const modelAlloc = modelAllocation[category.id] || 0;
      const currentAlloc = currentAllocation[category.id] || 0;
      
      // Only suggest actions for significant deviations (greater than 1%)
      if (Math.abs(deviation) > 1) {
        const amountDifference = (deviation / 100) * totalPortfolioValue;
        
        if (deviation > 0) {
          // Overweight - need to reduce
          actions.push({
            category: category.name,
            action: 'Sell',
            percent: deviation.toFixed(2),
            amount: Math.abs(amountDifference).toFixed(2)
          });
        } else {
          // Underweight - need to increase
          actions.push({
            category: category.name,
            action: 'Buy',
            percent: Math.abs(deviation).toFixed(2),
            amount: Math.abs(amountDifference).toFixed(2)
          });
        }
      }
    });
    
    // Also check uncategorized assets
    const uncategorizedDeviation = deviations['uncategorized'] || 0;
    if (Math.abs(uncategorizedDeviation) > 1) {
      const amountDifference = (uncategorizedDeviation / 100) * totalPortfolioValue;
      
      if (uncategorizedDeviation > 0) {
        actions.push({
          category: 'Uncategorized',
          action: 'Sell',
          percent: uncategorizedDeviation.toFixed(2),
          amount: Math.abs(amountDifference).toFixed(2)
        });
      } else {
        actions.push({
          category: 'Uncategorized',
          action: 'Buy',
          percent: Math.abs(uncategorizedDeviation).toFixed(2),
          amount: Math.abs(amountDifference).toFixed(2)
        });
      }
    }
    
    return actions;
  };

  // Generate specific stock-level rebalancing suggestions
  const generateSpecificSuggestions = () => {
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
  };

  // Update calculations when model portfolio selection changes
  useEffect(() => {
    if (selectedModelPortfolio) {
      const model = calculateModelAllocation(selectedModelPortfolio);
      const current = calculateCurrentAllocation();
      
      setModelAllocation(model);
      setCurrentAllocation(current);
      setDeviations(calculateDeviations(model, current));
    }
  }, [selectedModelPortfolio]);

  // Update rebalance actions when deviations change
  useEffect(() => {
    setRebalanceActions(generateRebalanceActions());
    setSpecificRebalancingSuggestions(generateSpecificSuggestions());
  }, [deviations, totalPortfolioValue, selectedModelPortfolio]);

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

  // Handle exporting data to JSON
  const exportToJson = () => {
    if (!selectedModelPortfolio) return;
    
    const data = {
      modelPortfolio: modelPortfolios.find(p => p.name === selectedModelPortfolio),
      currentAllocation,
      modelAllocation,
      deviations,
      rebalanceActions,
      specificSuggestions: specificRebalancingSuggestions,
      totalPortfolioValue
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-comparison-${selectedModelPortfolio}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Handle exporting data to CSV
  const exportToCsv = () => {
    if (!selectedModelPortfolio) return;
    
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
    
    // Format rebalance data for CSV
    const rebalanceData = specificRebalancingSuggestions.map(item => ({
      Symbol: item.symbol,
      Action: item.action,
      Shares: item.shares,
      Value: `$${formatNumber(item.value)}`,
      Category: item.category,
      CurrentAllocation: `${item.currentPercentage}%`,
      TargetAllocation: `${item.targetPercentage}%`,
      Deviation: `${item.deviation}%`
    }));
    
    if (rebalanceData.length === 0) {
      alert('No rebalancing data to export');
      return;
    }
    
    const csvString = convertToCSV(rebalanceData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebalance-suggestions-${selectedModelPortfolio}-${new Date().toISOString().slice(0, 10)}.csv`;
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
        labels: {
          boxWidth: 12
        }
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
                      <div className="d-flex justify-content-end">
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="me-2"
                          onClick={exportToJson}
                        >
                          Export to JSON
                        </Button>
                        <Button 
                          variant="outline-success" 
                          size="sm"
                          onClick={exportToCsv}
                        >
                          Export to CSV
                        </Button>
                      </div>
                    </Col>
                  </Row>
                
                  <Row>
                    <Col md={6}>
                      <h5 className="text-center mb-3">Model Portfolio</h5>
                      <div className="chart-container" style={{ height: '300px' }}>
                        <Pie data={getChartData(modelAllocation, 'Model Allocation')} options={chartOptions} />
                      </div>
                    </Col>
                    <Col md={6}>
                      <h5 className="text-center mb-3">Current Portfolio</h5>
                      <div className="chart-container" style={{ height: '300px' }}>
                        <Pie data={getChartData(currentAllocation, 'Current Allocation')} options={chartOptions} />
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
                          <th>Current Allocation</th>
                          <th>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(category => {
                          const modelAlloc = modelAllocation[category.id] || 0;
                          const currentAlloc = currentAllocation[category.id] || 0;
                          const diff = deviations[category.id] || 0;
                          const rowClass = Math.abs(diff) > 5 ? (diff > 0 ? 'table-danger' : 'table-success') : '';

                          return (
                            <tr key={category.id} className={rowClass}>
                              <td>{category.name}</td>
                              <td>{formatNumber(modelAlloc)}%</td>
                              <td>{formatNumber(currentAlloc)}%</td>
                              <td>{diff > 0 ? '+' : ''}{formatNumber(diff)}%</td>
                            </tr>
                          );
                        })}
                        <tr className={Math.abs(deviations['uncategorized'] || 0) > 5 ? 'table-danger' : ''}>
                          <td>Uncategorized</td>
                          <td>{formatNumber(modelAllocation['uncategorized'] || 0)}%</td>
                          <td>{formatNumber(currentAllocation['uncategorized'] || 0)}%</td>
                          <td>
                            {(deviations['uncategorized'] || 0) > 0 ? '+' : ''}
                            {formatNumber(deviations['uncategorized'] || 0)}%
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>

                  {rebalanceActions.length > 0 && (
                    <>
                      <h5 className="mt-4 mb-3">Rebalancing Actions</h5>
                      <div className="table-responsive">
                        <Table striped bordered hover>
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Action</th>
                              <th>% Difference</th>
                              <th>Amount ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rebalanceActions.map((action, index) => (
                              <tr key={index}>
                                <td>{action.category}</td>
                                <td>{action.action}</td>
                                <td>{action.percent}%</td>
                                <td>{formatDollarAmount(action.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                      
                      <div className="text-center mt-3 mb-3">
                        <Button
                          variant="primary"
                          onClick={() => setShowSpecificSuggestions(!showSpecificSuggestions)}
                        >
                          {showSpecificSuggestions 
                            ? 'Hide Specific Rebalancing Suggestions' 
                            : 'Show Specific Rebalancing Suggestions'}
                        </Button>
                      </div>
                      
                      {showSpecificSuggestions && specificRebalancingSuggestions.length > 0 && (
                        <>
                          <h5 className="mt-4 mb-3">Specific Rebalancing Suggestions</h5>
                          <Alert variant="info">
                            The following suggestions provide specific buy/sell recommendations for individual stocks to help you rebalance your portfolio.
                          </Alert>
                          <div className="table-responsive">
                            <Table striped bordered hover>
                              <thead>
                                <tr>
                                  <th>Action</th>
                                  <th>Symbol</th>
                                  <th>Category</th>
                                  <th>Shares</th>
                                  <th>Value ($)</th>
                                  <th>Current %</th>
                                  <th>Target %</th>
                                  <th>Deviation</th>
                                </tr>
                              </thead>
                              <tbody>
                                {specificRebalancingSuggestions.map((suggestion, index) => (
                                  <tr key={index}>
                                    <td>
                                      <Badge bg={suggestion.action === 'Buy' ? 'success' : 'danger'}>
                                        {suggestion.action}
                                      </Badge>
                                    </td>
                                    <td>{suggestion.symbol}</td>
                                    <td>{suggestion.category}</td>
                                    <td>{formatNumber(suggestion.shares, 0)}</td>
                                    <td>{formatDollarAmount(suggestion.value)}</td>
                                    <td>{suggestion.currentPercentage}%</td>
                                    <td>{suggestion.targetPercentage}%</td>
                                    <td>{suggestion.deviation > 0 ? '+' : ''}{suggestion.deviation}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </>
                      )}
                    </>
                  )}
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
    </div>
  );
};

export default PortfolioComparison;
