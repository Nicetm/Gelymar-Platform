const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Handlebars = require('handlebars');
const { poolPromise } = require('../config/db');

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

  const normalizeEmail = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
  };

  const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1';
    }
    return false;
  };

  const getValidationMode = () => (String(file?.is_generated) === '0' ? 0 : 1);

  const canContactReceive = (contact, mode = getValidationMode()) => {
    if (!contact) return true;

    const shEnabled = contact.sh_documents === true;
    const reportsEnabled = contact.reports === true;

    if (!shEnabled && !reportsEnabled) {
      return false;
    }

    if (mode === 0) {
      return shEnabled;
    }

    return reportsEnabled;
  };

  const createPermissionError = (mode, blockedEmails = []) => {
    const error = new Error('EMAIL_PERMISSION_DENIED');
    error.name = 'EmailPermissionError';
    error.validationMode = mode;
    error.blockedEmails = blockedEmails;
    return error;
  };

  let cachedContacts = null;

  const loadContacts = async () => {
    if (cachedContacts) return cachedContacts;

    if (!file.customer_id) {
      throw new Error('No se proporcionó customer_id para obtener contactos');
    }

    try {
      const pool = await poolPromise;
      const [contactRows] = await pool.query(
        'SELECT contact_email FROM customer_contacts WHERE customer_id = ?',
        [file.customer_id]
      );

      const parseContacts = (raw) => {
        if (!raw) return [];

        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch (error) {
            console.error('Error parseando contact_email JSON:', error);
            return [];
          }
        }

        return Array.isArray(raw) ? raw : [];
      };

      const contacts = contactRows
        .flatMap((row) => parseContacts(row.contact_email))
        .map((contact) => ({
          email: normalizeEmail(contact?.email ?? contact?.contact_email ?? contact?.primary_email),
          sh_documents: toBoolean(contact?.sh_documents),
          reports: toBoolean(contact?.reports),
        }))
        .filter((contact) => contact.email);

      cachedContacts = contacts;
      return cachedContacts;
    } catch (error) {
      console.error('Error obteniendo contactos del cliente:', error);
      throw error;
    }
  };

  let emails = [];

  if (overrideRecipients && overrideRecipients.length) {
    const uniqueOverrides = Array.from(
      new Set(
        overrideRecipients
          .map((email) => (typeof email === 'string' ? email.trim() : ''))
          .filter(Boolean)
      )
    );

    const contacts = await loadContacts();
    const validationMode = getValidationMode();
    const contactsMap = new Map(
      contacts.map((contact) => [contact.email.toLowerCase(), contact])
    );

    const blocked = new Set();
    const allowed = [];

    uniqueOverrides.forEach((email) => {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) return;

      const contact = contactsMap.get(normalizedEmail.toLowerCase());
      if (contact) {
        if (canContactReceive(contact, validationMode)) {
          allowed.push(normalizedEmail);
        } else {
          blocked.add(normalizedEmail);
        }
      } else {
        allowed.push(normalizedEmail);
      }
    });

    if (blocked.size) {
      throw createPermissionError(validationMode, Array.from(blocked));
    }

    emails = allowed;
  } else {
    const contacts = await loadContacts();
    if (!contacts.length) {
      throw new Error('No hay emails disponibles para enviar el correo');
    }

    const validationMode = getValidationMode();
    const allowedContacts = contacts.filter((contact) => canContactReceive(contact, validationMode));

    if (!allowedContacts.length) {
      const blockedEmails = contacts
        .map((contact) => (contact.email ? contact.email.trim() : ''))
        .filter(Boolean);
      throw createPermissionError(validationMode, blockedEmails);
    }

    emails = allowedContacts.map((contact) => contact.email);
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
