const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { getInvoicePaths } = require('./storage');

function fileToDataUri(filePath) {
  if (!filePath) return '';
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '..', '..', filePath);
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

function formatCurrency(amount, currency = '€') {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(num) + ' ' + currency;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildInvoiceHtml(data, config) {
  const templatePath = path.join(__dirname, '..', 'templates', 'invoice-template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  const invoiceDate = data.date ? new Date(data.date + 'T00:00:00') : new Date();
  const year = invoiceDate.getFullYear();
  const invoiceNumber = `${year}-${data.id}`;

  // Logotipo
  let companyLogoTag = '';
  if (data.logoDataUri) {
    companyLogoTag = `<img src="${data.logoDataUri}" alt="Logo" class="company-logo-img">`;
  } else {
    const logoPath = (data.logoPath !== undefined) ? data.logoPath : (config.company && config.company.logoPath);
    if (logoPath) {
      const dataUri = fileToDataUri(logoPath);
      if (dataUri) {
        companyLogoTag = `<img src="${dataUri}" alt="Logo" class="company-logo-img">`;
      }
    }
  }

  // Cálculo de totales
  const taxRate = typeof data.taxRate === 'number' ? data.taxRate : 21;
  let subtotal = 0;

  const itemsHtml = (data.items || []).map((item, index) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;

    return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td><div class="item-desc">${escapeHtml(item.concept)}</div></td>
        <td class="text-center">${qty}</td>
        <td class="text-right">${formatCurrency(price, config.currency)}</td>
        <td class="text-right">${formatCurrency(lineTotal, config.currency)}</td>
      </tr>
    `;
  }).join('');

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Header & Emisor
  const companyName = data.companyName || config.company.name || 'Mi Empresa';
  const companyMeta = data.companyMeta || `${config.company.cif || ''}\n${config.company.address || ''}\n${config.company.postalCode || ''} ${config.company.city || ''}`;

  let dueDateRow = '';
  if (data.dueDate) {
    dueDateRow = `
      <tr>
        <td class="label">VENCIMIENTO:</td>
        <td class="val">${formatDate(data.dueDate)}</td>
      </tr>
    `;
  }

  const emitterHtml = escapeHtml(data.emitter || '').replace(/\n/g, '<br>');
  const clientHtml = escapeHtml(data.client || '').replace(/\n/g, '<br>');
  const paymentNotes = escapeHtml(data.paymentNotes || config.company.iban ? `Forma de pago: Transferencia bancaria\nIBAN: ${config.company.iban}\n${config.company.notes || ''}` : '').replace(/\n/g, '<br>');

  html = html
    .replace(/{{companyLogoTag}}/g, companyLogoTag)
    .replace(/{{companyName}}/g, escapeHtml(companyName))
    .replace(/{{companyMeta}}/g, escapeHtml(companyMeta))
    .replace(/{{invoiceNumber}}/g, escapeHtml(invoiceNumber))
    .replace(/{{invoiceDate}}/g, formatDate(data.date))
    .replace(/{{dueDateRow}}/g, dueDateRow)
    .replace(/{{emitterContent}}/g, emitterHtml)
    .replace(/{{clientContent}}/g, clientHtml)
    .replace(/{{itemsRows}}/g, itemsHtml)
    .replace(/{{paymentNotes}}/g, paymentNotes)
    .replace(/{{taxRate}}/g, taxRate)
    .replace(/{{subtotalFormatted}}/g, formatCurrency(subtotal, config.currency))
    .replace(/{{taxAmountFormatted}}/g, formatCurrency(taxAmount, config.currency))
    .replace(/{{totalFormatted}}/g, formatCurrency(total, config.currency));

  return { html, invoiceNumber, subtotal, taxAmount, total };
}

/**
 * Genera el archivo PDF y lo guarda en <invoicesPath>/<año>/<mes>/<año>-<id>.pdf
 */
async function generateInvoicePdf(data, config) {
  const { html, invoiceNumber, subtotal, taxAmount, total } = buildInvoiceHtml(data, config);
  const paths = getInvoicePaths(config, data.id, data.date);

  // Asegurar que la carpeta del año y mes existe
  if (!fs.existsSync(paths.folderPath)) {
    fs.mkdirSync(paths.folderPath, { recursive: true });
  }

  // Crear ventana invisible de Electron para renderizar el PDF
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    // Opciones de impresión PDF A4 con fondo y márgenes calibrados
    const pdfBuffer = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'none'
      }
    });

    fs.writeFileSync(paths.filePath, pdfBuffer);

    return {
      success: true,
      filePath: paths.filePath,
      fileName: paths.fileName,
      folderPath: paths.folderPath,
      invoiceNumber,
      year: paths.year,
      month: paths.month,
      subtotal,
      taxAmount,
      total
    };
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}

module.exports = {
  buildInvoiceHtml,
  generateInvoicePdf,
  formatCurrency,
  formatDate,
  fileToDataUri
};
