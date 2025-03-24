import React, { useState, useEffect, useRef } from 'react';
import { Form } from 'react-bootstrap';

/**
 * A custom input component for price entry that allows natural input
 * while still ensuring only valid numeric values with two decimal places
 */
const PriceInput = ({ value, onChange, placeholder, size = null, label = null }) => {
  // Store the display value (what the user sees/types)
  const [displayValue, setDisplayValue] = useState('');
  // Track if the input is currently focused
  const [isFocused, setIsFocused] = useState(false);
  // Keep track of cursor position
  const inputRef = useRef(null);
  const cursorPositionRef = useRef(null);
  
  // Update display value when external value changes
  useEffect(() => {
    // When external value changes, update the display value
    if (value !== undefined && value !== null) {
      // Only update if it's different to avoid cursor jumps during editing
      if (value.toString() !== displayValue) {
        // If focused, keep the raw format for editing
        if (!isFocused) {
          setDisplayValue(value.toString());
        }
      }
    } else {
      setDisplayValue('');
    }
  }, [value, displayValue, isFocused]);
  
  // Handle user input changes
  const handleInputChange = (e) => {
    const input = e.target.value;
    
    // Save cursor position for later
    cursorPositionRef.current = e.target.selectionStart;
    
    // Allow empty input
    if (input === '') {
      setDisplayValue('');
      onChange('');
      return;
    }
    
    // Check if the input could represent a valid number in any stage of typing
    // Allow digits, one decimal point, and any stage of numeric input
    if (/^[0-9]*\.?[0-9]*$/.test(input)) {
      // Allow the input as long as it could potentially be a valid number
      setDisplayValue(input);
      
      // Pass the raw input value to the parent component
      onChange(input);
    }
  };
  
  // Restore cursor position after state update
  useEffect(() => {
    // If we have a cursor position and input reference
    if (cursorPositionRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(
        cursorPositionRef.current,
        cursorPositionRef.current
      );
      // Reset cursor position reference
      cursorPositionRef.current = null;
    }
  }, [displayValue]);

  // When input gets focus, convert to raw format for easier editing
  const handleFocus = () => {
    setIsFocused(true);
    
    // If the value is formatted like "150.00", convert to "150" when focusing
    // to make it easier to edit
    if (displayValue && displayValue.includes('.')) {
      try {
        // Check if it ends with ".00"
        if (displayValue.match(/^\d+\.00$/)) {
          const rawValue = displayValue.replace(/\.00$/, '');
          setDisplayValue(rawValue);
          onChange(rawValue);
        }
      } catch (e) {
        // If any error parsing, keep the original value
        console.error("Error parsing value on focus:", e);
      }
    }
  };
  
  // When input loses focus, format the value to always have two decimal places
  const handleBlur = () => {
    setIsFocused(false);
    
    if (displayValue === '' || displayValue === '.') {
      setDisplayValue('');
      onChange('');
      return;
    }
    
    // Handle cases where the user is still typing a decimal
    // e.g., "123." should be treated as "123.00"
    let numValue;
    if (displayValue.endsWith('.')) {
      numValue = parseFloat(displayValue + '0');
    } else {
      numValue = parseFloat(displayValue);
    }
    
    if (!isNaN(numValue)) {
      const formattedValue = numValue.toFixed(2);
      setDisplayValue(formattedValue);
      onChange(formattedValue);
    }
  };
  
  return (
    <>
      {label && <Form.Label>{label}</Form.Label>}
      <Form.Control
        ref={inputRef}
        type="text"
        placeholder={placeholder || "0.00"}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        size={size}
      />
    </>
  );
};

export default PriceInput; 