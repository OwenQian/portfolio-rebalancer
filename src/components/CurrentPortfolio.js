import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Form, Row, Col, Modal, Badge, Accordion, Spinner, Alert } from 'react-bootstrap';
import { formatDollarAmount } from '../utils/formatters';
import PortfolioValueChart from './PortfolioValueChart';

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
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [newSymbol, setNewSymbol] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newValue, setNewValue] = useState('');
  const [addPositionBy, setAddPositionBy] = useState('shares'); // 'shares' or 'value'
  const [newCategory, setNewCategory] = useState('');
  const [editingAssets, setEditingAssets] = useState(false);
  const [tempPrices, setTempPrices] = useState({...stockPrices});
  const [tempCategories, setTempCategories] = useState({...stockCategories});
  const [tempApiKey, setTempApiKey] = useState(marketstackApiKey);
  const [newPrice, setNewPrice] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState(Array(accounts.length).fill(true).map((_, i) => i.toString()));
  const [sortedSnapshotHistory, setSortedSnapshotHistory] = useState([]);
  const [editingSnapshotIndex, setEditingSnapshotIndex] = useState(null);
  const [editSnapshotValue, setEditSnapshotValue] = useState('');
  const [editSnapshotDate, setEditSnapshotDate] = useState('');
  const [newSnapshotValue, setNewSnapshotValue] = useState('');
  const [newSnapshotDate, setNewSnapshotDate] = useState('');

  const expandAllAccounts = () => {
    const allAccountKeys = accounts.map((_, index) => index.toString());
    setExpandedAccounts(allAccountKeys);
  };

  const collapseAllAccounts = () => {
    setExpandedAccounts([]);
  };

  // Update expandedAccounts when accounts are added or removed
  useEffect(() => {
    // Default to having first account expanded when accounts change
    if (accounts.length > 0) {
      setExpandedAccounts(['0']);
    } else {
      setExpandedAccounts([]);
    }
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
    
    return Array.from(symbols).sort();
  };

  const handlePriceChange = (symbol, price) => {
    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price');
      return;
    }
    
    setTempPrices(prev => ({
      ...prev,
      [symbol]: parseFloat(price).toFixed(2)
    }));
  };

  const handleCategoryChange = (symbol, categoryId) => {
    setTempCategories(prev => ({
      ...prev,
      [symbol]: categoryId
    }));
  };

  const saveAssetSettings = () => {
    updateStockPrices(tempPrices);
    setStockCategories(tempCategories);
    setEditingAssets(false);
    alert('Asset settings updated successfully');
  };

  const cancelAssetEditing = () => {
    setTempPrices({...stockPrices});
    setTempCategories({...stockCategories});
    setEditingAssets(false);
  };

  const handleConfigureApiKey = () => {
    setTempApiKey(marketstackApiKey);
    setShowApiKeyModal(true);
  };

  const handleSaveApiKey = () => {
    updateApiKey(tempApiKey);
    setShowApiKeyModal(false);
  };

  const handleSyncPrices = () => {
    if (!marketstackApiKey) {
      handleConfigureApiKey();
    } else {
      updateStockPrices();
    }
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

    if (newCategory) {
      setStockCategories({
        ...stockCategories,
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
    if (tempPrices[symbol]) {
      alert('This stock is already in your portfolio.');
      return;
    }

    if (!newPrice || isNaN(parseFloat(newPrice)) || parseFloat(newPrice) <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const price = parseFloat(newPrice).toFixed(2);

    // Update temporary prices and categories
    setTempPrices(prev => ({
      ...prev,
      [symbol]: price
    }));
    
    if (newCategory) {
      setTempCategories(prev => ({
        ...prev,
        [symbol]: newCategory
      }));
    }

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
    const date = new Date(editSnapshotDate).toISOString();
    
    // Get the record to edit from sorted history
    const recordToEdit = sortedSnapshotHistory[editingSnapshotIndex];
    
    // Find its actual index in the portfolio value history
    const actualIndex = portfolioValueHistory.findIndex(
      record => record.date === recordToEdit.date && 
                record.value === recordToEdit.value && 
                record.type === recordToEdit.type
    );
    
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
    const date = new Date(newSnapshotDate).toISOString();
    
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
      
      // Find its actual index in the portfolio value history
      const actualIndex = portfolioValueHistory.findIndex(
        record => record.date === recordToDelete.date && 
                 record.value === recordToDelete.value && 
                 record.type === recordToDelete.type
      );
      
      if (actualIndex !== -1) {
        const updatedHistory = [...portfolioValueHistory];
        updatedHistory.splice(actualIndex, 1);
        setPortfolioValueHistory(updatedHistory);
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
  }, [portfolioValueHistory, setSortedSnapshotHistory]);

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
  }, [portfolioValueHistory, updateSortedSnapshotHistory]);

  // Take a snapshot of the current portfolio value
  const handleTakeSnapshot = () => {
    // Calculate the current portfolio total
    const totalValue = calculatePortfolioTotal();
    
    // Ensure portfolioValueHistory is an array before updating
    const currentHistory = Array.isArray(portfolioValueHistory) ? portfolioValueHistory : [];
    
    // Record the snapshot
    setPortfolioValueHistory([
      ...currentHistory,
      { date: new Date().toISOString(), value: totalValue, type: 'snapshot' }
    ]);
    
    alert(`Portfolio snapshot recorded: ${formatDollarAmount(totalValue)}`);
    
    // Close the modal after taking a snapshot
    setShowSnapshotModal(false);
  };

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
                  <Button variant="primary" onClick={() => setShowSnapshotModal(true)} className="me-2">
                    Manage Snapshots
                  </Button>
                  <Button variant="outline-secondary" onClick={handleConfigureApiKey}>
                    <i className="bi bi-gear-fill"></i> API Settings
                  </Button>
                </>
              )}
            </>
          )}
        </Col>
      </Row>

      {apiError && (
        <Alert variant="danger" className="mb-4">
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
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g., 150.00"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
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
                  {getAllUniqueStockSymbols().map((symbol) => (
                    <tr key={symbol}>
                      <td>{symbol}</td>
                      <td>{formatDollarAmount(stockPrices[symbol] || '0.00')}</td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.01"
                          min="0"
                          value={tempPrices[symbol] || ''}
                          onChange={(e) => handlePriceChange(symbol, e.target.value)}
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
                  ))}
                </tbody>
              </Table>
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
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Portfolio Summary</h5>
            </Card.Header>
            <Card.Body>
              <Table bordered>
                <thead>
                  <tr>
                    <th>Total Portfolio Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="h4 text-center">{formatDollarAmount(calculatePortfolioTotal())}</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <div className="d-flex justify-content-end mb-3">
            <Button 
              variant="outline-primary" 
              size="sm" 
              className="me-2"
              onClick={expandAllAccounts}
            >
              Expand All
            </Button>
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={collapseAllAccounts}
            >
              Collapse All
            </Button>
          </div>

          <Accordion activeKey={expandedAccounts} alwaysOpen onSelect={(keys) => setExpandedAccounts(keys || [])}>
            {accounts.map((account, accountIndex) => (
              <Accordion.Item key={account.id} eventKey={accountIndex.toString()}>
                <Accordion.Header>
                  <div className="d-flex justify-content-between align-items-center w-100 me-3">
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
                <Form.Control
                  type="number"
                  placeholder="e.g., 5000"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
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

      {/* API Key Configuration Modal */}
      <Modal show={showApiKeyModal} onHide={() => setShowApiKeyModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Marketstack API Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
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
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApiKeyModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveApiKey}>
            Save API Key
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Snapshot Management Modal */}
      <Modal show={showSnapshotModal} onHide={() => setShowSnapshotModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Manage Portfolio Snapshots</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Quick Snapshot button */}
          <div className="d-grid gap-2 mb-4">
            <Button 
              variant="success" 
              size="lg" 
              onClick={handleTakeSnapshot}
              className="text-center"
            >
              <i className="bi bi-camera-fill me-2"></i>
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
                  <Form.Control 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={newSnapshotValue} 
                    onChange={(e) => setNewSnapshotValue(e.target.value)}
                    placeholder="Enter value"
                    required
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
                          <Form.Control 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={editSnapshotValue} 
                            onChange={(e) => setEditSnapshotValue(e.target.value)}
                            required
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
    </div>
  );
};

export default CurrentPortfolio;
