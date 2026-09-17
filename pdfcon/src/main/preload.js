'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdfcon', {
  pickFiles: (filters) => ipcRenderer.invoke('dialog:pick-files', filters),
  getOutputDir: () => ipcRenderer.invoke('app:get-output-dir'),
  openPath: (targetPath) => ipcRenderer.invoke('app:open-path', targetPath),
  checkLibreOffice: () => ipcRenderer.invoke('libreoffice:check-available'),

  convertToPdf: (files, options) => ipcRenderer.invoke('convert:to-pdf', files, options),
  convertPdfToOffice: (files) => ipcRenderer.invoke('convert:pdf-to-office', files),
  mergePdfs: (files) => ipcRenderer.invoke('pdf:merge', files),
  splitPdf: (file, options) => ipcRenderer.invoke('pdf:split', file, options),
  getPdfPageCount: (file) => ipcRenderer.invoke('pdf:page-count', file),

  saveImageBuffer: (baseName, pageNumber, format, arrayBuffer) =>
    ipcRenderer.invoke('files:save-image', baseName, pageNumber, format, arrayBuffer)
});
