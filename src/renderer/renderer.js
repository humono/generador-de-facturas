// Estado de la aplicación
let appConfig = null;
let currentYear = new Date().getFullYear();
let generatedResult = null;
let activeLogoPath = '';
let activeLogoDataUri = '';

// Formateador de moneda en euros
function formatCurrency(num) {
  const val = typeof num === 'number' ? num : parseFloat(num) || 0;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(val) + ' €';
}

// Inicialización de la aplicación
async function initApp() {
  try {
    const data = await window.electronAPI.getInitialData();
    appConfig = data.config;

    // Configuración del logotipo inicial
    activeLogoPath = (appConfig.company && appConfig.company.logoPath) || '';
    activeLogoDataUri = data.logoDataUri || '';
    updateLogoDisplay(activeLogoDataUri, activeLogoPath);

    // Configurar fechas
    const today = data.todayDate;
    document.getElementById('invoiceDate').value = today;
    updateYearDisplay(today);

    // Configurar ID
    document.getElementById('invoiceId').value = data.nextId;

    // Configurar IVA
    document.getElementById('taxRate').value = appConfig.defaultTaxRate || 21;

    // Configurar datos de la empresa por defecto
    populateCompanyDefaults();

    // Actualizar badges y previews de ruta
    updateStorageDisplay();
    updatePathPreview();

    // Añadir la primera fila de concepto
    addItemRow('', 1, '');

    // Calcular totales iniciales
    calculateTotals();

    // Escuchadores de eventos globales
    setupEventListeners();
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    showToast('Error cargando la configuración inicial: ' + error.message);
  }
}

// Actualizar visualización del logo en formulario y modal
function updateLogoDisplay(dataUri, logoPath) {
  const formLogoImg = document.getElementById('formCompanyLogoImg');
  const formNoLogo = document.getElementById('formCompanyNoLogo');
  const cfgLogoPreview = document.getElementById('cfgLogoPreview');
  const cfgNoLogoText = document.getElementById('cfgNoLogoText');
  const btnRemoveLogo = document.getElementById('btnRemoveLogo');
  const headerAppLogo = document.getElementById('headerAppLogo');

  if (dataUri) {
    if (formLogoImg) {
      formLogoImg.src = dataUri;
      formLogoImg.style.display = 'block';
    }
    if (formNoLogo) formNoLogo.style.display = 'none';

    if (cfgLogoPreview) {
      cfgLogoPreview.src = dataUri;
      cfgLogoPreview.style.display = 'block';
    }
    if (cfgNoLogoText) cfgNoLogoText.style.display = 'none';
    if (btnRemoveLogo) btnRemoveLogo.style.display = 'inline-flex';
    if (headerAppLogo) headerAppLogo.src = dataUri;
  } else {
    if (formLogoImg) formLogoImg.style.display = 'none';
    if (formNoLogo) formNoLogo.style.display = 'block';

    if (cfgLogoPreview) cfgLogoPreview.style.display = 'none';
    if (cfgNoLogoText) cfgNoLogoText.style.display = 'block';
    if (btnRemoveLogo) btnRemoveLogo.style.display = 'none';
  }

  const hiddenPathInput = document.getElementById('configLogoPath');
  if (hiddenPathInput) {
    hiddenPathInput.value = logoPath || '';
  }
}

// Rellenar datos de la empresa desde la configuración
function populateCompanyDefaults() {
  if (!appConfig || !appConfig.company) return;
  const comp = appConfig.company;

  document.getElementById('emitterName').value = comp.name || '';

  const detailsLines = [];
  if (comp.cif) detailsLines.push(`NIF/CIF: ${comp.cif}`);
  if (comp.address) detailsLines.push(comp.address);
  if (comp.postalCode || comp.city) {
    detailsLines.push(`${comp.postalCode || ''} ${comp.city || ''}`.trim());
  }
  const contactParts = [];
  if (comp.phone) contactParts.push(`Tel: ${comp.phone}`);
  if (comp.email) contactParts.push(`Email: ${comp.email}`);
  if (contactParts.length > 0) detailsLines.push(contactParts.join(' | '));

  document.getElementById('emitterDetails').value = detailsLines.join('\n');

  // Forma de pago y observaciones
  const paymentLines = [];
  if (comp.iban) {
    paymentLines.push(`Forma de pago: Transferencia Bancaria`);
    paymentLines.push(`IBAN: ${comp.iban}`);
  }
  if (comp.notes) {
    paymentLines.push(comp.notes);
  }
  document.getElementById('paymentNotes').value = paymentLines.join('\n');

  // Logotipo
  activeLogoPath = comp.logoPath || '';
  if (activeLogoPath && !activeLogoDataUri) {
    window.electronAPI.getImageDataUri(activeLogoPath).then(uri => {
      activeLogoDataUri = uri;
      updateLogoDisplay(activeLogoDataUri, activeLogoPath);
    });
  } else {
    updateLogoDisplay(activeLogoDataUri, activeLogoPath);
  }
}

