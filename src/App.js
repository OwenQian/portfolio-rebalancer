import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Tabs, Tab, Button, Modal, Form, Card } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { formatDollarAmount } from './utils/formatters';

// Import Components
import Header from './components/Header';
import ModelPortfolioManager from './components/ModelPortfolioManager';
import CurrentPortfolio from './components/CurrentPortfolio';
import PortfolioComparison from './components/PortfolioComparison';
import CategoryManager from './components/CategoryManager';
import AllocationChart from './components/AllocationChart';
import AggregatedAllocationChart from './components/AggregatedAllocationChart';

// Import File Storage Utils
import { 
  saveDataToFile, 
  loadDataFromFile, 
  fileBackupExists,
  exportDataBackup,
  importDataBackup
} from './utils/fileStorage';

function App() {
  // State to store model portfolios
  const [modelPortfolios, setModelPortfolios] = useState(() => {
    const savedPortfolios = localStorage.getItem('modelPortfolios');
    return savedPortfolios ? JSON.parse(savedPortfolios) : [];
  });

  // State to store current positions/accounts
  const [accounts, setAccounts] = useState(() => {
    const savedAccounts = localStorage.getItem('accounts');
    return savedAccounts ? JSON.parse(savedAccounts) : [];
  });

  // State to store asset categories
  const [categories, setCategories] = useState(() => {
    const savedCategories = localStorage.getItem('assetCategories');
    return savedCategories ? JSON.parse(savedCategories) : [
      { id: '1', name: 'US Large Cap' },
      { id: '2', name: 'US Small Cap' },
      { id: '3', name: 'International Developed Markets' },
      { id: '4', name: 'Emerging Markets' },
      { id: '5', name: 'International Small Cap' },
      { id: '6', name: 'Emerging Small Cap' },
      { id: '7', name: 'Other' }
    ];
  });

  // State to store stock mappings to categories
  const [stockCategories, setStockCategories] = useState(() => {
    const savedMappings = localStorage.getItem('stockCategories');
    return savedMappings ? JSON.parse(savedMappings) : {};
  });

  // State to store current stock prices
  const [stockPrices, setStockPrices] = useState(() => {
    const savedPrices = localStorage.getItem('stockPrices');
    return savedPrices ? JSON.parse(savedPrices) : {};
  });

  // State for API key
  const [marketstackApiKey, setMarketstackApiKey] = useState(() => {
    const savedApiKey = localStorage.getItem('marketstackApiKey');
    return savedApiKey || '';
  });

  // State for API loading status
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // State for portfolio value history
  const [portfolioValueHistory, setPortfolioValueHistory] = useState(() => {
    const savedHistory = localStorage.getItem('portfolioValueHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  
  // State for file backup modal
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [isUsingFileStorage, setIsUsingFileStorage] = useState(false);

  // New state for export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  const [exportStatus, setExportStatus] = useState('');
  const [exportDataType, setExportDataType] = useState('all');

  // Validate imported data structure
  const validateImportedData = (data) => {
    // First, make sure data is an object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }
    
    // At a minimum, we should have at least one of these key properties
    const requiredKeys = ['modelPortfolios', 'accounts', 'categories', 'stockCategories', 'portfolioValueHistory'];
    const hasAtLeastOneKey = requiredKeys.some(key => key in data);
    
    if (!hasAtLeastOneKey) {
      return false;
    }
    
    // Check if the data has the expected structure for each key
    if (data.modelPortfolios && !Array.isArray(data.modelPortfolios)) {
      return false;
    }
    
    if (data.accounts && !Array.isArray(data.accounts)) {
      return false;
    }
    
    if (data.categories && !Array.isArray(data.categories)) {
      return false;
    }
    
    // For stock categories, we expect an object
    if (data.stockCategories && typeof data.stockCategories !== 'object') {
      return false;
    }
    
    // For portfolioValueHistory, we expect an array
    if (data.portfolioValueHistory && !Array.isArray(data.portfolioValueHistory)) {
      return false;
    }
    
    return true;
  };

  // Helper function to update state with imported data - wrapped in useCallback
  const importPortfolioData = useCallback((data) => {
    // Update all the state with loaded data
    setModelPortfolios(data.modelPortfolios || []);
    setAccounts(data.accounts || []);
    setCategories(data.categories || []);
    setStockCategories(data.stockCategories || {});
    setStockPrices(data.stockPrices || {});
    setMarketstackApiKey(data.marketstackApiKey || '');
    
    // Fix dates and ensure portfolio history data is properly preserved
    let portfolioHistory = data.portfolioValueHistory || [];
    
    // Ensure consistent date format and fix timezone issues (especially near year boundaries)
    if (Array.isArray(portfolioHistory) && portfolioHistory.length > 0) {
      portfolioHistory = portfolioHistory.map(item => {
        // Make sure date is always stored as ISO string
        if (item.date) {
          const dateObj = new Date(item.date);
          // Store the date as UTC to prevent timezone issues
          const isoDate = dateObj.toISOString();
          return { ...item, date: isoDate };
        }
        return item;
      });
    }
    
    setPortfolioValueHistory(portfolioHistory);
  }, [setModelPortfolios, setAccounts, setCategories, setStockCategories, setStockPrices, setMarketstackApiKey, setPortfolioValueHistory]);
  
  // Function to handle restore from file - wrapped in useCallback
  const handleRestoreFromFile = useCallback(async () => {
    try {
      setRestoreStatus('Loading data...');
      
      // Only try file-based restore if file system is available
      if (isUsingFileStorage) {
        try {
          // Load data from the automatic backup file
          const data = await loadDataFromFile('portfolioData', null);
          
          if (!data) {
            setRestoreStatus('No automatic backup found.');
            return;
          }
          
          // Validate the imported data structure before applying
          if (!validateImportedData(data)) {
            setRestoreStatus('Invalid data format in automatic backup. Restore failed.');
            return;
          }
          
          // Update all state with loaded data
          importPortfolioData(data);
          
          setRestoreStatus('Data restored successfully from automatic backup.');
          setTimeout(() => setShowRestoreModal(false), 2000);
        } catch (error) {
          console.error('Error restoring from automatic backup:', error);
          setRestoreStatus(`Error: ${error.message}. Try manual import instead.`);
          setIsUsingFileStorage(false); // Disable file storage after error
        }
      } else {
        setRestoreStatus('Automatic backup is only available in desktop app. Please use Import From File.');
      }
    } catch (error) {
      console.error('Error in handleRestoreFromFile:', error);
      setRestoreStatus(`Error: ${error.message}`);
      setIsUsingFileStorage(false); // Disable file storage after error
    }
  }, [isUsingFileStorage, importPortfolioData]);

  // Check if file storage is available - initialize only once
  useEffect(() => {
    let mounted = true;
    
    const checkFileStorage = async () => {
      try {
        // Check for Electron environment first
        const isElectron = window && window.process && window.process.type;
        if (!isElectron) {
          console.log('Not running in Electron, using localStorage only');
          if (mounted) setIsUsingFileStorage(false);
          return;
        }
        
        // Try to read the portfolio data file to see if we're in Electron with file access
        const fileExists = await fileBackupExists('portfolioData');
        if (mounted) setIsUsingFileStorage(true);
        
        // If file exists and we don't have data, load it
        if (fileExists && accounts.length === 0 && mounted) {
          handleRestoreFromFile();
        }
      } catch (error) {
        console.log('File system not available, using localStorage only:', error);
        if (mounted) setIsUsingFileStorage(false);
      }
    };
    
    checkFileStorage().catch(err => {
      console.error('Error checking file storage availability:', err);
      if (mounted) setIsUsingFileStorage(false);
    });
    
    return () => {
      mounted = false;
    };
  }, [accounts.length, handleRestoreFromFile]);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('modelPortfolios', JSON.stringify(modelPortfolios));
  }, [modelPortfolios]);

  useEffect(() => {
    localStorage.setItem('accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('assetCategories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('stockCategories', JSON.stringify(stockCategories));
  }, [stockCategories]);

  useEffect(() => {
    localStorage.setItem('stockPrices', JSON.stringify(stockPrices));
  }, [stockPrices]);

  useEffect(() => {
    localStorage.setItem('marketstackApiKey', marketstackApiKey);
  }, [marketstackApiKey]);

  useEffect(() => {
    localStorage.setItem('portfolioValueHistory', JSON.stringify(portfolioValueHistory));
  }, [portfolioValueHistory]);
  
  // Auto-save to file whenever data changes (if file system is available)
  useEffect(() => {
    // Make sure we're in Electron
    const isElectron = window && window.process && window.process.type;
    if (!isElectron) {
      setIsUsingFileStorage(false);
      return;
    }
    
    const saveData = async () => {
      try {
        // Only try to save if we have data
        if (accounts.length > 0 || modelPortfolios.length > 0) {
          // Ensure portfolioValueHistory is properly normalized before saving
          let normalizedHistory = [];
          
          if (Array.isArray(portfolioValueHistory) && portfolioValueHistory.length > 0) {
            normalizedHistory = portfolioValueHistory.map(item => {
              // Make sure date is always stored as ISO string
              if (item.date) {
                const dateObj = new Date(item.date);
                // Store the date as UTC to prevent timezone issues
                const isoDate = dateObj.toISOString();
                return { ...item, date: isoDate };
              }
              return item;
            });
          }
          
          const portfolioData = {
            modelPortfolios,
            accounts,
            categories,
            stockCategories,
            stockPrices,
            marketstackApiKey,
            portfolioValueHistory: normalizedHistory
          };
          
          await saveDataToFile('portfolioData', portfolioData);
        }
      } catch (error) {
        console.error('Error saving to file:', error);
        // File system error occurred, disable file storage for this session
        setIsUsingFileStorage(false);
      }
    };
    
    saveData();
  }, [modelPortfolios, accounts, categories, stockCategories, stockPrices, marketstackApiKey, portfolioValueHistory, isUsingFileStorage]);

  // Function to update stock prices using Marketstack API
  const updateStockPrices = async (manualPrices = null, selectedSymbols = null, snapshotOnly = false, snapshotValue = null) => {
    try {
      // If it's just a manual snapshot without syncing prices
      if (snapshotOnly && snapshotValue) {
        recordPortfolioSnapshot(snapshotValue, 'snapshot');
        return snapshotValue;
      }
      
      // If manual prices are provided, use them
      if (manualPrices) {
        setStockPrices(manualPrices);
        
        const totalValue = calculateTotalPortfolioValue(accounts, manualPrices);
        return totalValue;
      }

      // Get all unique stock symbols from accounts and model portfolios
      const symbols = new Set();
      
      if (selectedSymbols && selectedSymbols.length > 0) {
        // Use provided selected symbols if available
        selectedSymbols.forEach(symbol => symbols.add(symbol));
      } else {
        // Otherwise get all symbols
        accounts.forEach(account => {
          account.positions.forEach(position => {
            symbols.add(position.symbol);
          });
        });

        // Also include symbols from model portfolios
        modelPortfolios.forEach(portfolio => {
          portfolio.stocks.forEach(stock => {
            symbols.add(stock.symbol);
          });
        });
      }

      // Convert to array and format for API request
      const symbolsArray = Array.from(symbols);
      
      if (symbolsArray.length === 0) {
        alert('No symbols selected for price update.');
        return null;
      }

      // Check if API key is provided
      if (!marketstackApiKey) {
        const apiKey = prompt("Please enter your Marketstack API key to fetch real-time stock prices:");
        if (!apiKey) {
          alert('API key is required to fetch stock prices.');
          return null;
        }
        setMarketstackApiKey(apiKey);
      }

      setIsLoadingPrices(true);
      setApiError(null);

      // Process symbols in batches of 100 (API limit)
      const batchSize = 100;
      const updatedPrices = { ...stockPrices };
      let failedSymbols = [];
      let successCount = 0;

      for (let i = 0; i < symbolsArray.length; i += batchSize) {
        const batchSymbols = symbolsArray.slice(i, i + batchSize);
        const symbolsString = batchSymbols.join(',');

        try {
          // Make API request to Marketstack
          const response = await fetch(
            `https://api.marketstack.com/v1/eod/latest?access_key=${marketstackApiKey}&symbols=${symbolsString}`
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch stock prices');
          }

          const data = await response.json();

          // Update prices for each symbol in the response
          if (data.data && Array.isArray(data.data)) {
            // Use for loop instead of forEach to avoid closure issues
            for (let j = 0; j < data.data.length; j++) {
              const stock = data.data[j];
              if (stock.symbol && stock.close) {
                updatedPrices[stock.symbol] = parseFloat(stock.close).toFixed(2);
                successCount += 1;
              } else {
                failedSymbols.push(stock.symbol || 'Unknown');
              }
            }
          }
          
          // Add a small delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error fetching batch of symbols: ${error.message}`);
          failedSymbols = [...failedSymbols, ...batchSymbols];
        }
      }

      setStockPrices(updatedPrices);
      setIsLoadingPrices(false);

      // Calculate portfolio value but don't record a snapshot
      const totalValue = calculateTotalPortfolioValue(accounts, updatedPrices);

      if (failedSymbols.length > 0) {
        setApiError(`Failed to update prices for ${failedSymbols.length} symbols: ${failedSymbols.join(', ')}`);
        console.error('Failed symbols:', failedSymbols);
        alert(`Successfully updated ${successCount} symbols. ${failedSymbols.length} symbols failed to update.`);
      } else {
        alert(`Successfully updated prices for ${successCount} symbols!`);
      }
      
      return totalValue;
    } catch (error) {
      console.error('Error updating stock prices:', error);
      setIsLoadingPrices(false);
      setApiError(error.message);
      alert(`Failed to update stock prices: ${error.message}`);
      return null;
    }
  };

  // Function to update API key
  const updateApiKey = (newKey) => {
    setMarketstackApiKey(newKey);
  };
  
  // Function to handle backup to file
  const handleBackupToFile = async () => {
    try {
      setBackupStatus('Creating backup...');
      
      // Normalize portfolioValueHistory to prevent date issues
      let normalizedHistory = [];
      
      if (Array.isArray(portfolioValueHistory) && portfolioValueHistory.length > 0) {
        normalizedHistory = portfolioValueHistory.map(item => {
          // Make sure date is always stored as ISO string
          if (item.date) {
            const dateObj = new Date(item.date);
            // Store the date as UTC to prevent timezone issues
            const isoDate = dateObj.toISOString();
            return { ...item, date: isoDate };
          }
          return item;
        });
      }
      
      const portfolioData = {
        modelPortfolios,
        accounts,
        categories,
        stockCategories,
        stockPrices,
        marketstackApiKey,
        portfolioValueHistory: normalizedHistory,
        backupDate: new Date().toISOString()
      };
      
      if (isUsingFileStorage) {
        // Use Electron file system for desktop app
        const backupPath = await exportDataBackup(portfolioData);
        setBackupStatus(`Backup created successfully at: ${backupPath}`);
      } else {
        // Browser environment - create downloadable file
        downloadJsonData(portfolioData, `portfolio-backup-${new Date().toISOString().replace(/:/g, '-')}.json`);
        setBackupStatus('Backup file downloaded successfully.');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setBackupStatus(`Error creating backup: ${error.message}`);
    }
  };
  
  // Helper function to download JSON data in browser
  const downloadJsonData = (data, filename) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };
  
  // Function to open browser's file picker
  const openBrowserFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) {
        setRestoreStatus('No file selected.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = e.target.result;
          handleJsonImport(jsonData, file.name);
        } catch (error) {
          console.error('Error reading file:', error);
          setRestoreStatus(`Error reading file: ${error.message}`);
        }
      };
      
      reader.onerror = () => {
        setRestoreStatus('Error reading file.');
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  };
  
  // Function to handle JSON import from file
  const handleJsonImport = (jsonData, filename) => {
    try {
      const data = JSON.parse(jsonData);
      setRestoreStatus(`Validating data from ${filename}...`);
      
      // Validate the imported data structure
      if (!validateImportedData(data)) {
        setRestoreStatus(`Invalid data structure in ${filename}.`);
        return;
      }
      
      // Normalize the portfolio history data to handle timezone issues
      if (data.portfolioValueHistory && Array.isArray(data.portfolioValueHistory)) {
        data.portfolioValueHistory = data.portfolioValueHistory.map(item => {
          if (item.date) {
            const dateObj = new Date(item.date);
            return {
              ...item,
              date: dateObj.toISOString()
            };
          }
          return item;
        });
      }
      
      // Update all state with loaded data
      importPortfolioData(data);
      
      setRestoreStatus(`Data successfully imported from ${filename}.`);
      
      // Close modal after a brief delay
      setTimeout(() => setShowRestoreModal(false), 2000);
    } catch (error) {
      console.error('Error parsing JSON data:', error);
      setRestoreStatus(`Error parsing JSON data from ${filename}: ${error.message}`);
    }
  };
  
  // Function to handle pasting JSON directly
  const handlePasteJson = () => {
    try {
      setRestoreStatus('Paste your JSON data below:');
      
      // Create and configure a textarea
      const textarea = document.createElement('textarea');
      textarea.style.width = '100%';
      textarea.style.height = '200px';
      textarea.style.marginTop = '10px';
      textarea.placeholder = 'Paste JSON data here...';
      
      // Create a button to process the pasted JSON
      const importBtn = document.createElement('button');
      importBtn.textContent = 'Import Pasted Data';
      importBtn.className = 'btn btn-primary mt-3';
      
      // Create a container for the UI elements
      const container = document.createElement('div');
      container.appendChild(textarea);
      container.appendChild(document.createElement('br'));
      container.appendChild(importBtn);
      
      // Clear previous UI and add new elements
      const modalBody = document.querySelector('.modal-body');
      const existingAlert = modalBody.querySelector('.alert');
      if (existingAlert) {
        existingAlert.remove();
      }
      
      // Create a new info element to show status
      const statusDiv = document.createElement('div');
      statusDiv.className = 'alert alert-info mt-3';
      statusDiv.textContent = setRestoreStatus('Paste your JSON data and click Import');
      
      modalBody.appendChild(container);
      modalBody.appendChild(statusDiv);
      
      // Handle the import button click
      importBtn.onclick = () => {
        const jsonData = textarea.value.trim();
        if (!jsonData) {
          setRestoreStatus('No data provided.');
          return;
        }
        
        handleJsonImport(jsonData, 'pasted-data');
        
        // Clean up the UI
        container.remove();
        setShowRestoreModal(true); // Keep the modal open to show the status
      };
    } catch (error) {
      console.error('Error setting up paste UI:', error);
      setRestoreStatus(`Error: ${error.message}`);
    }
  };

  // Function to export data to JSON
  const exportToJson = (data) => {
    if (!data) return 'No data to export';
    return JSON.stringify(data, null, 2);
  };
  
  // Function to convert JSON to CSV
  const convertToCSV = (data) => {
    try {
      if (!data || !Array.isArray(data) || data.length === 0 || !data[0]) {
        return 'No data to export';
      }
      
      // Get headers from the first object's keys
      const headers = Object.keys(data[0]);
      
      // Create CSV header row
      let csv = headers.join(',') + '\n';
      
      // Add data rows
      data.forEach(item => {
        const row = headers.map(header => {
          let cell = item[header];
          
          // Handle nested objects/arrays
          if (typeof cell === 'object' && cell !== null) {
            cell = JSON.stringify(cell).replace(/"/g, '""');
          }
          
          // Escape commas and quotes
          if (cell === null || cell === undefined) {
            return '';
          }
          cell = String(cell);
          
          // Wrap in quotes if contains commas, quotes, or newlines
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',');
        
        csv += row + '\n';
      });
      
      return csv;
    } catch (error) {
      console.error('Error converting to CSV:', error);
      return 'Error converting to CSV: ' + error.message;
    }
  };
  
  // Helper function to get the data for export based on selected type
  const getExportData = () => {
    switch (exportDataType) {
      case 'all':
        return {
          modelPortfolios,
          accounts,
          categories,
          stockCategories,
          stockPrices,
          portfolioValueHistory
        };
      case 'modelPortfolios':
        return modelPortfolios;
      case 'accounts':
        return accounts;
      case 'categories':
        return categories;
      case 'snapshots':
        return portfolioValueHistory;
      default:
        return {};
    }
  };
  
  // Function to export data based on the selected format
  const handleExport = (destination) => {
    try {
      setExportStatus('Preparing data...');
      const data = getExportData();
      
      let exportContent;
      let fileExt;
      let contentType;
      
      // Format the data based on selected format
      if (exportFormat === 'json') {
        exportContent = exportToJson(data);
        fileExt = 'json';
        contentType = 'application/json';
      } else {
        // For CSV, handle different data types appropriately
        if (exportDataType === 'all') {
          // For 'all', create a consolidated CSV with separate sections
          let csvSections = [];
          
          // Add model portfolios section if data exists
          if (modelPortfolios && modelPortfolios.length > 0) {
            const modelPortfolioCSV = [];
            modelPortfolios.forEach(portfolio => {
              portfolio.stocks.forEach(stock => {
                modelPortfolioCSV.push({
                  type: 'Model Portfolio',
                  portfolioName: portfolio.name,
                  symbol: stock.symbol,
                  targetWeight: stock.targetWeight,
                  category: stockCategories[stock.symbol] || ''
                });
              });
            });
            
            if (modelPortfolioCSV.length > 0) {
              csvSections.push('MODEL PORTFOLIOS\n' + convertToCSV(modelPortfolioCSV));
            }
          }
          
          // Add accounts section if data exists
          if (accounts && accounts.length > 0) {
            const accountsCSV = [];
            accounts.forEach(account => {
              account.positions.forEach(position => {
                accountsCSV.push({
                  type: 'Account',
                  accountName: account.name,
                  symbol: position.symbol,
                  shares: position.shares,
                  price: stockPrices[position.symbol] || 0,
                  category: stockCategories[position.symbol] || ''
                });
              });
            });
            
            if (accountsCSV.length > 0) {
              csvSections.push('ACCOUNTS AND POSITIONS\n' + convertToCSV(accountsCSV));
            }
          }
          
          // Add snapshots section if data exists
          if (portfolioValueHistory && portfolioValueHistory.length > 0) {
            const snapshotsCSV = [];
            portfolioValueHistory.forEach(snapshot => {
              snapshotsCSV.push({
                date: new Date(snapshot.date).toLocaleString(),
                value: parseFloat(snapshot.value).toFixed(2),
                type: snapshot.type
              });
            });
            
            if (snapshotsCSV.length > 0) {
              csvSections.push('PORTFOLIO SNAPSHOTS\n' + convertToCSV(snapshotsCSV));
            }
          }
          
          exportContent = csvSections.join('\n\n');
        } else if (exportDataType === 'snapshots') {
          // Handle snapshots format conversion separately
          const snapshotsCSV = [];
          portfolioValueHistory.forEach(snapshot => {
            snapshotsCSV.push({
              date: new Date(snapshot.date).toLocaleString(),
              value: parseFloat(snapshot.value).toFixed(2),
              type: snapshot.type
            });
          });
          exportContent = convertToCSV(snapshotsCSV);
        } else if (Array.isArray(data)) {
          exportContent = convertToCSV(data);
        } else {
          setExportStatus('The selected data cannot be exported to CSV format');
          return;
        }
        
        fileExt = 'csv';
        contentType = 'text/csv';
      }
      
      // Handle the export based on the selected destination
      if (destination === 'clipboard') {
        navigator.clipboard.writeText(exportContent)
          .then(() => {
            setExportStatus('Data copied to clipboard successfully!');
            setTimeout(() => setExportStatus(''), 3000);
          })
          .catch(err => {
            console.error('Error copying to clipboard:', err);
            setExportStatus('Error copying to clipboard');
          });
      } else if (destination === 'download') {
        // Create a blob with the data
        const blob = new Blob([exportContent], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        // Create a download link and click it
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-data-${exportDataType}.${fileExt}`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setExportStatus('File downloaded successfully!');
          setTimeout(() => setExportStatus(''), 3000);
        }, 0);
      }
    } catch (error) {
      console.error('Error during export:', error);
      setExportStatus(`Error during export: ${error.message}`);
    }
  };

  // Function to open backup file dialog and import
  const handleImportBackup = async () => {
    try {
      setRestoreStatus('Selecting file...');
      
      // Check if we're in Electron with file dialog support
      if (window && typeof window.require === 'function') {
        try {
          const { ipcRenderer } = window.require('electron');
          const filePath = await ipcRenderer.invoke('open-file-dialog');
          
          if (!filePath) {
            setRestoreStatus('File selection cancelled.');
            return;
          }
          
          const data = await importDataBackup(filePath);
          
          // Validate the imported data
          if (!validateImportedData(data)) {
            setRestoreStatus('Invalid data format in file. Import failed.');
            return;
          }
          
          // Update all the state with loaded data
          importPortfolioData(data);
          
          setRestoreStatus('Data imported successfully from: ' + filePath);
          setTimeout(() => setShowRestoreModal(false), 2000);
        } catch (error) {
          console.error('Error accessing Electron features:', error);
          setRestoreStatus('Using browser file picker instead...');
          openBrowserFilePicker();
        }
      } else {
        setRestoreStatus('Using browser file picker...');
        openBrowserFilePicker();
      }
    } catch (error) {
      console.error('Error importing backup:', error);
      setRestoreStatus(`Error importing backup: ${error.message}`);
    }
  };

  // Function to record a snapshot of the current portfolio value
  const recordPortfolioSnapshot = (value, type = 'snapshot') => {
    setPortfolioValueHistory(prev => {
      // Ensure prev is an array
      const prevHistory = Array.isArray(prev) ? prev : [];
      
      // Create date in ISO format with consistent UTC timezone to avoid boundary issues
      const now = new Date();
      const isoDate = now.toISOString();
      
      return [
        ...prevHistory,
        { date: isoDate, value, type }
      ];
    });
    return value;
  };

  // Make calculateTotalPortfolioValue available for JSX
  const calculateTotalPortfolioValue = (accountsList, priceData) => {
    return accountsList.reduce((total, account) => {
      const accountTotal = account.positions.reduce((accTotal, position) => {
        const price = priceData[position.symbol] || 0;
        return accTotal + (price * position.shares);
      }, 0);
      return total + accountTotal;
    }, 0).toFixed(2);
  };

  return (
    <div className="App">
      <Header />
      <Container fluid className="mt-4">
        {/* Data Management Buttons */}
        <div className="mb-3 d-flex justify-content-end">
          {isUsingFileStorage ? (
            <>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="me-2"
                onClick={() => setShowBackupModal(true)}
              >
                Backup Data
              </Button>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="me-2"
                onClick={() => setShowRestoreModal(true)}
              >
                Restore Data
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="me-2"
                onClick={() => setShowRestoreModal(true)}
              >
                Import Data
              </Button>
            </>
          )}
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={() => setShowExportModal(true)}
          >
            Export Data
          </Button>
        </div>
        
        <Tabs defaultActiveKey="current" className="mb-4">
          <Tab eventKey="current" title="Current Portfolio">
            <Row>
              <Col md={8}>
                <CurrentPortfolio 
                  accounts={accounts} 
                  setAccounts={setAccounts} 
                  categories={categories}
                  stockCategories={stockCategories} 
                  setStockCategories={setStockCategories}
                  stockPrices={stockPrices}
                  updateStockPrices={updateStockPrices}
                  marketstackApiKey={marketstackApiKey}
                  updateApiKey={updateApiKey}
                  isLoadingPrices={isLoadingPrices}
                  apiError={apiError}
                  modelPortfolios={modelPortfolios}
                  portfolioValueHistory={portfolioValueHistory}
                  setPortfolioValueHistory={setPortfolioValueHistory}
                />
              </Col>
              <Col md={4}>
                <Card className="h-100">
                  <Card.Header>
                    <h5 className="mb-0">Asset Allocation</h5>
                  </Card.Header>
                  <Card.Body>
                    <div className="allocation-section">
                      <h5 className="mb-4 mt-2 text-center fw-bold">Detailed Allocation</h5>
                      <div className="chart-wrapper">
                        <AllocationChart 
                          accounts={accounts} 
                          categories={categories}
                          stockCategories={stockCategories}
                          stockPrices={stockPrices}
                          showHeader={false}
                        />
                      </div>
                    </div>
                    
                    <hr className="chart-divider chart-visual-separator" />
                    
                    <div className="allocation-section">
                      <h5 className="mb-4 mt-2 text-center fw-bold">Grouped Allocation</h5>
                      <div className="chart-wrapper">
                        <AggregatedAllocationChart
                          accounts={accounts} 
                          categories={categories}
                          stockCategories={stockCategories}
                          stockPrices={stockPrices}
                          showHeader={false}
                        />
                      </div>
                    </div>
                  </Card.Body>
                  <Card.Footer className="text-muted">
                    Total Portfolio Value: {formatDollarAmount(
                      calculateTotalPortfolioValue(accounts, stockPrices)
                    )}
                  </Card.Footer>
                </Card>
              </Col>
            </Row>
          </Tab>
          <Tab eventKey="model" title="Model Portfolios">
            <ModelPortfolioManager 
              modelPortfolios={modelPortfolios} 
              setModelPortfolios={setModelPortfolios} 
              categories={categories}
              stockCategories={stockCategories}
              setStockCategories={setStockCategories}
            />
          </Tab>
          <Tab eventKey="compare" title="Portfolio Comparison">
            <PortfolioComparison 
              modelPortfolios={modelPortfolios}
              accounts={accounts}
              categories={categories}
              stockCategories={stockCategories}
              stockPrices={stockPrices}
            />
          </Tab>
          <Tab eventKey="categories" title="Categories">
            <CategoryManager 
              categories={categories} 
              setCategories={setCategories}
              stockCategories={stockCategories}
              setStockCategories={setStockCategories}
              modelPortfolios={modelPortfolios}
              accounts={accounts}
            />
          </Tab>
        </Tabs>
      </Container>
      
      {/* New Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Export Portfolio Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Select data to export:</Form.Label>
              <Form.Select 
                value={exportDataType} 
                onChange={(e) => setExportDataType(e.target.value)}
              >
                <option value="all">All Data</option>
                <option value="modelPortfolios">Model Portfolios</option>
                <option value="accounts">Accounts & Positions</option>
                <option value="categories">Asset Categories</option>
                <option value="snapshots">Portfolio Snapshots</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Export format:</Form.Label>
              <Form.Select 
                value={exportFormat} 
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </Form.Select>
            </Form.Group>
          </Form>
          
          {exportStatus && (
            <div className="alert alert-info mt-3">
              {exportStatus}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            Close
          </Button>
          <Button 
            variant="outline-primary" 
            onClick={() => handleExport('clipboard')}
          >
            Copy to Clipboard
          </Button>
          <Button 
            variant="primary" 
            onClick={() => handleExport('download')}
          >
            Download File
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Backup Modal */}
      <Modal show={showBackupModal} onHide={() => setShowBackupModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Backup Portfolio Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Create a backup file of all your portfolio data.</p>
          <p>This will save your:</p>
          <ul>
            <li>Model portfolios</li>
            <li>Accounts and positions</li>
            <li>Asset categories</li>
            <li>Stock prices</li>
            <li>Portfolio value history & snapshots</li>
            <li>API settings</li>
          </ul>
          {backupStatus && (
            <div className="alert alert-info mt-3">
              {backupStatus}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBackupModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={handleBackupToFile}>
            Create Backup
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Restore Modal */}
      <Modal show={showRestoreModal} onHide={() => setShowRestoreModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Restore Portfolio Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Restore your portfolio data from a backup file or paste JSON directly.</p>
          <p><strong>Warning:</strong> This will replace all your current data.</p>
          {restoreStatus && (
            <div className="alert alert-info mt-3">
              {restoreStatus}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>
            Cancel
          </Button>
          {isUsingFileStorage && (
            <Button variant="warning" onClick={handleRestoreFromFile}>
              Restore Last Automatic Backup
            </Button>
          )}
          <Button 
            variant="outline-primary" 
            onClick={handlePasteJson}
          >
            Paste JSON Data
          </Button>
          <Button variant="primary" onClick={handleImportBackup}>
            Import From File...
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App;
