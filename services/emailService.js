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

  console.log("Intentando enviar correo al admin:", adminEmail);
  console.log('[email] Datos de cita:', JSON.stringify({ ...citaData, admin_url: undefined }));

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

  console.log("Intentando enviar correo al paciente:", patientEmail);

  const result = await sendEmail({
    to: patientEmail,
      subject: `Solicitud recibida - MediHomeRD (Código: ${citaData.codigo_cita || ''})`,
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
    console.log("Intentando enviar correo resultado al admin:", adminEmail);
    sendEmail({
      to: adminEmail,
      subject: 'Resultado medico registrado - ' + (resultData.codigo_cita || ''),
      html: '<div style="font-family:Inter,system-ui,sans-serif;padding:32px;max-width:560px;margin:0 auto;background:#ffffff">' +
        '<div style="background:linear-gradient(135deg,#0F172A 0%,#0EA5E9 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center">' +
        '<h2 style="color:#ffffff;margin:0;font-size:20px;font-weight:600">Resultado Medico Registrado</h2></div>' +
        '<div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">' +
        '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px 0">Se ha registrado un resultado medico para la cita <strong>' + (resultData.codigo_cita || '') + '</strong>.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;background:#f8fafc;width:100px">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:500">' + (resultData.nombre_paciente || '') + '</td></tr>' +
        '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;background:#f8fafc;width:100px">Archivo</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:500">' + (resultData.archivo_original || '') + '</td></tr>' +
        '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#64748b;background:#f8fafc;width:100px">Nota</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:500">' + (resultData.nota || 'Sin nota') + '</td></tr>' +
        '</table></div>' +
        '<div style="padding:16px;text-align:center;border-top:1px solid #e2e8f0;margin-top:0">' +
        '<p style="font-size:12px;color:#94a3b8;margin:0">MediHomeRD &mdash; Plataforma de Salud Digital</p></div></div>',
      text: 'Resultado medico registrado para ' + (resultData.nombre_paciente || '') + ' - Cita: ' + (resultData.codigo_cita || '') + '\n\nMediHomeRD - Plataforma de Salud Digital',
    }).catch(function(err) { console.error("Error enviando correo resultado al admin:", err.reason || err); });
  }

  const patientEmail = resultData.correo;
  if (patientEmail) {
    console.log("Intentando enviar correo resultado al paciente:", patientEmail);
    sendEmail({
      to: patientEmail,
      subject: 'Su resultado medico ha sido registrado - MediHomeRD',
      html: '<div style="font-family:Inter,system-ui,sans-serif;padding:32px;max-width:560px;margin:0 auto;background:#ffffff">' +
        '<div style="background:linear-gradient(135deg,#0F172A 0%,#0EA5E9 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center">' +
        '<h2 style="color:#ffffff;margin:0;font-size:20px;font-weight:600">Resultado Medico Disponible</h2></div>' +
        '<div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">' +
        '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px 0">Su resultado medico para la cita <strong>' + (resultData.codigo_cita || '') + '</strong> ha sido registrado.</p>' +
        '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0">Puede contactar a su medico para obtener mas informacion sobre los resultados.</p></div>' +
        '<div style="padding:16px;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">' +
        '<p style="font-size:12px;color:#94a3b8;margin:0">MediHomeRD &mdash; Plataforma de Salud Digital</p></div></div>',
      text: 'Su resultado medico para la cita ' + (resultData.codigo_cita || '') + ' ha sido registrado. Contacte a su medico para mas informacion.\n\nMediHomeRD - Plataforma de Salud Digital',
    }).catch(function(err) { console.error("Error enviando correo resultado al paciente:", err.reason || err); });
  }
}

module.exports = { sendNewCitaNotification, sendAdminNotification, sendPatientConfirmation, sendResultadoNotification };