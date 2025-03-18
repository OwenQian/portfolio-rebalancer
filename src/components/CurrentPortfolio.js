import React, { useState } from 'react';
import { Card, Button, Table, Form, Row, Col, Modal, Badge, Accordion, Spinner, Alert } from 'react-bootstrap';
import { formatDollarAmount } from '../utils/formatters';

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
  apiError
}) => {
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [newSymbol, setNewSymbol] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingPrices, setEditingPrices] = useState(false);
  const [tempPrices, setTempPrices] = useState({...stockPrices});
  const [tempApiKey, setTempApiKey] = useState(marketstackApiKey);

  const getAllUniqueStockSymbols = () => {
    const symbols = new Set();
    
    accounts.forEach(account => {
      account.positions.forEach(position => {
        symbols.add(position.symbol);
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

  const saveAllPrices = () => {
    updateStockPrices(tempPrices);
    setEditingPrices(false);
    alert('Stock prices updated successfully');
  };

  const cancelPriceEditing = () => {
    setTempPrices({...stockPrices});
    setEditingPrices(false);
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
    setNewCategory('');
    setShowAddPositionModal(true);
  };

  const handleSavePosition = () => {
    if (!newSymbol.trim()) {
      alert('Please enter a stock symbol');
      return;
    }

    if (!newShares || isNaN(newShares) || Number(newShares) <= 0) {
      alert('Please enter a valid number of shares');
      return;
    }

    const symbol = newSymbol.toUpperCase();
    const shares = Number(newShares);

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
    const price = editingPrices ? tempPrices[symbol] || 0 : stockPrices[symbol] || 0;
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
              {editingPrices ? (
                <>
                  <Button variant="success" onClick={saveAllPrices} className="me-2">
                    Save Prices
                  </Button>
                  <Button variant="secondary" onClick={cancelPriceEditing} className="me-2">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="warning" onClick={() => setEditingPrices(true)} className="me-2">
                    Edit Prices
                  </Button>
                  <Button variant="success" onClick={handleSyncPrices} className="me-2">
                    Sync Prices
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
          <p>{apiError}</p>
        </Alert>
      )}

      {editingPrices && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Edit Stock Prices</h5>
          </Card.Header>
          <Card.Body>
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Current Price</th>
                    <th>New Price</th>
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

          <Accordion defaultActiveKey="0">
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
                                {stockCategories[position.symbol] ? (
                                  <Badge bg="info">
                                    {categories.find(cat => cat.id === stockCategories[position.symbol])?.name || 'Unknown'}
                                  </Badge>
                                ) : (
                                  <Badge bg="secondary">Uncategorized</Badge>
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
                                {formatDollarAmount(editingPrices ? tempPrices[position.symbol] || '0.00' : stockPrices[position.symbol] || '0.00')}
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
              <Form.Label>Number of Shares</Form.Label>
              <Form.Control
                type="number"
                placeholder="e.g., 10"
                value={newShares}
                onChange={(e) => setNewShares(e.target.value)}
              />
            </Form.Group>

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
    </div>
  );
};

export default CurrentPortfolio;
