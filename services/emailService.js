const { sendEmail } = require('../utils/mailer');
const { buildHtml, buildText } = require('../templates/email/appointmentNotification');
const { buildPatientHtml, buildPatientText } = require('../templates/email/patientConfirmation');

async function sendAdminNotification(citaData) {
  const adminEmail = process.env.EMAIL_ADMIN;
  if (!adminEmail) {
    console.warn('[email] EMAIL_ADMIN no definido. Correo admin NO enviado.');
    return { sent: false, reason: 'EMAIL_ADMIN no definido' };
  }

  if (!citaData.nombre_paciente) {
    console.warn('[email] Datos de cita incompletos. Correo admin NO enviado.');
    return { sent: false, reason: 'Datos de cita incompletos' };
  }

  console.log('[email] Intentando enviar correo admin...');

  const cc = citaData.medico_correo ? [citaData.medico_correo] : undefined;

  const result = await sendEmail({
    to: adminEmail,
    subject: `Nueva cita agendada - ${citaData.nombre_paciente}`,
    html: buildHtml(citaData),
    text: buildText(citaData),
    cc,
  });

  if (result.sent) {
    console.log(`[email] Admin: enviado a ${adminEmail}${cc ? `, CC: ${cc.join(', ')}` : ''} | ID: ${result.messageId}`);
  } else {
    console.error(`[email] Error enviando correo admin: ${result.reason}`);
  }

  return result;
}

async function sendPatientConfirmation(citaData) {
  const patientEmail = citaData.correo;
  if (!patientEmail) {
    console.warn('[email] Paciente sin correo. Confirmación NO enviada.');
    return { sent: false, reason: 'Paciente sin correo' };
  }

  console.log('[email] Intentando enviar confirmación al paciente...');

  const result = await sendEmail({
    to: patientEmail,
    subject: `Solicitud recibida - MediHome (Código: ${citaData.codigo_cita || ''})`,
    html: buildPatientHtml(citaData),
    text: buildPatientText(citaData),
  });

  if (result.sent) {
    console.log(`[email] Paciente: enviado a ${patientEmail} | ID: ${result.messageId}`);
  } else {
    console.error(`[email] Error enviando correo paciente: ${result.reason}`);
  }

  return result;
}

async function sendNewCitaNotification(citaData) {
  const adminResult = await sendAdminNotification(citaData);
  const patientResult = await sendPatientConfirmation(citaData);
  return { admin: adminResult, patient: patientResult };
}

module.exports = { sendNewCitaNotification, sendAdminNotification, sendPatientConfirmation };