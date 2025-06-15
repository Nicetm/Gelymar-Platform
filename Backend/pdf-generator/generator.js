const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Handlebars = require('handlebars');

// Función central que recibe template, datos y ruta
async function generatePDF(filePath, templateName, data) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  // Agrega logo
  doc.image(path.join(__dirname, 'assets', 'logo.png'), 50, 50, { width: 100 });

  doc.fontSize(18).text(data.title, { align: 'center' });
  doc.moveDown();

  if (data.subtitle) {
    doc.fontSize(14).text(data.subtitle, { align: 'center' });
    doc.moveDown();
  }

  doc.fontSize(12).text(`Cliente: ${data.customerName}`);
  doc.text(`Orden: ${data.orderNumber}`);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`);
  doc.moveDown();

  const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);
  const finalText = template(data);
  doc.fontSize(12).text(finalText, { align: 'justify' });
  doc.moveDown();

  if (data.items && data.items.length > 0) {
    generateTable(doc, data.items);
  }

  doc.moveDown();
  doc.text('______________________________', { align: 'left' });
  doc.text(`${data.signName} - ${data.signRole}`, { align: 'left' });

  doc.end();
}

function generateTable(doc, items) {
  const tableTop = doc.y;
  const itemX = 50;
  const qtyX = 300;
  const priceX = 400;

  doc.fontSize(12).text('Detalle:', itemX, tableTop);
  doc.moveDown();

  doc.text('Producto', itemX, doc.y);
  doc.text('Cantidad', qtyX, doc.y);
  doc.text('Precio', priceX, doc.y);
  doc.moveDown();

  items.forEach(item => {
    doc.text(item.product, itemX, doc.y);
    doc.text(item.quantity, qtyX, doc.y);
    doc.text(item.price, priceX, doc.y);
    doc.moveDown();
  });
}

// 🔥 AQUÍ EXPORTAS LOS GENERADORES ESPECÍFICOS
module.exports = {
  generateRO: (filePath, data) => generatePDF(filePath, 'ro', data),
  generateInvoice: (filePath, data) => generatePDF(filePath, 'invoice', data),
  generateBL: (filePath, data) => generatePDF(filePath, 'bl', data)
};