// Actualizar indicador de año
function updateYearDisplay(dateStr) {
  if (dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (!isNaN(d.getFullYear())) {
      currentYear = d.getFullYear();
    }
  }
  document.getElementById('yearPrefix').textContent = `${currentYear}-`;
}

// Actualizar visualización de la ruta de almacenamiento
function updateStorageDisplay() {
  if (!appConfig) return;
  document.getElementById('displayFolder').textContent = appConfig.invoicesPath || 'No definida';
  document.getElementById('displayFolder').title = appConfig.invoicesPath || '';
}

// Actualizar preview de ruta y nombre de archivo resultante
function updatePathPreview() {
  const idVal = document.getElementById('invoiceId').value.trim() || '1';
  const dateVal = document.getElementById('invoiceDate').value;
  let year = currentYear;
  let month = '01';

  if (dateVal) {
    const d = new Date(dateVal + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = String(d.getMonth() + 1).padStart(2, '0');
    }
  }

  const fileName = `${year}-${idVal}.pdf`;
  document.getElementById('previewFileName').textContent = fileName;

  const basePath = appConfig ? appConfig.invoicesPath : 'E:\\Facturas';
  const fullPreview = `${basePath}\\${year}\\${month}\\${fileName}`;
  document.getElementById('destinationPathPreview').textContent = fullPreview;
}

// Configurar escuchadores de eventos
function setupEventListeners() {
  // Cambio en ID o Fecha
  document.getElementById('invoiceId').addEventListener('input', updatePathPreview);
  document.getElementById('invoiceDate').addEventListener('change', (e) => {
    updateYearDisplay(e.target.value);
    updatePathPreview();
  });

  // Cambio en IVA
  document.getElementById('taxRate').addEventListener('input', calculateTotals);

  // Botón añadir concepto
  document.getElementById('btnAddItem').addEventListener('click', () => {
    addItemRow('', 1, '');
    calculateTotals();
  });

  // Botón restablecer emisor
  document.getElementById('btnResetCompany').addEventListener('click', () => {
    populateCompanyDefaults();
    showToast('Datos de empresa restablecidos a los valores por defecto.');
  });

  // Envío del formulario (Generar Factura)
  document.getElementById('invoiceForm').addEventListener('submit', handleGenerateInvoice);

  // Botón Vista Previa
  document.getElementById('btnPreview').addEventListener('click', handlePreviewInvoice);

  // Modales
  setupConfigModal();
  setupSuccessModal();
}

