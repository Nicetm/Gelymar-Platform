const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');

require('dotenv').config(); // Esto debe estar al inicio de tu app principal (app.js), si no lo tienes ya

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

async function sendFileToClient(file) {
  if (!file || !file.customer_email || !file.path) {
    throw new Error('Faltan datos para enviar el correo');
  }

  // Normalizamos el path de DB (que viene con backslash de Windows)
  const relativePath = file.path.replace(/\\/g, '/');

  // Armamos el path físico local
  const absolutePath = path.join(process.env.FILE_SERVER_ROOT, relativePath);

  // Validamos existencia
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Archivo no encontrado en el servidor local');
  }

  const mailOptions = {
    from: `Gelymar Documentos <${process.env.SMTP_USER}>`,
    to: `${file.customer_email},${file.contact_emails}`,
    subject: `📄 Documento Gelymar: ${file.name}`,
    text: `Dear ${file.customer_name},

We hope this message finds you well.

Please find attached the document "${file.name}" corresponding to your logistics management with Gelymar.

This document contains important information about your shipment and we recommend reviewing it carefully.

If you have any questions or need additional information, please do not hesitate to contact us.

Best regards,
Gelymar Team
International Logistics Services
📧 info@gelymar.com
🌐 www.gelymar.com
📞 +56 2 2345 6789

---
This is an automated email. Please do not reply to this message.`,
    html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg" alt="Gelymar Logo" style="max-width: 200px; height: auto;">
      </div>
      <div style="background: #FC8A00; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${file.name}</h1>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Dear <strong style="color: #013054;">${file.customer_name}</strong>,
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          We hope this message finds you well.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #FC8A00; margin: 20px 0;">
          <p style="font-size: 16px; line-height: 1.6; margin: 0;">
            Please find attached the document <strong style="color: #013054;">"${file.name}"</strong> corresponding to your logistics management with <strong>Gelymar</strong>.
          </p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          This document contains important information about your shipment and we recommend reviewing it carefully.
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          If you have any questions or need additional information, please do not hesitate to contact us.
        </p>
        
        <div style="border-top: 2px solid #e2e8f0; padding-top: 20px;">
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 5px;">
            <strong style="color: #FC8A00;">Best regards,</strong>
          </p>
          <p style="font-size: 18px; font-weight: bold; color: #FC8A00; margin: 5px 0;">
            Gelymar Team
          </p>
          <p style="font-size: 14px; color: #64748b; margin: 5px 0;">
            International Logistics Services
          </p>
        </div>
        
        <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin-top: 20px; text-align: center;">
          <p style="margin: 5px 0; font-size: 14px;">
            📧 <a href="mailto:info@gelymar.com" style="color: #FC8A00; text-decoration: none;">info@gelymar.com</a>
          </p>
          <p style="margin: 5px 0; font-size: 14px;">
            🌐 <a href="https://www.gelymar.com" style="color: #FC8A00; text-decoration: none;">www.gelymar.com</a>
          </p>
          <p style="margin: 5px 0; font-size: 14px;">
            📞 +56 2 2345 6789
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 20px; text-align: center;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0; font-style: italic;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>
    </div>`,
    attachments: [{
      filename: file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`,
      path: absolutePath
    }]
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendFileToClient };
