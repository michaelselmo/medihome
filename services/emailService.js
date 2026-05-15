const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_APP_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`[emailService] Variables .env faltantes: ${missing.join(', ')}. Correos no disponibles.`);
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

function buildHtmlFromTemplate(data) {
  const templatePath = path.join(__dirname, '..', 'templates', 'emailCita.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  const replacements = {
    PACIENTE_NOMBRE: data.nombre_paciente || '—',
    PACIENTE_TELEFONO: data.telefono || '—',
    PACIENTE_CORREO: data.correo || '—',
    SERVICIO_NOMBRE: data.servicio_nombre || '—',
    MEDICO_NOMBRE: data.medico_nombre || 'Por asignar',
    FECHA_CITA: data.fecha || '—',
    HORA_CITA: data.hora || '—',
    DIRECCION: data.direccion || '—',
    CIUDAD: data.ciudad || '—',
    MODALIDAD: data.modalidad || 'domicilio',
    COMENTARIO: data.comentario || '—',
    CODIGO_CITA: data.codigo_cita || '—',
    FECHA_REGISTRO: data.created_at || new Date().toISOString(),
    ESTADO: data.estado || 'pendiente',
    ADMIN_URL: data.admin_url || 'http://localhost:3000/admin.html',
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return html;
}

function buildTextFallback(data) {
  return [
    `Nueva cita agendada en MediHome`,
    `================================`,
    `Paciente: ${data.nombre_paciente || '—'}`,
    `Teléfono: ${data.telefono || '—'}`,
    `Correo: ${data.correo || '—'}`,
    `Servicio: ${data.servicio_nombre || '—'}`,
    `Doctor: ${data.medico_nombre || 'Por asignar'}`,
    `Fecha: ${data.fecha || '—'}`,
    `Hora: ${data.hora || '—'}`,
    `Dirección: ${data.direccion || '—'}`,
    `Ciudad: ${data.ciudad || '—'}`,
    `Modalidad: ${data.modalidad || 'domicilio'}`,
    `Comentario: ${data.comentario || '—'}`,
    `Código: ${data.codigo_cita || '—'}`,
    `Registrado: ${data.created_at || '—'}`,
    `Estado: ${data.estado || 'pendiente'}`,
    ``,
    `Panel admin: ${data.admin_url || 'http://localhost:3000/admin.html'}`,
  ].join('\n');
}

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

  const html = buildHtmlFromTemplate(citaData);
  const text = buildTextFallback(citaData);

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
