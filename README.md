# 💼 Generador de Facturas para Escritorio Windows

Aplicación de escritorio moderna y rápida desarrollada en **JavaScript (Electron + HTML5/CSS3)** para generar facturas de tu empresa en formato PDF profesional, organizadas automáticamente en carpetas por año y mes.

---

## 🚀 Características Principales

1. **Interfaz Gráfica en Escritorio Windows**:
   - Ventana de escritorio nativa, moderna, limpia e intuitiva.
   - Acceso directo mediante doble clic en `iniciar-generador.bat` o `npm start`.

2. **Numeración y Nombres de Archivo Automáticos**:
   - **Formato del archivo:** Siempre `{Año}-{ID}.pdf` (por ejemplo: `2026-1.pdf`).
   - **ID sugerido:** Detecta el último ID utilizado (o analiza las facturas existentes) y coloca por defecto el siguiente (`último ID + 1`). Puedes modificar el ID en cualquier momento si lo deseas.

3. **Almacenamiento Estructurado por Año y Mes**:
   - Guarda automáticamente cada factura en subcarpetas clasificadas por año y mes:
     ```text
     {Ruta_Base}/
     └── 2026/
         ├── 01/
         ├── 02/
         └── 11/
             └── 2026-1.pdf
     ```
   - La carpeta base es configurable en la ventana de **Configuración** con un selector nativo de carpetas de Windows.

4. **Cálculo Automático de Totales e IVA (21%)**:
   - Añade tantas líneas y conceptos como necesites con el botón **"+ Añadir Concepto"**.
   - Cada línea calcula en tiempo real su subtotal (`Cantidad × Precio Unitario`).
   - Se calcula automáticamente:
     - **Base Imponible** (suma de todos los conceptos).
     - **IVA al 21%** (configurable si en el futuro necesitas otro tipo).
     - **Total Factura**.

5. **Logotipo Personalizado en Cabecera e Icono**:
   - Se incluye el logotipo floral configurado tanto en la cabecera superior de la aplicación como en la barra de tareas de Windows.
   - En el PDF de la factura, el logotipo aparece elegantemente situado en la esquina superior izquierda de la cabecera.
   - Puedes cambiarlo o quitarlo en cualquier momento desde el panel de **Configuración (⚙️)** con un selector de imágenes nativo.

6. **Datos de Facturación del Cliente y de tu Empresa**:
   - **Emisor (Tu empresa):** Incluye por defecto todos los datos de tu empresa (Nombre, CIF, Dirección, Teléfono, Email, IBAN de cobro y observaciones legales).
   - **Receptor (Cliente):** Cuadro de texto para introducir el nombre, razón social, NIF/CIF, dirección y datos de facturación del cliente.
   - Panel de **Configuración (⚙️)** para guardar de forma permanente los datos de tu empresa y no tener que escribirlos cada vez.

7. **Vista Previa y Acceso Rápido**:
   - Botón **"Vista Previa"** para visualizar el documento antes de crearlo.
   - Al generar la factura, puedes hacer clic directamente en **"Abrir Factura (PDF)"** o **"Abrir Carpeta"** en el Explorador de Windows.

---

## 🛠️ Tecnologías Utilizadas

- **JavaScript / Node.js**: Lenguaje dominado por el usuario, lo que te permite entender, modificar y ampliar cualquier parte del código con total comodidad.
- **Electron**: Proporciona el entorno de escritorio nativo en Windows y el motor Chromium, lo que permite renderizar facturas en HTML/CSS de altísima calidad tipográfica y exportarlas a PDF vectorial nativo (A4) sin necesidad de impresoras virtuales externas.

---

## 📁 Estructura del Proyecto

```text
generador-de-facturas/
├── config.json                     # Configuración persistente (datos de empresa, ruta base, último ID)
├── iniciar-generador.bat           # Acceso directo para iniciar la app con doble clic
├── package.json                    # Dependencias y scripts de Node.js
├── main.js                         # Proceso principal de Electron (gestión de ventanas, IPC, archivos)
├── preload.js                      # Puente seguro entre el proceso nativo y la interfaz gráfica
├── src/
│   ├── renderer/
│   │   ├── index.html              # Interfaz de usuario (formulario, tablas, modales)
│   │   ├── styles.css              # Estilos visuales modernos para escritorio Windows
│   │   └── renderer.js             # Lógica de cálculo en vivo, interacción y eventos
│   ├── templates/
│   │   └── invoice-template.html   # Plantilla HTML/CSS para la generación del PDF de la factura
│   └── utils/
│       ├── invoice-generator.js    # Motor de renderizado y generación del archivo PDF
│       └── storage.js              # Gestión de rutas por año/mes, escaneo de IDs y configuración
└── tests/
    └── test_suite.js               # Batería de pruebas automatizadas
```

---

## 🖥️ Cómo Iniciar la Aplicación

### Opción 1: Acceso Directo (Recomendado)
Haz doble clic sobre el archivo:
```text
iniciar-generador.bat
```

### Opción 2: Desde la Terminal
Abre PowerShell o CMD en la carpeta del proyecto y ejecuta:
```bash
npm start
```

---

## ⚙️ Primera Configuración (Recomendada)

1. Abre la aplicación.
2. Pulsa en el botón **"⚙️ Configuración"** en la esquina superior derecha.
3. Elige la carpeta donde quieres almacenar tus facturas mediante el botón **"📂 Cambiar Carpeta..."** (por ejemplo `C:\Facturas` o en un disco secundario).
4. Rellena los datos fiscales de tu empresa (Nombre, CIF, Dirección, Teléfono, Email, IBAN de cuenta bancaria).
5. Pulsa **"Guardar Configuración"**. A partir de ese momento, la aplicación recordará siempre tus datos.

---

## 🧪 Pruebas Automatizadas

Para verificar en cualquier momento que todos los cálculos matemáticos, formateo de moneda y la generación física de PDFs funcionan al 100%:
```bash
npm test
```
