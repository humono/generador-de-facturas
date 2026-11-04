const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const MONTH_NAMES = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre'
};

/**
 * Obtiene los años disponibles con carpetas de facturas
 */
function getAvailableYears(config) {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear]);

  const basePath = config.invoicesPath;
  if (fs.existsSync(basePath)) {
    try {
      const items = fs.readdirSync(basePath);
      for (const item of items) {
        if (/^\d{4}$/.test(item)) {
          const itemPath = path.join(basePath, item);
          if (fs.statSync(itemPath).isDirectory()) {
            years.add(parseInt(item, 10));
          }
        }
      }
    } catch (err) {
      console.warn('Error leyendo años disponibles:', err);
    }
  }

  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Busca y contabiliza las facturas para los meses y año indicados
 */
function getInvoicesForPeriod(config, year, months) {
  const basePath = config.invoicesPath;
  const yearStr = String(year);
  const yearDir = path.join(basePath, yearStr);
  const foundFiles = [];

  if (!fs.existsSync(yearDir)) {
    return { count: 0, files: [] };
  }

  for (const m of months) {
    const monthStr = String(m).padStart(2, '0');
    const monthDir = path.join(yearDir, monthStr);

    if (fs.existsSync(monthDir) && fs.statSync(monthDir).isDirectory()) {
      try {
        const files = fs.readdirSync(monthDir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.pdf')) {
            const filePath = path.join(monthDir, file);
            const stats = fs.statSync(filePath);
            foundFiles.push({
              fileName: file,
              filePath,
              year: yearStr,
              month: monthStr,
              monthName: MONTH_NAMES[monthStr] || monthStr,
              sizeBytes: stats.size,
              sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
              modifiedAt: stats.mtime
            });
          }
        }
      } catch (err) {
        console.warn(`Error leyendo directorio del mes ${monthStr}:`, err);
      }
    }
  }

  // Ordenar alfabéticamente por nombre de archivo
  foundFiles.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));

  return {
    count: foundFiles.length,
    files: foundFiles
  };
}

/**
 * Crea un archivo ZIP con las facturas encontradas
 */
function exportInvoicesToZip(config, { year, months, destinationZipPath }) {
  const { files } = getInvoicesForPeriod(config, year, months);

  if (files.length === 0) {
    throw new Error('No se encontraron facturas en los meses seleccionados para exportar.');
  }

  const zip = new AdmZip();

  // Añadir cada archivo PDF al ZIP
  // Se organizan en subcarpetas por mes dentro del ZIP (ej: 11_Noviembre/2026-1.pdf)
  for (const file of files) {
    const zipEntryFolder = `${file.month}_${file.monthName}`;
    zip.addLocalFile(file.filePath, zipEntryFolder);
  }

  // Generar índice CSV resumen para el gestor
  let csvContent = '\uFEFF'; // BOM para que Excel abra UTF-8 en Windows correctamente
  csvContent += 'Año;Mes;Nombre Factura;Tamaño;Ruta en ZIP\n';
  for (const file of files) {
    csvContent += `${file.year};"${file.month} - ${file.monthName}";"${file.fileName}";"${file.sizeFormatted}";"${file.month}_${file.monthName}/${file.fileName}"\n`;
  }
  zip.addFile('00_Listado_Facturas.csv', Buffer.from(csvContent, 'utf-8'));

  // Escribir archivo ZIP final
  zip.writeZip(destinationZipPath);

  return {
    success: true,
    count: files.length,
    destinationZipPath
  };
}

module.exports = {
  getAvailableYears,
  getInvoicesForPeriod,
  exportInvoicesToZip,
  MONTH_NAMES
};
