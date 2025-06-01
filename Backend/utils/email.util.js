const nodemailer = require('nodemailer');
require('dotenv').config();


async function sendEmail({ to, subject, html }) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_KEY
      }
    });

    await transporter.sendMail({
      from: `"Gelymar Panel" <onboarding@resend.dev>`,
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