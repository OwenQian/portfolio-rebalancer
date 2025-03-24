/**
 * File-based data persistence utilities
 */

// Only try to require Node.js modules if we're in Electron
let fs = null;
let path = null;
let app = null;

// Check if we're in Electron (where window.require exists)
const isElectron = () => {
  return window && window.require;
};

// Initialize Node.js modules if in Electron
if (isElectron()) {
  fs = window.require('fs');
  path = window.require('path');
  try {
    const remote = window.require('@electron/remote');
    app = remote.app;
  } catch (error) {
    console.error('Error loading @electron/remote:', error);
  }
}

// Get the user's data directory
const getDataDirectory = () => {
  if (!isElectron()) {
    return null;
  }
  
  // In Electron, use app.getPath('userData')
  if (app) {
    return app.getPath('userData');
  }
  
  // In development or non-Electron environment, use a local data directory
  return path.join(process.cwd(), 'data');
};

// Make sure data directory exists
const ensureDataDirectoryExists = () => {
  if (!isElectron()) {
    return null;
  }
  
  const dataDir = getDataDirectory();
  if (dataDir && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

// Get the full path to a data file
const getDataFilePath = (filename) => {
  if (!isElectron()) {
    return null;
  }
  
  const dataDir = ensureDataDirectoryExists();
  return dataDir ? path.join(dataDir, filename) : null;
};

// Get the backups directory path and ensure it exists
const ensureBackupsDirectoryExists = () => {
  if (!isElectron()) {
    return null;
  }
  
  const dataDir = ensureDataDirectoryExists();
  if (!dataDir) return null;
  
  const backupsDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  return backupsDir;
};

// Get the full path to a backup file
const getBackupFilePath = (filename) => {
  if (!isElectron()) {
    return null;
  }
  
  const backupsDir = ensureBackupsDirectoryExists();
  return backupsDir ? path.join(backupsDir, filename) : null;
};

/**
 * Save data to a file
 * @param {string} filename - Name of the file to save to
 * @param {object} data - Data to save
 * @returns {Promise<void>}
 */
export const saveDataToFile = (filename, data) => {
  return new Promise((resolve, reject) => {
    // Check if file operations are available
    if (!isElectron() || !fs) {
      reject(new Error('File system not available in this environment'));
      return;
    }
    
    try {
      // Add .json extension if not provided
      if (!filename.endsWith('.json')) {
        filename = `${filename}.json`;
      }
      
      const filePath = getDataFilePath(filename);
      if (!filePath) {
        reject(new Error('Unable to determine file path'));
        return;
      }
      
      const jsonData = JSON.stringify(data, null, 2);
      
      fs.writeFile(filePath, jsonData, 'utf8', (err) => {
        if (err) {
          console.error('Error writing to file:', err);
          reject(err);
        } else {
          console.log(`Data successfully saved to ${filePath}`);
          resolve();
        }
      });
    } catch (error) {
      console.error('Error in saveDataToFile:', error);
      reject(error);
    }
  });
};

/**
 * Load data from a file
 * @param {string} filename - Name of the file to load from
 * @param {any} defaultValue - Default value to return if file doesn't exist
 * @returns {Promise<any>} - The loaded data
 */
export const loadDataFromFile = (filename, defaultValue = null) => {
  return new Promise((resolve, reject) => {
    // Check if file operations are available
    if (!isElectron() || !fs) {
      reject(new Error('File system not available in this environment'));
      return;
    }
    
    try {
      // Add .json extension if not provided
      if (!filename.endsWith('.json')) {
        filename = `${filename}.json`;
      }
      
      const filePath = getDataFilePath(filename);
      if (!filePath) {
        resolve(defaultValue);
        return;
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`File ${filePath} does not exist, returning default value`);
        resolve(defaultValue);
        return;
      }
      
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          reject(err);
        } else {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            reject(parseError);
          }
        }
      });
    } catch (error) {
      console.error('Error in loadDataFromFile:', error);
      reject(error);
    }
  });
};

/**
 * Check if file backup exists
 * @param {string} filename - Name of the file
 * @returns {Promise<boolean>}
 */
export const fileBackupExists = (filename) => {
  return new Promise((resolve) => {
    // Check if file operations are available
    if (!isElectron() || !fs) {
      resolve(false);
      return;
    }
    
    try {
      // Add .json extension if not provided
      if (!filename.endsWith('.json')) {
        filename = `${filename}.json`;
      }
      
      const filePath = getDataFilePath(filename);
      resolve(filePath && fs.existsSync(filePath));
    } catch (error) {
      console.error('Error checking file existence:', error);
      resolve(false);
    }
  });
};

/**
 * Export all data to a backup file
 * @param {object} data - All application data
 * @returns {Promise<string>} - Path to the backup file
 */
export const exportDataBackup = (data) => {
  return new Promise((resolve, reject) => {
    // Check if file operations are available
    if (!isElectron() || !fs) {
      reject(new Error('File system not available in this environment'));
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFilename = `portfolio-backup-${timestamp}.json`;
      const filePath = getBackupFilePath(backupFilename);
      
      if (!filePath) {
        reject(new Error('Unable to determine file path'));
        return;
      }
      
      const jsonData = JSON.stringify(data, null, 2);
      
      fs.writeFile(filePath, jsonData, 'utf8', (err) => {
        if (err) {
          console.error('Error creating backup:', err);
          reject(err);
        } else {
          console.log(`Backup successfully created at ${filePath}`);
          resolve(filePath);
        }
      });
    } catch (error) {
      console.error('Error in exportDataBackup:', error);
      reject(error);
    }
  });
};

/**
 * Import data from a backup file
 * @param {string} filePath - Path to the backup file
 * @returns {Promise<object>} - The loaded data
 */
export const importDataBackup = (filePath) => {
  return new Promise((resolve, reject) => {
    // Check if file operations are available
    if (!isElectron() || !fs) {
      reject(new Error('File system not available in this environment'));
      return;
    }
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // If filepath doesn't exist as is, try checking in the backups directory
        const backupsDir = ensureBackupsDirectoryExists();
        const backupPath = path.join(backupsDir, path.basename(filePath));
        
        if (fs.existsSync(backupPath)) {
          // Use the backup path instead
          filePath = backupPath;
        } else {
          console.error(`Backup file does not exist at ${filePath} or ${backupPath}`);
          reject(new Error('Backup file not found'));
          return;
        }
      }
      
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading backup file:', err);
          reject(err);
        } else {
          try {
            const jsonData = JSON.parse(data);
            
            // Fix any date format issues in portfolio history
            if (jsonData.portfolioValueHistory && Array.isArray(jsonData.portfolioValueHistory)) {
              jsonData.portfolioValueHistory = jsonData.portfolioValueHistory.map(item => {
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
            
            resolve(jsonData);
          } catch (parseError) {
            console.error('Error parsing backup JSON:', parseError);
            reject(parseError);
          }
        }
      });
    } catch (error) {
      console.error('Error in importDataBackup:', error);
      reject(error);
    }
  });
}; 