const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn('[mailer] EMAIL_HOST o EMAIL_USER no configurados. Correos no disponibles.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS,
    },
  });
  return transporter;
}

async function sendEmail({ to, subject, html, text, cc }) {
  const t = getTransporter();
  if (!t) {
    return { sent: false, reason: 'Correo no configurado' };
  }

  if (!to) {
    return { sent: false, reason: 'Destinatario no especificado' };
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!from) {
    return { sent: false, reason: 'EMAIL_FROM no configurado' };
  }

  console.log("Intentando enviar correo al destinatario:", to);

  try {
    const info = await t.sendMail({
      from: `"MediHomeRD" <${from}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
    });
    console.log("Correo enviado correctamente - ID:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("Error enviando correo:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendEmail };