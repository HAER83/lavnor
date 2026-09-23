const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('pdf:open-dialog'),
  readPath: (filePath) => ipcRenderer.invoke('pdf:read-path', filePath),
  saveAttachment: (suggestedName, data) => ipcRenderer.invoke('pdf:save-attachment', { suggestedName, data }),
  onOpenPdf: (callback) => {
    ipcRenderer.on('open-pdf', (_event, payload) => callback(payload));
  },
  onTriggerPrint: (callback) => {
    ipcRenderer.on('trigger-print', () => callback());
  },
});
