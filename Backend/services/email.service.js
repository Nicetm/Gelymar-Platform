const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Handlebars = require('handlebars');

// Las variables de entorno ya se cargan automáticamente en app.js

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // false para TLS
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

const DOC_NAME_MAP = {
  'Order Receipt Advice': 'Aviso de Recepción de Orden',
  'Shipment Advice': 'Aviso de Embarque',
  'Order Delivery Advice': 'Aviso de Entrega',
  'Availability Advice': 'Aviso de Disponibilidad de Orden',
};

async function sendFileToClient(file, lang = 'en') {

  lang = file.lang || 'en';

  if (!file) {
    throw new Error('Faltan datos para enviar el correo');
  }
  
  if (!file.path) {
    throw new Error('No hay emails disponibles para enviar el correo');
  }

  // Verificar que al menos haya un email disponible
  const emails = [];
  if (file.customer_email) emails.push(file.customer_email);
  if (file.contact_emails) emails.push(...file.contact_emails.split(',').filter(email => email.trim()));
  
  if (emails.length === 0) {
    throw new Error('No hay emails disponibles para enviar el correo');
  }

  // Normalizamos el path de DB (que viene con backslash de Windows)
  const relativePath = file.path.replace(/\\/g, '/');

  // Armamos el path físico local
  const absolutePath = path.join(process.env.FILE_SERVER_ROOT, relativePath);

  // Validamos existencia
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Archivo no encontrado en el servidor local');
  }

  // Cargar traducciones
  const translationsPath = path.join(__dirname, '../mail-generator/i18n', `${lang}.json`);
  const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

  // Cargar template
  const templatePath = path.join(__dirname, '../mail-generator/template/document.hbs');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);
  const filename = lang == 'en' ? file.name : await translateNameOfDocument(file.name);

  // Datos para el template
  const templateData = {
    lang,
    dear: translations.mail.dear,
    subject: `📄 Gelymar: ${filename}`,
    title: filename,
    logoUrl: 'https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg',
    customerName: file.customer_name,
    introMessage: translations.mail.introMessage,
    documentName: filename,
    logisticsManagement: translations.mail.logisticsManagement,
    gelymar: translations.mail.gelymar,
    pleaseFindAttached: translations.mail.pleaseFindAttached,
    correspondingTo: translations.mail.correspondingTo,
    documentContains: translations.mail.documentContains,
    questionsContact: translations.mail.questionsContact,
    bestRegards: translations.mail.bestRegards,
    gelymarTeam: translations.mail.gelymarTeam,
    internationalLogisticsServices: translations.mail.internationalLogisticsServices,
    contactEmail: 'info@gelymar.com',
    contactWebsite: 'www.gelymar.com',
    contactPhone: '+56 2 2345 6789',
    disclaimer: translations.mail.disclaimer
  };

  const htmlContent = template(templateData);

  const mailOptions = {
    from: `Gelymar <${process.env.SMTP_USER}>`,
    to: emails.join(','),
    subject: templateData.subject,
    html: htmlContent,
    attachments: [{
      filename: file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`,
      path: absolutePath
    }]
  };

  await transporter.sendMail(mailOptions);
}

async function translateNameOfDocument(name) {
  return DOC_NAME_MAP[name] || name;
}

module.exports = { sendFileToClient };
