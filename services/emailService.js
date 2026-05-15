const { getTransporter } = require('../utils/mailer');
const { buildHtml, buildText } = require('../templates/email/appointmentNotification');

async function sendNewCitaNotification(citaData) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[emailService] Transporter no configurado. Correo NO enviado.');
    return { sent: false, reason: 'SMTP no configurado' };
  }

  const adminEmail = process.env.EMAIL_ADMIN;
  if (!adminEmail) {
    console.warn('[emailService] EMAIL_ADMIN no definido. Correo NO enviado.');
    return { sent: false, reason: 'EMAIL_ADMIN no definido' };
  }

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
    console.log(`[emailService] Correo enviado a ${adminEmail}${mailOptions.cc ? `, CC: ${mailOptions.cc}` : ''} | MessageID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[emailService] Error al enviar correo:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendNewCitaNotification };
