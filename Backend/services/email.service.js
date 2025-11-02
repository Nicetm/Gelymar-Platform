const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Handlebars = require('handlebars');

// Las variables de entorno ya se cargan automÃ¡ticamente en app.js

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
  'Order Receipt Advice': 'Aviso de RecepciÃ³n de Orden',
  'Shipment Advice': 'Aviso de Embarque',
  'Order Delivery Advice': 'Aviso de Entrega',
  'Availability Advice': 'Aviso de Disponibilidad de Orden',
};

async function sendFileToClient(file, options = {}) {
  if (!file) {
    throw new Error('Faltan datos para enviar el correo');
  }

  let resolvedLang = file.lang || 'en';
  let overrideRecipients = null;

  if (typeof options === 'string') {
    resolvedLang = options || resolvedLang;
  } else if (options && typeof options === 'object') {
    if (options.lang) {
      resolvedLang = options.lang;
    }
    if (Array.isArray(options.recipients)) {
      overrideRecipients = options.recipients
        .map((email) => (typeof email === 'string' ? email.trim() : ''))
        .filter(Boolean);
    }
  }

  if (!file.path) {
    throw new Error('No hay emails disponibles para enviar el correo');
  }

  let emails = [];
  if (overrideRecipients && overrideRecipients.length) {
    emails = Array.from(new Set(overrideRecipients));
  } else {
    if (file.customer_email) emails.push(file.customer_email);
    if (file.contact_emails) {
      emails.push(
        ...file.contact_emails
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean)
      );
    }
  }

  if (emails.length === 0) {
    throw new Error('No hay emails disponibles para enviar el correo');
  }

  const uniqueEmails = Array.from(new Set(emails));

  const relativePath = file.path.replace(/\\/g, '/');
  const absolutePath = path.join(process.env.FILE_SERVER_ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error('Archivo no encontrado en el servidor local');
  }

  const translationsPath = path.join(__dirname, '../mail-generator/i18n', `${resolvedLang}.json`);
  const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

  const templatePath = path.join(__dirname, '../mail-generator/template/document.hbs');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);
  const filename = resolvedLang === 'en' ? file.name : await translateNameOfDocument(file.name);

  const templateData = {
    lang: resolvedLang,
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
    to: uniqueEmails.join(','),
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
