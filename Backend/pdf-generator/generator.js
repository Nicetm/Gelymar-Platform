const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Handlebars = require('handlebars');

const STYLES = {
  headerBg: '#ffffff',
  lineColor: '#d1d5db',
  tableHeaderBg: '#f3f4f6',
  tableRowAlt: '#fafafa',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  accent: '#374151',
  font: 'Helvetica',
  fontBold: 'Helvetica-Bold',
  fontItalic: 'Helvetica-Oblique'
};

async function generatePDF(filePath, templateName, data) {
    const { logger } = require('../utils/logger');
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        logger.error(`[PDFGenerator] Error al eliminar archivo existente: ${error.message}`);
      }
    }
    
    const doc = new PDFDocument({ 
      margin: 60,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: data.title,
        Author: 'Gelymar S.A.',
        Subject: `${templateName.toUpperCase()} - ${data.orderNumber}`
      }
    });
    
    doc.pipe(fs.createWriteStream(filePath));
    
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateContent);
      const finalText = template(data);
  
      const textWidth = 450;
      const textX = (doc.page.width - textWidth) / 2;
      const lines = finalText.split('\n');
      
      lines.forEach((line) => {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }
        
        const trimmed = line.trim();
        
        if (/^#HEADER#/.test(trimmed)) {
          drawHeader(doc, logoPath, data);
        }
        else if (/^#INTRODUCCION#/.test(trimmed)) {
          const introText = data.introduction || '';
          if (introText) {
            doc.fontSize(11).font(STYLES.font).fillColor(STYLES.textPrimary)
              .text(introText, textX, doc.y, { width: textWidth, align: 'justify', lineGap: 3 });
          }
        }
        else if (/^#INFO_SECTION#/.test(trimmed)) {
          if (templateName === 'aviso-embarque') {
            drawInfoSectionEmbarque(doc, data);
          } else if (templateName === 'aviso-entrega') {
            drawInfoSectionEntrega(doc, data);
          } else if (templateName === 'aviso-disponibilidad') {
            drawInfoSectionDisponibilidad(doc, data);
          } else {
            drawInfoSectionReception(doc, data);
          }
        }
         else if (/^#ITEMS_TABLE#/.test(trimmed)) {
           if (data.items && data.items.length > 0) {
             if (doc.y > doc.page.height - 200) {
               doc.addPage();
             }
             if (templateName === 'aviso-embarque') {
               generateEmbarqueTable(doc, data.items, data);
             } else if (templateName === 'aviso-entrega') {
               generateEntregaTable(doc, data.items, data);
             } else if (templateName === 'aviso-disponibilidad') {
               generateDisponibilidadTable(doc, data.items, data);
             } else {
               generateModernTable(doc, data.items, data);
             }
           }
         }
        else if (/^#SIGNATURE#/.test(trimmed)) {
          if (doc.y > doc.page.height - 120) {
            doc.addPage();
          }
          drawSignatureSection(doc, data);
        }
        else if (trimmed.length > 0) {
          doc.fontSize(11).font(STYLES.font).fillColor(STYLES.textPrimary)
            .text(trimmed, textX, doc.y, { width: textWidth, align: 'justify', lineGap: 3 });
        } else {
          doc.moveDown(0.5);
        }
      });
    }
    
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      drawFooter(doc, i + 1, pageCount, data);
    }
  
    doc.end();
  }

function drawHeader(doc, logoPath, data) {
  const title = data.translations?.title || data.title || 'AVISO DE RECEPCIÓN DE ORDEN';
  const headerHeight = 50;
  
  doc.rect(0, 0, doc.page.width, headerHeight).fill('#f3f4f6');
  doc.rect(0, 0, doc.page.width, 2).fill(STYLES.lineColor);
  
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 25, 13, { height: 30 });
  }
  
  const dateFormat = data.lang === 'en' ? 'en-US' : 'es-CL';
  const currentDate = new Date().toLocaleDateString(dateFormat, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  doc.fontSize(9).fillColor(STYLES.textSecondary).font(STYLES.font)
    .text(currentDate, doc.page.width - 180, 25, { width: 160, align: 'right' });
  
  doc.rect(0, 50, doc.page.width, 1).fill(STYLES.lineColor);
  doc.y = 80;
  
  doc.fontSize(20).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(title, 0, doc.y, { align: 'center', width: doc.page.width });
  
  doc.moveDown(0.2);
  const lineY = doc.y;
  doc.moveTo(150, lineY).lineTo(doc.page.width - 150, lineY)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  
  doc.moveDown(0.2);
}

function drawInfoSectionReception(doc, data) {
  const startY = doc.y + 15;
  const sectionWidth = 500;
  const sectionX = (doc.page.width - sectionWidth) / 2;
  const boxHeight = 180;

  doc.save();
  doc.roundedRect(sectionX, startY - 15, sectionWidth, boxHeight, 12)
    .fillAndStroke('#f3f4f6', STYLES.lineColor);
  doc.restore();

  const infoTitle = data.translations?.info_section_title || 'INFORMACIÓN DEL DOCUMENTO';
  doc.fontSize(13).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(infoTitle, sectionX, startY - 5, { align: 'center', width: sectionWidth });

  doc.y = startY + 35;

  const leftColumn = sectionX + 35;
  const rightColumn = sectionX + 290;
  const row1Y = doc.y;
  const row2Y = row1Y + 20;
  const row3Y = row2Y + 20;
  const row4Y = row3Y + 20;
  const row5Y = row4Y + 20;
  const row6Y = row5Y + 20;
  const row7Y = row6Y + 20;
  
  const t = data.translations || {};
  const dateFormat = data.lang === 'en' ? 'en-US' : 'es-CL';
  
  // Lista izquierda
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.client || 'Cliente:'}`, leftColumn, row1Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.customerName}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.internal_order || 'Número de pedido interno:'}`, leftColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.internalOrderNumber || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.order_number || 'Número de Orden:'}`, leftColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.orderNumber}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.destination_port || 'Puerto de Destino:'}`, leftColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.destinationPort || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm_delivery || 'Fecha de entrega Incoterm:'}`, leftColumn, row5Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incotermDeliveryDate || 'Semana 42'}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.payment_condition || 'Condición de Pago:'}`, leftColumn, row6Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.paymentCondition || '-'}`, { width: 180 });

  // Lista derecha
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.currency || 'Moneda:'}`, rightColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.currency || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm || 'Incoterm:'}`, rightColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incoterm || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.shipping_method || 'Medio de envío:'}`, rightColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.shippingMethod || '-'}`, { width: 180 });

  doc.y = row7Y + 5;
}

function drawInfoSectionEmbarque(doc, data) {
  const startY = doc.y + 15;
  const sectionWidth = 500;
  const sectionX = (doc.page.width - sectionWidth) / 2;
  const boxHeight = 180;

  doc.save();
  doc.roundedRect(sectionX, startY - 15, sectionWidth, boxHeight, 12)
    .fillAndStroke('#f3f4f6', STYLES.lineColor);
  doc.restore();

  const infoTitle = data.translations?.info_section_title || 'INFORMACIÓN DEL DOCUMENTO';
  doc.fontSize(13).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(infoTitle, sectionX, startY - 5, { align: 'center', width: sectionWidth });

  doc.y = startY + 35;

  const leftColumn = sectionX + 35;
  const rightColumn = sectionX + 290;
  const row1Y = doc.y;
  const row2Y = row1Y + 20;
  const row3Y = row2Y + 20;
  const row4Y = row3Y + 20;
  const row5Y = row4Y + 20;
  const row6Y = row5Y + 20;
  const row7Y = row6Y + 20;
  
  const t = data.translations || {};
  const dateFormat = data.lang === 'en' ? 'en-US' : 'es-CL';
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.client || 'Cliente:'}`, leftColumn, row1Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.customerName}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.internal_order || 'Número de pedido interno:'}`, leftColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.internalOrderNumber || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.order_number || 'Número de Orden:'}`, leftColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.orderNumber}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.shipping_method || 'Medio de envío:'}`, leftColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.shippingMethod || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.destination_port || 'Puerto de Destino:'}`, leftColumn, row5Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.destinationPort || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm_delivery || 'Fecha de entrega Incoterm:'}`, leftColumn, row6Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incotermDeliveryDate || ''}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm || 'Incoterm:'}`, rightColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incoterm || '-'}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.etd || 'ETD:'}`, rightColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${formatDateByLanguage(data.etd, data.lang)}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.eta || 'ETA:'}`, rightColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${formatDateByLanguage(data.eta, data.lang)}`, { width: 180 });

  doc.y = row7Y + 5;
}

function generateModernTable(doc, items, data = {}) {
  const tableTop = doc.y + 35;
  const tableWidth = 500;
  const tableX = (doc.page.width - tableWidth) / 2;
  const itemX = tableX + 10;
  const qtyX = tableX + 215;
  const priceX = tableX + 325;
  const totalX = tableX + 400;
  const rowHeight = 28;

  const t = data.translations || {};
  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.products_detail || 'DETALLE DE PRODUCTOS', 0, tableTop - 25, { align: 'center', width: doc.page.width });

  doc.save();
  doc.rect(tableX, tableTop, tableWidth, rowHeight).fill(STYLES.tableHeaderBg);
  doc.restore();
  doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.product || 'PRODUCTO', itemX, tableTop + 8, { width: 180 })
    .text(t.quantity || 'CANTIDAD', qtyX, tableTop + 8, { width: 90, align: 'center' })
    .text(t.price || 'PRECIO', priceX, tableTop + 8, { width: 70, align: 'center' })
    .text(t.total || 'TOTAL', totalX, tableTop + 8, { width: 90, align: 'right' });
  
  doc.moveTo(tableX, tableTop + rowHeight).lineTo(tableX + tableWidth, tableTop + rowHeight)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();

  let grandTotal = 0;
  let totalQuantity = 0;

  items.forEach((item, i) => {
    const y = tableTop + rowHeight * (i + 1);
    if (i % 2 === 0) {
      doc.save();
      doc.rect(tableX, y, tableWidth, rowHeight).fill(STYLES.tableRowAlt);
      doc.restore();
    }
    
    const productName = item.descripcion || item.item_name || '';
    const quantity = data.hasFactura
      ? (parseNumeric(item.kg_facturados ?? 0) || 0)
      : (parseNumeric(item.kg_solicitados ?? item.kg_facturados ?? 0) || 0);
    const unitPrice = parseNumeric(item.unit_price) || 0;
    const total = quantity * unitPrice;
    totalQuantity += quantity;
    
    doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textPrimary)
      .text(productName, itemX, y + 8, { width: 180 })
      .text(`${formatNumber(quantity, data.lang)} kg`, qtyX, y + 8, { width: 90, align: 'center' })
      .text(`${formatCurrency(unitPrice, data.currency, 4)}`, priceX, y + 8, { width: 70, align: 'center' });
    
    if (Number.isFinite(total)) {
      grandTotal += total;
      doc.font(STYLES.fontBold)
        .text(`${formatCurrency(total, data.currency, 2)}`, totalX, y + 8, { width: 90, align: 'right' });
    } else {
      doc.font(STYLES.fontBold)
        .text('-', totalX, y + 8, { width: 90, align: 'right' });
    }
    
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();
  });

  const additionalCharge = parseNumeric(data.additionalCharge);
  if (Number.isFinite(additionalCharge)) {
    grandTotal += additionalCharge;
  }

  if (Number.isFinite(grandTotal)) {
    const currency = data.currency || 'USD';
    const summaryY = tableTop + rowHeight * (items.length + 1);
    const totalsBlockHeight = 60;

    doc.save();
    doc.rect(tableX, summaryY, tableWidth, totalsBlockHeight).fill('#e5e7eb');
    doc.restore();

    doc.moveTo(tableX, summaryY).lineTo(tableX + tableWidth, summaryY)
      .strokeColor('#9ca3af').lineWidth(1.2).stroke();

    const totalKgLine = `${t.total_kg || 'TOTAL KG'}: ${formatNumber(totalQuantity, data.lang)} kg`;
    const additionalLine = `${t.additional_charge || 'GTO ADICIONAL'}: ${Number.isFinite(additionalCharge) ? formatCurrency(additionalCharge, currency, 2) : '-'}`;
    const totalLine = `${t.total_general || 'TOTAL'}: ${formatCurrency(grandTotal, currency, 2)}`;

    const qtyWidth = 90;
    const totalWidth = 160;
    const totalsX = totalX - (totalWidth - 90);
    const line1Y = summaryY + 10;
    const line2Y = summaryY + 30;

    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
      .text(totalKgLine, qtyX, line1Y, { width: qtyWidth, align: 'center', lineBreak: false })
      .text(additionalLine, totalsX, line1Y, { width: totalWidth, align: 'right', lineBreak: false })
      .text(totalLine, totalsX, line2Y, { width: totalWidth, align: 'right', lineBreak: false });

    doc.moveTo(tableX, summaryY + totalsBlockHeight).lineTo(tableX + tableWidth, summaryY + totalsBlockHeight)
      .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  }
  doc.moveDown(3);
}

function generateEmbarqueTable(doc, items, data = {}) {
  const tableTop = doc.y + 35;
  const tableWidth = 500;
  const tableX = (doc.page.width - tableWidth) / 2;
  const itemX = tableX + 10;
  const qtyX = tableX + 300;
  const rowHeight = 28;

  const t = data.translations || {};
  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.products_detail || 'DETALLE DE PRODUCTOS', 0, tableTop - 25, { align: 'center', width: doc.page.width });

  doc.save();
  doc.rect(tableX, tableTop, tableWidth, rowHeight).fill(STYLES.tableHeaderBg);
  doc.restore();
  doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.product || 'PRODUCTO', itemX, tableTop + 8, { width: 280 })
    .text(t.quantity || 'CANTIDAD (kgs facturados)', qtyX, tableTop + 8, { width: 200, align: 'center' });
  
  doc.moveTo(tableX, tableTop + rowHeight).lineTo(tableX + tableWidth, tableTop + rowHeight)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();

  let totalQuantity = 0;

  items.forEach((item, i) => {
    const y = tableTop + rowHeight * (i + 1);
    if (i % 2 === 0) {
      doc.save();
      doc.rect(tableX, y, tableWidth, rowHeight).fill(STYLES.tableRowAlt);
      doc.restore();
    }
    
    const productName = item.descripcion || item.item_name || '';
    let quantity = data.hasFactura
      ? parseNumeric(item.kg_facturados ?? 0)
      : parseNumeric(item.kg_solicitados ?? item.kg_facturados ?? 0);
    if (!Number.isFinite(quantity)) quantity = 0;
    else totalQuantity += quantity;
    
    doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textPrimary)
      .text(productName, itemX, y + 8, { width: 280 })
      .text(`${formatNumber(quantity, data.lang)} kg`, qtyX, y + 8, { width: 200, align: 'center' });
    
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();
  });

  // Fila de total
  if (items.length > 0) {
    const totalY = tableTop + rowHeight * (items.length + 1);
    doc.save();
    doc.rect(tableX, totalY, tableWidth, rowHeight).fill('#e5e7eb');
    doc.restore();
    
    doc.moveTo(tableX, totalY).lineTo(tableX + tableWidth, totalY)
      .strokeColor('#9ca3af').lineWidth(1.2).stroke();
    
    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
      .text(t.total_general || 'TOTAL GENERAL', itemX + 30, totalY + 12, { width: 320, align: 'right' })
      .text(totalQuantity ? `${formatNumber(totalQuantity, data.lang)} kg` : '-', qtyX, totalY + 12, { width: 200, align: 'center' });
    
    doc.moveTo(tableX, totalY + rowHeight).lineTo(tableX + tableWidth, totalY + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  }

  doc.moveDown(3);
}

function drawInfoSectionEntrega(doc, data) {
  const startY = doc.y + 15;
  const sectionWidth = 500;
  const sectionX = (doc.page.width - sectionWidth) / 2;
  const boxHeight = 180;

  doc.save();
  doc.roundedRect(sectionX, startY - 15, sectionWidth, boxHeight, 12)
    .fillAndStroke('#f3f4f6', STYLES.lineColor);
  doc.restore();

  const infoTitle = data.translations?.info_section_title || 'INFORMACIÓN DEL DOCUMENTO';
  doc.fontSize(13).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(infoTitle, sectionX, startY - 5, { align: 'center', width: sectionWidth });

  doc.y = startY + 35;

  const leftColumn = sectionX + 35;
  const rightColumn = sectionX + 290;
  const row1Y = doc.y;
  const row2Y = row1Y + 20;
  const row3Y = row2Y + 20;
  const row4Y = row3Y + 20;
  const row5Y = row4Y + 20;
  const row6Y = row5Y + 20;
  const row7Y = row6Y + 20;
  
  const t = data.translations || {};
  const dateFormat = data.lang === 'en' ? 'en-US' : 'es-CL';
  
  // Lista izquierda
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.client || 'Cliente:'}`, leftColumn, row1Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.customerName}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.internal_order || 'Número de pedido interno:'}`, leftColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.internalOrderNumber || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.order_number || 'Número de Orden:'}`, leftColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.orderNumber}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.destination_port || 'Puerto de Destino:'}`, leftColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.destinationPort || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm_delivery || 'Fecha de entrega Incoterm:'}`, leftColumn, row5Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incotermDeliveryDate || 'Semana 42'}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.payment_condition || 'Condición de Pago:'}`, leftColumn, row6Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.paymentCondition || '-'}`, { width: 180 });

  // Lista derecha
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.currency || 'Moneda:'}`, rightColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.currency || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm || 'Incoterm:'}`, rightColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incoterm || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.shipping_method || 'Medio de envío:'}`, rightColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.shippingMethod || '-'}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.etd || 'ETD:'}`, rightColumn, row5Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${formatDateByLanguage(data.etd, data.lang)}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.eta || 'ETA:'}`, rightColumn, row6Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${formatDateByLanguage(data.eta, data.lang)}`, { width: 180 });

  doc.y = row7Y + 5;
}

