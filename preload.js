const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  saveConfig: (newConfig) => ipcRenderer.invoke('save-config', newConfig),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectLogo: () => ipcRenderer.invoke('select-logo'),
  getImageDataUri: (imagePath) => ipcRenderer.invoke('get-image-data-uri', imagePath),
  generateInvoice: (invoiceData) => ipcRenderer.invoke('generate-invoice', invoiceData),
  previewInvoice: (invoiceData) => ipcRenderer.invoke('preview-invoice', invoiceData),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath)
});
