const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig, saveConfig, getNextInvoiceId, getInvoicePaths } = require('./src/utils/storage');
const { generateInvoicePdf, buildInvoiceHtml } = require('./src/utils/invoice-generator');
const { getAvailableYears, getInvoicesForPeriod, exportInvoicesToZip } = require('./src/utils/exporter');

let mainWindow = null;

function fileToDataUri(filePath) {
  if (!filePath) return '';
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
  if (!fs.existsSync(resolved)) return '';
  const ext = path.extname(resolved).toLowerCase().replace('.', '');
  const mimeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml'
  };
  const mimeType = mimeMap[ext] || 'image/png';
  const data = fs.readFileSync(resolved);
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'logo.png');

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 880,
    minWidth: 960,
    minHeight: 680,
    title: 'Generador de Facturas',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Obtener datos iniciales
ipcMain.handle('get-initial-data', async () => {
  const config = loadConfig();
  const nextId = getNextInvoiceId(config);
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const logoDataUri = config.company && config.company.logoPath ? fileToDataUri(config.company.logoPath) : '';

  return {
    config,
    nextId,
    todayDate,
    logoDataUri
  };
});

// IPC: Guardar configuración
ipcMain.handle('save-config', async (event, newConfig) => {
  const success = saveConfig(newConfig);
  const nextId = getNextInvoiceId(newConfig);
  const logoDataUri = newConfig.company && newConfig.company.logoPath ? fileToDataUri(newConfig.company.logoPath) : '';
  return { success, config: newConfig, nextId, logoDataUri };
});

// IPC: Seleccionar directorio
ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar carpeta donde guardar las facturas',
    properties: ['openDirectory', 'createDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC: Seleccionar imagen de logo
ipcMain.handle('select-logo', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagen para el logo de la factura',
    filters: [
      { name: 'Imágenes (*.png, *.jpg, *.jpeg, *.webp, *.svg)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase();
    const assetsDir = path.join(__dirname, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const destName = `logo_${Date.now()}${ext}`;
    const destPath = path.join(assetsDir, destName);
    fs.copyFileSync(sourcePath, destPath);

    const relativePath = path.relative(__dirname, destPath);
    const dataUri = fileToDataUri(destPath);
    return {
      filePath: relativePath,
      dataUri
    };
  }
  return null;
});

// IPC: Obtener Data URI de una imagen
ipcMain.handle('get-image-data-uri', async (event, imagePath) => {
  return fileToDataUri(imagePath);
});

// IPC: Generar Factura
ipcMain.handle('generate-invoice', async (event, invoiceData) => {
  try {
    const config = loadConfig();
    const result = await generateInvoicePdf(invoiceData, config);

    // Actualizar el último ID si es numérico y mayor
    const idNum = parseInt(invoiceData.id, 10);
    if (!isNaN(idNum) && idNum >= (config.lastInvoiceId || 0)) {
      config.lastInvoiceId = idNum;
      saveConfig(config);
    }

    const newNextId = getNextInvoiceId(config);

    return {
      success: true,
      ...result,
      newNextId
    };
  } catch (error) {
    console.error('Error generating invoice:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al generar la factura'
    };
  }
});

// IPC: Vista previa en ventana emergente
ipcMain.handle('preview-invoice', async (event, invoiceData) => {
  try {
    const config = loadConfig();
    const { html, invoiceNumber } = buildInvoiceHtml(invoiceData, config);

    const previewWin = new BrowserWindow({
      width: 900,
      height: 900,
      title: `Vista Previa - Factura ${invoiceNumber}`,
      parent: mainWindow,
      modal: false,
      autoHideMenuBar: true
    });

    previewWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: Abrir archivo generado
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Abrir carpeta contenedora
ipcMain.handle('open-folder', async (event, targetPath) => {
  try {
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (err) {
    try {
      await shell.openPath(targetPath);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
});

// IPC: Obtener datos para modal de exportación
ipcMain.handle('get-export-data', async () => {
  const config = loadConfig();
  const availableYears = getAvailableYears(config);
  const currentYear = new Date().getFullYear();
  return { availableYears, currentYear };
});

// IPC: Comprobar facturas disponibles en un período
ipcMain.handle('check-invoices-period', async (event, { year, months }) => {
  const config = loadConfig();
  return getInvoicesForPeriod(config, year, months);
});

// IPC: Diálogo para guardar archivo ZIP
ipcMain.handle('show-save-zip-dialog', async (event, suggestedName) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar archivo ZIP con las facturas para el gestor',
    defaultPath: suggestedName,
    filters: [
      { name: 'Archivo Comprimido ZIP (*.zip)', extensions: ['zip'] }
    ]
  });
  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

// IPC: Ejecutar exportación a ZIP
ipcMain.handle('do-export-zip', async (event, { year, months, destinationZipPath }) => {
  try {
    const config = loadConfig();
    const result = exportInvoicesToZip(config, { year, months, destinationZipPath });
    return { success: true, ...result };
  } catch (error) {
    console.error('Error exportando facturas a ZIP:', error);
    return { success: false, error: error.message };
  }
});
