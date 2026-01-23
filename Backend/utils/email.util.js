const nodemailer = require('nodemailer');
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

async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: `Gelymar <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error('❌ Error enviando correo:', err);
    throw new Error('Fallo en envío de correo');
  }
}

module.exports = { sendEmail };
