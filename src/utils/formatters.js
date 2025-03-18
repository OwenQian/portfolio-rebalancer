/**
 * Formats a number as a dollar amount with comma separators
 * @param {number|string} amount - The amount to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted dollar amount with commas (e.g., $1,234.56)
 */
export const formatDollarAmount = (amount, decimals = 2) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }
  
  // Convert to number and fixed decimal places
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Use toLocaleString to add commas for thousands
  return '$' + numAmount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Formats a number with comma separators without currency symbol
 * @param {number|string} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number with commas (e.g., 1,234.56)
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00';
  }
  
  // Convert to number and fixed decimal places
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Use toLocaleString to add commas for thousands
  return numValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}; 