function generateEntregaTable(doc, items, data = {}) {
  const tableTop = doc.y + 35;
  const tableWidth = 500;
  const tableX = (doc.page.width - tableWidth) / 2;
  const itemX = tableX + 10;
  const facturaX = tableX + 250;
  const qtyX = tableX + 340;
  const rowHeight = 28;

  const t = data.translations || {};
  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.products_detail || 'DETALLE DE PRODUCTOS', 0, tableTop - 25, { align: 'center', width: doc.page.width });

  doc.save();
  doc.rect(tableX, tableTop, tableWidth, rowHeight).fill(STYLES.tableHeaderBg);
  doc.restore();
  doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.product || 'PRODUCTO', itemX, tableTop + 8, { width: 280 })
    .text(t.invoice || 'FACTURA', facturaX, tableTop + 8, { width: 200, align: 'center' })
    .text(t.quantity || 'CANTIDAD', qtyX, tableTop + 8, { width: 200, align: 'center' });
  
  doc.moveTo(tableX, tableTop + rowHeight).lineTo(tableX + tableWidth, tableTop + rowHeight)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();

  let totalQuantity = 0;

  items.forEach((item, i) => {
    const y = tableTop + rowHeight * (i + 1);
    if (i % 2 === 0) {
      doc.save();
      doc.rect(tableX, y, tableWidth, rowHeight).fill(STYLES.tableRowAlt);
      doc.restore();
    }
    
    const productName = item.descripcion || item.item_name || '';
    let quantity = data.hasFactura
      ? parseNumeric(item.kg_facturados ?? 0)
      : parseNumeric(item.kg_solicitados ?? item.kg_facturados ?? 0);
    if (!Number.isFinite(quantity)) quantity = 0;
    else totalQuantity += quantity;
    const factura = item.factura || '-';


    doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textPrimary)
      .text(productName, itemX, y + 8, { width: 280 })
      .text(factura, facturaX, y + 8, { width: 200, align: 'center' })
      .text(`${formatNumber(quantity, data.lang)} kg`, qtyX, y + 8, { width: 200, align: 'center' });
    
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();
  });

  // Fila de total
  if (totalQuantity > 0) {
    const totalY = tableTop + rowHeight * (items.length + 1);
    doc.save();
    doc.rect(tableX, totalY, tableWidth, rowHeight).fill('#e5e7eb');
    doc.restore();
    
    doc.moveTo(tableX, totalY).lineTo(tableX + tableWidth, totalY)
      .strokeColor('#9ca3af').lineWidth(1.2).stroke();
    
    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
      .text(t.total_general || 'TOTAL GENERAL', facturaX - 170, totalY + 12, { width: 320, align: 'right' })
      .text(`${formatNumber(totalQuantity, data.lang)} kg`, qtyX, totalY + 12, { width: 200, align: 'center' });
    
    doc.moveTo(tableX, totalY + rowHeight).lineTo(tableX + tableWidth, totalY + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  }

  doc.moveDown(3);
}

