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

async function sendResultadoNotification(resultData) {
  const adminEmail = process.env.EMAIL_ADMIN;
  if (adminEmail) {
    sendEmail({
      to: adminEmail,
      subject: 'Resultado medico registrado - ' + (resultData.codigo_cita || ''),
      html: '<div style="font-family:sans-serif;padding:24px;max-width:560px;margin:0 auto">' +
        '<h2 style="color:#0f172a">Resultado Medico Registrado</h2>' +
        '<p style="color:#475569">Se ha registrado un resultado medico para la cita <strong>' + (resultData.codigo_cita || '') + '</strong>.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#64748b">Paciente</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a">' + (resultData.nombre_paciente || '') + '</td></tr>' +
        '<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#64748b">Archivo</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a">' + (resultData.archivo_original || '') + '</td></tr>' +
        '<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#64748b">Nota</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a">' + (resultData.nota || 'Sin nota') + '</td></tr>' +
        '</table></div>',
      text: 'Resultado medico registrado para ' + (resultData.nombre_paciente || '') + ' - Cita: ' + (resultData.codigo_cita || ''),
    });
  }

  const patientEmail = resultData.correo;
  if (patientEmail) {
    sendEmail({
      to: patientEmail,
      subject: 'Su resultado medico ha sido registrado - MediHome',
      html: '<div style="font-family:sans-serif;padding:24px;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:12px">' +
        '<h2 style="color:#0f172a">Resultado Medico Disponible</h2>' +
        '<p style="color:#475569">Su resultado medico para la cita <strong>' + (resultData.codigo_cita || '') + '</strong> ha sido registrado.</p>' +
        '<p style="color:#475569">Puede contactar a su medico para obtener mas informacion sobre los resultados.</p>' +
        '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">' +
        '<p style="font-size:12px;color:#94a3b8">MediHome - Servicios Medicos a Domicilio</p></div>',
      text: 'Su resultado medico para la cita ' + (resultData.codigo_cita || '') + ' ha sido registrado. Contacte a su medico para mas informacion.',
    });
  }
}

module.exports = { sendNewCitaNotification, sendAdminNotification, sendPatientConfirmation, sendResultadoNotification };