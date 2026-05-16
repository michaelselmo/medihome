const { Resend } = require('resend');

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) {
    console.warn('[mailer] RESEND_API_KEY no configurada. Correos no disponibles.');
    return null;
  }
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

async function sendEmail({ to, subject, html, text, cc }) {
  const r = getClient();
  if (!r) {
    return { sent: false, reason: 'RESEND_API_KEY no configurada' };
  }

  if (!to) {
    return { sent: false, reason: 'Destinatario no especificado' };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    return { sent: false, reason: 'EMAIL_FROM no configurado' };
  }

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };

  if (cc && cc.length > 0) {
    payload.cc = Array.isArray(cc) ? cc : [cc];
  }

  try {
    const { data, error } = await r.emails.send(payload);
    if (error) {
      console.error(`[mailer] Error Resend: ${error.name || ''} ${error.message || ''}`);
      return { sent: false, reason: error.message || 'Error desconocido de Resend', code: error.name || 'RESEND_ERROR' };
    }
    return { sent: true, messageId: data?.id };
  } catch (err) {
    console.error(`[mailer] Error inesperado: ${err.message}`);
    return { sent: false, reason: err.message, code: err.code || 'UNEXPECTED' };
  }
}

module.exports = { sendEmail };