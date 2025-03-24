const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { initialize, enable } = require('@electron/remote/main');

// Initialize @electron/remote
initialize();

// Get port from environment variable or default to 3001
const PORT = process.env.PORT || 3001;

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: !isDev // Disable CORS in dev mode
    }
  });

  // Enable @electron/remote for this window
  enable(mainWindow.webContents);

  // Load the app with the correct port
  mainWindow.loadURL(
    isDev
      ? `http://localhost:${PORT}`
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// IPC handlers
ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('save-file-dialog', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'portfolio-backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  
  if (canceled) {
    return null;
  } else {
    return filePath;
  }
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 