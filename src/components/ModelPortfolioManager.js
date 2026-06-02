import React, { useState } from 'react';
import { Row, Col, Card, Button, Form, Table, Modal, Badge, Dropdown } from 'react-bootstrap';
import { formatNumber } from '../utils/formatters';
import { setSingleCategory } from '../utils/categoryUtils';

const ModelPortfolioManager = ({ 
  modelPortfolios, 
  setModelPortfolios, 
  categories, 
  stockCategories, 
  setStockCategories 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [newStockPercentage, setNewStockPercentage] = useState('');
  const [newStockCategory, setNewStockCategory] = useState('');
  const [stocks, setStocks] = useState([]);
  const [editIndex, setEditIndex] = useState(null);

  // Preset portfolio templates
  const presetPortfolios = {
    bogleheads2Fund: {
      name: "Bogleheads 2-Fund Portfolio (60/40)",
      stocks: [
        { symbol: "VTI", percentage: 60 },
        { symbol: "VXUS", percentage: 40 }
      ]
    },
    bogleheads3Fund: {
      name: "Bogleheads 3-Fund Portfolio (60/20/20)",
      stocks: [
        { symbol: "VTI", percentage: 60 },
        { symbol: "VXUS", percentage: 20 },
        { symbol: "BND", percentage: 20 }
      ]
    }
  };

  // Function to categorize ETFs automatically
  const categorizeETFs = (stocks) => {
    // Map of ETFs to their category allocations (multi-category format)
    const etfCategories = {
      "VTI": [{ categoryId: "1", percentage: 100 }], // US Large Cap
      "VXUS": [{ categoryId: "3", percentage: 100 }], // International Developed Markets
      "BND": [{ categoryId: "7", percentage: 100 }], // Other (for bonds)
      "VOO": [{ categoryId: "1", percentage: 100 }], // US Large Cap
      "VEA": [{ categoryId: "3", percentage: 100 }], // International Developed Markets
      "VWO": [{ categoryId: "4", percentage: 100 }], // Emerging Markets
      "VB": [{ categoryId: "2", percentage: 100 }], // US Small Cap
      "VTV": [{ categoryId: "1", percentage: 100 }], // US Large Cap (Value)
      "VUG": [{ categoryId: "1", percentage: 100 }], // US Large Cap (Growth)
      "VTEB": [{ categoryId: "7", percentage: 100 }], // Other (Municipal bonds)
      "VGSH": [{ categoryId: "7", percentage: 100 }], // Other (Short-term Treasury)
      "VGIT": [{ categoryId: "7", percentage: 100 }], // Other (Intermediate-term Treasury)
      "VGLT": [{ categoryId: "7", percentage: 100 }], // Other (Long-term Treasury)
      "VCSH": [{ categoryId: "7", percentage: 100 }], // Other (Short-term corporate bonds)
      "VCIT": [{ categoryId: "7", percentage: 100 }], // Other (Intermediate-term corporate bonds)
      "VCLT": [{ categoryId: "7", percentage: 100 }], // Other (Long-term corporate bonds)
      "VSS": [{ categoryId: "5", percentage: 100 }], // International Small Cap
      "VXF": [{ categoryId: "2", percentage: 100 }], // US Small Cap
      "VT": [{ categoryId: "1", percentage: 60 }, { categoryId: "3", percentage: 25 }, { categoryId: "4", percentage: 15 }], // Total World Stock
    };

    // Create a new map merging existing categories with automatic ones
    const newCategories = { ...stockCategories };

    // Add category for each stock if not already categorized
    stocks.forEach(stock => {
      if (etfCategories[stock.symbol] && !newCategories[stock.symbol]) {
        newCategories[stock.symbol] = etfCategories[stock.symbol];
      }
    });

    return newCategories;
  };

  // Function to create a preset portfolio
  const createPresetPortfolio = (preset) => {
    const portfolioTemplate = presetPortfolios[preset];
    if (!portfolioTemplate) return;
    
    // Check if a portfolio with this name already exists
    const existingIndex = modelPortfolios.findIndex(p => p.name === portfolioTemplate.name);
    
    // Create the new portfolio
    const newPortfolio = {
      name: portfolioTemplate.name,
      stocks: portfolioTemplate.stocks,
      createdAt: new Date().toISOString()
    };
    
    // Auto-categorize ETFs
    const newCategories = categorizeETFs(portfolioTemplate.stocks);
    setStockCategories(newCategories);
    
    // Update the model portfolios
    if (existingIndex >= 0) {
      // Replace existing portfolio
      const updatedPortfolios = [...modelPortfolios];
      updatedPortfolios[existingIndex] = {
        ...newPortfolio,
        updatedAt: new Date().toISOString()
      };
      setModelPortfolios(updatedPortfolios);
    } else {
      // Add new portfolio
      setModelPortfolios([...modelPortfolios, newPortfolio]);
    }
  };

  const handleAddPortfolio = () => {
    setNewPortfolioName('');
    setStocks([]);
    setShowAddModal(true);
  };

  const handleEditPortfolio = (portfolio, index) => {
    setCurrentPortfolio(portfolio);
    setNewPortfolioName(portfolio.name);
    // Add categoryId property to each stock for editing (primary category from array format)
    const stocksWithCategories = portfolio.stocks.map(stock => {
      const allocs = stockCategories[stock.symbol];
      const primaryCatId = Array.isArray(allocs) && allocs.length > 0 ? allocs[0].categoryId : '';
      return { ...stock, categoryId: primaryCatId };
    });
    setStocks(stocksWithCategories);
    setEditIndex(index);
    setShowEditModal(true);
  };

  const handleStockCategoryChange = (index, categoryId) => {
    const updatedStocks = [...stocks];
    updatedStocks[index].categoryId = categoryId;
    setStocks(updatedStocks);
  };

  const handleDeletePortfolio = (index) => {
    if (window.confirm('Are you sure you want to delete this model portfolio?')) {
      const updatedPortfolios = [...modelPortfolios];
      updatedPortfolios.splice(index, 1);
      setModelPortfolios(updatedPortfolios);
    }
  };

  const handleAddStock = () => {
    if (!newStockSymbol || !newStockPercentage) {
      alert('Please enter both symbol and percentage');
      return;
    }

    const symbol = newStockSymbol.toUpperCase();
    const percentage = parseFloat(newStockPercentage);

    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      alert('Percentage must be a number between 0 and 100');
      return;
    }

    // Update stock category mapping if a category is selected
    if (newStockCategory) {
      setStockCategories({
        ...stockCategories,
        [symbol]: setSingleCategory(newStockCategory)
      });
    }

    setStocks([...stocks, { symbol, percentage }]);
    setNewStockSymbol('');
    setNewStockPercentage('');
    setNewStockCategory('');
  };

  const handleRemoveStock = (index) => {
    const updatedStocks = [...stocks];
    updatedStocks.splice(index, 1);
    setStocks(updatedStocks);
  };

  const handleSavePortfolio = () => {
    if (!newPortfolioName) {
      alert('Please enter a portfolio name');
      return;
    }

    if (stocks.length === 0) {
      alert('Please add at least one stock to the portfolio');
      return;
    }

    // Check if the total percentage adds up to 100%
    const totalPercentage = stocks.reduce((total, stock) => total + stock.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`The total allocation is ${formatNumber(totalPercentage)}%. It should be 100%.`);
      return;
    }

    const newPortfolio = {
      name: newPortfolioName,
      stocks: stocks,
      createdAt: new Date().toISOString()
    };

    setModelPortfolios([...modelPortfolios, newPortfolio]);
    setShowAddModal(false);
  };

  const handleUpdatePortfolio = () => {
    if (!newPortfolioName) {
      alert('Please enter a portfolio name');
      return;
    }

    if (stocks.length === 0) {
      alert('Please add at least one stock to the portfolio');
      return;
    }

    // Check if the total percentage adds up to 100%
    const totalPercentage = stocks.reduce((total, stock) => total + stock.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`The total allocation is ${formatNumber(totalPercentage)}%. It should be 100%.`);
      return;
    }

    // Save any category changes (convert single categoryId to array format)
    const updatedStockCategories = { ...stockCategories };
    stocks.forEach(stock => {
      if (stock.categoryId) {
        const currentAllocs = stockCategories[stock.symbol];
        const currentPrimary = Array.isArray(currentAllocs) && currentAllocs.length > 0 ? currentAllocs[0].categoryId : '';
        if (stock.categoryId !== currentPrimary) {
          updatedStockCategories[stock.symbol] = setSingleCategory(stock.categoryId);
        }
      }
    });
    setStockCategories(updatedStockCategories);

    const updatedPortfolio = {
      ...currentPortfolio,
      name: newPortfolioName,
      stocks: stocks.map(({ symbol, percentage }) => ({ symbol, percentage })), // Remove categoryId from stocks object
      updatedAt: new Date().toISOString()
    };

    const updatedPortfolios = [...modelPortfolios];
    updatedPortfolios[editIndex] = updatedPortfolio;
    setModelPortfolios(updatedPortfolios);
    setShowEditModal(false);
  };

  return (
    <div>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">Model Portfolios</h2>
          <div className="d-flex gap-2">
            <Button variant="primary" onClick={handleAddPortfolio}>
              Add New Model Portfolio
            </Button>
            <Dropdown>
              <Dropdown.Toggle variant="outline-primary" id="dropdown-presets">
                Add Preset Portfolio
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => createPresetPortfolio('bogleheads2Fund')}>
                  Bogleheads 2-Fund (60/40 VTI/VXUS)
                </Dropdown.Item>
                <Dropdown.Item onClick={() => createPresetPortfolio('bogleheads3Fund')}>
                  Bogleheads 3-Fund (60/20/20 VTI/VXUS/BND)
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Col>
      </Row>

      <Row>
        {modelPortfolios.length === 0 ? (
          <Col>
            <Card className="text-center p-4">
              <Card.Body>
                <Card.Title>No Model Portfolios</Card.Title>
                <Card.Text>
                  Create your first model portfolio to get started.
                </Card.Text>
                <Button variant="primary" onClick={handleAddPortfolio}>
                  Create Model Portfolio
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ) : (
          modelPortfolios.map((portfolio, index) => (
            <Col md={4} key={index}>
              <Card className="portfolio-card">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{portfolio.name}</h5>
                  <div>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="me-2"
                      onClick={() => handleEditPortfolio(portfolio, index)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={() => handleDeletePortfolio(index)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Allocation</th>
                          <th>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.stocks.map((stock, idx) => (
                          <tr key={idx}>
                            <td>{stock.symbol}</td>
                            <td>{formatNumber(stock.percentage)}%</td>
                            <td>
                              {Array.isArray(stockCategories[stock.symbol]) && stockCategories[stock.symbol].length > 0 ? (
                                stockCategories[stock.symbol].map((alloc, i) => (
                                  <Badge key={i} bg="info" className="me-1">
                                    {categories.find(cat => cat.id === alloc.categoryId)?.name || 'Unknown'}
                                    {stockCategories[stock.symbol].length > 1 ? ` ${alloc.percentage}%` : ''}
                                  </Badge>
                                ))
                              ) : (
                                <Badge bg="secondary">Uncategorized</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
                <Card.Footer className="text-muted">
                  Created: {new Date(portfolio.createdAt).toLocaleDateString()}
                  {portfolio.updatedAt && ` (Updated: ${new Date(portfolio.updatedAt).toLocaleDateString()})`}
                </Card.Footer>
              </Card>
            </Col>
          ))
        )}
      </Row>

      {/* Add Portfolio Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add New Model Portfolio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Portfolio Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter portfolio name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
            </Form.Group>

            <h5 className="mt-4">Add Stocks</h5>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Symbol</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., AAPL"
                    value={newStockSymbol}
                    onChange={(e) => setNewStockSymbol(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Percentage</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="e.g., 10"
                    value={newStockPercentage}
                    onChange={(e) => setNewStockPercentage(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Category</Form.Label>
                  <Form.Select
                    value={newStockCategory}
                    onChange={(e) => setNewStockCategory(e.target.value)}
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
              <Col md={2} className="d-flex align-items-end mb-3">
                <Button variant="secondary" onClick={handleAddStock}>
                  Add
                </Button>
              </Col>
            </Row>

            <div className="table-responsive mt-3">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Percentage</th>
                    <th>Category</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock, index) => (
                    <tr key={index}>
                      <td>{stock.symbol}</td>
                      <td>{formatNumber(stock.percentage)}%</td>
                      <td>
                        {Array.isArray(stockCategories[stock.symbol]) && stockCategories[stock.symbol].length > 0 ? (
                          stockCategories[stock.symbol].map((alloc, i) => (
                            <Badge key={i} bg="info" className="me-1">
                              {categories.find(cat => cat.id === alloc.categoryId)?.name || 'Unknown'}
                              {stockCategories[stock.symbol].length > 1 ? ` ${alloc.percentage}%` : ''}
                            </Badge>
                          ))
                        ) : (
                          <Badge bg="secondary">Uncategorized</Badge>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveStock(index)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th>{formatNumber(stocks.reduce((total, stock) => total + Number(stock.percentage), 0))}%</th>
                    <th colSpan="2"></th>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSavePortfolio}>
            Save Portfolio
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Portfolio Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Model Portfolio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Portfolio Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter portfolio name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
            </Form.Group>

            <h5 className="mt-4">Add Stocks</h5>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Symbol</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., AAPL"
                    value={newStockSymbol}
                    onChange={(e) => setNewStockSymbol(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Percentage</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="e.g., 10"
                    value={newStockPercentage}
                    onChange={(e) => setNewStockPercentage(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Category</Form.Label>
                  <Form.Select
                    value={newStockCategory}
                    onChange={(e) => setNewStockCategory(e.target.value)}
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
              <Col md={2} className="d-flex align-items-end mb-3">
                <Button variant="secondary" onClick={handleAddStock}>
                  Add
                </Button>
              </Col>
            </Row>

            <div className="table-responsive mt-3">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Percentage</th>
                    <th>Category</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock, index) => (
                    <tr key={index}>
                      <td>{stock.symbol}</td>
                      <td>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={stock.percentage}
                          onChange={(e) => {
                            const updatedStocks = [...stocks];
                            updatedStocks[index].percentage = parseFloat(e.target.value);
                            setStocks(updatedStocks);
                          }}
                        />
                      </td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={stock.categoryId || ''}
                          onChange={(e) => handleStockCategoryChange(index, e.target.value)}
                        >
                          <option value="">Select category</option>
                          {categories.map(category => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveStock(index)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th>{formatNumber(stocks.reduce((total, stock) => total + Number(stock.percentage), 0))}%</th>
                    <th colSpan="2"></th>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdatePortfolio}>
            Update Portfolio
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ModelPortfolioManager;
