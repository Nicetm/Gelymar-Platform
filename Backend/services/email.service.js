const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');

require('dotenv').config(); // Esto debe estar al inicio de tu app principal (app.js), si no lo tienes ya

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
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
    from: 'Gelymar Documentos <onboarding@resend.dev>',
    to: `${file.customer_email},${file.contact_emails}`,
    subject: `Documento importante: ${file.name}`,
    text: `Estimado/a ${file.customer_name},\n\nLe enviamos adjunto el documento "${file.name}" correspondiente a su gestión con Gelymar.\n\nPor favor, revise el archivo y no dude en contactarnos si requiere información adicional.\n\nAtentamente,\nEquipo Gelymar\nwww.gelymar.com` ,
    html: `<div style="font-family: Arial, sans-serif; color: #222;">
      <p>Estimado/a <b>${file.customer_name}</b>,</p>
      <p>Le enviamos adjunto el documento <b>"${file.name}"</b> correspondiente a su gestión con <b>Gelymar</b>.</p>
      <p>Por favor, revise el archivo y no dude en contactarnos si requiere información adicional.</p>
      <br>
      <p style="margin-bottom:2px;">Atentamente,</p>
      <p style="font-weight:bold; color:#1d4ed8; margin:0;">Equipo Gelymar</p>
      <p style="margin:0; font-size:13px;">www.gelymar.com</p>
    </div>`,
    attachments: [{
      filename: file.name,
      path: absolutePath
    }]
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendFileToClient };
