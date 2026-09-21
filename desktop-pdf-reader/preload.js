const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('pdf:open-dialog'),
  onOpenPdf: (callback) => {
    ipcRenderer.on('open-pdf', (_event, payload) => callback(payload));
  },
});
