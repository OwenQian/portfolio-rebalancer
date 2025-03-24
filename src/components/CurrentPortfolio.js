import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Form, Row, Col, Modal, Badge, Accordion, Spinner, Alert } from 'react-bootstrap';
import { formatDollarAmount } from '../utils/formatters';
import PortfolioValueChart from './PortfolioValueChart';
import PriceInput from './PriceInput';

const CurrentPortfolio = ({ 
  accounts, 
  setAccounts, 
  categories, 
  stockCategories, 
  setStockCategories, 
  stockPrices, 
  updateStockPrices,
  marketstackApiKey,
  updateApiKey,
  isLoadingPrices,
  apiError,
  modelPortfolios,
  portfolioValueHistory,
  setPortfolioValueHistory
}) => {
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showSyncPricesModal, setShowSyncPricesModal] = useState(false);
  const [selectedStocksToSync, setSelectedStocksToSync] = useState({});
  const [tempApiKey, setTempApiKey] = useState(marketstackApiKey || '');
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [newSymbol, setNewSymbol] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addPositionBy, setAddPositionBy] = useState('shares'); // 'shares' or 'value'
  const [newCategory, setNewCategory] = useState('');
  const [editingAssets, setEditingAssets] = useState(false);
  const [tempPrices, setTempPrices] = useState({...stockPrices});
  const [tempCategories, setTempCategories] = useState({...stockCategories});
  const [expandedAccounts, setExpandedAccounts] = useState(Array(accounts.length).fill(true).map((_, i) => i.toString()));
  const [sortedSnapshotHistory, setSortedSnapshotHistory] = useState([]);
  const [editingSnapshotIndex, setEditingSnapshotIndex] = useState(null);
  const [editSnapshotValue, setEditSnapshotValue] = useState('');
  const [editSnapshotDate, setEditSnapshotDate] = useState('');
  const [newSnapshotValue, setNewSnapshotValue] = useState('');
  const [newSnapshotDate, setNewSnapshotDate] = useState('');
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);

  // Update expandedAccounts when accounts are added or removed
  useEffect(() => {
    // Default to having all accounts collapsed when accounts change
    setExpandedAccounts([]);
  }, [accounts.length]);

  const getAllUniqueStockSymbols = () => {
    const symbols = new Set();
    
    // Add symbols from accounts
    accounts.forEach(account => {
      account.positions.forEach(position => {
        symbols.add(position.symbol);
      });
    });
    
    // Add symbols from model portfolios
    modelPortfolios?.forEach(portfolio => {
      portfolio.stocks.forEach(stock => {
        symbols.add(stock.symbol);
      });
    });
    
    // Add symbols from stockPrices and stockCategories
    Object.keys(stockPrices).forEach(symbol => {
      symbols.add(symbol);
    });
    
    Object.keys(stockCategories).forEach(symbol => {
      symbols.add(symbol);
    });
    
    // When in editing mode, also add symbols from temporary states
    if (editingAssets) {
      Object.keys(tempPrices).forEach(symbol => {
        symbols.add(symbol);
      });
      
      Object.keys(tempCategories).forEach(symbol => {
        symbols.add(symbol);
      });
    }
    
    return Array.from(symbols).sort();
  };

  const handlePriceChange = (symbol, price) => {
    // Allow empty input or input that could become a valid number
    // Don't validate until complete - this allows the user to type freely
    if (price === '' || price === '.') {
      setTempPrices(prev => ({
        ...prev,
        [symbol]: price
      }));
      return;
    }
    
    // Only do numeric validation when we have a complete value
    if (!/^[0-9]*\.?[0-9]*$/.test(price)) {
      return; // Reject invalid characters but don't show alert
    }
    
    // Update the price without formatting until blur event
    setTempPrices(prev => ({
      ...prev,
      [symbol]: price
    }));
  };

  const handleCategoryChange = (symbol, categoryId) => {
    setTempCategories(prev => ({
      ...prev,
      [symbol]: categoryId
    }));
  };

  const saveAssetSettings = () => {
    // Format all prices to ensure they have 2 decimal places
    const formattedPrices = {};
    
    // Format each price entry to ensure it has 2 decimal places
    Object.entries(tempPrices).forEach(([symbol, price]) => {
      try {
        // Handle empty or incomplete values
        if (price === '' || price === '.') {
          formattedPrices[symbol] = '0.00';
        } else {
          const numValue = parseFloat(price);
          if (!isNaN(numValue)) {
            formattedPrices[symbol] = numValue.toFixed(2);
          } else {
            formattedPrices[symbol] = '0.00';
          }
        }
      } catch (e) {
        console.error(`Error formatting price for ${symbol}:`, e);
        formattedPrices[symbol] = '0.00';
      }
    });
    
    updateStockPrices(formattedPrices);
    setStockCategories(tempCategories);
    setEditingAssets(false);
    alert('Asset settings updated successfully');
  };

  const cancelAssetEditing = () => {
    setTempPrices({...stockPrices});
    setTempCategories({...stockCategories});
    setEditingAssets(false);
  };

  const getStocksInUse = () => {
    const usedSymbols = new Set();
    
    // Add symbols from accounts
    accounts.forEach(account => {
      account.positions.forEach(position => {
        usedSymbols.add(position.symbol);
      });
    });
    
    // Also keep symbols from model portfolios
    modelPortfolios?.forEach(portfolio => {
      portfolio.stocks.forEach(stock => {
        usedSymbols.add(stock.symbol);
      });
    });
    
    return usedSymbols;
  };

  const handleCleanupUnusedStocks = () => {
    const usedSymbols = getStocksInUse();
    
    // Debug: Log the symbols that are being used
    console.log('Symbols in use:', Array.from(usedSymbols));
    
    // Create new objects with only the stocks that are in use
    const cleanedPrices = {};
    const cleanedCategories = {};
    const removedStocks = [];
    
    // Only keep the stocks that are in use
    Object.keys(stockPrices).forEach(symbol => {
      if (usedSymbols.has(symbol)) {
        cleanedPrices[symbol] = stockPrices[symbol];
      } else {
        removedStocks.push(symbol);
      }
    });
    
    Object.keys(stockCategories).forEach(symbol => {
      if (usedSymbols.has(symbol)) {
        cleanedCategories[symbol] = stockCategories[symbol];
      } else if (!removedStocks.includes(symbol)) {
        removedStocks.push(symbol);
      }
    });
    
    // Update the state
    updateStockPrices(cleanedPrices);
    setStockCategories(cleanedCategories);
    
    // Also update the temporary state used for editing
    setTempPrices(cleanedPrices);
    setTempCategories(cleanedCategories);
    
    if (removedStocks.length === 0) {
      alert('No unused stocks found to remove.');
    } else {
      alert(`Removed ${removedStocks.length} unused stocks: ${removedStocks.join(', ')}`);
    }
  };

  const handleSyncPrices = () => {
    // Initialize selected stocks state with all stocks selected
    const initialSelectedStocks = {};
    const symbols = getAllUniqueStockSymbols();
    symbols.forEach(symbol => {
      initialSelectedStocks[symbol] = true;
    });
    setSelectedStocksToSync(initialSelectedStocks);
    setTempApiKey(marketstackApiKey || '');
    setShowSyncPricesModal(true);
  };

  const handleSyncSelectedPrices = () => {
    const selectedSymbols = Object.keys(selectedStocksToSync).filter(symbol => selectedStocksToSync[symbol]);
    if (selectedSymbols.length === 0) {
      alert('Please select at least one stock to update.');
      return;
    }
    
    // Save API key if changed
    if (tempApiKey !== marketstackApiKey) {
      updateApiKey(tempApiKey);
    }
    
    updateStockPrices(null, selectedSymbols);
    setShowSyncPricesModal(false);
  };

  const handleSelectAllStocks = () => {
    const allSelected = {};
    getAllUniqueStockSymbols().forEach(symbol => {
      allSelected[symbol] = true;
    });
    setSelectedStocksToSync(allSelected);
  };

  const handleDeselectAllStocks = () => {
    const allDeselected = {};
    getAllUniqueStockSymbols().forEach(symbol => {
      allDeselected[symbol] = false;
    });
    setSelectedStocksToSync(allDeselected);
  };

  const handleStockSelectionChange = (symbol, isSelected) => {
    setSelectedStocksToSync(prev => ({
      ...prev,
      [symbol]: isSelected
    }));
  };

  const handleAddAccount = () => {
    setNewAccountName('');
    setShowAddAccountModal(true);
  };

  const handleSaveAccount = () => {
    if (!newAccountName.trim()) {
      alert('Please enter an account name');
      return;
    }

    const newAccount = {
      id: Date.now().toString(),
      name: newAccountName,
      positions: []
    };

    setAccounts([...accounts, newAccount]);
    setShowAddAccountModal(false);
  };

  const handleDeleteAccount = (accountId) => {
    if (window.confirm('Are you sure you want to delete this account? All positions will be lost.')) {
      const updatedAccounts = accounts.filter(account => account.id !== accountId);
      setAccounts(updatedAccounts);
    }
  };

  const handleAddPosition = (account) => {
    setSelectedAccount(account);
    setNewSymbol('');
    setNewShares('');
    setNewValue('');
    setNewPrice('');
    setAddPositionBy('shares');
    setNewCategory('');
    setShowAddPositionModal(true);
  };

  const handleSavePosition = () => {
    if (!newSymbol.trim()) {
      alert('Please enter a stock symbol');
      return;
    }

    const symbol = newSymbol.toUpperCase();
    let shares = 0;

    if (addPositionBy === 'shares') {
      if (!newShares || isNaN(newShares) || Number(newShares) <= 0) {
        alert('Please enter a valid number of shares');
        return;
      }
      shares = Number(newShares);
    } else {
      // Adding by dollar value
      if (!newValue || isNaN(newValue) || Number(newValue) <= 0) {
        alert('Please enter a valid dollar value');
        return;
      }

      const price = stockPrices[symbol];
      if (!price || price <= 0) {
        alert('No price available for this symbol. Please update prices first or add by shares.');
        return;
      }

      // Calculate shares based on dollar value and price
      shares = Number(newValue) / price;
      
      // Round to 4 decimal places to handle fractional shares
      shares = Math.round(shares * 10000) / 10000;
    }

    // Update stock price if provided
    if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
      const formattedPrice = parseFloat(newPrice).toFixed(2);
      const updatedPrices = {
        ...stockPrices,
        [symbol]: formattedPrice
      };
      updateStockPrices(updatedPrices);
      
      // Also update temporary prices used in asset settings
      setTempPrices({
        ...tempPrices,
        [symbol]: formattedPrice
      });
    }

    if (newCategory) {
      // Update both the main stockCategories and the temporary one used in asset settings
      const updatedCategories = {
        ...stockCategories,
        [symbol]: newCategory
      };
      setStockCategories(updatedCategories);
      setTempCategories({
        ...tempCategories,
        [symbol]: newCategory
      });
    }

    const updatedAccounts = accounts.map(account => {
      if (account.id === selectedAccount.id) {
        const existingPositionIndex = account.positions.findIndex(
          position => position.symbol === symbol
        );

        if (existingPositionIndex >= 0) {
          const updatedPositions = [...account.positions];
          updatedPositions[existingPositionIndex].shares += shares;
          return {
            ...account,
            positions: updatedPositions
          };
        } else {
          return {
            ...account,
            positions: [
              ...account.positions,
              { symbol, shares }
            ]
          };
        }
      }
      return account;
    });

    setAccounts(updatedAccounts);
    setShowAddPositionModal(false);
  };

  const handleDeletePosition = (accountId, positionIndex) => {
    if (window.confirm('Are you sure you want to delete this position?')) {
      const updatedAccounts = accounts.map(account => {
        if (account.id === accountId) {
          const updatedPositions = [...account.positions];
          updatedPositions.splice(positionIndex, 1);
          return {
            ...account,
            positions: updatedPositions
          };
        }
        return account;
      });

      setAccounts(updatedAccounts);
    }
  };

  const handleUpdateShares = (accountId, positionIndex, shares) => {
    if (isNaN(shares) || shares <= 0) {
      alert('Please enter a valid number of shares');
      return;
    }

    const updatedAccounts = accounts.map(account => {
      if (account.id === accountId) {
        const updatedPositions = [...account.positions];
        updatedPositions[positionIndex].shares = Number(shares);
        return {
          ...account,
          positions: updatedPositions
        };
      }
      return account;
    });

    setAccounts(updatedAccounts);
  };

  const calculatePositionValue = (symbol, shares) => {
    const price = editingAssets ? tempPrices[symbol] || 0 : stockPrices[symbol] || 0;
    return (price * shares).toFixed(2);
  };

  const calculateAccountTotal = (account) => {
    return account.positions.reduce((total, position) => {
      return total + parseFloat(calculatePositionValue(position.symbol, position.shares));
    }, 0).toFixed(2);
  };

  const calculatePortfolioTotal = () => {
    return accounts.reduce((total, account) => {
      return total + parseFloat(calculateAccountTotal(account));
    }, 0).toFixed(2);
  };

  const handleAddNewStock = () => {
    if (!newSymbol.trim()) {
      alert('Please enter a stock symbol');
      return;
    }

    const symbol = newSymbol.toUpperCase();
    
    // Check if the stock already exists in the temp prices (which now shows all currently displayed stocks)
    if (tempPrices[symbol]) {
      alert('This stock is already in your portfolio.');
      return;
    }

    // More permissive price validation
    if (!newPrice || newPrice === '.') {
      alert('Please enter a valid price');
      return;
    }

    let formattedPrice;
    try {
      const numValue = parseFloat(newPrice);
      if (isNaN(numValue) || numValue < 0) {
        alert('Please enter a valid price');
        return;
      }
      formattedPrice = numValue.toFixed(2);
    } catch (e) {
      alert('Please enter a valid price');
      return;
    }

    // Update temporary prices and categories
    setTempPrices(prev => ({
      ...prev,
      [symbol]: formattedPrice
    }));
    
    if (newCategory) {
      setTempCategories(prev => ({
        ...prev,
        [symbol]: newCategory
      }));
    }

    // Provide feedback that the stock was added
    alert(`${symbol} added to asset settings with price $${formattedPrice}. Remember to save changes.`);

    // Reset form fields for next entry
    setNewSymbol('');
    setNewPrice('');
    setNewCategory('');
  };

  // Handle editing a snapshot
  const handleEditSnapshot = (index) => {
    const snapshot = sortedSnapshotHistory[index];
    
    // Convert date to the format expected by datetime-local input
    const dateObj = new Date(snapshot.date);
    const formattedDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    
    setEditSnapshotValue(snapshot.value);
    setEditSnapshotDate(formattedDate);
    setEditingSnapshotIndex(index);
  };

  // Handle saving edited snapshot
  const handleSaveEditedSnapshot = () => {
    if (!editSnapshotValue || isNaN(parseFloat(editSnapshotValue)) || parseFloat(editSnapshotValue) <= 0) {
      alert('Please enter a valid snapshot value');
      return;
    }
    
    if (!editSnapshotDate) {
      alert('Please select a valid date');
      return;
    }

    // Ensure portfolioValueHistory is an array
    if (!portfolioValueHistory || !Array.isArray(portfolioValueHistory)) {
      return;
    }

    const value = parseFloat(editSnapshotValue).toFixed(2);
    
    // Handle date with care to prevent timezone issues
    const inputDate = new Date(editSnapshotDate);
    // Convert to UTC ISO string to ensure consistent timezone handling
    const date = inputDate.toISOString();
    
    // Get the record to edit from sorted history
    const recordToEdit = sortedSnapshotHistory[editingSnapshotIndex];
    
    // Use a more robust method to find the entry - match by approximate time and value
    // This avoids issues where exact date string equality might fail due to timezone or formatting differences
    const actualIndex = portfolioValueHistory.findIndex(record => {
      // Match by approximate time (within 1 second) and exact value and type
      const recordDate = new Date(record.date).getTime();
      const editDate = new Date(recordToEdit.date).getTime();
      const timeDiff = Math.abs(recordDate - editDate);
      
      return timeDiff < 1000 && // Within 1 second
             record.value === recordToEdit.value && 
             record.type === recordToEdit.type;
    });
    
    if (actualIndex !== -1) {
      // Create an updated copy of the history
      const updatedHistory = [...portfolioValueHistory];
      // Update the record with new values but keep the same type
      updatedHistory[actualIndex] = {
        ...updatedHistory[actualIndex],
        date,
        value
      };
      
      // Update the state which will trigger useEffect to update sortedSnapshotHistory
      setPortfolioValueHistory(updatedHistory);
      
      // Exit edit mode
      setEditingSnapshotIndex(null);
    } else {
      // If we couldn't find the exact record, add a new one
      // This is a fallback to prevent data loss
      alert('Could not find the original snapshot record. Adding as a new snapshot instead.');
      
      setPortfolioValueHistory([
        ...portfolioValueHistory,
        { date, value, type: 'snapshot' }
      ]);
      
      // Exit edit mode
      setEditingSnapshotIndex(null);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingSnapshotIndex(null);
  };

  // Handle adding a new snapshot manually
  const handleAddManualSnapshot = (e) => {
    e.preventDefault();
    
    if (!newSnapshotValue || isNaN(parseFloat(newSnapshotValue)) || parseFloat(newSnapshotValue) <= 0) {
      alert('Please enter a valid snapshot value');
      return;
    }
    
    if (!newSnapshotDate) {
      alert('Please select a valid date');
      return;
    }

    const value = parseFloat(newSnapshotValue).toFixed(2);
    
    // Handle date with care to prevent timezone issues
    const inputDate = new Date(newSnapshotDate);
    // Convert to UTC ISO string to ensure consistent timezone handling
    const date = inputDate.toISOString();
    
    // Ensure portfolioValueHistory is an array before updating
    const currentHistory = Array.isArray(portfolioValueHistory) ? portfolioValueHistory : [];
    
    // Create a new snapshot record and add to history
    setPortfolioValueHistory([
      ...currentHistory,
      { date, value, type: 'snapshot' }
    ]);
    
    // Reset form fields
    setNewSnapshotValue('');
    setNewSnapshotDate('');
    
    alert('Snapshot added successfully!');
  };

  const handleDeleteSnapshot = (index) => {
    if (window.confirm('Are you sure you want to delete this snapshot?')) {
      // Ensure portfolioValueHistory is an array
      if (!portfolioValueHistory || !Array.isArray(portfolioValueHistory)) {
        return;
      }
      
      // Get the record to delete from sorted history
      const recordToDelete = sortedSnapshotHistory[index];
      
      // Use the same robust matching method as in handleSaveEditedSnapshot
      const actualIndex = portfolioValueHistory.findIndex(record => {
        // Match by approximate time (within 1 second) and exact value and type
        const recordDate = new Date(record.date).getTime();
        const deleteDate = new Date(recordToDelete.date).getTime();
        const timeDiff = Math.abs(recordDate - deleteDate);
        
        return timeDiff < 1000 && // Within 1 second
               record.value === recordToDelete.value && 
               record.type === recordToDelete.type;
      });
      
      if (actualIndex !== -1) {
        const updatedHistory = [...portfolioValueHistory];
        updatedHistory.splice(actualIndex, 1);
        setPortfolioValueHistory(updatedHistory);
      } else {
        alert('Could not find the snapshot to delete. Please try again.');
      }
    }
  };

  // Format date for display in snapshot list
  const formatDateAndTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Update sorted snapshot history whenever portfolio value history changes
  const updateSortedSnapshotHistory = useCallback(() => {
    // Check if portfolioValueHistory is an array
    if (!portfolioValueHistory || !Array.isArray(portfolioValueHistory)) {
      setSortedSnapshotHistory([]);
      return;
    }
    
    // Create a sorted copy of the history (newest first)
    const sorted = [...portfolioValueHistory].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    setSortedSnapshotHistory(sorted);
  }, [portfolioValueHistory]);

  // Initialize date input with current date and time when opening modal
  useEffect(() => {
    if (showSnapshotModal) {
      const now = new Date();
      // Format date in the format expected by datetime-local input (YYYY-MM-DDThh:mm)
      const formattedDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setNewSnapshotDate(formattedDate);
    }
  }, [showSnapshotModal]);

  // Update sorted history whenever the original history changes
  useEffect(() => {
    updateSortedSnapshotHistory();
  }, [updateSortedSnapshotHistory]);

  // Take a snapshot of the current portfolio value
  const handleTakeSnapshot = () => {
    // Calculate the current portfolio total
    const totalValue = calculatePortfolioTotal();
    
    // Ensure portfolioValueHistory is an array before updating
    const currentHistory = Array.isArray(portfolioValueHistory) ? portfolioValueHistory : [];
    
    // Create date in UTC ISO format with consistent timezone to avoid boundary issues
    const now = new Date();
    const isoDate = now.toISOString();
    
    // Record the snapshot
    setPortfolioValueHistory([
      ...currentHistory,
      { date: isoDate, value: totalValue, type: 'snapshot' }
    ]);
    
    alert(`Portfolio snapshot recorded: ${formatDollarAmount(totalValue)}`);
    
    // Close the modal after taking a snapshot
    setShowSnapshotModal(false);
  };

  // Reset error dismissed state when apiError changes
  useEffect(() => {
    if (apiError) {
      setIsErrorDismissed(false);
    }
  }, [apiError]);

  return (
    <div>
      <Row className="mb-4">
        <Col md={6}>
          <h2 className="section-title">Current Portfolio</h2>
        </Col>
        <Col md={6} className="text-end">
          <Button variant="primary" onClick={handleAddAccount} className="me-2">
            Add Account
          </Button>
          {isLoadingPrices ? (
            <Button variant="warning" disabled className="me-2">
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
              Updating Prices...
            </Button>
          ) : (
            <>
              {editingAssets ? (
                <>
                  <Button variant="success" onClick={saveAssetSettings} className="me-2">
                    Save Settings
                  </Button>
                  <Button variant="secondary" onClick={cancelAssetEditing} className="me-2">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="warning" onClick={() => setEditingAssets(true)} className="me-2">
                    Asset Settings
                  </Button>
                  <Button variant="success" onClick={handleSyncPrices} className="me-2">
                    Sync Prices
                  </Button>
                  <Button variant="primary" onClick={() => setShowSnapshotModal(true)}>
                    Manage Snapshots
                  </Button>
                </>
              )}
            </>
          )}
        </Col>
      </Row>

      {apiError && !isErrorDismissed && (
        <Alert variant="danger" className="mb-4" dismissible onClose={() => setIsErrorDismissed(true)}>
          <Alert.Heading>Error Syncing Prices</Alert.Heading>
          {apiError.includes('Failed to update prices for') ? (
            <>
              <p>{apiError.split(':')[0]}:</p>
              <ul className="mb-0">
                {apiError.split(':')[1].split(',').map((symbol, index) => (
                  <li key={index}>{symbol.trim()}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{apiError}</p>
          )}
        </Alert>
      )}

      {/* Portfolio Value History Chart */}
      <PortfolioValueChart portfolioValueHistory={portfolioValueHistory} />

      {editingAssets && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Asset Settings</h5>
          </Card.Header>
          <Card.Body>
            {/* Add new stock form */}
            <div className="mb-4">
              <h6>Add New Stock</h6>
              <Row className="align-items-end">
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Symbol</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="e.g., AAPL"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-2">
                    <Form.Label>Price</Form.Label>
                    <PriceInput
                      value={newPrice}
                      onChange={setNewPrice}
                      placeholder="e.g., 150.00"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="">Select category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2} className="mb-2">
                  <Button 
                    variant="secondary"
                    onClick={handleAddNewStock}
                  >
                    Add Stock
                  </Button>
                </Col>
              </Row>
            </div>

            <h6>Edit Existing Stocks</h6>
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Current Price</th>
                    <th>New Price</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {getAllUniqueStockSymbols().map((symbol) => {
                    const inUse = getStocksInUse().has(symbol);
                    return (
                      <tr key={symbol}>
                        <td>
                          {symbol}
                          {!inUse && (
                            <Badge bg="warning" className="ms-2" style={{ fontSize: '0.7em' }}>
                              Unused
                            </Badge>
                          )}
                        </td>
                        <td>{formatDollarAmount(stockPrices[symbol] || '0.00')}</td>
                        <td>
                          <PriceInput
                            value={tempPrices[symbol] || ''}
                            onChange={(value) => handlePriceChange(symbol, value)}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Form.Select
                            size="sm"
                            value={tempCategories[symbol] || ''}
                            onChange={(e) => handleCategoryChange(symbol, e.target.value)}
                          >
                            <option value="">Select category</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Form.Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            
            <div className="mt-3">
              {(() => {
                // Count how many unused stocks there are
                const usedSymbols = getStocksInUse();
                const allSymbols = getAllUniqueStockSymbols();
                const unusedCount = allSymbols.filter(symbol => !usedSymbols.has(symbol)).length;
                
                return (
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={handleCleanupUnusedStocks}
                    disabled={unusedCount === 0}
                  >
                    Clean Up Unused Stocks {unusedCount > 0 && `(${unusedCount})`}
                  </Button>
                );
              })()}
              <Form.Text className="text-muted d-block mt-1">
                Removes stocks that aren't used in any account.
              </Form.Text>
            </div>
          </Card.Body>
        </Card>
      )}

      {accounts.length === 0 ? (
        <Card className="text-center p-4">
          <Card.Body>
            <Card.Title>No Accounts</Card.Title>
            <Card.Text>
              Add your first investment account to get started.
            </Card.Text>
            <Button variant="primary" onClick={handleAddAccount}>
              Add Account
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">Accounts</h5>
            </div>
            <div>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => {
                  const allAccountKeys = accounts.map((_, index) => index.toString());
                  setExpandedAccounts(expandedAccounts.length === accounts.length ? [] : allAccountKeys);
                }}
              >
                {expandedAccounts.length === accounts.length ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>
          </div>

          <Accordion activeKey={expandedAccounts} alwaysOpen onSelect={(keys) => setExpandedAccounts(keys || [])}>
            {accounts.map((account, accountIndex) => (
              <div key={account.id} className="mb-3">
                <Accordion.Item eventKey={accountIndex.toString()}>
                  <Accordion.Header>
                    <div className="d-flex justify-content-between align-items-center w-100">
                      <span>{account.name}</span>
                      <span className="text-primary">{formatDollarAmount(calculateAccountTotal(account))}</span>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    <div className="mb-3 d-flex justify-content-between">
                      <Button variant="success" size="sm" onClick={() => handleAddPosition(account)}>
                        Add Position
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteAccount(account.id)}>
                        Delete Account
                      </Button>
                    </div>

                    {account.positions.length === 0 ? (
                      <p className="text-center">No positions in this account yet.</p>
                    ) : (
                      <div className="table-responsive">
                        <Table striped bordered hover>
                          <thead>
                            <tr>
                              <th>Symbol</th>
                              <th>Category</th>
                              <th>Shares</th>
                              <th>Price</th>
                              <th>Value</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.positions.map((position, positionIndex) => (
                              <tr key={positionIndex}>
                                <td>{position.symbol}</td>
                                <td>
                                  {editingAssets ? (
                                    tempCategories[position.symbol] ? (
                                      <Badge bg="info">
                                        {categories.find(cat => cat.id === tempCategories[position.symbol])?.name || 'Unknown'}
                                      </Badge>
                                    ) : (
                                      <Badge bg="secondary">Uncategorized</Badge>
                                    )
                                  ) : (
                                    stockCategories[position.symbol] ? (
                                      <Badge bg="info">
                                        {categories.find(cat => cat.id === stockCategories[position.symbol])?.name || 'Unknown'}
                                      </Badge>
                                    ) : (
                                      <Badge bg="secondary">Uncategorized</Badge>
                                    )
                                  )}
                                </td>
                                <td>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    value={position.shares}
                                    onChange={(e) => handleUpdateShares(account.id, positionIndex, e.target.value)}
                                  />
                                </td>
                                <td>
                                  {formatDollarAmount(editingAssets ? tempPrices[position.symbol] || '0.00' : stockPrices[position.symbol] || '0.00')}
                                </td>
                                <td>{formatDollarAmount(calculatePositionValue(position.symbol, position.shares))}</td>
                                <td>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleDeletePosition(account.id, positionIndex)}
                                  >
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <th colSpan="4" className="text-end">Total:</th>
                              <th>{formatDollarAmount(calculateAccountTotal(account))}</th>
                              <th></th>
                            </tr>
                          </tfoot>
                        </Table>
                      </div>
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              </div>
            ))}
          </Accordion>
        </>
      )}

      {/* Add Account Modal */}
      <Modal show={showAddAccountModal} onHide={() => setShowAddAccountModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Account Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., 401(k), Roth IRA, Taxable"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddAccountModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveAccount}>
            Save Account
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Position Modal */}
      <Modal show={showAddPositionModal} onHide={() => setShowAddPositionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Position to {selectedAccount?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Stock Symbol</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., AAPL"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Add Position By</Form.Label>
              <Form.Select
                value={addPositionBy}
                onChange={(e) => setAddPositionBy(e.target.value)}
              >
                <option value="shares">Number of Shares</option>
                <option value="value">Dollar Value</option>
              </Form.Select>
            </Form.Group>

            {addPositionBy === 'shares' ? (
              <Form.Group className="mb-3">
                <Form.Label>Number of Shares</Form.Label>
                <Form.Control
                  type="number"
                  placeholder="e.g., 10"
                  value={newShares}
                  onChange={(e) => setNewShares(e.target.value)}
                />
              </Form.Group>
            ) : (
              <Form.Group className="mb-3">
                <Form.Label>Dollar Value</Form.Label>
                <PriceInput
                  placeholder="e.g., 5000"
                  value={newValue}
                  onChange={setNewValue}
                />
                {newSymbol && (
                  <Form.Text className="text-muted">
                    Current price: {formatDollarAmount(stockPrices[newSymbol.toUpperCase()] || '0.00')}
                    {stockPrices[newSymbol.toUpperCase()] ? (
                      <> (approx. {(newValue && stockPrices[newSymbol.toUpperCase()]) 
                        ? (newValue / stockPrices[newSymbol.toUpperCase()]).toFixed(4) 
                        : '0'} shares)</>
                    ) : (
                      <>. Please update price first.</>
                    )}
                  </Form.Text>
                )}
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Price (Optional)</Form.Label>
              <PriceInput
                placeholder="e.g., 150.00"
                value={newPrice}
                onChange={setNewPrice}
              />
              <Form.Text className="text-muted">
                Leave blank to keep current price: {formatDollarAmount(stockPrices[newSymbol.toUpperCase()] || '0.00')}
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddPositionModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSavePosition}>
            Add Position
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Snapshot Management Modal */}
      <Modal show={showSnapshotModal} onHide={() => setShowSnapshotModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Manage Portfolio Snapshots</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Information card about snapshots */}
          <Card className="mb-4 bg-light">
            <Card.Body>
              <Card.Title>About Portfolio Snapshots</Card.Title>
              <Card.Text>
                Snapshots record your portfolio's total value at specific points in time. They are only created manually.
                Use snapshots to track your portfolio's performance over time.
              </Card.Text>
            </Card.Body>
          </Card>
          
          {/* Quick Snapshot button */}
          <div className="d-grid gap-2 mb-4">
            <Button 
              variant="success" 
              size="lg" 
              onClick={handleTakeSnapshot}
              className="text-center"
            >
              Take Current Portfolio Snapshot
            </Button>
            <p className="text-center text-muted small mt-1">
              Records the current total value of your portfolio with today's date and time.
            </p>
          </div>

          {/* Add New Snapshot Form */}
          <Form onSubmit={handleAddManualSnapshot} className="mb-4 p-3 border rounded">
            <h5>Add New Snapshot</h5>
            <Row>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Value ($)</Form.Label>
                  <PriceInput
                    value={newSnapshotValue}
                    onChange={setNewSnapshotValue}
                    placeholder="Enter value"
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group>
                  <Form.Label>Date & Time</Form.Label>
                  <Form.Control 
                    type="datetime-local" 
                    value={newSnapshotDate} 
                    onChange={(e) => setNewSnapshotDate(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={3} className="d-flex align-items-end">
                <Button type="submit" variant="primary" className="w-100">
                  Add Snapshot
                </Button>
              </Col>
            </Row>
          </Form>

          {/* Snapshots List */}
          <h5 className="mb-3">Snapshot History</h5>
          
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedSnapshotHistory.map((record, index) => (
                  <tr key={index}>
                    {editingSnapshotIndex === index ? (
                      // Edit mode
                      <>
                        <td>
                          <Form.Control 
                            type="datetime-local" 
                            value={editSnapshotDate} 
                            onChange={(e) => setEditSnapshotDate(e.target.value)}
                            required
                            size="sm"
                          />
                        </td>
                        <td>
                          <PriceInput 
                            value={editSnapshotValue} 
                            onChange={setEditSnapshotValue}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={handleSaveEditedSnapshot}
                            className="me-1"
                          >
                            Save
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </td>
                      </>
                    ) : (
                      // View mode
                      <>
                        <td>{formatDateAndTime(record.date)}</td>
                        <td>{formatDollarAmount(record.value)}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleEditSnapshot(index)}
                            className="me-1"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteSnapshot(index)}
                          >
                            Delete
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {sortedSnapshotHistory.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center">No snapshots available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowSnapshotModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Sync Prices Modal */}
      <Modal 
        show={showSyncPricesModal} 
        onHide={() => setShowSyncPricesModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Select Stocks to Update</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* API Key Configuration */}
          <Card className="mb-3">
            <Card.Header>
              <h6 className="mb-0">API Settings</h6>
            </Card.Header>
            <Card.Body>
              <Form.Group className="mb-0">
                <Form.Label>Marketstack API Key</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter your Marketstack API key"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                />
                <Form.Text className="text-muted">
                  Your API key will be stored locally in your browser. You can get a free API key by signing up at <a href="https://marketstack.com" target="_blank" rel="noopener noreferrer">marketstack.com</a>
                </Form.Text>
              </Form.Group>
            </Card.Body>
          </Card>

          <div className="d-flex justify-content-end mb-3">
            <Button 
              variant="outline-primary" 
              size="sm" 
              className="me-2"
              onClick={handleSelectAllStocks}
            >
              Select All
            </Button>
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={handleDeselectAllStocks}
            >
              Deselect All
            </Button>
          </div>
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Symbol</th>
                  <th>Current Price</th>
                </tr>
              </thead>
              <tbody>
                {getAllUniqueStockSymbols().map((symbol) => (
                  <tr key={symbol}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={selectedStocksToSync[symbol] || false}
                        onChange={(e) => handleStockSelectionChange(symbol, e.target.checked)}
                      />
                    </td>
                    <td>{symbol}</td>
                    <td>{formatDollarAmount(stockPrices[symbol] || '0.00')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSyncPricesModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSyncSelectedPrices}>
            Sync Selected Prices
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CurrentPortfolio;
