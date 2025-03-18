import React, { useState } from 'react';
import { Row, Col, Card, Button, Form, Table, Modal, Badge } from 'react-bootstrap';
import { formatNumber } from '../utils/formatters';

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

  const handleAddPortfolio = () => {
    setNewPortfolioName('');
    setStocks([]);
    setShowAddModal(true);
  };

  const handleEditPortfolio = (portfolio, index) => {
    setCurrentPortfolio(portfolio);
    setNewPortfolioName(portfolio.name);
    setStocks([...portfolio.stocks]);
    setEditIndex(index);
    setShowEditModal(true);
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
        [symbol]: newStockCategory
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

    const updatedPortfolio = {
      ...currentPortfolio,
      name: newPortfolioName,
      stocks: stocks,
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
          <Button variant="primary" onClick={handleAddPortfolio}>
            Add New Model Portfolio
          </Button>
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
                              {stockCategories[stock.symbol] ? (
                                <Badge bg="info">
                                  {categories.find(cat => cat.id === stockCategories[stock.symbol])?.name || 'Unknown'}
                                </Badge>
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
                        {stockCategories[stock.symbol] ? (
                          <Badge bg="info">
                            {categories.find(cat => cat.id === stockCategories[stock.symbol])?.name || 'Unknown'}
                          </Badge>
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
                      <td>{formatNumber(stock.percentage)}%</td>
                      <td>
                        {stockCategories[stock.symbol] ? (
                          <Badge bg="info">
                            {categories.find(cat => cat.id === stockCategories[stock.symbol])?.name || 'Unknown'}
                          </Badge>
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
