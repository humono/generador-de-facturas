const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { loadConfig, getNextInvoiceId, getInvoicePaths } = require('../src/utils/storage');
const { buildInvoiceHtml, generateInvoicePdf, formatCurrency } = require('../src/utils/invoice-generator');

async function runTests() {
  console.log('🧪 Iniciando pruebas unitarias y de integración...\n');

  // Test 1: Formateo de moneda
  assert.ok(formatCurrency(100).includes('100,00'));
  assert.ok(formatCurrency(1234.5).includes('1') && formatCurrency(1234.5).includes('234,50'));
  console.log('✅ Test 1: formatCurrency funciona correctamente:', formatCurrency(1234.5));

  // Test 2: Carga de configuración
  const config = loadConfig();
  assert.ok(config.company, 'Config debe contener datos de empresa');
  assert.ok(config.invoicesPath, 'Config debe contener ruta de facturas');
  console.log('✅ Test 2: loadConfig carga la configuración correctamente.');

  // Test 3: Siguiente ID
  const nextId = getNextInvoiceId(config, new Date('2026-11-04'));
  assert.strictEqual(typeof nextId, 'number', 'nextId debe ser un número');
  assert.ok(nextId >= 1, 'nextId debe ser >= 1');
  console.log(`✅ Test 3: getNextInvoiceId devuelve ${nextId}.`);

  // Test 4: Cálculo de rutas
  const testPaths = getInvoicePaths(config, 42, '2026-11-04');
  assert.strictEqual(testPaths.year, '2026');
  assert.strictEqual(testPaths.month, '11');
  assert.strictEqual(testPaths.fileName, '2026-42.pdf');
  console.log(`✅ Test 4: getInvoicePaths genera ${testPaths.filePath}.`);

  // Test 5: Cálculo económico y generación de HTML
  const mockInvoiceData = {
    id: 1,
    date: '2026-11-04',
    dueDate: '2026-12-04',
    companyName: 'Tech Solutions S.L.',
    companyMeta: 'CIF: B99999999\nCalle Innovación 10\n28000 Madrid',
    emitter: 'Tech Solutions S.L.\nCIF: B99999999',
    client: 'Cliente Alfa S.A.\nCIF: A11111111\nAvda Central 20',
    taxRate: 21,
    items: [
      { concept: 'Desarrollo de Software a medida', quantity: 10, price: 50 }, // 500
      { concept: 'Mantenimiento mensual servidores', quantity: 2, price: 150 } // 300
    ],
    paymentNotes: 'Transferencia bancaria a ES12 3456 7890',
    logoPath: path.join(__dirname, '..', 'assets', 'logo.png')
  };

  const { html, invoiceNumber, subtotal, taxAmount, total } = buildInvoiceHtml(mockInvoiceData, config);
  assert.strictEqual(invoiceNumber, '2026-1');
  assert.strictEqual(subtotal, 800, 'Subtotal debe ser 800 (500 + 300)');
  assert.strictEqual(taxAmount, 168, 'IVA al 21% de 800 debe ser 168');
  assert.strictEqual(total, 968, 'Total debe ser 968 (800 + 168)');
  assert.ok(html.includes('2026-1'), 'HTML debe incluir el número de factura');
  assert.ok(html.includes('800,00 €'), 'HTML debe incluir el subtotal formateado');
  assert.ok(html.includes('968,00 €'), 'HTML debe incluir el total formateado');
  assert.ok(html.includes('company-logo-img'), 'HTML debe incluir el tag del logotipo');
  assert.ok(html.includes('data:image/png;base64,'), 'HTML debe incrustar el logotipo en base64');
  console.log('✅ Test 5: Cálculos (800€ + IVA 21% = 968€) y renderizado de logotipo floral verificados.');

  // Test 6: Generación real de PDF en disco con Electron
  const testOutputDir = path.join(__dirname, 'test_output_invoices');
  const testConfig = { ...config, invoicesPath: testOutputDir };

  console.log('📄 Generando PDF de prueba...');
  const pdfResult = await generateInvoicePdf(mockInvoiceData, testConfig);

  assert.ok(pdfResult.success, 'La generación de PDF debe ser exitosa');
  assert.ok(fs.existsSync(pdfResult.filePath), `El archivo PDF debe existir en ${pdfResult.filePath}`);

  const stat = fs.statSync(pdfResult.filePath);
  assert.ok(stat.size > 5000, 'El archivo PDF debe tener un tamaño válido (> 5KB)');

  const buffer = fs.readFileSync(pdfResult.filePath);
  const pdfHeader = buffer.slice(0, 5).toString();
  assert.strictEqual(pdfHeader, '%PDF-', 'El archivo debe comenzar con la cabecera %PDF-');
  console.log(`✅ Test 6: PDF generado correctamente (${stat.size} bytes) en: ${pdfResult.filePath}`);

  // Limpiar directorio de pruebas
  fs.rmSync(testOutputDir, { recursive: true, force: true });
  console.log('🧹 Limpieza de archivos de prueba completada.');

  // Test 7: Exportación de Facturas a ZIP para Gestoría
  console.log('📦 Probando exportador de facturas a ZIP...');
  const { getAvailableYears, getInvoicesForPeriod, exportInvoicesToZip } = require('../src/utils/exporter');
  const AdmZip = require('adm-zip');

  const testPeriodDir = path.join(__dirname, 'test_invoices_period');
  const year2026Dir = path.join(testPeriodDir, '2026');
  const month10Dir = path.join(year2026Dir, '10');
  const month11Dir = path.join(year2026Dir, '11');

  fs.mkdirSync(month10Dir, { recursive: true });
  fs.mkdirSync(month11Dir, { recursive: true });

  fs.writeFileSync(path.join(month10Dir, '2026-101.pdf'), '%PDF-1.4 Mock 1');
  fs.writeFileSync(path.join(month11Dir, '2026-102.pdf'), '%PDF-1.4 Mock 2');

  const mockExportConfig = { invoicesPath: testPeriodDir };

  // Años disponibles
  const availableYears = getAvailableYears(mockExportConfig);
  assert.ok(availableYears.includes(2026), 'Debe detectar el año 2026');

  // Conteo de facturas para 4T
  const periodData = getInvoicesForPeriod(mockExportConfig, 2026, ['10', '11', '12']);
  assert.strictEqual(periodData.count, 2, 'Debe encontrar 2 facturas en 4T');

  // Generación física del ZIP
  const targetZip = path.join(testPeriodDir, 'Facturas_4T_Test.zip');
  const zipResult = exportInvoicesToZip(mockExportConfig, {
    year: 2026,
    months: ['10', '11', '12'],
    destinationZipPath: targetZip
  });

  assert.ok(zipResult.success, 'La exportación debe completarse con éxito');
  assert.strictEqual(zipResult.count, 2, 'El resultado debe reportar 2 facturas');
  assert.ok(fs.existsSync(targetZip), 'El archivo ZIP debe existir en el disco');

  // Inspección de entradas dentro del ZIP
  const readZip = new AdmZip(targetZip);
  const zipEntries = readZip.getEntries().map(e => e.entryName);
  assert.ok(zipEntries.some(e => e.includes('2026-101.pdf')), 'El ZIP debe incluir 2026-101.pdf');
  assert.ok(zipEntries.some(e => e.includes('2026-102.pdf')), 'El ZIP debe incluir 2026-102.pdf');
  assert.ok(zipEntries.includes('00_Listado_Facturas.csv'), 'El ZIP debe incluir el índice CSV');

  console.log(`✅ Test 7: Exportador a ZIP verificado con éxito (${zipEntries.length} entradas en el ZIP).`);

  // Limpieza
  fs.rmSync(testPeriodDir, { recursive: true, force: true });

  console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
  app.quit();
}

app.whenReady().then(runTests).catch(err => {
  console.error('❌ Error en las pruebas:', err);
  process.exit(1);
});
