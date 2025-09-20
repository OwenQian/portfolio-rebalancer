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



// Get the backups directory path and ensure it exists
const ensureBackupsDirectoryExists = () => {
  if (!isElectron()) {
    return null;
  }
  
  const dataDir = ensureConfiguredDataDirectoryExists();
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
  return new Promise(async (resolve, reject) => {
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
      
      const filePath = getConfiguredDataFilePath(filename);
      if (!filePath) {
        reject(new Error('Unable to determine file path'));
        return;
      }
      
      const jsonData = JSON.stringify(data, null, 2);
      
      // Use retry logic for cloud storage operations
      await retryOperation(async () => {
        return new Promise((writeResolve, writeReject) => {
          fs.writeFile(filePath, jsonData, 'utf8', (err) => {
            if (err) {
              const enhancedError = handleCloudStorageError(err, 'Save operation');
              console.error('Error writing to file:', enhancedError.message);
              writeReject(enhancedError);
            } else {
              console.log(`Data successfully saved to ${filePath}`);
              writeResolve();
            }
          });
        });
      });
      
      resolve();
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
  return new Promise(async (resolve, reject) => {
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
      
      const filePath = getConfiguredDataFilePath(filename);
      if (!filePath) {
        resolve(defaultValue);
        return;
      }
      
      // Use retry logic for cloud storage operations
      const result = await retryOperation(async () => {
        return new Promise((readResolve, readReject) => {
          // Check if file exists
          if (!fs.existsSync(filePath)) {
            console.log(`File ${filePath} does not exist, returning default value`);
            readResolve(defaultValue);
            return;
          }
          
          fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              const enhancedError = handleCloudStorageError(err, 'Load operation');
              console.error('Error reading file:', enhancedError.message);
              readReject(enhancedError);
            } else {
              try {
                const parsedData = JSON.parse(data);
                readResolve(parsedData);
              } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                readReject(parseError);
              }
            }
          });
        });
      });
      
      resolve(result);
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
      
      const filePath = getConfiguredDataFilePath(filename);
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

// Storage location types
export const STORAGE_TYPES = {
  LOCAL: 'local',
  ICLOUD: 'icloud',
  GOOGLE_DRIVE: 'google_drive',
  CUSTOM: 'custom'
};

// Cloud folder detection utilities
export const detectCloudFolders = () => {
  if (!isElectron() || !fs || !path) {
    return { icloud: null, googleDrive: null };
  }

  const os = window.require('os');
  const homeDir = os.homedir();
  
  const cloudPaths = {
    icloud: null,
    googleDrive: null
  };

  try {
    // Detect iCloud Drive (macOS)
    const icloudPath = path.join(homeDir, 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
    if (fs.existsSync(icloudPath)) {
      cloudPaths.icloud = icloudPath;
    }

    // Detect Google Drive (multiple possible locations)
    const googleDrivePaths = [
      path.join(homeDir, 'Google Drive'),
      path.join(homeDir, 'GoogleDrive'),
      path.join(homeDir, 'Google Drive File Stream'),
      path.join(homeDir, 'GoogleDriveFileStream')
    ];

    for (const gPath of googleDrivePaths) {
      if (fs.existsSync(gPath)) {
        cloudPaths.googleDrive = gPath;
        break;
      }
    }
  } catch (error) {
    console.error('Error detecting cloud folders:', error);
  }

  return cloudPaths;
};

// Get storage configuration from settings
let storageConfig = null;

export const setStorageConfig = (config) => {
  storageConfig = config;
};

export const getStorageConfig = () => {
  if (!storageConfig) {
    // Default to local storage
    return {
      type: STORAGE_TYPES.LOCAL,
      path: null
    };
  }
  return storageConfig;
};

// Get the configured data directory based on storage settings
const getConfiguredDataDirectory = () => {
  if (!isElectron()) {
    return null;
  }

  const config = getStorageConfig();
  
  switch (config.type) {
    case STORAGE_TYPES.ICLOUD:
      const cloudFolders = detectCloudFolders();
      if (cloudFolders.icloud) {
        return path.join(cloudFolders.icloud, 'PortfolioRebalancer');
      }
      // Fallback to local if iCloud not available
      console.warn('iCloud Drive not found, falling back to local storage');
      return getDataDirectory();
      
    case STORAGE_TYPES.GOOGLE_DRIVE:
      const gdFolders = detectCloudFolders();
      if (gdFolders.googleDrive) {
        return path.join(gdFolders.googleDrive, 'PortfolioRebalancer');
      }
      // Fallback to local if Google Drive not available
      console.warn('Google Drive not found, falling back to local storage');
      return getDataDirectory();
      
    case STORAGE_TYPES.CUSTOM:
      return config.path;
      
    case STORAGE_TYPES.LOCAL:
    default:
      return getDataDirectory();
  }
};

// Update existing functions to use configured storage
const ensureConfiguredDataDirectoryExists = () => {
  if (!isElectron()) {
    return null;
  }
  
  const dataDir = getConfiguredDataDirectory();
  if (dataDir && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

// Get the full path to a data file using configured storage
const getConfiguredDataFilePath = (filename) => {
  if (!isElectron()) {
    return null;
  }
  
  const dataDir = ensureConfiguredDataDirectoryExists();
  return dataDir ? path.join(dataDir, filename) : null;
};

// Cloud-specific error handling and retry logic
const retryOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying, with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
};

// Enhanced file operations with cloud-specific error handling
const isCloudStorageError = (error) => {
  if (!error || !error.message) return false;
  
  const message = error.message.toLowerCase();
  const cloudErrors = [
    'enoent', // File not found (common with sync delays)
    'ebusy',  // File busy (sync in progress)
    'eagain', // Resource temporarily unavailable
    'emfile', // Too many open files
    'eacces', // Permission denied (sync conflicts)
    'eperm',  // Operation not permitted
    'enotdir', // Not a directory (sync issues)
    'eisdir'  // Is a directory
  ];
  
  return cloudErrors.some(errorType => message.includes(errorType));
};

const handleCloudStorageError = (error, operation = 'file operation') => {
  if (!isCloudStorageError(error)) {
    return error; // Return original error if not cloud-related
  }
  
  const message = error.message.toLowerCase();
  let userMessage = `${operation} failed: `;
  
  if (message.includes('enoent')) {
    userMessage += 'File not found. This may occur if cloud sync is still in progress.';
  } else if (message.includes('ebusy') || message.includes('eagain')) {
    userMessage += 'File is temporarily busy. Cloud sync may be in progress.';
  } else if (message.includes('eacces') || message.includes('eperm')) {
    userMessage += 'Permission denied. Check cloud storage permissions or sync conflicts.';
  } else {
    userMessage += 'Cloud storage error. Please check your connection and sync status.';
  }
  
  const enhancedError = new Error(userMessage);
  enhancedError.originalError = error;
  enhancedError.isCloudError = true;
  return enhancedError;
}; 