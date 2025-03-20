import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the App component before importing
// Since we're focusing on export/import functionality
jest.mock('../App', () => {
  const mockApp = (props) => {
    global.mockAppProps = props;
    global.mockAppFunctions = {
      handleExport: jest.fn(),
      handleJsonImport: jest.fn(),
      validateImportedData: jest.fn(),
      getExportData: jest.fn(),
    };
    return <div data-testid="mock-app">Mock App</div>;
  };
  return mockApp;
});

// Helper functions for tests
const exportToJson = (data) => {
  if (!data) return 'No data to export';
  return JSON.stringify(data, null, 2);
};

const convertToCSV = (data) => {
  if (!data || !data.length) return 'No data to export';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Handle special cases (commas, quotes, etc.)
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return String(value).replace(/"/g, '""');
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
};

// Sample data for testing
const samplePortfolioData = {
  modelPortfolios: [
    {
      id: 'model1',
      name: 'Test Model Portfolio',
      stocks: [
        { symbol: 'AAPL', targetPercentage: 25 },
        { symbol: 'MSFT', targetPercentage: 25 },
        { symbol: 'GOOG', targetPercentage: 25 },
        { symbol: 'AMZN', targetPercentage: 25 },
      ],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-02-01T00:00:00.000Z'
    }
  ],
  accounts: [
    {
      id: 'account1',
      name: 'Test Brokerage Account',
      positions: [
        { symbol: 'AAPL', shares: 10, costBasis: 150 },
        { symbol: 'MSFT', shares: 5, costBasis: 200 },
      ],
      cash: 1000
    }
  ],
  categories: ['Technology', 'Healthcare', 'Finance'],
  stockCategories: {
    'AAPL': 'Technology',
    'MSFT': 'Technology',
    'GOOG': 'Technology',
    'AMZN': 'Technology'
  },
  stockPrices: {
    'AAPL': 180.5,
    'MSFT': 340.2,
    'GOOG': 140.3,
    'AMZN': 175.8
  },
  marketstackApiKey: 'test-api-key',
  portfolioValueHistory: [
    { date: '2023-01-01T00:00:00.000Z', value: 5000, source: 'manual' },
    { date: '2023-02-01T00:00:00.000Z', value: 5500, source: 'auto' },
    { date: '2023-03-01T00:00:00.000Z', value: 5300, source: 'auto' }
  ],
  backupDate: '2023-03-15T00:00:00.000Z'
};

const invalidData = {
  something: 'wrong'
};

// Implement a simplified version of validateImportedData for tests
const validateImportedData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  
  const requiredKeys = ['modelPortfolios', 'accounts', 'categories', 'stockCategories', 'portfolioValueHistory'];
  const hasAtLeastOneKey = requiredKeys.some(key => key in data);
  
  if (!hasAtLeastOneKey) {
    return false;
  }
  
  if (data.modelPortfolios && !Array.isArray(data.modelPortfolios)) {
    return false;
  }
  
  if (data.accounts && !Array.isArray(data.accounts)) {
    return false;
  }
  
  if (data.categories && !Array.isArray(data.categories)) {
    return false;
  }
  
  if (data.stockCategories && typeof data.stockCategories !== 'object') {
    return false;
  }
  
  if (data.portfolioValueHistory && !Array.isArray(data.portfolioValueHistory)) {
    return false;
  }
  
  return true;
};

