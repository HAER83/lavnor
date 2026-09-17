'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const pdfTools = require('./pdf-tools');
const libreoffice = require('./libreoffice');

const OFFICE_EXTENSIONS = new Set(['.doc', '.docx']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

let mainWindow = null;

function getOutputDir() {
  const dir = path.join(app.getPath('downloads'), 'PDFcon');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#EEF1FB',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', '..', 'build', 'icons', 'png', 'icon-256.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// IPC: dialogi i system plików
// ---------------------------------------------------------------------------

ipcMain.handle('dialog:pick-files', async (_event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: filters && filters.length ? filters : undefined
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('app:get-output-dir', () => getOutputDir());

ipcMain.handle('app:open-path', async (_event, targetPath) => {
  const err = await shell.openPath(targetPath);
  return { ok: !err, error: err || null };
});

ipcMain.handle('libreoffice:check-available', () => libreoffice.isLibreOfficeAvailable());

// ---------------------------------------------------------------------------
// IPC: konwersje do PDF (DOC/DOCX/JPG/PNG -> PDF)
// ---------------------------------------------------------------------------

ipcMain.handle('convert:to-pdf', async (_event, files, options = {}) => {
  const outDir = getOutputDir();
  const combineImages = options.combineImages !== false;
  const created = [];
  const errors = [];

  const officeFiles = [];
  const imageFiles = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (OFFICE_EXTENSIONS.has(ext)) officeFiles.push(file);
    else if (IMAGE_EXTENSIONS.has(ext)) imageFiles.push(file);
    else errors.push({ file, message: 'Nieobsługiwany format pliku: ' + ext });
  }

  for (const file of officeFiles) {
    try {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfcon-'));
      const converted = await libreoffice.convertWithLibreOffice(file, tmpDir, 'pdf');
      const dest = pdfTools.uniquePath(path.join(outDir, path.basename(converted)));
      fs.copyFileSync(converted, dest);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      created.push(dest);
    } catch (err) {
      errors.push({ file, message: err.message });
    }
  }

  if (imageFiles.length > 0) {
    if (combineImages) {
      try {
        const name = imageFiles.length === 1
          ? path.parse(imageFiles[0]).name
          : 'obrazy';
        const outPath = pdfTools.uniquePath(path.join(outDir, `${name}.pdf`));
        await pdfTools.imagesToPdf(imageFiles, outPath);
        created.push(outPath);
      } catch (err) {
        errors.push({ file: imageFiles.join(', '), message: err.message });
      }
    } else {
      for (const file of imageFiles) {
        try {
          const outPath = pdfTools.uniquePath(
            path.join(outDir, `${path.parse(file).name}.pdf`)
          );
          await pdfTools.imagesToPdf([file], outPath);
          created.push(outPath);
        } catch (err) {
          errors.push({ file, message: err.message });
        }
      }
    }
  }

  return { created, errors, outputDir: outDir };
});

// ---------------------------------------------------------------------------
// IPC: konwersje z PDF na DOCX (obrazy obsługuje renderer przez pdf.js)
// ---------------------------------------------------------------------------

ipcMain.handle('convert:pdf-to-office', async (_event, files) => {
  const outDir = getOutputDir();
  const created = [];
  const errors = [];

  for (const file of files) {
    try {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfcon-'));
      const converted = await libreoffice.convertWithLibreOffice(file, tmpDir, 'docx');
      const dest = pdfTools.uniquePath(path.join(outDir, path.basename(converted)));
      fs.copyFileSync(converted, dest);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      created.push(dest);
    } catch (err) {
      errors.push({ file, message: err.message });
    }
  }

  return { created, errors, outputDir: outDir };
});

// ---------------------------------------------------------------------------
// IPC: scalanie i dzielenie PDF
// ---------------------------------------------------------------------------

ipcMain.handle('pdf:merge', async (_event, files) => {
  const outDir = getOutputDir();
  try {
    const outPath = pdfTools.uniquePath(path.join(outDir, 'polaczony.pdf'));
    await pdfTools.mergePdfs(files, outPath);
    return { created: [outPath], errors: [], outputDir: outDir };
  } catch (err) {
    return { created: [], errors: [{ file: files.join(', '), message: err.message }], outputDir: outDir };
  }
});

ipcMain.handle('pdf:split', async (_event, file, options) => {
  const outDir = getOutputDir();
  try {
    const created = await pdfTools.splitPdf(file, outDir, options);
    return { created, errors: [], outputDir: outDir };
  } catch (err) {
    return { created: [], errors: [{ file, message: err.message }], outputDir: outDir };
  }
});

ipcMain.handle('pdf:page-count', async (_event, file) => {
  return pdfTools.getPdfPageCount(file);
});

// ---------------------------------------------------------------------------
// IPC: zapis obrazów wyrenderowanych z PDF (pdf.js działa w rendererze)
// ---------------------------------------------------------------------------

ipcMain.handle('files:save-image', async (_event, baseName, pageNumber, format, arrayBuffer) => {
  const outDir = getOutputDir();
  const safeBase = String(baseName).replace(/[\\/:*?"<>|]/g, '_');
  const outPath = pdfTools.uniquePath(
    path.join(outDir, `${safeBase}_strona_${pageNumber}.${format}`)
  );
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
  return outPath;
});