function drawInfoSectionDisponibilidad(doc, data) {
  const startY = doc.y + 15;
  const sectionWidth = 500;
  const sectionX = (doc.page.width - sectionWidth) / 2;
  const boxHeight = 180;

  doc.save();
  doc.roundedRect(sectionX, startY - 15, sectionWidth, boxHeight, 12)
    .fillAndStroke('#f3f4f6', STYLES.lineColor);
  doc.restore();

  const infoTitle = data.translations?.info_section_title || 'INFORMACIÓN DEL DOCUMENTO';
  doc.fontSize(13).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(infoTitle, sectionX, startY - 5, { align: 'center', width: sectionWidth });

  doc.y = startY + 35;

  const leftColumn = sectionX + 35;
  const rightColumn = sectionX + 290;
  const row1Y = doc.y;
  const row2Y = row1Y + 20;
  const row3Y = row2Y + 20;
  const row4Y = row3Y + 20;
  const row5Y = row4Y + 20;
  const row6Y = row5Y + 20;
  const row7Y = row6Y + 20;
  
  const t = data.translations || {};
  const dateFormat = data.lang === 'en' ? 'en-US' : 'es-CL';
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.client || 'Cliente:'}`, leftColumn, row1Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.customerName}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.internal_order || 'Número de pedido interno:'}`, leftColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.internalOrderNumber || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.order_number || 'Número de Orden:'}`, leftColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.orderNumber}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.shipping_method || 'Medio de envío:'}`, leftColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.shippingMethod || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.destination_port || 'Puerto de Destino:'}`, leftColumn, row5Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.destinationPort || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm_delivery || 'Fecha de entrega Incoterm:'}`, leftColumn, row6Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incotermDeliveryDate || ''}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.incoterm || 'Incoterm:'}`, rightColumn, row2Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${data.incoterm || '-'}`, { width: 180 });
  
  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.etd || 'ETD:'}`, rightColumn, row3Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${formatDateByLanguage(data.etd, data.lang)}`, { width: 180 });

  doc.fontSize(11).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(`${t.eta || 'ETA:'}`, rightColumn, row4Y, { continued: true })
    .font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(` ${formatDateByLanguage(data.eta, data.lang)}`, { width: 180 });

  doc.y = row7Y + 5;
}

