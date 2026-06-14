const { escHtml } = require("./validators");

function buildDoctorAssignmentEmail(d) {
  var modalidadIcon = d.modalidad === "telemedicina" ? "📹" : "🏠";
  var modalidadLabel = d.modalidad === "telemedicina" ? "Telemedicina" : "A Domicilio";
  return (
    '<div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.04)">' +
    '<div style="background:linear-gradient(135deg,#2563eb,#0ea5e5);padding:28px 32px;text-align:center">' +
    '<div style="font-size:2rem;margin-bottom:8px">🏥</div>' +
    '<h1 style="color:#ffffff;font-size:1.3rem;margin:0;font-weight:700;letter-spacing:-0.3px">Nueva Cita Asignada</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:0.85rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>' +
    '<div style="padding:28px 32px">' +
    '<p style="color:#0f172a;font-size:0.95rem;margin:0 0 20px">Se le ha asignado una nueva cita médica. A continuación los detalles:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:120px;font-weight:600">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(d.nombre_paciente) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Código</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#2563eb;font-weight:700">' + escHtml(d.codigo_cita) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(d.servicio_nombre) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Fecha</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(d.fecha) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Hora</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(d.hora) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Modalidad</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + modalidadIcon + " " + modalidadLabel + "</td></tr>" +
    (d.direccion ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Dirección</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(d.direccion) + (d.ciudad ? ", " + escHtml(d.ciudad) : "") + "</td></tr>" : "") +
    (d.comentario ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Comentarios</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(d.comentario) + "</td></tr>" : "") +
    "</table>" +
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:20px">' +
    '<p style="margin:0;color:#166534;font-size:0.8rem"><strong>💡 Recordatorio:</strong> Puede gestionar esta cita desde su panel de médico. Ingrese los resultados y observaciones después de atender al paciente.</p></div>' +
    '<a href="' + escHtml(process.env.PUBLIC_URL || "http://localhost:3000") + '/medico.html" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#0ea5e5);color:white;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-size:0.9rem">Ir al Panel Médico</a></div>' +
    '<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>'
  );
}

function buildDoctorAssignmentText(d) {
  var modalidadLabel = d.modalidad === "telemedicina" ? "Telemedicina" : "A Domicilio";
  return (
    "NUEVA CITA ASIGNADA\n\n" +
    "Se le ha asignado una nueva cita médica.\n\n" +
    "Paciente: " + (d.nombre_paciente || "") + "\n" +
    "Código: " + (d.codigo_cita || "") + "\n" +
    "Servicio: " + (d.servicio_nombre || "") + "\n" +
    "Fecha: " + (d.fecha || "") + "\n" +
    "Hora: " + (d.hora || "") + "\n" +
    "Modalidad: " + modalidadLabel + "\n" +
    (d.direccion ? "Dirección: " + d.direccion + (d.ciudad ? ", " + d.ciudad : "") + "\n" : "") +
    (d.comentario ? "Comentarios: " + d.comentario + "\n" : "") +
    "\nPuede gestionar esta cita desde su panel de médico.\n" +
    (process.env.PUBLIC_URL || "http://localhost:3000") + "/medico.html\n"
  );
}

module.exports = { buildDoctorAssignmentEmail, buildDoctorAssignmentText };
