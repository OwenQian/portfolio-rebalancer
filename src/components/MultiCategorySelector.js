import React, { useState } from 'react';
import { Form, Button, Badge, InputGroup } from 'react-bootstrap';
import { validateCategoryAllocations } from '../utils/categoryUtils';

/**
 * MultiCategorySelector — allows assigning a stock to one or more categories.
 *
 * Props:
 *   categories    — array of { id, name }
 *   allocations   — array of { categoryId, percentage } (current value)
 *   onChange       — (newAllocations: Array) => void
 *   compact        — (optional) if true, shows compact badge view
 *   size           — (optional) 'sm' | 'lg' (Bootstrap size)
 */
const MultiCategorySelector = ({ categories, allocations = [], onChange, compact = false, size = 'sm' }) => {
  const [splitMode, setSplitMode] = useState(
    allocations.length > 1
  );

  const validAllocations = Array.isArray(allocations) && allocations.length > 0
    ? allocations
    : [];

  const currentCategoryId = validAllocations.length === 1 ? validAllocations[0].categoryId : '';

  // Single-category mode: simple dropdown
  const handleSingleSelect = (categoryId) => {
    if (categoryId) {
      onChange([{ categoryId, percentage: 100 }]);
    } else {
      onChange([]);
    }
  };

  // Multi-category: add a new row
  const handleAddRow = () => {
    const usedIds = new Set(validAllocations.map(a => a.categoryId));
    const available = categories.filter(c => !usedIds.has(c.id));
    if (available.length === 0) return;
    onChange([...validAllocations, { categoryId: available[0].id, percentage: 0 }]);
  };

  // Multi-category: remove a row
  const handleRemoveRow = (index) => {
    const updated = validAllocations.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Multi-category: update category for a row
  const handleCategoryChange = (index, categoryId) => {
    const updated = validAllocations.map((a, i) =>
      i === index ? { ...a, categoryId } : a
    );
    onChange(updated);
  };

  // Multi-category: update percentage for a row
  const handlePercentageChange = (index, pct) => {
    const updated = validAllocations.map((a, i) =>
      i === index ? { ...a, percentage: parseFloat(pct) || 0 } : a
    );
    onChange(updated);
  };

  // Toggle split mode
  const handleToggleSplit = () => {
    if (!splitMode) {
      // Entering split mode: keep current single category as first row
      setSplitMode(true);
      if (validAllocations.length <= 1) {
        // Already have 0-1 rows, that's fine
      }
    } else {
      // Leaving split mode: collapse to single category (keep first)
      setSplitMode(false);
      if (validAllocations.length > 0) {
        onChange([{ categoryId: validAllocations[0].categoryId, percentage: 100 }]);
      }
    }
  };

  // Compact mode: show badges
  if (compact && validAllocations.length > 0 && !splitMode) {
    const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'Unknown';
    return (
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => setSplitMode(true)}
        title="Click to edit category allocation"
      >
        {validAllocations.map((a, i) => (
          <Badge key={i} bg="info" className="me-1" style={{ fontSize: '0.75em' }}>
            {getCategoryName(a.categoryId)} {validAllocations.length > 1 ? `${a.percentage}%` : ''}
          </Badge>
        ))}
      </div>
    );
  }

  // Running total for validation
  const total = validAllocations.reduce((sum, a) => sum + (a.percentage || 0), 0);
  const isValid = validateCategoryAllocations(validAllocations);
  const usedCategoryIds = new Set(validAllocations.map(a => a.categoryId));

  return (
    <div>
      {!splitMode ? (
        // Single category dropdown
        <div>
          <Form.Select
            size={size}
            value={currentCategoryId}
            onChange={(e) => handleSingleSelect(e.target.value)}
          >
            <option value="">Select category</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Form.Select>
          <Button
            variant="link"
            size="sm"
            className="p-0 mt-1"
            style={{ fontSize: '0.75em' }}
            onClick={handleToggleSplit}
          >
            Split across categories
          </Button>
        </div>
      ) : (
        // Multi-category editor
        <div>
          {validAllocations.map((alloc, index) => (
            <InputGroup key={index} size={size} className="mb-1">
              <Form.Select
                value={alloc.categoryId}
                onChange={(e) => handleCategoryChange(index, e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map(category => (
                  <option
                    key={category.id}
                    value={category.id}
                    disabled={usedCategoryIds.has(category.id) && category.id !== alloc.categoryId}
                  >
                    {category.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Control
                type="number"
                min="0"
                max="100"
                step="1"
                value={alloc.percentage}
                onChange={(e) => handlePercentageChange(index, e.target.value)}
                style={{ maxWidth: '80px' }}
              />
              <InputGroup.Text>%</InputGroup.Text>
              {validAllocations.length > 1 && (
                <Button
                  variant="outline-danger"
                  size={size}
                  onClick={() => handleRemoveRow(index)}
                >
                  &times;
                </Button>
              )}
            </InputGroup>
          ))}

          <div className="d-flex justify-content-between align-items-center mt-1">
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleAddRow}
                disabled={usedCategoryIds.size >= categories.length}
                style={{ fontSize: '0.75em' }}
              >
                + Add category
              </Button>
              <Button
                variant="link"
                size="sm"
                className="ms-2"
                style={{ fontSize: '0.75em' }}
                onClick={handleToggleSplit}
              >
                Single category
              </Button>
            </div>
            <small className={isValid ? 'text-success' : 'text-danger'}>
              Total: {total.toFixed(0)}%
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCategorySelector;
