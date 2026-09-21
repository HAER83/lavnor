const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-features', 'OptimizationHints,MediaRouter');

let mainWindow = null;

function resolvePdfArg(argv) {
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.toLowerCase().endsWith('.pdf') && fs.existsSync(arg)) {
      return path.resolve(arg);
    }
  }
  return null;
}

async function openPdfPath(filePath) {
  if (!mainWindow) return;
  try {
    const data = await fs.promises.readFile(filePath);
    mainWindow.webContents.send('open-pdf', {
      name: path.basename(filePath),
      data,
    });
    mainWindow.show();
    mainWindow.focus();
  } catch (err) {
    dialog.showErrorBox('Blad otwierania pliku', String(err && err.message ? err.message : err));
  }
}

function createWindow(initialFilePath) {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#070F17',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    if (initialFilePath) openPdfPath(initialFilePath);
  });

  if (process.env.PDF_READER_DEBUG) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Plik',
      submenu: [
        {
          label: 'Otworz PDF...',
          accelerator: 'CmdOrCtrl+O',
          click: () => triggerOpenDialog(),
        },
        {
          label: 'Drukuj',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow && mainWindow.webContents.print(),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Zamknij' },
      ],
    },
    {
      label: 'Widok',
      submenu: [
        { role: 'reload', label: 'Odswiez' },
        { role: 'toggleDevTools', label: 'Narzedzia deweloperskie' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Resetuj powiekszenie okna' },
        { role: 'zoomIn', label: 'Powieksz okno' },
        { role: 'zoomOut', label: 'Pomniejsz okno' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pelny ekran' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function triggerOpenDialog() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Otworz plik PDF',
    filters: [{ name: 'Pliki PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return;
  await openPdfPath(result.filePaths[0]);
}

ipcMain.handle('pdf:open-dialog', async () => {
  await triggerOpenDialog();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = resolvePdfArg(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (filePath) openPdfPath(filePath);
  });

  app.whenReady().then(() => {
    buildMenu();
    const filePath = resolvePdfArg(process.argv.slice(app.isPackaged ? 1 : 2));
    createWindow(filePath);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
      openPdfPath(filePath);
    } else {
      app.whenReady().then(() => createWindow(filePath));
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