// Añadir fila a la tabla de conceptos
function addItemRow(concept = '', quantity = 1, price = '') {
  const tbody = document.getElementById('itemsBody');
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td>
      <input type="text" class="form-control item-concept" placeholder="Ej: Servicio de consultoría informática..." value="${escapeAttr(concept)}" required>
    </td>
    <td>
      <input type="number" class="form-control text-center item-quantity" min="0.01" step="any" placeholder="1" value="${quantity}" required>
    </td>
    <td>
      <input type="number" class="form-control text-right item-price" min="0" step="any" placeholder="0.00" value="${price}" required>
    </td>
    <td class="text-right line-total-cell">
      0,00 €
    </td>
    <td class="text-center">
      <button type="button" class="btn-remove-row" title="Eliminar este concepto">🗑️</button>
    </td>
  `;

  // Eventos de la fila
  const qtyInput = tr.querySelector('.item-quantity');
  const priceInput = tr.querySelector('.item-price');
  const removeBtn = tr.querySelector('.btn-remove-row');

  const onRowChange = () => {
    updateRowTotal(tr);
    calculateTotals();
  };

  qtyInput.addEventListener('input', onRowChange);
  priceInput.addEventListener('input', onRowChange);

  // Al pulsar enter en el precio, añadir una nueva fila si se desea
  priceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTr = addItemRow('', 1, '');
      const nextInput = newTr.querySelector('.item-concept');
      if (nextInput) nextInput.focus();
    }
  });

  removeBtn.addEventListener('click', () => {
    if (tbody.children.length > 1) {
      tr.remove();
      calculateTotals();
    } else {
      showToast('Debe haber al menos un concepto en la factura.');
    }
  });

  tbody.appendChild(tr);
  updateRowTotal(tr);
  return tr;
}

function updateRowTotal(tr) {
  const qty = parseFloat(tr.querySelector('.item-quantity').value) || 0;
  const price = parseFloat(tr.querySelector('.item-price').value) || 0;
  const total = qty * price;
  tr.querySelector('.line-total-cell').textContent = formatCurrency(total);
}

// Calcular todos los totales en vivo
function calculateTotals() {
  const rows = document.querySelectorAll('#itemsBody tr');
  let subtotal = 0;

  rows.forEach(tr => {
    const qty = parseFloat(tr.querySelector('.item-quantity').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    subtotal += (qty * price);
  });

  const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  document.getElementById('calcSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('calcTaxLabel').textContent = `IVA (${taxRate}%):`;
  document.getElementById('calcTax').textContent = formatCurrency(taxAmount);
  document.getElementById('calcTotal').textContent = formatCurrency(grandTotal);

  return { subtotal, taxRate, taxAmount, grandTotal };
}

// Obtener los datos actuales del formulario
function getFormData() {
  const id = document.getElementById('invoiceId').value.trim();
  const date = document.getElementById('invoiceDate').value;
  const dueDate = document.getElementById('dueDate').value;
  const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;

  const emitterName = document.getElementById('emitterName').value.trim();
  const emitterDetails = document.getElementById('emitterDetails').value.trim();
  const emitter = `${emitterName}\n${emitterDetails}`.trim();

  const clientName = document.getElementById('clientName').value.trim();
  const clientDetails = document.getElementById('clientDetails').value.trim();
  const client = `${clientName}\n${clientDetails}`.trim();

  const paymentNotes = document.getElementById('paymentNotes').value.trim();

  const items = [];
  document.querySelectorAll('#itemsBody tr').forEach(tr => {
    const concept = tr.querySelector('.item-concept').value.trim();
    const quantity = parseFloat(tr.querySelector('.item-quantity').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    if (concept) {
      items.push({ concept, quantity, price });
    }
  });

  return {
    id,
    date,
    dueDate,
    taxRate,
    companyName: emitterName,
    companyMeta: emitterDetails,
    emitter,
    clientName,
    client,
    paymentNotes,
    items,
    logoPath: activeLogoPath,
    logoDataUri: activeLogoDataUri
  };
}

// Manejar Generación de Factura
async function handleGenerateInvoice(e) {
  e.preventDefault();

  const data = getFormData();

  if (!data.id) {
    alert('Por favor, indica un ID para la factura.');
    document.getElementById('invoiceId').focus();
    return;
  }

  if (data.items.length === 0) {
    alert('Por favor, añade al menos un concepto a la factura con su descripción.');
    return;
  }

  const btnGenerate = document.getElementById('btnGenerate');
  const originalText = btnGenerate.innerHTML;
  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span>⏳</span> Generando PDF...';

  try {
    const response = await window.electronAPI.generateInvoice(data);

    if (response.success) {
      generatedResult = response;

      // Mostrar modal de éxito
      document.getElementById('succInvoiceNum').textContent = response.invoiceNumber;
      document.getElementById('succFilePath').value = response.filePath;
      document.getElementById('succSubtotal').textContent = formatCurrency(response.subtotal);
      document.getElementById('succTax').textContent = formatCurrency(response.taxAmount);
      document.getElementById('succTotal').textContent = formatCurrency(response.total);

      document.getElementById('successModal').style.display = 'flex';

      // Actualizar siguiente ID para la próxima factura
      document.getElementById('invoiceId').value = response.newNextId;
      updatePathPreview();
    } else {
      alert('Error al generar la factura: ' + (response.error || 'Ocurrió un error inesperado'));
    }
  } catch (err) {
    console.error('Error generando factura:', err);
    alert('Error al generar factura: ' + err.message);
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = originalText;
  }
}

// Vista Previa
async function handlePreviewInvoice() {
  const data = getFormData();
  if (data.items.length === 0) {
    showToast('Añade al menos un concepto para previsualizar.');
    return;
  }
  const res = await window.electronAPI.previewInvoice(data);
  if (!res.success) {
    showToast('Error abriendo vista previa: ' + res.error);
  }
}

// Configurar Modal de Éxito
function setupSuccessModal() {
  const modal = document.getElementById('successModal');

  document.getElementById('btnOpenGeneratedPdf').addEventListener('click', () => {
    if (generatedResult && generatedResult.filePath) {
      window.electronAPI.openFile(generatedResult.filePath);
    }
  });

  document.getElementById('btnOpenGeneratedFolder').addEventListener('click', () => {
    if (generatedResult && generatedResult.folderPath) {
      window.electronAPI.openFolder(generatedResult.folderPath);
    }
  });

  document.getElementById('btnCloseSuccess').addEventListener('click', () => {
    modal.style.display = 'none';

    // Limpiar tabla de conceptos y preparar para siguiente factura
    const tbody = document.getElementById('itemsBody');
    tbody.innerHTML = '';
    addItemRow('', 1, '');
    calculateTotals();

    // Limpiar datos del cliente para la nueva factura
    document.getElementById('clientName').value = '';
    document.getElementById('clientDetails').value = '';
    document.getElementById('clientName').focus();

    showToast('Formulario preparado para la siguiente factura.');
  });
}

// Configurar Modal de Configuración
function setupConfigModal() {
  const modal = document.getElementById('configModal');
  const btnOpen = document.getElementById('btnOpenConfig');
  const btnClose = document.getElementById('btnCloseConfig');
  const btnCancel = document.getElementById('btnCancelConfig');
  const btnSelectFolder = document.getElementById('btnSelectFolder');
  const btnSelectLogo = document.getElementById('btnSelectLogo');
  const btnRemoveLogo = document.getElementById('btnRemoveLogo');
  const configForm = document.getElementById('configForm');

  btnOpen.addEventListener('click', () => {
    // Cargar valores actuales en el modal
    document.getElementById('configInvoicesPath').value = appConfig.invoicesPath || '';
    document.getElementById('cfgCompName').value = appConfig.company.name || '';
    document.getElementById('cfgCompCif').value = appConfig.company.cif || '';
    document.getElementById('cfgCompAddress').value = appConfig.company.address || '';
    document.getElementById('cfgCompPostalCode').value = appConfig.company.postalCode || '';
    document.getElementById('cfgCompCity').value = appConfig.company.city || '';
    document.getElementById('cfgCompPhone').value = appConfig.company.phone || '';
    document.getElementById('cfgCompEmail').value = appConfig.company.email || '';
    document.getElementById('cfgCompIban').value = appConfig.company.iban || '';
    document.getElementById('cfgCompNotes').value = appConfig.company.notes || '';
    document.getElementById('cfgLastId').value = appConfig.lastInvoiceId || 0;
    document.getElementById('cfgDefaultTax').value = appConfig.defaultTaxRate || 21;

    updateLogoDisplay(activeLogoDataUri, activeLogoPath);
    modal.style.display = 'flex';
  });

  const closeModal = () => { modal.style.display = 'none'; };
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Seleccionar carpeta
  btnSelectFolder.addEventListener('click', async () => {
    const selected = await window.electronAPI.selectDirectory();
    if (selected) {
      document.getElementById('configInvoicesPath').value = selected;
    }
  });

  // Seleccionar logotipo
  btnSelectLogo.addEventListener('click', async () => {
    const res = await window.electronAPI.selectLogo();
    if (res) {
      activeLogoPath = res.filePath;
      activeLogoDataUri = res.dataUri;
      updateLogoDisplay(activeLogoDataUri, activeLogoPath);
      showToast('Logotipo seleccionado correctamente.');
    }
  });

  // Quitar logotipo
  btnRemoveLogo.addEventListener('click', () => {
    activeLogoPath = '';
    activeLogoDataUri = '';
    updateLogoDisplay('', '');
    showToast('Logotipo quitado.');
  });

  // Guardar configuración
  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedConfig = {
      ...appConfig,
      invoicesPath: document.getElementById('configInvoicesPath').value.trim() || appConfig.invoicesPath,
      lastInvoiceId: parseInt(document.getElementById('cfgLastId').value, 10) || 0,
      defaultTaxRate: parseFloat(document.getElementById('cfgDefaultTax').value) || 21,
      company: {
        name: document.getElementById('cfgCompName').value.trim(),
        cif: document.getElementById('cfgCompCif').value.trim(),
        address: document.getElementById('cfgCompAddress').value.trim(),
        postalCode: document.getElementById('cfgCompPostalCode').value.trim(),
        city: document.getElementById('cfgCompCity').value.trim(),
        phone: document.getElementById('cfgCompPhone').value.trim(),
        email: document.getElementById('cfgCompEmail').value.trim(),
        iban: document.getElementById('cfgCompIban').value.trim(),
        notes: document.getElementById('cfgCompNotes').value.trim(),
        logoPath: activeLogoPath
      }
    };

    const res = await window.electronAPI.saveConfig(updatedConfig);
    if (res.success) {
      appConfig = res.config;
      activeLogoDataUri = res.logoDataUri || '';
      activeLogoPath = res.config.company.logoPath || '';
      updateLogoDisplay(activeLogoDataUri, activeLogoPath);

      updateStorageDisplay();
      updatePathPreview();
      document.getElementById('invoiceId').value = res.nextId;
      closeModal();
      showToast('Configuración y logotipo guardados correctamente.');
    } else {
      alert('Error guardando la configuración.');
    }
  });
}

// Notificación Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', initApp);
