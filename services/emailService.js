const { getTransporter } = require('../utils/mailer');
const { buildHtml, buildText } = require('../templates/email/appointmentNotification');

async function sendNewCitaNotification(citaData) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] Transporter no configurado. Correo NO enviado.');
    return { sent: false, reason: 'SMTP no configurado' };
  }

  const adminEmail = process.env.EMAIL_ADMIN;
  if (!adminEmail) {
    console.warn('[email] EMAIL_ADMIN no definido. Correo NO enviado.');
    return { sent: false, reason: 'EMAIL_ADMIN no definido' };
  }

  console.log('[email] Variables de entorno:');
  ['EMAIL_HOST','EMAIL_PORT','EMAIL_USER','EMAIL_ADMIN','EMAIL_APP_PASSWORD'].forEach(v =>
    console.log(`  ${v}: ${process.env[v] ? 'sí' : 'no'}`)
  );

  const html = buildHtml(citaData);
  const text = buildText(citaData);

  const mailOptions = {
    from: `"MediHome" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `Nueva cita agendada en MediHome - ${citaData.nombre_paciente || 'Paciente'}`,
    html,
    text,
  };

  if (citaData.medico_correo) {
    mailOptions.cc = citaData.medico_correo;
  }

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[email] Correo enviado correctamente a ${adminEmail}${mailOptions.cc ? `, CC: ${mailOptions.cc}` : ''} | MessageID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const code = err.code || 'UNKNOWN';
    console.error(`[email] Error enviando correo: código=${code} mensaje=${err.message}`);
    return { sent: false, reason: err.message, code };
  }
}

module.exports = { sendNewCitaNotification };
