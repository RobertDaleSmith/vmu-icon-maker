// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  console.log('Creating window...');
  const win = new BrowserWindow({
    width: 860,
    height: 860,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html').then(() => {
    console.log('Window loaded successfully');
  }).catch(err => {
    console.error('Failed to load window:', err);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
