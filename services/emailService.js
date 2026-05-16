const { getTransporter } = require('../utils/mailer');
const { buildHtml, buildText } = require('../templates/email/appointmentNotification');
const { buildPatientHtml, buildPatientText } = require('../templates/email/patientConfirmation');

async function sendAdminNotification(citaData) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] Transporter no configurado. Correo admin NO enviado.');
    return { sent: false, reason: 'SMTP no configurado' };
  }

  const adminEmail = process.env.EMAIL_ADMIN;
  if (!adminEmail) {
    console.warn('[email] EMAIL_ADMIN no definido. Correo admin NO enviado.');
    return { sent: false, reason: 'EMAIL_ADMIN no definido' };
  }

  const html = buildHtml(citaData);
  const text = buildText(citaData);

  const mailOptions = {
    from: `"MediHome" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `Nueva cita agendada - ${citaData.nombre_paciente || 'Paciente'}`,
    html,
    text,
  };

  if (citaData.medico_correo) {
    mailOptions.cc = citaData.medico_correo;
  }

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[email] Admin: enviado a ${adminEmail}${mailOptions.cc ? `, CC: ${mailOptions.cc}` : ''} | ID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const code = err.code || 'UNKNOWN';
    console.error(`[email] Error enviando correo admin: código=${code} mensaje=${err.message}`);
    return { sent: false, reason: err.message, code };
  }
}

async function sendPatientConfirmation(citaData) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] Transporter no configurado. Correo paciente NO enviado.');
    return { sent: false, reason: 'SMTP no configurado' };
  }

  const patientEmail = citaData.correo;
  if (!patientEmail) {
    console.warn('[email] Paciente sin correo. Correo NO enviado.');
    return { sent: false, reason: 'Paciente sin correo' };
  }

  const html = buildPatientHtml(citaData);
  const text = buildPatientText(citaData);

  const mailOptions = {
    from: `"MediHome" <${process.env.EMAIL_USER}>`,
    to: patientEmail,
    subject: `Solicitud recibida - MediHome (Código: ${citaData.codigo_cita || ''})`,
    html,
    text,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[email] Paciente: enviado a ${patientEmail} | ID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const code = err.code || 'UNKNOWN';
    console.error(`[email] Error enviando correo paciente: código=${code} mensaje=${err.message}`);
    return { sent: false, reason: err.message, code };
  }
}

async function sendNewCitaNotification(citaData) {
  const adminResult = await sendAdminNotification(citaData);
  const patientResult = await sendPatientConfirmation(citaData);
  return { admin: adminResult, patient: patientResult };
}

module.exports = { sendNewCitaNotification, sendAdminNotification, sendPatientConfirmation };