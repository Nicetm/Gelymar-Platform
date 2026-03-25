const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
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
    minVersion: 'TLSv1.2',
    ciphers: 'HIGH:!aNULL:!MD5'
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5
});

const DOC_NAME_MAP = {
  'Order Receipt Notice': 'Aviso de Recepción de Orden',
  'Shipment Notice': 'Aviso de Embarque',
  'Order Delivery Notice': 'Aviso de Entrega',
  'Availability Notice': 'Aviso de Disponibilidad de Orden',
};

// Pre-compiled templates cache
const compiledTemplates = {};
const translations = {};

// Load and compile templates on startup
const loadTemplates = () => {
  try {
    const templateDir = path.join(__dirname, '../mail-generator/template');
    const templateFiles = ['document.hbs', 'chat.hbs', 'notifications-summary.hbs', 'password-reset.hbs'];
    
    templateFiles.forEach(file => {
      const templatePath = path.join(templateDir, file);
      if (fs.existsSync(templatePath)) {
        const content = fs.readFileSync(templatePath, 'utf8');
        const name = file.replace('.hbs', '');
        compiledTemplates[name] = Handlebars.compile(content);
      }
    });
    
    const { logger } = require('../utils/logger');
    logger.info(`[EmailService] Loaded ${Object.keys(compiledTemplates).length} pre-compiled templates`);
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.error(`[EmailService] Error loading templates: ${error.message}`);
  }
};

// Load translations on startup
const loadTranslations = () => {
  try {
    const i18nDir = path.join(__dirname, '../mail-generator/i18n');
    const langFiles = fs.readdirSync(i18nDir).filter(f => f.endsWith('.json'));
    
    langFiles.forEach(file => {
      const lang = file.replace('.json', '');
      const content = fs.readFileSync(path.join(i18nDir, file), 'utf8');
      translations[lang] = JSON.parse(content);
    });
    
    const { logger } = require('../utils/logger');
    logger.info(`[EmailService] Loaded translations for ${Object.keys(translations).length} languages`);
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.error(`[EmailService] Error loading translations: ${error.message}`);
  }
};

// Initialize templates and translations
loadTemplates();
loadTranslations();