function generateDisponibilidadTable(doc, items, data = {}) {
  const tableTop = doc.y + 35;
  const tableWidth = 500;
  const tableX = (doc.page.width - tableWidth) / 2;
  const itemX = tableX + 10;
  const qtyX = tableX + 300;
  const rowHeight = 28;

  const t = data.translations || {};
  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.products_detail || 'DETALLE DE PRODUCTOS', 0, tableTop - 25, { align: 'center', width: doc.page.width });

  doc.save();
  doc.rect(tableX, tableTop, tableWidth, rowHeight).fill(STYLES.tableHeaderBg);
  doc.restore();
  doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(t.product || 'PRODUCTO', itemX, tableTop + 8, { width: 280 })
    .text(t.quantity || 'CANTIDAD (kgs facturados)', qtyX, tableTop + 8, { width: 200, align: 'center' });
  
  doc.moveTo(tableX, tableTop + rowHeight).lineTo(tableX + tableWidth, tableTop + rowHeight)
    .strokeColor(STYLES.lineColor).lineWidth(1).stroke();

  let totalQuantity = 0;

  items.forEach((item, i) => {
    const y = tableTop + rowHeight * (i + 1);
    if (i % 2 === 0) {
      doc.save();
      doc.rect(tableX, y, tableWidth, rowHeight).fill(STYLES.tableRowAlt);
      doc.restore();
    }
    
    const productName = item.descripcion || item.item_name || '';
    let quantity = data.hasFactura
      ? parseNumeric(item.kg_facturados ?? 0)
      : parseNumeric(item.kg_solicitados ?? item.kg_facturados ?? 0);
    if (!Number.isFinite(quantity)) quantity = 0;
    else totalQuantity += quantity;
    
    doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textPrimary)
      .text(productName, itemX, y + 8, { width: 280 })
      .text(`${formatNumber(quantity, data.lang)} kg`, qtyX, y + 8, { width: 200, align: 'center' });
    
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();
  });

  // Fila de total
  if (items.length > 0) {
    const totalY = tableTop + rowHeight * (items.length + 1);
    doc.save();
    doc.rect(tableX, totalY, tableWidth, rowHeight).fill('#e5e7eb');
    doc.restore();
    
    doc.moveTo(tableX, totalY).lineTo(tableX + tableWidth, totalY)
      .strokeColor('#9ca3af').lineWidth(1.2).stroke();
    
    doc.fontSize(9).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
      .text(t.total_general || 'TOTAL GENERAL', itemX + 30, totalY + 12, { width: 320, align: 'right' })
      .text(totalQuantity ? `${formatNumber(totalQuantity, data.lang)} kg` : '-', qtyX, totalY + 12, { width: 200, align: 'center' });
    
    doc.moveTo(tableX, totalY + rowHeight).lineTo(tableX + tableWidth, totalY + rowHeight)
      .strokeColor(STYLES.lineColor).lineWidth(1).stroke();
  }

  doc.moveDown(3);
}

