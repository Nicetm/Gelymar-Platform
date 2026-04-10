const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createServer } = require('./server/index.js');

let mainWindow = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    minWidth: 1280,
    minHeight: 720,
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  const server = createServer(userDataPath);

  const listener = server.listen(0, () => {
    const port = listener.address().port;
    console.log(`Express server running on port ${port}`);
    createWindow(port);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    // Server is already running; re-create window if needed
  }
});
