const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Handlebars = require('handlebars');

// Configuración de estilos centralizada - Paleta profesional
const STYLES = {
  headerBg: '#2C3E50',        // Azul gris oscuro profesional
  headerShadow: '#34495E',    // Sombra sutil
  headerLine: '#BDC3C7',      // Línea divisoria clara
  tableHeaderBg: '#34495E',   // Cabecera de tabla
  tableRowAlt: '#F8F9FA',     // Fondo alternado muy sutil
  footerColor: '#7F8C8D',     // Gris medio para pie de página
  textPrimary: '#2C3E50',     // Texto principal
  textSecondary: '#5D6D7E',   // Texto secundario
  font: 'Helvetica',
  fontBold: 'Helvetica-Bold',
  fontItalic: 'Helvetica-Oblique'
};

// Encabezado profesional con diseño corporativo
function drawHeader(doc, logoPath, title, subtitle) {
  // Banner principal con color corporativo
  doc.rect(0, 0, doc.page.width, 50).fill(STYLES.headerBg);

  // Sombra inferior elegante
  doc.save()
    .rect(0, 50, doc.page.width, 3)
    .fill(STYLES.headerShadow)
    .restore();

  // Logo bien posicionado
  doc.image(logoPath, 55, 12, { width: 120 });

  // Línea divisoria profesional
  doc.moveTo(60, 58).lineTo(doc.page.width - 60, 58)
    .strokeColor(STYLES.headerLine).lineWidth(1).stroke();

  doc.moveDown(2.5);

  // Título principal
  doc.fontSize(24).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(title, { align: 'center' });
  
  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(14).font(STYLES.fontItalic).fillColor(STYLES.textSecondary)
      .text(subtitle, { align: 'center' });
  }
  doc.moveDown(1.5);
}

// Pie de página profesional con línea divisoria
function drawFooter(doc, text) {
  const bottom = doc.page.height - 50;
  
  // Línea divisoria superior
  doc.moveTo(60, bottom - 10).lineTo(doc.page.width - 60, bottom - 10)
    .strokeColor(STYLES.headerLine).lineWidth(1).stroke();
  
  // Fondo sutil para el pie
  doc.rect(0, bottom - 5, doc.page.width, 40).fill('#FAFBFC');
  
  doc.fontSize(10).fillColor(STYLES.footerColor)
    .text(text, 0, bottom + 5, { align: 'center', width: doc.page.width });
}

// Tabla moderna y profesional
function generateModernTable(doc, items) {
  const tableTop = doc.y;
  const itemX = 60;
  const qtyX = 320;
  const priceX = 420;
  const tableWidth = 340;
  const rowHeight = 24;

  // Cabecera elegante
  doc
    .font(STYLES.fontBold)
    .fontSize(12)
    .fillColor('white')
    .rect(itemX - 2, tableTop - 2, tableWidth, rowHeight)
    .fill(STYLES.tableHeaderBg)
    .fillColor('white')
    .text('Producto', itemX + 5, tableTop + 5, { width: 200 })
    .text('Cantidad', qtyX, tableTop + 5, { width: 70, align: 'right' })
    .text('Precio', priceX, tableTop + 5, { width: 70, align: 'right' });

  // Filas con diseño limpio
  items.forEach((item, i) => {
    const y = tableTop + rowHeight * (i + 1);
    
    // Fondo alternado muy sutil
    if (i % 2 === 0) {
      doc.rect(itemX - 2, y - 2, tableWidth, rowHeight).fill(STYLES.tableRowAlt);
    }
    
    // Línea divisoria sutil entre filas
    doc.moveTo(itemX - 2, y + rowHeight - 2)
      .lineTo(itemX - 2 + tableWidth, y + rowHeight - 2)
      .strokeColor('#E8EAED').lineWidth(0.5).stroke();
    
    doc
      .font(STYLES.font)
      .fontSize(12)
      .fillColor(STYLES.textPrimary)
      .text(item.product, itemX + 5, y + 5, { width: 200 })
      .text(item.quantity, qtyX, y + 5, { width: 70, align: 'right' })
      .text(item.price, priceX, y + 5, { width: 70, align: 'right' });
  });
  
  doc.moveDown(2);
}

// Función central que recibe template, datos y ruta
async function generatePDF(filePath, templateName, data) {
  const doc = new PDFDocument({ margin: 60 });
  doc.pipe(fs.createWriteStream(filePath));

  // Encabezado profesional
  drawHeader(doc, path.join(__dirname, 'assets', 'logo.png'), data.title, data.subtitle);

  // Datos principales con formato profesional
  doc.fontSize(12).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('Cliente:', { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.customerName}`);
  
  doc.font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('Orden:', { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.orderNumber ?? ''}`);
  
  doc.font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('Fecha:', { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`);
  
  doc.moveDown(1.5);

  // Texto de la plantilla
  const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);
  const finalText = template(data);
  doc.fontSize(12).font(STYLES.font).fillColor(STYLES.textPrimary)
    .text(finalText, { align: 'justify' });
  doc.moveDown(1.5);

  // Tabla si hay items
  if (data.items && data.items.length > 0) {
    generateModernTable(doc, data.items);
  }

  doc.moveDown(2);
  
  // Firma profesional alineada a la derecha
  const signY = doc.y;
  doc.font(STYLES.font).fillColor(STYLES.textSecondary)
    .text('______________________________', 350, signY, { align: 'left', width: 200 });
  doc.font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${data.signName} - ${data.signRole}`, 350, signY + 15, { align: 'left', width: 200 });

  // Pie de página profesional
  drawFooter(doc, 'Gelymar S.A. | www.gelymar.com | contacto@gelymar.com');

  doc.end();
}

// Exportación de generadores específicos
module.exports = {
  generateRO: (filePath, data) => generatePDF(filePath, 'ro', data),
  generateInvoice: (filePath, data) => generatePDF(filePath, 'invoice', data),
  generateBL: (filePath, data) => generatePDF(filePath, 'bl', data)
};





