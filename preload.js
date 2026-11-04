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
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Exportador de Facturas a ZIP
  getExportData: () => ipcRenderer.invoke('get-export-data'),
  checkInvoicesPeriod: (params) => ipcRenderer.invoke('check-invoices-period', params),
  showSaveZipDialog: (suggestedName) => ipcRenderer.invoke('show-save-zip-dialog', suggestedName),
  doExportZip: (params) => ipcRenderer.invoke('do-export-zip', params)
});
