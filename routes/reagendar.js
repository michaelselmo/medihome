const { db } = require("../db/database");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const { escHtml } = require("../utils/validators");

function crearNotificacion(usuarioId, titulo, mensaje, tipo, cb) {
  db.run("INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?,?,?,?)", [usuarioId, titulo, mensaje || "", tipo || "info"], cb);
}

module.exports = function(app) {
app.put("/api/admin/citas/:id/reprogramar", authMiddleware, (req, res) => {
  const { fecha, hora, motivo } = req.body;
  if (!fecha || !hora)
    return res.status(400).json({ error: "Fecha y hora requeridas" });

  db.get("SELECT * FROM citas WHERE id=?", [req.params.id], (err, cita) => {
    if (err || !cita)
      return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.estado === "completada" || cita.estado === "cancelada") {
      return res.status(400).json({
        error: "No se puede reprogramar una cita completada o cancelada",
      });
    }

    // Crear nueva cita con los mismos datos pero nueva fecha/hora
    db.run(
      `INSERT INTO citas (codigo_cita, nombre_paciente, cedula, telefono, correo, direccion, ciudad,
      servicio_id, fecha, hora, modalidad, ars, comentario, estado, medico_id, reprogramada_de)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cita.codigo_cita + "-R",
        cita.nombre_paciente,
        cita.cedula,
        cita.telefono,
        cita.correo,
        cita.direccion,
        cita.ciudad,
        cita.servicio_id,
        fecha,
        hora,
        cita.modalidad,
        cita.ars,
        (motivo || "Reprogramada") +
          (cita.comentario ? " | " + cita.comentario : ""),
        "pendiente",
        cita.medico_id,
        cita.id,
      ],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        // Cancelar cita original
        db.run(
          "UPDATE citas SET estado='cancelada', updated_at=CURRENT_TIMESTAMP WHERE id=?",
          [cita.id],
        );

        // Notificar a admins
        db.all(
          "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
          [],
          function (err3, admins) {
            if (err3 || !admins) return;
            var stmt = db.prepare(
              "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
            );
            admins.forEach(function (a) {
              stmt.run(
                a.id,
                "Cita reprogramada",
                "Cita de " +
                  cita.nombre_paciente +
                  " reprogramada para " +
                  fecha +
                  " " +
                  hora,
                "cita_reprogramada",
                cita.id,
                cita.nombre_paciente,
                "",
              );
            });
            stmt.finalize();
          },
        );

        res.json({
          id: this.lastID,
          mensaje:
            "Cita reprogramada correctamente. Se ha generado una nueva cita.",
        });
      },
    );
  });
});

// ── REAGENDAR CITA (actualiza en-place) ──

app.put("/api/admin/citas/:id/reagendar", authMiddleware, (req, res) => {
  const { nueva_fecha, nueva_hora, medico_id, motivo } = req.body;
  if (!nueva_fecha || !nueva_hora || !medico_id) {
    return res.status(400).json({ error: "Todos los campos son obligatorios: nueva_fecha, nueva_hora, medico_id" });
  }
  const motivoFinal = motivo || "Reagendamiento administrativo";

  db.get(
    "SELECT c.*, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=?",
    [req.params.id],
    (err, cita) => {
    if (err || !cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.estado === "completada" || cita.estado === "cancelada") {
      return res.status(400).json({ error: "No se puede reagendar una cita completada o cancelada" });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const nuevaFechaObj = new Date(nueva_fecha + "T12:00:00");
    if (nuevaFechaObj < hoy) {
      return res.status(400).json({ error: "No se puede reagendar a una fecha pasada" });
    }

    const oldFecha = cita.fecha;
    const oldHora = cita.hora;

    db.get("SELECT nombre FROM medicos WHERE id=?", [medico_id], (err, medicoNuevo) => {
      if (err || !medicoNuevo) return res.status(400).json({ error: "Médico no encontrado" });

      // Validar doble reserva del mismo médico en la misma fecha y hora
      db.get(
        "SELECT id FROM citas WHERE medico_id=? AND fecha=? AND hora=? AND estado NOT IN ('cancelada','completada') AND id!=?",
        [medico_id, nueva_fecha, nueva_hora, req.params.id],
        (err2, conflicto) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (conflicto) {
            return res.status(400).json({ error: "El médico ya tiene una cita en esa fecha y hora" });
          }

          const adminNombre = req.admin ? req.admin.nombre || req.admin.usuario || "Administrador" : "Administrador";
          const oldMedicoNombre = cita.medico_nombre || "No asignado";

          // Actualizar la cita
          db.run(
            "UPDATE citas SET fecha=?, hora=?, medico_id=?, estado='reagendada', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            [nueva_fecha, nueva_hora, medico_id, req.params.id],
            function (err3) {
              if (err3) return res.status(500).json({ error: err3.message });

              // Registrar en el historial
              const historial = JSON.stringify({
                tipo: "reagendada",
                fecha_anterior: oldFecha,
                hora_anterior: oldHora,
                medico_anterior: oldMedicoNombre,
                medico_anterior_id: cita.medico_id,
                fecha_nueva: nueva_fecha,
                hora_nueva: nueva_hora,
                medico_nuevo: medicoNuevo.nombre,
                medico_nuevo_id: medico_id,
                motivo: motivoFinal,
                realizado_por: adminNombre,
                fecha_cambio: new Date().toISOString(),
              });
              db.run(
                "INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
                [req.params.id, "reagendamiento", historial, adminNombre],
                function () {
                  // Enviar notificaciones a admins
                  db.all("SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'", [], (err4, admins) => {
                    if (admins && admins.length > 0) {
                      const stmt = db.prepare(
                        "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)"
                      );
                      admins.forEach(function (a) {
                        stmt.run(a.id,
                          "Cita reagendada",
                          "Cita de " + cita.nombre_paciente + " reagendada de " + oldFecha + " " + cita.hora + " a " + nueva_fecha + " " + nueva_hora + ". Motivo: " + motivoFinal,
                          "cita_reagendada",
                          parseInt(req.params.id),
                          cita.nombre_paciente,
                          cita.servicio_nombre || ""
                        );
                      });
                      stmt.finalize();
                    }
                  });

                  // Notificar al nuevo médico (in-app + email)
                  db.get("SELECT * FROM medicos WHERE id=? AND activo=1", [medico_id], (err5, med) => {
                    if (med) {
                      db.get("SELECT id FROM usuarios_admin WHERE medico_id=? AND activo=1 LIMIT 1", [medico_id], (err6, userMed) => {
                        if (userMed) {
                          crearNotificacion(userMed.id,
                            "Cita reagendada - " + cita.nombre_paciente,
                            "Se le ha reasignado la cita " + (cita.codigo_cita || "") + " para " + cita.nombre_paciente + " el " + nueva_fecha + " a las " + nueva_hora + ". Motivo: " + motivoFinal,
                            "cita_reagendada"
                          );
                        }
                      });

                      // Enviar email al médico
                      if (med.correo) {
                        const { sendEmail } = require("../utils/mailer");
                        const cambioMedico = parseInt(medico_id) !== parseInt(cita.medico_id);
                        sendEmail({
                          to: med.correo,
                          subject: "Cita reagendada - " + cita.nombre_paciente + " - MediHomeRD",
                          html: buildRescheduleDoctorEmail(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                          text: buildRescheduleDoctorText(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                        });
                      }
                    }
                  });

                  // Notificar al paciente (email)
                  if (cita.correo) {
                    const { sendEmail } = require("../utils/mailer");
                    const cambioMedico = parseInt(medico_id) !== parseInt(cita.medico_id);
                    sendEmail({
                      to: cita.correo,
                      subject: "Su cita ha sido reagendada - MediHomeRD (Código: " + (cita.codigo_cita || "") + ")",
                      html: buildReschedulePatientEmail(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                      text: buildReschedulePatientText(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                    });
                  }

                  res.json({
                    mensaje: "Cita reagendada correctamente",
                    cita: {
                      id: parseInt(req.params.id),
                      fecha_anterior: oldFecha,
                      hora_anterior: oldHora,
                      medico_anterior: oldMedicoNombre,
                      nueva_fecha: nueva_fecha,
                      nueva_hora: nueva_hora,
                      nuevo_medico: medicoNuevo.nombre,
                      estado: "reagendada",
                    },
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

function buildRescheduleDoctorEmail(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var cambioMedicoLine = cambioMedico
    ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nuevo Médico</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(medicoNombre) + "</td></tr>"
    : "";
  var headerTitle = cambioMedico ? "Cita Reagendada - Nuevo Médico Asignado" : "Cita Reagendada";
  return (
    '<div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.04)">' +
    '<div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;text-align:center">' +
    '<div style="font-size:2rem;margin-bottom:8px">📅</div>' +
    '<h1 style="color:#ffffff;font-size:1.3rem;margin:0;font-weight:700;letter-spacing:-0.3px">' + headerTitle + '</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:0.85rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>' +
    '<div style="padding:28px 32px">' +
    '<p style="color:#0f172a;font-size:0.95rem;margin:0 0 20px">Se ha reagendado una cita. A continuación los nuevos detalles:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:120px;font-weight:600">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(cita.nombre_paciente) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Código</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#2563eb;font-weight:700">' + escHtml(cita.codigo_cita) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(cita.servicio_nombre) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Fecha</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaFecha) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Hora</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaHora) + "</td></tr>" +
    cambioMedicoLine +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Motivo</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-style:italic">' + escHtml(motivo) + "</td></tr>" +
    "</table>" +
    '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:16px 20px"><p style="margin:0;color:#92400e;font-size:0.8rem">💡 La cita original fue reagendada. Consulte el panel médico para ver los detalles actualizados.</p></div></div>' +
    '<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>'
  );
}

function buildRescheduleDoctorText(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var lines = [
    "CITA REAGENDADA",
    "================",
    "",
    (cambioMedico ? "Se le ha reasignado una cita reagendada." : "Una cita ha sido reagendada."),
    "",
    "Paciente: " + cita.nombre_paciente,
    "Código: " + (cita.codigo_cita || ""),
    "Servicio: " + (cita.servicio_nombre || ""),
    "Nueva Fecha: " + nuevaFecha,
    "Nueva Hora: " + nuevaHora,
    cambioMedico ? "Nuevo Médico: " + medicoNombre : "",
    "Motivo: " + motivo,
    "",
    "MediHomeRD — Plataforma de Salud Digital",
  ];
  return lines.filter(Boolean).join("\n");
}

function buildReschedulePatientEmail(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var cambioMedicoLine = cambioMedico
    ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Médico</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(medicoNombre) + "</td></tr>"
    : "";
  return (
    '<div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.04)">' +
    '<div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;text-align:center">' +
    '<div style="font-size:2rem;margin-bottom:8px">📅</div>' +
    '<h1 style="color:#ffffff;font-size:1.3rem;margin:0;font-weight:700;letter-spacing:-0.3px">Su cita ha sido reagendada</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:0.85rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>' +
    '<div style="padding:28px 32px">' +
    '<p style="color:#0f172a;font-size:0.95rem;margin:0 0 20px">Su cita ha sido reagendada con los siguientes nuevos detalles:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:120px;font-weight:600">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(cita.nombre_paciente) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Código</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#2563eb;font-weight:700">' + escHtml(cita.codigo_cita) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(cita.servicio_nombre) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Fecha</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaFecha) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Hora</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaHora) + "</td></tr>" +
    cambioMedicoLine +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Motivo</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-style:italic">' + escHtml(motivo) + "</td></tr>" +
    "</table>" +
    '<p style="color:#64748b;font-size:0.82rem;margin:0 0 16px">Si tiene alguna pregunta, contáctenos al <strong>+1 (829) 901-7488</strong>.</p>' +
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;text-align:center">' +
    '<p style="margin:0;color:#166534;font-size:0.8rem">Puede dar seguimiento a su cita usando el código <strong>' + escHtml(cita.codigo_cita) + '</strong> en nuestra plataforma.</p></div></div>' +
    '<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>'
  );
}

function buildReschedulePatientText(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var lines = [
    "SU CITA HA SIDO REAGENDADA",
    "===========================",
    "",
    "Estimado/a " + cita.nombre_paciente + ", su cita ha sido reagendada.",
    "",
    "Nuevos detalles:",
    "Código: " + (cita.codigo_cita || ""),
    "Servicio: " + (cita.servicio_nombre || ""),
    "Nueva Fecha: " + nuevaFecha,
    "Nueva Hora: " + nuevaHora,
    cambioMedico ? "Médico: " + medicoNombre : "",
    "Motivo: " + motivo,
    "",
    "Si tiene alguna pregunta, contáctenos al +1 (829) 901-7488",
    "",
    "MediHomeRD — Plataforma de Salud Digital",
  ];
  return lines.filter(Boolean).join("\n");
}

// ── CALENDARIO DE DISPONIBILIDAD (vista mensual) ──

app.get("/api/admin/reagendar/calendario", authMiddleware, (req, res) => {
  const { servicio_id, medico_id, year, month } = req.query;
  if (!servicio_id || !year || month === undefined) {
    return res.status(400).json({ error: "servicio_id, year y month son requeridos" });
  }

  const y = parseInt(year);
  const m = parseInt(month);
  const diasEnMes = new Date(y, m + 1, 0).getDate();
  const results = [];

  // Obtener la disponibilidad del servicio por día de semana
  db.all(
    "SELECT dia_semana FROM disponibilidad WHERE servicio_id=? AND activo=1 GROUP BY dia_semana",
    [servicio_id],
    (err, diasDisponibles) => {
      if (err) return res.status(500).json({ error: err.message });

      const diasSemanaSet = {};
      (diasDisponibles || []).forEach(function (d) { diasSemanaSet[d.dia_semana] = true; });

      // Obtener excepciones del servicio para el mes
      const primerDia = y + "-" + String(m + 1).padStart(2, "0") + "-01";
      const ultimoDia = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(diasEnMes).padStart(2, "0");
      db.all(
        "SELECT fecha FROM disponibilidad_excepciones WHERE servicio_id=? AND fecha>=? AND fecha<=? AND activo=1 AND tipo='no_disponible'",
        [servicio_id, primerDia, ultimoDia],
        (err2, excepciones) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const excSet = {};
          (excepciones || []).forEach(function (e) {
            if (e.fecha) excSet[e.fecha] = true;
          });

          // Si hay medico_id, obtener sus citas en este mes (para detectar días completamente ocupados)
          var citasMedico = {};
          var cargoMedico = false;
          if (medico_id) {
            cargoMedico = true;
            db.all(
              "SELECT fecha, COUNT(*) as count FROM citas WHERE medico_id=? AND fecha>=? AND fecha<=? AND estado NOT IN ('cancelada','completada') GROUP BY fecha",
              [medico_id, primerDia, ultimoDia],
              (err3, ocupadas) => {
                if (err3) return res.status(500).json({ error: err3.message });
                (ocupadas || []).forEach(function (o) {
                  citasMedico[o.fecha] = o.count;
                });
                construirCalendario();
              }
            );
          }

          function construirCalendario() {
            for (let d = 1; d <= diasEnMes; d++) {
              const dateStr = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
              const dateObj = new Date(dateStr + "T12:00:00");
              const dow = dateObj.getDay();
              const isPast = dateObj <= new Date(new Date().toDateString());
              if (isPast) {
                results.push({ fecha: dateStr, dia: d, disponible: false, razon: "pasado" });
              } else if (excSet[dateStr]) {
                results.push({ fecha: dateStr, dia: d, disponible: false, razon: "excepcion" });
              } else if (!diasSemanaSet[dow]) {
                results.push({ fecha: dateStr, dia: d, disponible: false, razon: "no_disponible" });
              } else {
                results.push({ fecha: dateStr, dia: d, disponible: true, razon: null });
              }
            }

            res.json({ year: y, month: m, total_dias: diasEnMes, dias: results });
          }

          if (!cargoMedico) construirCalendario();
        }
      );
    }
  );
});

// ── VERIFICAR DISPONIBILIDAD PARA REAGENDAR ──

app.get("/api/admin/citas/:id/reagendar/disponibilidad", authMiddleware, (req, res) => {
  const { servicio_id, medico_id, fecha } = req.query;
  if (!servicio_id || !medico_id || !fecha) {
    return res.status(400).json({ error: "servicio_id, medico_id y fecha son requeridos" });
  }

  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();

  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1 ORDER BY hora_inicio",
    [servicio_id, diaSemana],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) {
        return res.json({ disponible: false, slots: [], mensaje: "No hay disponibilidad para este servicio en la fecha seleccionada." });
      }

      const slots = [];
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const isToday = fecha === todayStr;

      rows.forEach(function (config) {
        const [hInicio, mInicio] = config.hora_inicio.split(":").map(Number);
        const [hFin, mFin] = config.hora_fin.split(":").map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const finMinutos = hFin * 60 + mFin;
        const duracion = config.duracion || 30;
        for (let m = inicioMinutos; m + duracion <= finMinutos; m += duracion) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const horaStr = String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
          const periodo = h >= 12 ? "PM" : "AM";
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const hora12 = h12 + ":" + String(min).padStart(2, "0") + " " + periodo;
          if (isToday) {
            const nowMin = today.getHours() * 60 + today.getMinutes();
            if (m <= nowMin) continue;
          }
          slots.push({ hora: horaStr, hora12: hora12, label: hora12 });
        }
      });

      var capacidad = rows[0]?.capacidad || 1;

      // Obtener citas ocupadas para este servicio y fecha (para verificar capacidad del servicio)
      // y también verificar si el médico específico ya tiene cita en esta fecha/hora
      db.all(
        "SELECT hora, COUNT(*) as count FROM citas WHERE servicio_id=? AND fecha=? AND estado NOT IN ('cancelada') AND id!=? GROUP BY hora",
        [servicio_id, fecha, req.params.id],
        (err2, ocupadasServicio) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // Obtener citas del médico específico en esta fecha
          db.all(
            "SELECT hora FROM citas WHERE medico_id=? AND fecha=? AND estado NOT IN ('cancelada','completada') AND id!=?",
            [medico_id, fecha, req.params.id],
            (err3, ocupadasMedico) => {
              if (err3) return res.status(500).json({ error: err3.message });

              const ocupMapServicio = {};
              (ocupadasServicio || []).forEach(function (o) { ocupMapServicio[o.hora] = o.count; });

              const ocupMapMedico = {};
              (ocupadasMedico || []).forEach(function (o) { ocupMapMedico[o.hora] = true; });

              const conEstado = slots.map(function (s) {
                const servicioOcupado = (ocupMapServicio[s.hora] || 0) >= capacidad;
                const medicoOcupado = !!ocupMapMedico[s.hora];
                return {
                  ...s,
                  ocupado: servicioOcupado || medicoOcupado,
                  ocupado_servicio: servicioOcupado,
                  ocupado_medico: medicoOcupado,
                  reservas: ocupMapServicio[s.hora] || 0,
                  capacidad: capacidad,
                };
              });

              const disponibles = conEstado.filter(function (s) { return !s.ocupado; });
              const mensaje = conEstado.length > 0 && disponibles.length === 0
                ? "El médico seleccionado no tiene disponibilidad para la fecha seleccionada."
                : null;

              res.json({ disponible: disponibles.length > 0, slots: conEstado, mensaje: mensaje });
            }
          );
        }
      );
    }
  );
});

// ── DISPONIBILIDAD GLOBAL (slots across ALL doctors for a service+date) ──

app.get("/api/admin/reagendar/disponibilidad-global", authMiddleware, (req, res) => {
  const { servicio_id, fecha, excluir_cita_id } = req.query;
  if (!servicio_id || !fecha) {
    return res.status(400).json({ error: "servicio_id y fecha son requeridos" });
  }

  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();

  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1 ORDER BY hora_inicio",
    [servicio_id, diaSemana],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) {
        return res.json({ disponible: false, slots: [], mensaje: "No hay disponibilidad para este servicio en la fecha seleccionada." });
      }

      const slotsBase = [];
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const isToday = fecha === todayStr;

      rows.forEach(function(config) {
        const [hInicio, mInicio] = config.hora_inicio.split(":").map(Number);
        const [hFin, mFin] = config.hora_fin.split(":").map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const finMinutos = hFin * 60 + mFin;
        const duracion = config.duracion || 30;
        for (let m = inicioMinutos; m + duracion <= finMinutos; m += duracion) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const horaStr = String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
          const periodo = h >= 12 ? "PM" : "AM";
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const hora12 = h12 + ":" + String(min).padStart(2, "0") + " " + periodo;
          if (isToday) {
            const nowMin = today.getHours() * 60 + today.getMinutes();
            if (m <= nowMin) continue;
          }
          slotsBase.push({ hora: horaStr, hora12: hora12 });
        }
      });

      const capacidad = rows[0].capacidad || 1;

      // Get all active doctors for this service
      db.all(
        "SELECT m.id, m.nombre, m.especialidad FROM medicos m JOIN medico_servicios ms ON m.id=ms.medico_id WHERE ms.servicio_id=? AND m.activo=1",
        [servicio_id],
        (err2, doctores) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const excluirId = parseInt(excluir_cita_id) || 0;

          // Get all booked citas for this service+date excluding the current cita
          db.all(
            "SELECT medico_id, hora FROM citas WHERE servicio_id=? AND fecha=? AND estado NOT IN ('cancelada','completada') AND id!=?",
            [servicio_id, fecha, excluirId],
            (err3, ocupadas) => {
              if (err3) return res.status(500).json({ error: err3.message });

              const ocupMap = {};
              (ocupadas || []).forEach(function(o) {
                if (!ocupMap[o.hora]) ocupMap[o.hora] = {};
                ocupMap[o.hora][o.medico_id] = true;
              });

              const servOcupMap = {};
              (ocupadas || []).forEach(function(o) {
                servOcupMap[o.hora] = (servOcupMap[o.hora] || 0) + 1;
              });

              const resultSlots = slotsBase.map(function(s) {
                const doctorsAvailable = doctores.filter(function(d) {
                  return !(ocupMap[s.hora] && ocupMap[s.hora][d.id]);
                });
                const servicioOcupado = (servOcupMap[s.hora] || 0) >= capacidad;

                return {
                  hora: s.hora,
                  hora12: s.hora12,
                  ocupado: servicioOcupado || doctorsAvailable.length === 0,
                  doctores_disponibles: doctorsAvailable.map(function(d) {
                    return { id: d.id, nombre: d.nombre, especialidad: d.especialidad || "General" };
                  }),
                };
              });

              const disponibles = resultSlots.filter(function(s) { return !s.ocupado; });
              res.json({
                disponible: disponibles.length > 0,
                slots: resultSlots,
                doctores_registrados: doctores.map(function(d) {
                  return { id: d.id, nombre: d.nombre, especialidad: d.especialidad || "General" };
                }),
              });
            }
          );
        }
      );
    }
  );
});

// ── CONFIRMAR CITA MANUAL ──
app.get("/api/admin/expedientes/:cedula", authMiddleware, (req, res) => {
  db.get(
    "SELECT * FROM pacientes WHERE cedula=?",
    [req.params.cedula],
    (err, paciente) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!paciente)
        return res.json({
          existe: false,
          paciente: null,
          citas: [],
          resultados: [],
        });

      db.all(
        "SELECT c.*, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY c.created_at DESC",
        [paciente.nombre, paciente.telefono],
        (err2, citas) => {
          const citaIds = (citas || []).map((c) => c.id);

          console.log("[expedientes] paciente.id:", paciente.id, typeof paciente.id);
          db.all(
            "SELECT rp.* FROM resultados_paciente rp WHERE rp.paciente_id=? ORDER BY rp.created_at DESC",
            [paciente.id],
            (err4, rowsRp) => {
              console.log("[expedientes] rp callback err:", err4?.message, "rows:", rowsRp?.length);
              if (err4) return res.status(500).json({ error: err4.message });
              const resultadosPaciente = rowsRp || [];

              if (citas.length === 0) {
                const allResultados = resultadosPaciente.map(r => ({
                  ...r,
                  estudio: r.estudio || "Estudio",
                  fecha: r.fecha || "",
                  medico_nombre: r.medico_nombre || "",
                  observaciones: r.observaciones || "",
                }));
                allResultados.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                return res.json({ existe: true, paciente, citas: citas || [], resultados: allResultados });
              }

              const rcitaIds = citas.map((c) => c.id);
              db.all(
                `SELECT rc.*, c.codigo_cita, c.fecha as cita_fecha, c.nombre_paciente, s.nombre as servicio_nombre FROM resultados_citas rc JOIN citas c ON rc.cita_id=c.id LEFT JOIN servicios s ON c.servicio_id=s.id WHERE rc.cita_id IN (${rcitaIds.map(() => "?").join(",")}) ORDER BY rc.created_at DESC`,
                rcitaIds,
                (err5, rowsRc) => {
                  if (err5) return res.status(500).json({ error: err5.message });
                  const resultadosCitas = rowsRc || [];
                  const normalizar = (r) => ({
                    ...r,
                    estudio: r.estudio || r.servicio_nombre || "Estudio",
                    fecha: r.fecha || r.cita_fecha || "",
                    medico_nombre: r.medico_nombre || "",
                    observaciones: r.observaciones || r.nota || "",
                  });
                  const allResultados = [
                    ...resultadosPaciente.map(normalizar),
                    ...resultadosCitas.map(normalizar),
                  ];
                  allResultados.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                  res.json({ existe: true, paciente, citas: citas || [], resultados: allResultados });
                },
              );
            },
          );
        },
      );
    },
  );
});

// ── GENERAR PDF FACTURA ──
app.put("/api/admin/citas/:id/confirmar", authMiddleware, (req, res) => {
  db.run(
    "UPDATE citas SET estado='confirmada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado='pendiente'",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res
          .status(400)
          .json({ error: "La cita no está pendiente o no existe" });
      // Notificar a admins
      db.get(
        "SELECT c.nombre_paciente, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=?",
        [req.params.id],
        function (err2, cita2) {
          if (err2 || !cita2) return;
          db.all(
            "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
            [],
            function (err3, admins) {
              if (err3 || !admins) return;
              var stmt = db.prepare(
                "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
              );
              admins.forEach(function (a) {
                stmt.run(
                  a.id,
                  "Cita confirmada",
                  "Cita de " +
                    cita2.nombre_paciente +
                    " confirmada — " +
                    (cita2.servicio_nombre || ""),
                  "cita_confirmada",
                  parseInt(req.params.id),
                  cita2.nombre_paciente,
                  cita2.servicio_nombre,
                );
              });
              stmt.finalize();
            },
          );
        },
      );
      res.json({ mensaje: "Cita confirmada correctamente" });
    },
  );
});

};
