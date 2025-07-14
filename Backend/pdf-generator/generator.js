const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Handlebars = require('handlebars');

// Configuración de estilos minimalista y profesional
const STYLES = {
  // Paleta de colores reducida y profesional
  headerBg: '#ffffff',        // Fondo blanco
  lineColor: '#d1d5db',       // Gris suave para líneas
  tableHeaderBg: '#f3f4f6',   // Gris muy claro para tablas
  tableRowAlt: '#fafafa',     // Fondo alternado mínimo
  textPrimary: '#1f2937',     // Negro profesional
  textSecondary: '#6b7280',   // Gris medio
  accent: '#374151',          // Gris oscuro para acentos
  
  // Tipografías
  font: 'Helvetica',
  fontBold: 'Helvetica-Bold',
  fontItalic: 'Helvetica-Oblique'
};

function drawHeader(doc, logoPath, title, subtitle) {
  const headerHeight = 50;
  
  // Fondo gris claro profesional
  doc.rect(0, 0, doc.page.width, headerHeight).fill('#f3f4f6');
  
  // Línea divisoria superior (banner)
  doc.rect(0, 0, doc.page.width, 2).fill(STYLES.lineColor);
  
  // Logo pequeño a la izquierda
  if (fs.existsSync(logoPath)) {
    // Mantener proporción original del logo para mejor definición y alineación profesional
    doc.image(logoPath, 25, 13, { height: 30 }); // Alineado con la fecha
  }
  
  // Fecha discreta en esquina superior derecha
  const currentDate = new Date().toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  doc.fontSize(9).fillColor(STYLES.textSecondary).font(STYLES.font)
    .text(currentDate, doc.page.width - 180, 25, { width: 160, align: 'right' });
  
  // Línea divisoria media (separación del banner)
  doc.rect(0, 50, doc.page.width, 1).fill(STYLES.lineColor);
  
  // Posición después del banner
  doc.y = 100;
  
  // Título centrado y profesional
  doc.fontSize(20).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(title, 0, doc.y, { align: 'center', width: doc.page.width });
  
  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(14).font(STYLES.font).fillColor(STYLES.textSecondary)
      .text(subtitle, 0, doc.y, { align: 'center', width: doc.page.width });
  }
  
  // Línea divisoria inferior
  doc.moveDown(1);
  const lineY = doc.y;
  doc.moveTo(150, lineY).lineTo(doc.page.width - 150, lineY)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  
  doc.moveDown(5);
}