function drawSignatureSection(doc, data) {
  doc.moveDown(1);
  
  const signY = doc.y;
  const signWidth = 220;
  const signX = (doc.page.width - signWidth) / 2;
  const signatureImage = data.signImagePath || data.signatureImagePath; // ruta opcional

  doc.save();
  doc.roundedRect(signX, signY - 5, signWidth, 75, 10)
    .strokeColor(STYLES.lineColor)
    .lineWidth(1)
    .stroke();
  doc.restore();

  const t = data.translations || {};
  //doc.fontSize(9).font(STYLES.font).fillColor(STYLES.textSecondary)
  // .text(t.signature_title || 'FIRMA AUTORIZADA', signX + 10, signY + 2);

  // Imagen de firma (si se pasa la ruta)
  if (signatureImage) {
    const imgWidth = 80;
    doc.image(signatureImage, signX + (signWidth - imgWidth) / 2, signY + 6, { width: imgWidth });
  }

  doc.moveTo(signX + 20, signY + 30).lineTo(signX + signWidth - 20, signY + 30)
    .strokeColor(STYLES.lineColor).lineWidth(0.7).stroke();

  const signName = data.signName || t.signature_name || 'Carla Torres';
  const signRole = data.signRole || t.signature_role || 'Customer Service';
  const signPhone = data.signPhone || t.signature_phone || '+56 9 9760 4855';
  
  doc.fontSize(10).font(STYLES.fontBold).fillColor(STYLES.textPrimary)
    .text(signName, signX + 10, signY + 36, { width: signWidth - 20, align: 'center' })
    .fontSize(8).font(STYLES.font).fillColor(STYLES.textSecondary)
    .text(signRole, signX + 10, signY + 50, { width: signWidth - 20, align: 'center' })
    .text(signPhone, signX + 10, signY + 58, { width: signWidth - 20, align: 'center' });
}