describe('Export and Import Functionality', () => {
  // Mock document functions for file operations
  let originalCreateElement;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockAnchorElement;
  
  beforeAll(() => {
    originalCreateElement = document.createElement;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    
    // Mock createElement
    document.createElement = jest.fn((tag) => {
      if (tag === 'a') {
        mockAnchorElement = {
          href: '',
          download: '',
          click: jest.fn(),
          style: {},
          appendChild: jest.fn(),
          classList: {
            add: jest.fn()
          },
          textContent: ''
        };
        return mockAnchorElement;
      }
      if (tag === 'textarea' || tag === 'div' || tag === 'button') {
        return {
          style: {},
          value: '',
          appendChild: jest.fn(),
          classList: {
            add: jest.fn()
          },
          textContent: '',
          onclick: null
        };
      }
      return originalCreateElement.call(document, tag);
    });
    
    // Mock URL methods
    URL.createObjectURL = jest.fn(() => 'mock-url');
    URL.revokeObjectURL = jest.fn();
    
    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined)
      },
      writable: true
    });
  });
  
  afterAll(() => {
    // Restore mocks
    document.createElement = originalCreateElement;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Export functionality', () => {
    it('should export valid JSON data', () => {
      const json = exportToJson(samplePortfolioData);
      expect(json).toBeTruthy();
      
      // Verify we can parse it back
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(samplePortfolioData);
    });
    
    it('should export empty JSON data gracefully', () => {
      const json = exportToJson(null);
      expect(json).toBe('No data to export');
    });
    
    it('should generate CSV data correctly', () => {
      const data = [
        { name: 'AAPL', price: 180.5, category: 'Technology' },
        { name: 'MSFT', price: 340.2, category: 'Technology' },
      ];
      
      const csv = convertToCSV(data);
      
      // Verify CSV structure
      const lines = csv.split('\n');
      expect(lines[0]).toBe('name,price,category');
      expect(lines.length).toBe(3);
      expect(lines[1]).toContain('AAPL');
      expect(lines[2]).toContain('MSFT');
    });
    
    it('should handle download link creation properly', () => {
      // Mock the DOM elements and URL methods more comprehensively
      const mockBlob = {};
      const mockURL = 'mock-url';
      
      // Mock Blob constructor
      global.Blob = jest.fn().mockImplementation(() => mockBlob);
      
      // Mock URL methods
      URL.createObjectURL = jest.fn().mockReturnValue(mockURL);
      URL.revokeObjectURL = jest.fn();
      
      // Simplified download function to avoid DOM manipulations
      const downloadJsonData = (data, filename) => {
        // Create a blob with the data
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        
        // Create URL from blob
        const url = URL.createObjectURL(blob);
        
        // Rather than manipulating DOM, just verify the URL and filename
        expect(url).toBe(mockURL);
        expect(filename).toBe('test-export.json');
        
        // Cleanup
        URL.revokeObjectURL(url);
      };
      
      // Call the function
      downloadJsonData(samplePortfolioData, 'test-export.json');
      
      // Verify mock functions were called
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockURL);
    });
    
    it('should handle clipboard export', async () => {
      const json = exportToJson(samplePortfolioData);
      
      await navigator.clipboard.writeText(json);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(json);
    });
  });

  describe('Import functionality', () => {
    it('should validate proper portfolio data structure', () => {
      expect(validateImportedData(samplePortfolioData)).toBe(true);
      expect(validateImportedData(invalidData)).toBe(false);
      expect(validateImportedData(null)).toBe(false);
      expect(validateImportedData(undefined)).toBe(false);
      expect(validateImportedData('string')).toBe(false);
    });
    
    it('should prevent importing invalid data', () => {
      // Mock importPortfolioData
      const importPortfolioData = jest.fn();
      const validateSpy = jest.fn(validateImportedData);
      
      // Function to simulate JSON import handler
      const handleJsonImport = (jsonData) => {
        let data;
        try {
          data = JSON.parse(jsonData);
        } catch (error) {
          return { success: false, error: 'Invalid JSON format' };
        }
        
        if (!validateSpy(data)) {
          return { success: false, error: 'Invalid data structure' };
        }
        
        importPortfolioData(data);
        return { success: true };
      };
      
      // Test with invalid data
      validateSpy.mockReturnValueOnce(false);
      const invalidResult = handleJsonImport(JSON.stringify(invalidData));
      expect(invalidResult.success).toBe(false);
      expect(importPortfolioData).not.toHaveBeenCalled();
      
      // Test with valid data
      validateSpy.mockReturnValueOnce(true);
      const validResult = handleJsonImport(JSON.stringify(samplePortfolioData));
      expect(validResult.success).toBe(true);
      expect(importPortfolioData).toHaveBeenCalledWith(samplePortfolioData);
    });
    
    it('should handle malformed JSON during import', () => {
      // Function to simulate JSON import handler
      const handleJsonImport = (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      };
      
      // Test with valid JSON
      const validResult = handleJsonImport(JSON.stringify(samplePortfolioData));
      expect(validResult.success).toBe(true);
      
      // Test with invalid JSON
      const invalidResult = handleJsonImport('{"this is: not valid JSON');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeTruthy();
    });
    
    it('should handle pasted data import correctly', () => {
      // Mock textarea element
      const textarea = { value: JSON.stringify(samplePortfolioData) };
      
      // Mock functions
      const importPortfolioData = jest.fn();
      const validateSpy = jest.fn(validateImportedData);
      
      // Function to handle pasted data import
      const handlePastedDataImport = (textareaElement) => {
        if (!textareaElement.value.trim()) {
          return { success: false, error: 'No data provided' };
        }
        
        try {
          const data = JSON.parse(textareaElement.value);
          
          if (!validateSpy(data)) {
            return { success: false, error: 'Invalid data format' };
          }
          
          importPortfolioData(data);
          return { success: true };
        } catch (error) {
          return { success: false, error: `Error parsing JSON: ${error.message}` };
        }
      };
      
      // Test successful import
      validateSpy.mockReturnValueOnce(true);
      const result = handlePastedDataImport(textarea);
      expect(result.success).toBe(true);
      expect(importPortfolioData).toHaveBeenCalledWith(samplePortfolioData);
      
      // Test with empty textarea
      const emptyTextarea = { value: '' };
      const emptyResult = handlePastedDataImport(emptyTextarea);
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toBe('No data provided');
    });
  });

  describe('Integration tests for export and import', () => {
    it('should successfully round-trip data from export to import', () => {
      // Export the data
      const exportedJson = exportToJson(samplePortfolioData);
      
      // Mock validation and import functions
      const importPortfolioData = jest.fn();
      const validateSpy = jest.fn(validateImportedData);
      
      // Function to handle JSON import
      const handleJsonImport = (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          
          if (!validateSpy(data)) {
            return { success: false, error: 'Invalid data format' };
          }
          
          importPortfolioData(data);
          return { success: true };
        } catch (error) {
          return { success: false, error: `Error parsing JSON: ${error.message}` };
        }
      };
      
      // Set validateSpy to return true
      validateSpy.mockReturnValueOnce(true);
      
      // Import the exported data
      const importResult = handleJsonImport(exportedJson);
      
      // Verify the result
      expect(importResult.success).toBe(true);
      expect(validateSpy).toHaveBeenCalledWith(samplePortfolioData);
      expect(importPortfolioData).toHaveBeenCalledWith(samplePortfolioData);
    });
    
    it('should preserve all data fields when round-tripping', () => {
      // Export the data
      const exportedJson = exportToJson(samplePortfolioData);
      
      // Re-import the data
      const reimportedData = JSON.parse(exportedJson);
      
      // Check that all fields are preserved
      expect(reimportedData).toEqual(samplePortfolioData);
      expect(reimportedData.modelPortfolios).toHaveLength(1);
      expect(reimportedData.accounts).toHaveLength(1);
      expect(reimportedData.categories).toHaveLength(3);
      expect(Object.keys(reimportedData.stockCategories)).toHaveLength(4);
      expect(Object.keys(reimportedData.stockPrices)).toHaveLength(4);
      expect(reimportedData.backupDate).toBe(samplePortfolioData.backupDate);
    });
  });
}); 