const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config.json');

const DEFAULT_CONFIG = {
  company: {
    name: 'Mi Empresa S.L.',
    cif: 'B12345678',
    address: 'Calle Principal 123, 1º B',
    postalCode: '28001',
    city: 'Madrid',
    phone: '+34 600 000 000',
    email: 'contacto@miempresa.com',
    iban: 'ES00 0000 0000 0000 0000 0000',
    notes: 'Gracias por su confianza.',
    logoPath: 'assets/logo.png'
  },
  invoicesPath: 'E:\\Facturas',
  lastInvoiceId: 0,
  defaultTaxRate: 21,
  currency: '€'
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Determina el siguiente ID sugerido para la factura.
 * Revisa el lastInvoiceId guardado y también busca en la carpeta del año actual si existe.
 */
function getNextInvoiceId(config, date = new Date()) {
  let highestId = 0;

  if (typeof config.lastInvoiceId === 'number') {
    highestId = Math.max(highestId, config.lastInvoiceId);
  } else if (!isNaN(parseInt(config.lastInvoiceId, 10))) {
    highestId = Math.max(highestId, parseInt(config.lastInvoiceId, 10));
  }

  // Comprobar si existen archivos en la carpeta del año actual
  const currentYear = String(date.getFullYear());
  const yearDir = path.join(config.invoicesPath, currentYear);

  if (fs.existsSync(yearDir)) {
    try {
      const months = fs.readdirSync(yearDir);
      for (const month of months) {
        const monthDir = path.join(yearDir, month);
        if (fs.statSync(monthDir).isDirectory()) {
          const files = fs.readdirSync(monthDir);
          for (const file of files) {
            // Formato esperado: YYYY-ID.pdf
            const match = file.match(new RegExp(`^${currentYear}-(\\d+)\\.pdf$`, 'i'));
            if (match) {
              const fileId = parseInt(match[1], 10);
              if (!isNaN(fileId) && fileId > highestId) {
                highestId = fileId;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Advertencia escaneando directorio de facturas:', err);
    }
  }

  return highestId + 1;
}

/**
 * Obtiene la ruta de destino completa para una factura
 */
function getInvoicePaths(config, invoiceId, dateStr) {
  const invoiceDate = dateStr ? new Date(dateStr) : new Date();
  const year = String(invoiceDate.getFullYear());
  const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');

  const folderPath = path.join(config.invoicesPath, year, month);
  const fileName = `${year}-${invoiceId}.pdf`;
  const filePath = path.join(folderPath, fileName);

  return {
    year,
    month,
    folderPath,
    fileName,
    filePath
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  getNextInvoiceId,
  getInvoicePaths
};