// Función auxiliar para elementos de información
function drawInfoItem(doc, label, value, x, width = 200) {
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(label, x, doc.y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${value}`, { width: width });
  doc.moveDown(3);
}

// Sección de información centrada y profesional
function drawInfoSection(doc, data) {
  const startY = doc.y;
  const sectionWidth = 500;
  const sectionX = (doc.page.width - sectionWidth) / 2;
  const boxHeight = 100;

  // Fondo gris claro con bordes redondeados
  doc.save();
  doc.roundedRect(sectionX, startY - 15, sectionWidth, boxHeight, 12)
    .fillAndStroke('#f7fafc', STYLES.lineColor);
  doc.restore();

  // Título de la sección centrado y destacado
  doc.fontSize(13).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('INFORMACIÓN DEL DOCUMENTO', sectionX, startY - 5, { align: 'center', width: sectionWidth });

  doc.y = startY + 35;

  // Información en dos columnas centradas y balanceadas
  const leftColumn = sectionX + 35;
  const rightColumn = sectionX + 290;
  const row1Y = doc.y;

  // Primera fila: Cliente y Fecha
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('Cliente:', leftColumn, row1Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.customerName}`, { width: 180 });
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('Fecha:', rightColumn, row1Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${new Date().toLocaleDateString('es-CL')}`, { width: 180 });

  // Segunda fila: N° Orden y Responsable
  const row2Y = row1Y + 20;
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('N° Orden:', leftColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.orderNumber}`, { width: 180 });
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('Responsable:', rightColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.responsiblePerson || 'Sistema'}`, { width: 180 });

  doc.moveDown(3);
}

// Indicadores de estado minimalistas y profesionales
function drawStatusSection(doc, data) {
  if (!data.priority && !data.status) return;

  const startY = doc.y;
  const centerX = doc.page.width / 2;
  let totalWidth = 0;

  if (data.priority) totalWidth += 130;
  if (data.status) totalWidth += 130;
  if (data.priority && data.status) totalWidth += 40; // Espacio entre

  let xOffset = centerX - (totalWidth / 2);
  const statusY = startY;
  const lineHeight = 14;

  // PRIORIDAD
  if (data.priority) {
    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textSecondary)
      .text(`PRIORIDAD: ${data.priority}`, xOffset, statusY, { width: 130, align: 'center' });
    // Línea recta debajo
    const textWidth = doc.widthOfString(`PRIORIDAD: ${data.priority}`);
    const lineX = xOffset + (130 - textWidth) / 2;
    doc.moveTo(lineX, statusY + lineHeight)
      .lineTo(lineX + textWidth, statusY + lineHeight)
      .strokeColor(STYLES.textSecondary).lineWidth(1).stroke();
    xOffset += 170;
  }

  // ESTADO
  if (data.status) {
    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textSecondary)
      .text(`ESTADO: ${data.status}`, xOffset, statusY, { width: 130, align: 'center' });
    // Línea recta debajo
    const textWidth = doc.widthOfString(`ESTADO: ${data.status}`);
    const lineX = xOffset + (130 - textWidth) / 2;
    doc.moveTo(lineX, statusY + lineHeight)
      .lineTo(lineX + textWidth, statusY + lineHeight)
      .strokeColor(STYLES.textSecondary).lineWidth(1).stroke();
  }

  doc.moveDown(3);
}

// Tabla minimalista y profesional
function generateModernTable(doc, items) {
  const tableTop = doc.y + 10;
  const tableWidth = 500;
  const tableX = (doc.page.width - tableWidth) / 2;
  const itemX = tableX + 10;
  const qtyX = tableX + 250;
  const priceX = tableX + 340;
  const totalX = tableX + 410;
  const rowHeight = 28;

  // Título de la tabla centrado
  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('DETALLE DE PRODUCTOS', 0, tableTop - 35, { align: 'center', width: doc.page.width });

  // Cabecera de tabla
  doc.save();
  doc.rect(tableX, tableTop, tableWidth, rowHeight).fill(STYLES.tableHeaderBg);
  doc.restore();
  doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text('PRODUCTO', itemX, tableTop + 8, { width: 210 })
    .text('CANTIDAD', qtyX, tableTop + 8, { width: 60, align: 'center' })
    .text('PRECIO', priceX, tableTop + 8, { width: 70, align: 'center' })
    .text('TOTAL', totalX, tableTop + 8, { width: 90, align: 'center' });
  
  doc.moveTo(tableX, tableTop + rowHeight).lineTo(tableX + tableWidth, tableTop + rowHeight)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();

  let grandTotal = 0;

  // Filas de datos
  items.forEach((item, i) => {
    const y = tableTop + rowHeight * (i + 1);
    if (i % 2 === 0) {
      doc.save();
      doc.rect(tableX, y, tableWidth, rowHeight).fill(STYLES.tableRowAlt);
      doc.restore();
    }
    
    doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textPrimary)
      .text(item.product || '', itemX, y + 8, { width: 210 })
      .text(item.quantity || '', qtyX, y + 8, { width: 60, align: 'center' })
      .text(String(item.price || ''), priceX, y + 8, { width: 70, align: 'center' });
    
    const priceValue = String(item.price || '').replace(/[^\d]/g, '');
    const price = parseFloat(priceValue);
    if (!isNaN(price)) {
      grandTotal += price;
      doc.font(STYLES.fontBold)
        .text(`$${price.toLocaleString('es-CL')}`, totalX, y + 8, { width: 90, align: 'center' });
    }
    
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();
  });

  // Fila de total
  if (grandTotal > 0) {
    const totalY = tableTop + rowHeight * (items.length + 1);
    doc.save();
    doc.rect(tableX, totalY, tableWidth, rowHeight).fill('#e5e7eb');
    doc.restore();
    
    doc.moveTo(tableX, totalY).lineTo(tableX + tableWidth, totalY)
      .strokeColor('#9ca3af').lineWidth(1.2).stroke();
    
    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
      .text('TOTAL GENERAL', priceX - 40, totalY + 12, { width: 110, align: 'right' })
      .text(`$${grandTotal.toLocaleString('es-CL')}`, totalX, totalY + 12, { width: 90, align: 'center' });
    
    doc.moveTo(tableX, totalY + rowHeight).lineTo(tableX + tableWidth, totalY + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  }
  doc.moveDown(5);
}

// Sección de firma centrada
function drawSignatureSection(doc, data) {
  const signY = doc.y + 20;
  const signWidth = 220;
  const signX = (doc.page.width - signWidth) / 2;

  doc.save();
  doc.roundedRect(signX, signY - 5, signWidth, 70, 10)
    .strokeColor(STYLES.lineColor)
    .lineWidth(1)
    .stroke();
  doc.restore();

  doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textSecondary)
    .text('FIRMA AUTORIZADA', signX + 10, signY + 2);

  doc.moveTo(signX + 20, signY + 30).lineTo(signX + signWidth - 20, signY + 30)
    .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();

  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(data.signName, signX + 10, signY + 36, { width: signWidth - 20, align: 'center' })
    .fontSize(8).font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(data.signRole, signX + 10, signY + 50, { width: signWidth - 20, align: 'center' });
}


function drawFooter(doc, currentPage, totalPages) {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const margin = doc.page.margins.bottom;
    
    const footerLineY = pageHeight - margin - 20;

    doc.save();
  
    // Dibuja la línea
    doc.moveTo(50, footerLineY)
       .lineTo(pageWidth - 50, footerLineY)
       .strokeColor(STYLES.lineColor)
       .lineWidth(1)
       .stroke();
  
    // El número de página ahora se pasa como argumento, ¡mucho más fiable!
    const footerText = `GELYMAR S.A.  |  www.gelymar.com | contacto@gelymar.com  |  Página ${currentPage} de ${totalPages}`;
    
    doc.fontSize(8)
       .font(STYLES.font)
       .fillColor(STYLES.textSecondary)
       .text(footerText, 0, footerLineY + 8, { align: 'center' });

    doc.restore();
}

async function generatePDF(filePath, templateName, data) {
    // Eliminar archivo existente si existe
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Archivo existente eliminado: ${filePath}`);
      } catch (error) {
        console.error(`Error al eliminar archivo existente: ${error.message}`);
      }
    }
    
    const doc = new PDFDocument({ 
      margin: 60,
      size: 'A4',
      bufferPages: true, // Habilita el buffer para procesar los footers al final
      info: {
        Title: data.title,
        Author: 'Gelymar S.A.',
        Subject: `${templateName.toUpperCase()} - ${data.orderNumber}`
      }
    });
    
    doc.pipe(fs.createWriteStream(filePath));
    
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    
    // ---- INICIO DEL CONTENIDO DEL DOCUMENTO ----
    
    // Encabezado
    drawHeader(doc, logoPath, data.title, data.subtitle);
    
    // Secciones de información
    drawInfoSection(doc, data);
    drawStatusSection(doc, data);
    
    // Contenido dinámico desde el template .hbs
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateContent);
      const finalText = template(data);
  
      const textWidth = 450;
      const textX = (doc.page.width - textWidth) / 2;
      const lines = finalText.split('\n');
      let isInList = false;
      
      lines.forEach((line) => {
        // Control de salto de página (ya no se necesita llamar a drawFooter aquí)
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }
        
        const trimmed = line.trim();
        
        if (/^(DETALLES DEL AVRO|INSTRUCCIONES ESPECIALES|PRÓXIMOS PASOS|FECHA ESTIMADA DE ENTREGA)$/i.test(trimmed)) {
          doc.moveDown(1);
          doc.fontSize(13).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
            .text(trimmed.toUpperCase(), textX, doc.y, { width: textWidth, align: 'left' });
          doc.moveDown(0.5);
        }
        else if (/^---+$/.test(trimmed)) {
          doc.moveDown(0.5);
          doc.rect(textX, doc.y, textWidth, 1).fill(STYLES.lineColor);
          doc.moveDown(0.5);
        }
        else if (/^\d+\./.test(trimmed)) {
          if (!isInList) { doc.moveDown(0.5); isInList = true; }
          doc.fontSize(11).font(STYLES.font).fillColor(STYLES.textPrimary)
            .text(trimmed, textX + 20, doc.y, { width: textWidth - 20, align: 'left' });
        }
        else if (/^\*\*[^:]+:\*\*/.test(trimmed)) {
          const match = trimmed.match(/^\*\*([^:]+):\*\*\s*(.*)$/);
          if (match) {
            doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
              .text(match[1] + ':', textX, doc.y, { continued: true });
            doc.font(STYLES.font).fillColor(STYLES.textSecondary)
              .text(' ' + match[2], { width: textWidth - doc.widthOfString(match[1] + ':'), continued: false });
          } else {
            doc.fontSize(11).font(STYLES.font).fillColor(STYLES.textPrimary)
              .text(trimmed, textX, doc.y, { width: textWidth, align: 'left' });
          }
        }
        else if (trimmed.length > 0) {
          doc.fontSize(11).font(STYLES.font).fillColor(STYLES.textPrimary)
            .text(trimmed, textX, doc.y, { width: textWidth, align: 'justify', lineGap: 3 });
          isInList = false;
        } else {
          doc.moveDown(0.5);
          isInList = false;
        }
      });
    }
    
    doc.moveDown(3);
  
    // Tabla de items
    if (data.items && data.items.length > 0) {
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }
      generateModernTable(doc, data.items);
    }
  
    // Sección de firma
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
    }
    drawSignatureSection(doc, data);
    
    // ---- FIN DEL CONTENIDO DEL DOCUMENTO ----
  
    // ---- PROCESAMIENTO FINAL: AGREGAR FOOTERS ----
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      // Pasamos el número de página actual y el total para un formato "Página X de Y"
      drawFooter(doc, i + 1, pageCount);
    }
  
    // Finaliza y guarda el archivo PDF
    doc.end();
  }
  
  
// Exportación de generadores específicos
module.exports = {
  generateRO: (filePath, data) => generatePDF(filePath, 'ro', data),
  generateAVRO: (filePath, data) => generatePDF(filePath, 'avro', data),
  generateInvoice: (filePath, data) => generatePDF(filePath, 'invoice', data),
  generateBL: (filePath, data) => generatePDF(filePath, 'bl', data)
};
