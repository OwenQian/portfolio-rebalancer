import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Tabs, Tab } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Import Components
import Header from './components/Header';
import ModelPortfolioManager from './components/ModelPortfolioManager';
import CurrentPortfolio from './components/CurrentPortfolio';
import PortfolioComparison from './components/PortfolioComparison';
import CategoryManager from './components/CategoryManager';
import AllocationChart from './components/AllocationChart';

function App() {
  // State to store model portfolios
  const [modelPortfolios, setModelPortfolios] = useState(() => {
    const savedPortfolios = localStorage.getItem('modelPortfolios');
    return savedPortfolios ? JSON.parse(savedPortfolios) : [];
  });

  // State to store current positions/accounts
  const [accounts, setAccounts] = useState(() => {
    const savedAccounts = localStorage.getItem('accounts');
    return savedAccounts ? JSON.parse(savedAccounts) : [];
  });

  // State to store asset categories
  const [categories, setCategories] = useState(() => {
    const savedCategories = localStorage.getItem('assetCategories');
    return savedCategories ? JSON.parse(savedCategories) : [
      { id: '1', name: 'US Large Cap' },
      { id: '2', name: 'US Small Cap' },
      { id: '3', name: 'International Developed Markets' },
      { id: '4', name: 'Emerging Markets' },
      { id: '5', name: 'International Small Cap' },
      { id: '6', name: 'Emerging Small Cap' },
      { id: '7', name: 'Other' }
    ];
  });

  // State to store stock mappings to categories
  const [stockCategories, setStockCategories] = useState(() => {
    const savedMappings = localStorage.getItem('stockCategories');
    return savedMappings ? JSON.parse(savedMappings) : {};
  });

  // State to store current stock prices
  const [stockPrices, setStockPrices] = useState(() => {
    const savedPrices = localStorage.getItem('stockPrices');
    return savedPrices ? JSON.parse(savedPrices) : {};
  });

  // State for API key
  const [marketstackApiKey, setMarketstackApiKey] = useState(() => {
    const savedApiKey = localStorage.getItem('marketstackApiKey');
    return savedApiKey || '';
  });

  // State for API loading status
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('modelPortfolios', JSON.stringify(modelPortfolios));
  }, [modelPortfolios]);

  useEffect(() => {
    localStorage.setItem('accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('assetCategories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('stockCategories', JSON.stringify(stockCategories));
  }, [stockCategories]);

  useEffect(() => {
    localStorage.setItem('stockPrices', JSON.stringify(stockPrices));
  }, [stockPrices]);

  useEffect(() => {
    localStorage.setItem('marketstackApiKey', marketstackApiKey);
  }, [marketstackApiKey]);

  // Function to update stock prices using Marketstack API
  const updateStockPrices = async (manualPrices = null) => {
    try {
      // If manual prices are provided, use them
      if (manualPrices) {
        setStockPrices(manualPrices);
        return;
      }

      // Get all unique stock symbols from accounts and model portfolios
      const symbols = new Set();
      accounts.forEach(account => {
        account.positions.forEach(position => {
          symbols.add(position.symbol);
        });
      });

      // Also include symbols from model portfolios
      modelPortfolios.forEach(portfolio => {
        portfolio.stocks.forEach(stock => {
          symbols.add(stock.symbol);
        });
      });

      // Convert to array and format for API request
      const symbolsArray = Array.from(symbols);
      
      if (symbolsArray.length === 0) {
        alert('No symbols found in your portfolio.');
        return;
      }

      // Check if API key is provided
      if (!marketstackApiKey) {
        const apiKey = prompt("Please enter your Marketstack API key to fetch real-time stock prices:");
        if (!apiKey) {
          alert('API key is required to fetch stock prices.');
          return;
        }
        setMarketstackApiKey(apiKey);
      }

      setIsLoadingPrices(true);
      setApiError(null);

      // Process symbols in batches of 100 (API limit)
      const batchSize = 100;
      const updatedPrices = { ...stockPrices };
      let failedSymbols = [];
      let successCount = 0;

      for (let i = 0; i < symbolsArray.length; i += batchSize) {
        const batchSymbols = symbolsArray.slice(i, i + batchSize);
        const symbolsString = batchSymbols.join(',');

        try {
          // Make API request to Marketstack
          const response = await fetch(
            `https://api.marketstack.com/v1/eod/latest?access_key=${marketstackApiKey}&symbols=${symbolsString}`
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch stock prices');
          }

          const data = await response.json();

          // Update prices for each symbol in the response
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach(stock => {
              if (stock.symbol && stock.close) {
                updatedPrices[stock.symbol] = parseFloat(stock.close).toFixed(2);
                successCount++;
              } else {
                failedSymbols.push(stock.symbol || 'Unknown');
              }
            });
          }
          
          // Add a small delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error fetching batch of symbols: ${error.message}`);
          failedSymbols = [...failedSymbols, ...batchSymbols];
        }
      }

      setStockPrices(updatedPrices);
      setIsLoadingPrices(false);

      if (failedSymbols.length > 0) {
        setApiError(`Failed to update prices for ${failedSymbols.length} symbols.`);
        console.error('Failed symbols:', failedSymbols);
        alert(`Successfully updated ${successCount} symbols. ${failedSymbols.length} symbols failed to update.`);
      } else {
        alert(`Successfully updated prices for ${successCount} symbols!`);
      }
    } catch (error) {
      console.error('Error updating stock prices:', error);
      setIsLoadingPrices(false);
      setApiError(error.message);
      alert(`Failed to update stock prices: ${error.message}`);
    }
  };

  // Function to update API key
  const updateApiKey = (newKey) => {
    setMarketstackApiKey(newKey);
  };

  return (
    <div className="App">
      <Header />
      <Container fluid className="mt-4">
        <Tabs defaultActiveKey="current" className="mb-4">
          <Tab eventKey="current" title="Current Portfolio">
            <Row>
              <Col md={8}>
                <CurrentPortfolio 
                  accounts={accounts} 
                  setAccounts={setAccounts} 
                  categories={categories}
                  stockCategories={stockCategories} 
                  setStockCategories={setStockCategories}
                  stockPrices={stockPrices}
                  updateStockPrices={updateStockPrices}
                  marketstackApiKey={marketstackApiKey}
                  updateApiKey={updateApiKey}
                  isLoadingPrices={isLoadingPrices}
                  apiError={apiError}
                />
              </Col>
              <Col md={4}>
                <AllocationChart 
                  accounts={accounts} 
                  categories={categories}
                  stockCategories={stockCategories}
                  stockPrices={stockPrices}
                />
              </Col>
            </Row>
          </Tab>
          <Tab eventKey="model" title="Model Portfolios">
            <ModelPortfolioManager 
              modelPortfolios={modelPortfolios} 
              setModelPortfolios={setModelPortfolios} 
              categories={categories}
              stockCategories={stockCategories}
              setStockCategories={setStockCategories}
            />
          </Tab>
          <Tab eventKey="compare" title="Portfolio Comparison">
            <PortfolioComparison 
              modelPortfolios={modelPortfolios}
              accounts={accounts}
              categories={categories}
              stockCategories={stockCategories}
              stockPrices={stockPrices}
            />
          </Tab>
          <Tab eventKey="categories" title="Categories">
            <CategoryManager 
              categories={categories} 
              setCategories={setCategories}
              stockCategories={stockCategories}
              setStockCategories={setStockCategories} 
            />
          </Tab>
        </Tabs>
      </Container>
    </div>
  );
}

export default App;