async function sendFileToClient(file, options = {}) {
  if (!file) {
    throw new Error('Faltan datos para enviar el correo');
  }

  let resolvedLang = file.lang || 'en';
  let overrideRecipients = null;
  let ccoRecipients = [];

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
    if (Array.isArray(options.ccoRecipients)) {
      ccoRecipients = options.ccoRecipients
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
    if (contact.cco === true) return true;

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

    let customerRut = file.customer_rut || file.rut || null;
    if (!customerRut && file.pc) {
      try {
        const { createOrderService } = require('./order.service');
        const { getOrderByPcOc, getOrderByPc } = createOrderService();
        const header = file.oc
          ? await getOrderByPcOc(String(file.pc), String(file.oc))
          : await getOrderByPc(String(file.pc));
        customerRut = header?.rut || header?.customer_uuid || header?.customer_rut || null;
      } catch (lookupError) {
        const { logger } = require('../utils/logger');
        logger.error(`[EmailService] Error obteniendo rut desde SQL por pc/oc: ${lookupError.message}`);
      }
    }
    if (!customerRut && file.customer_id) {
      customerRut = String(file.customer_id).trim();
    }
    if (!customerRut) {
      throw new Error(`No se proporcionó rut para obtener contactos (pc=${file.pc || 'N/A'} oc=${file.oc || 'N/A'})`);
    }

    try {
      const pool = await poolPromise;
      const [contactRows] = await pool.query(
        'SELECT contact_email FROM customer_contacts WHERE rut = ?',
        [customerRut]
      );

      const parseContacts = (raw) => {
        if (!raw) return [];

        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch (error) {
            const { logger } = require('../utils/logger');
            logger.error(`[EmailService] Error parseando contact_email JSON: ${error.message}`);
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
          cco: toBoolean(contact?.cco),
        }))
        .filter((contact) => contact.email);

      cachedContacts = contacts;
      return cachedContacts;
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error(`[EmailService] Error obteniendo contactos del cliente: ${error.message}`);
      throw error;
    }
  };

  let emails = [];

  let ccoFromContacts = [];

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
    ccoFromContacts = contacts.filter((c) => c.cco).map((c) => c.email).filter(Boolean);
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
    ccoFromContacts = contacts.filter((c) => c.cco).map((c) => c.email).filter(Boolean);
  }

  if (emails.length === 0) {
    throw new Error('No hay emails disponibles para enviar el correo');
  }

  const uniqueEmails = Array.from(new Set(emails));
  const bccList = ccoRecipients && ccoRecipients.length ? ccoRecipients : ccoFromContacts;
  const uniqueBcc = Array.from(new Set((bccList || []).filter(Boolean))).filter((email) => !uniqueEmails.includes(email));

  const relativePath = file.path.replace(/\\/g, '/');
  const absolutePath = path.join(process.env.FILE_SERVER_ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error('Archivo no encontrado en el servidor local');
  }

  const t = translations[resolvedLang] || translations.en || {};
  const template = compiledTemplates.document;
  
  if (!template) {
    throw new Error('Template "document" not found');
  }
  
  const filename = resolvedLang === 'en' ? file.name : await translateNameOfDocument(file.name);

  const templateData = {
    lang: resolvedLang,
    dear: t.mail?.dear || 'Dear',
    subject: `📄 Gelymar: ${filename}`,
    title: filename,
    logoUrl: 'https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg',
    customerName: file.customer_name,
    introMessage: t.mail?.introMessage || '',
    documentName: filename,
    logisticsManagement: t.mail?.logisticsManagement || '',
    gelymar: t.mail?.gelymar || 'Gelymar',
    pleaseFindAttached: t.mail?.pleaseFindAttached || '',
    correspondingTo: t.mail?.correspondingTo || '',
    documentContains: t.mail?.documentContains || '',
    questionsContact: t.mail?.questionsContact || '',
    bestRegards: t.mail?.bestRegards || 'Best regards',
    gelymarTeam: t.mail?.gelymarTeam || 'Gelymar Team',
    internationalLogisticsServices: t.mail?.internationalLogisticsServices || '',
    contactEmail: 'carla.torres@gelymar.com',
    contactWebsite: 'www.gelymar.com',
    contactPhone: '+56 9 9760 4855',
    disclaimer: t.mail?.disclaimer || ''
  };

  const htmlContent = template(templateData);

    const attachmentName = path.basename(absolutePath);
    const mailOptions = {
      from: `Gelymar <${process.env.SMTP_USER}>`,
      to: uniqueEmails.join(','),
      bcc: uniqueBcc.length ? uniqueBcc.join(',') : undefined,
      subject: templateData.subject,
      html: htmlContent,
      attachments: [{
        filename: attachmentName || (file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`),
        path: absolutePath
      }]
    };

  await transporter.sendMail(mailOptions);
}

async function sendChatNotification({
  adminEmail,
  adminName,
  customerName,
  message,
  portalUrl
}) {
  if (!adminEmail) {
    throw new Error('No se proporciono email de administrador');
  }

  const template = compiledTemplates.chat;
  
  if (!template) {
    throw new Error('Template "chat" not found');
  }

  const subject = 'Nuevo mensaje de chat - Gelymar';
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  const messageHtml = safeMessage ? safeMessage.replace(/\n/g, '<br />') : '-';

  const templateData = {
    subject,
    title: 'Nuevo mensaje de chat',
    adminName: adminName || 'Administrador',
    customerName: customerName || 'Cliente',
    messageHtml,
    portalUrl,
    logoUrl: 'https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg'
  };

  const htmlContent = template(templateData);

  const mailOptions = {
    from: `Gelymar <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject,
    html: htmlContent
  };

  await transporter.sendMail(mailOptions);
}

async function sendAdminNotificationSummary({
  adminEmail,
  adminName,
  summaryText,
  portalUrl,
  links = {}
}) {
  if (!adminEmail) {
    throw new Error('No se proporciono email de administrador');
  }

  const template = compiledTemplates['notifications-summary'];
  
  if (!template) {
    throw new Error('Template "notifications-summary" not found');
  }

  const subject = 'Recordatorio diario de tareas pendientes - Gelymar';
  const summaryHtml = (summaryText || '').replace(/\n/g, '<br />');

  const templateData = {
    subject,
    title: 'Tareas pendientes',
    adminName: adminName || 'Administrador',
    summaryHtml,
    portalUrl,
    ordersUrl: links.orders || '',
    clientsUrl: links.clients || '',
    logoUrl: 'https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg'
  };

  const htmlContent = template(templateData);

  const mailOptions = {
    from: `Gelymar <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject,
    html: htmlContent
  };

  await transporter.sendMail(mailOptions);
}

async function translateNameOfDocument(name) {
  return DOC_NAME_MAP[name] || name;
}

/**
 * Envía un solo correo con múltiples archivos adjuntos
 * @param {Array} files - Array de objetos file (de getFileById)
 * @param {Object} options - { recipients, ccoRecipients, lang }
 */
async function sendBulkFilesToClient(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('No hay archivos para enviar');
  }

  const resolvedLang = options.lang || files[0].lang || 'en';
  const overrideRecipients = Array.isArray(options.recipients)
    ? options.recipients.map(e => typeof e === 'string' ? e.trim() : '').filter(Boolean)
    : [];
  const ccoRecipients = Array.isArray(options.ccoRecipients)
    ? options.ccoRecipients.map(e => typeof e === 'string' ? e.trim() : '').filter(Boolean)
    : [];

  if (!overrideRecipients.length) {
    throw new Error('No hay destinatarios para enviar el correo');
  }

  // Build attachments and validate all files exist
  const attachments = [];
  const docNames = [];
  for (const file of files) {
    if (!file.path) continue;
    const relativePath = file.path.replace(/\\/g, '/');
    const absolutePath = path.join(process.env.FILE_SERVER_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      const { logger } = require('../utils/logger');
      logger.warn(`[sendBulkFilesToClient] Archivo no encontrado: ${absolutePath}`);
      continue;
    }
    const attachmentName = path.basename(absolutePath);
    attachments.push({
      filename: attachmentName || (file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`),
      path: absolutePath
    });
    const translated = resolvedLang === 'en' ? file.name : await translateNameOfDocument(file.name);
    docNames.push(translated);
  }

  if (attachments.length === 0) {
    throw new Error('Ninguno de los archivos fue encontrado en el servidor');
  }

  const t = translations[resolvedLang] || translations.en || {};
  const template = compiledTemplates.document;
  if (!template) {
    throw new Error('Template "document" not found');
  }

  const docListText = docNames.join(', ');
  const templateData = {
    lang: resolvedLang,
    dear: t.mail?.dear || 'Dear',
    subject: `📄 Gelymar: ${docListText}`,
    title: docListText,
    logoUrl: 'https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg',
    customerName: files[0].customer_name,
    introMessage: t.mail?.introMessage || '',
    documentName: docListText,
    logisticsManagement: t.mail?.logisticsManagement || '',
    gelymar: t.mail?.gelymar || 'Gelymar',
    pleaseFindAttached: t.mail?.pleaseFindAttached || '',
    correspondingTo: t.mail?.correspondingTo || '',
    documentContains: t.mail?.documentContains || '',
    questionsContact: t.mail?.questionsContact || '',
    bestRegards: t.mail?.bestRegards || 'Best regards',
    gelymarTeam: t.mail?.gelymarTeam || 'Gelymar Team',
    internationalLogisticsServices: t.mail?.internationalLogisticsServices || '',
    contactEmail: 'carla.torres@gelymar.com',
    contactWebsite: 'www.gelymar.com',
    contactPhone: '+56 9 9760 4855',
    disclaimer: t.mail?.disclaimer || ''
  };

  const htmlContent = template(templateData);
  const uniqueEmails = Array.from(new Set(overrideRecipients));
  const uniqueBcc = Array.from(new Set(ccoRecipients.filter(Boolean)))
    .filter(e => !uniqueEmails.includes(e));

  const mailOptions = {
    from: `Gelymar <${process.env.SMTP_USER}>`,
    to: uniqueEmails.join(','),
    bcc: uniqueBcc.length ? uniqueBcc.join(',') : undefined,
    subject: templateData.subject,
    html: htmlContent,
    attachments
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendFileToClient, sendBulkFilesToClient, sendChatNotification, sendAdminNotificationSummary };