function drawFooter(doc, currentPage, totalPages, data = {}) {
  const pageHeight = doc.page.height;
  const margin = doc.page.margins.bottom;
  
  // Texto del footer: 10px desde abajo (abajo del todo)
  const textY = pageHeight - margin - 10;
  
  // Línea: 20px desde abajo (sobre el texto)
  const lineY = pageHeight - margin - 20;

  doc.save();

  // 1. Texto del footer (abajo del todo)
  const t = data.translations || {};
  const pageText = t.footer || 'GELYMAR S.A.  |  www.gelymar.com | carla.torres@gelymar.com  |  Página';
  const footerText = `${pageText} ${currentPage} de ${totalPages}`;
  
  doc.fontSize(8)
     .font(STYLES.font)
     .fillColor(STYLES.textSecondary)
     .text(footerText, 0, textY, { align: 'center' });

  // 2. Línea horizontal (sobre el texto)
  doc.moveTo(50, lineY)
     .lineTo(doc.page.width - 50, lineY)
     .strokeColor(STYLES.lineColor)
     .lineWidth(1)
     .stroke();

  doc.restore();
}

function parseNumeric(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return NaN;

    const sanitized = trimmed.replace(/[^0-9,.\-]/g, '');
    const hasComma = sanitized.includes(',');
    const hasDot = sanitized.includes('.');
    let normalized = sanitized;

    if (hasComma && hasDot) {
      if (sanitized.lastIndexOf(',') > sanitized.lastIndexOf('.')) {
        normalized = sanitized.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = sanitized.replace(/,/g, '');
      }
    } else if (hasComma) {
      normalized = sanitized.replace(/\./g, '').replace(',', '.');
    }

    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function formatCurrency(value, currency, fractionDigits = 4) {
  const numericValue = parseNumeric(value);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  let locales;
  switch (currency) {
    case 'USD':
      locales = 'en-US';
      break;
    case 'EUR':
      locales = 'de-DE';
      break;
    case 'CLP':
      locales = 'es-CL';
      break;
    default:
      locales = 'en-US';
  }

  return new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(numericValue);
}

function formatNumber(value, lang = 'es') {
  const numericValue = parseNumeric(value);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  let locales;
  switch (lang) {
    case 'en':
      locales = 'en-US';
      break;
    case 'de':
      locales = 'de-DE';
      break;
    case 'es':
    default:
      locales = 'es-CL';
  }

  return new Intl.NumberFormat(locales, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numericValue);
}

function getWeekOfYear(dateString, lang = 'es') {
  if (!dateString) return '';

  const date = new Date(dateString);
  // Convertir a UTC para evitar problemas de zona horaria
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO: mover al jueves de esta semana
  const dayNum = d.getUTCDay() || 7; // domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Primer día del año ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calcular semana ISO
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return lang === 'en' ? `Week ${week}` : `Semana ${week}`;
}


function formatDateByLanguage(dateString, lang) {
  if (!dateString) return '-';
  let date;
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    const [year, month, day] = dateString.trim().split('-').map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    date = new Date(dateString);
  }
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  };

  if (lang === 'en') {
    // Ejemplo: September 4, 2025
    return date.toLocaleDateString('en-US', options);
  } else {
    // Ejemplo: 4 septiembre, 2025
    return date.toLocaleDateString('es-CL', options);
  }
}

module.exports = {
  generateRecepcionOrden: (filePath, data) => generatePDF(filePath, 'aviso-recepcion-orden', data),
  generateAvisoEmbarque: (filePath, data) => generatePDF(filePath, 'aviso-embarque', data),
  generateAvisoEntrega: (filePath, data) => generatePDF(filePath, 'aviso-entrega', data),
  generateAvisoDisponibilidad: (filePath, data) => generatePDF(filePath, 'aviso-disponibilidad', data),
  getWeekOfYear,
  formatDateByLanguage
};
