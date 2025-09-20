import React, { useState } from 'react';
import { Card, Button, Table, Form, Row, Col, Modal } from 'react-bootstrap';

const CategoryManager = ({ categories, setCategories, stockCategories, setStockCategories }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const handleAddCategory = () => {
    setNewCategoryName('');
    setShowAddModal(true);
  };

  const handleSaveCategory = () => {
    if (!newCategoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    const newCategory = {
      id: Date.now().toString(),
      name: newCategoryName
    };

    setCategories([...categories, newCategory]);
    setShowAddModal(false);
  };

  const handleEditCategory = (category) => {
    setEditCategoryId(category.id);
    setEditCategoryName(category.name);
    setShowEditModal(true);
  };

  const handleUpdateCategory = () => {
    if (!editCategoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    const updatedCategories = categories.map(category => {
      if (category.id === editCategoryId) {
        return {
          ...category,
          name: editCategoryName
        };
      }
      return category;
    });

    setCategories(updatedCategories);
    setShowEditModal(false);
  };

  const handleDeleteCategory = (categoryId) => {
    // Count how many stocks are using this category
    const stocksUsingCategory = Object.values(stockCategories).filter(
      catId => catId === categoryId
    ).length;

    if (stocksUsingCategory > 0) {
      const confirmDelete = window.confirm(
        `This category is used by ${stocksUsingCategory} stock(s). If you delete it, these stocks will be uncategorized. Continue?`
      );
      
      if (!confirmDelete) {
        return;
      }
      
      // Remove the category from all stocks using it
      const updatedStockCategories = { ...stockCategories };
      Object.keys(updatedStockCategories).forEach(symbol => {
        if (updatedStockCategories[symbol] === categoryId) {
          delete updatedStockCategories[symbol];
        }
      });
      
      setStockCategories(updatedStockCategories);
    } else if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    // Remove the category
    const updatedCategories = categories.filter(category => category.id !== categoryId);
    setCategories(updatedCategories);
  };

  // Count how many stocks are using each category
  const countStocksInCategory = (categoryId) => {
    return Object.values(stockCategories).filter(catId => catId === categoryId).length;
  };

  return (
    <div>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">Asset Categories</h2>
          <Button variant="primary" onClick={handleAddCategory}>
            Add New Category
          </Button>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Stocks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(category => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{countStocksInCategory(category.id)}</td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => handleEditCategory(category)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Add Category Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Category</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Category Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveCategory}>
            Save Category
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Category Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Category</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Category Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter category name"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateCategory}>
            Update Category
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CategoryManager;
