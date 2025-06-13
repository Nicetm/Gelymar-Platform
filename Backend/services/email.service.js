const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.RESEND_KEY
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
    from: '"Gelymar Documentos" <onboarding@resend.dev>',
    to: `${file.customer_email},${file.contact_emails}`,
    subject: `Documento ${file.name}`,
    text: `Estimado cliente, adjunto encontrará el documento ${file.name}`,
    attachments: [{
      filename: file.name,
      path: absolutePath
    }]
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendFileToClient };
