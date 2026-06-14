const { db } = require("../db/database");
const { sanitizar, validarTelefonoRD, validarEmail, validarCedulaRD, convertirHoraAMinutos, generarCodigoCita, escHtml } = require("../utils/validators");
const { limiterCitas } = require("../middleware/rateLimit");
const { sendNewCitaNotification } = require("../services/emailService");

module.exports = function(app) {
app.get("/api/servicios", (req, res) => {
  db.all(
    "SELECT * FROM servicios WHERE activo=1 ORDER BY nombre",
    (err, rows) => res.json(rows),
  );
});

app.get("/api/medicos", (req, res) => {
  db.all(
    "SELECT id, nombre, especialidad, telefono, correo FROM usuarios_admin WHERE rol='medico' AND activo=1 ORDER BY nombre",
    (err, rows) => res.json(rows || []),
  );
});

app.get("/api/ars", (req, res) => {
  db.all("SELECT * FROM ars WHERE activo=1 ORDER BY nombre", (err, rows) =>
    res.json(rows || []),
  );
});

app.get("/api/disponibilidad", (req, res) => {
  const { servicio_id } = req.query;
  if (!servicio_id) {
    return res.status(400).json({ error: "servicio_id es requerido" });
  }
  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND activo=1 ORDER BY dia_semana, hora_inicio",
    [servicio_id],
    (err, rows) => res.json(rows || []),
  );
});

app.get("/api/disponibilidad/horarios", (req, res) => {
  const { servicio_id, fecha } = req.query;
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
      const slots = [];
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const isToday = fecha === todayStr;
      rows.forEach((config) => {
        const [hInicio, mInicio] = config.hora_inicio.split(":").map(Number);
        const [hFin, mFin] = config.hora_fin.split(":").map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const finMinutos = hFin * 60 + mFin;
        const duracion = config.duracion || 30;
        for (let m = inicioMinutos; m + duracion <= finMinutos; m += duracion) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const horaStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
          const hora12 = formatHora12(h, min);
          if (isToday) {
            const nowMin = today.getHours() * 60 + today.getMinutes();
            if (m <= nowMin) continue;
          }
          slots.push({ hora: horaStr, hora12, label: hora12 });
        }
      });
      const capacidad = rows[0]?.capacidad || 1;
      db.all(
        "SELECT hora, COUNT(*) as count FROM citas WHERE servicio_id=? AND fecha=? AND estado NOT IN ('cancelada') GROUP BY hora",
        [servicio_id, fecha],
        (err2, ocupadas) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const ocupMap = {};
          (ocupadas || []).forEach((o) => { ocupMap[o.hora] = o.count; });
          const conEstado = slots.map((s) => ({
            ...s,
            ocupado: (ocupMap[s.hora] || 0) >= capacidad,
            reservas: ocupMap[s.hora] || 0,
            capacidad,
          }));
          const disponibles = conEstado.filter((s) => !s.ocupado);
          res.json({ disponible: disponibles.length > 0, slots: conEstado });
        },
      );
    },
  );
});

function formatHora12(h, min) {
  const periodo = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(min).padStart(2, "0")} ${periodo}`;
}

app.post("/api/citas", limiterCitas, (req, res) => {
  console.log("[appointment] req.body completo:", JSON.stringify(req.body));
  let {
    nombre_paciente,
    cedula,
    telefono,
    correo,
    direccion,
    ciudad,
    servicio_id,
    ars,
    fecha,
    hora,
    modalidad,
    comentario,
    acepto_privacidad,
  } = req.body;

  nombre_paciente = sanitizar(nombre_paciente || "");
  cedula = sanitizar(cedula || "");
  telefono = sanitizar(telefono || "");
  correo = sanitizar(correo || "");
  direccion = sanitizar(direccion || "");
  ciudad = sanitizar(ciudad || "");
  comentario = sanitizar(comentario || "");
  modalidad = sanitizar(modalidad || "");
  ars = sanitizar(ars || "");
  servicio_id = parseInt(servicio_id, 10);
  acepto_privacidad = !!acepto_privacidad;

  const errores = [];

  if (!nombre_paciente) errores.push("Nombre del paciente");
  if (!telefono) errores.push("Teléfono");
  else if (!validarTelefonoRD(telefono))
    errores.push("Teléfono inválido (10 dígitos)");
  if (!correo) errores.push("Correo electrónico");
  else if (!validarEmail(correo)) errores.push("Correo electrónico inválido");
  if (!direccion) errores.push("Dirección");
  if (!ciudad) errores.push("Sector / Ciudad");
  if (!servicio_id || isNaN(servicio_id)) errores.push("Servicio");
  if (!fecha) errores.push("Fecha");
  if (!hora) errores.push("Hora");
  if (!["domicilio", "telemedicina", "presencial"].includes(modalidad))
    errores.push("Modalidad (presencial, domicilio o telemedicina)");
  if (!ars) errores.push("ARS / Seguro médico");
  if (!cedula) errores.push("Cédula");
  else if (!validarCedulaRD(cedula))
    errores.push("Cédula inválida (11 dígitos)");
  if (!acepto_privacidad) errores.push("Aceptación de política de privacidad");

  if (errores.length > 0) {
    return res
      .status(400)
      .json({ error: `Campos obligatorios: ${errores.join(", ")}` });
  }

  console.log(
    `[appointment] Cita recibida - paciente: ${nombre_paciente}, servicio: ${servicio_id}, fecha: ${fecha} ${hora}`,
  );

  // ── Availability validation ──
  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();
  const validarDisponibilidad = (callback) => {
    db.all(
      "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1",
      [servicio_id, diaSemana],
      (err, rows) => {
        if (err) {
          console.error("[disponibilidad] Error:", err.message);
          return res.status(500).json({ error: "Error al validar disponibilidad" });
        }
        if (!rows || rows.length === 0) {
          return res.status(400).json({
            error: "Este servicio no tiene horario disponible para la fecha seleccionada.",
          });
        }
        const horaMinutos = convertirHoraAMinutos(hora);
        let valida = false;
        for (const config of rows) {
          const ini = convertirHoraAMinutos(config.hora_inicio);
          const fin = convertirHoraAMinutos(config.hora_fin);
          if (horaMinutos >= ini && horaMinutos + (config.duracion || 30) <= fin) {
            valida = true;
            break;
          }
        }
        if (!valida) {
          return res.status(400).json({
            error: "La hora seleccionada no está dentro del horario disponible del servicio.",
          });
        }
        db.get(
          "SELECT COUNT(*) as count FROM citas WHERE servicio_id=? AND fecha=? AND hora=? AND estado NOT IN ('cancelada')",
          [servicio_id, fecha, hora],
          (err2, existing) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const capacidad = rows[0]?.capacidad || 1;
            if ((existing?.count || 0) >= capacidad) {
              return res.status(400).json({
                error: "Ya se alcanzó la capacidad máxima para esta fecha y hora.",
              });
            }
            callback();
          },
        );
      },
    );
  };

  let codigo = generarCodigoCita();
  const checkCodigo = () => {
    db.get("SELECT id FROM citas WHERE codigo_cita=?", [codigo], (err, row) => {
      if (row) {
        codigo = generarCodigoCita();
        checkCodigo();
        return;
      }
      insertar();
    });
  };

  validarDisponibilidad(() => checkCodigo());

  const insertar = () => {
    console.log("Cedula recibida en backend:", cedula);
    console.log(
      "[insertar] valores:",
      JSON.stringify([
        codigo,
        nombre_paciente,
        cedula,
        telefono,
        correo,
        direccion,
        ciudad,
        servicio_id,
        ars,
        fecha,
        hora,
        modalidad,
        comentario,
      ]),
    );
    db.run(
      `INSERT INTO citas (codigo_cita, nombre_paciente, cedula, telefono, correo, direccion, ciudad, servicio_id, ars, fecha, hora, modalidad, comentario, estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        codigo,
        nombre_paciente,
        cedula,
        telefono,
        correo,
        direccion,
        ciudad,
        servicio_id,
        ars,
        fecha,
        hora,
        modalidad,
        comentario,
        "pendiente",
      ],
      function (err) {
        if (err) {
          console.error("[cita] Error al insertar:", err.message);
          return res
            .status(500)
            .json({ error: "Error al crear la cita: " + err.message });
        }
        const citaId = this.lastID;
        console.log("Cedula guardada en cita:", cedula);
        console.log(
          `[appointment] Cita guardada correctamente - id: ${citaId}, codigo: ${codigo}`,
        );

        // Crear o actualizar paciente (expediente por cedula)
        db.get(
          "SELECT id FROM pacientes WHERE cedula=?",
          [cedula],
          (err3, existingPac) => {
            if (err3)
              console.error("[paciente] Error al buscar:", err3.message);
            else if (existingPac) {
              db.run(
                "UPDATE pacientes SET nombre=?, telefono=?, correo=?, direccion=?, ciudad=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                [
                  nombre_paciente,
                  telefono,
                  correo,
                  direccion,
                  ciudad,
                  existingPac.id,
                ],
              );
            } else {
              db.run(
                "INSERT INTO pacientes (nombre, cedula, telefono, correo, direccion, ciudad, estado) VALUES (?,?,?,?,?,?,'activo')",
                [nombre_paciente, cedula, telefono, correo, direccion, ciudad],
              );
            }
          },
        );

        res.json({
          id: citaId,
          codigo_cita: codigo,
          mensaje:
            "Su solicitud fue recibida correctamente. Nos comunicaremos con usted para confirmar la cita.",
        });

        // Auto-generate invoice
        db.get(
          "SELECT s.nombre as servicio_nombre, s.precio FROM servicios s WHERE s.id=?",
          [servicio_id],
          (err2, servicio) => {
            const servicio_nombre = servicio ? servicio.servicio_nombre : "—";
            const precio_base = servicio ? servicio.precio : 0;

            // Generate invoice number
            const year = new Date().getFullYear();
            db.get(
              "SELECT COALESCE(MAX(CAST(SUBSTR(numero_factura, -6) AS INTEGER)) + 1, 1) as next FROM facturas WHERE numero_factura LIKE ?",
              [`FAC-${year}-%`],
              (err4, row) => {
                const nextNum = String(row ? row.next : 1).padStart(6, "0");
                const numero_factura = `FAC-${year}-${nextNum}`;

                const esSinSeguro = ars === "No tengo seguro";
                const estado = esSinSeguro
                  ? "pendiente_de_pago"
                  : "pendiente_de_validacion";
                const cobertura_estado = esSinSeguro
                  ? "no_aplica"
                  : "pendiente_de_validacion";
                const monto_pagar = precio_base;

                db.run(
                  `INSERT INTO facturas (numero_factura, cita_id, paciente_nombre, cedula, servicio_id, servicio_nombre, precio_base, ars_nombre, cobertura_porcentaje, monto_cubierto, monto_pagar, estado, cobertura_estado)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    numero_factura,
                    citaId,
                    nombre_paciente,
                    cedula,
                    servicio_id,
                    servicio_nombre,
                    precio_base,
                    ars,
                    0,
                    0,
                    monto_pagar,
                    estado,
                    cobertura_estado,
                  ],
                  function (err5) {
                    if (err5)
                      console.error(
                        "[invoice] Error al crear factura:",
                        err5.message,
                      );
                    else
                      console.log(
                        `[invoice] Factura ${numero_factura} generada para cita ${citaId} (${cobertura_estado})`,
                      );
                  },
                );

                // Create in-app notifications for admin users
                db.all(
                  "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
                  [],
                  (err6, admins) => {
                    if (err6) {
                      console.error(
                        "[notificacion] Error al buscar admins:",
                        err6.message,
                      );
                      return;
                    }
                    if (admins && admins.length > 0) {
                      const stmt = db.prepare(
                        "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                      );
                      admins.forEach((a) => {
                        stmt.run(
                          a.id,
                          "Nueva cita agendada",
                          `Paciente ${nombre_paciente} — ${servicio_nombre}`,
                          "nueva_cita",
                          citaId,
                          nombre_paciente,
                          servicio_nombre,
                        );
                      });
                      stmt.finalize();
                      console.log(
                        `[notificacion] Notificaciones creadas para ${admins.length} admin(s)`,
                      );
                    }
                  },
                );
              },
            );

            // Send email notifications
            db.all(
              `SELECT m.nombre, m.correo FROM medicos m
            JOIN medico_servicios ms ON m.id=ms.medico_id
            WHERE ms.servicio_id=? AND m.activo=1 AND m.correo IS NOT NULL AND m.correo != ''`,
              [servicio_id],
              (err3, doctores) => {
                const medico =
                  doctores && doctores.length > 0 ? doctores[0] : null;
                console.log(
                  `[email] Enviando notificaciones para cita ${codigo}...`,
                );
                sendNewCitaNotification({
                  nombre_paciente,
                  cedula,
                  telefono,
                  correo,
                  servicio_nombre,
                  medico_nombre: medico ? medico.nombre : "Por asignar",
                  medico_correo: medico ? medico.correo : null,
                  fecha,
                  hora,
                  direccion,
                  ciudad,
                  modalidad,
                  comentario,
                  codigo_cita: codigo,
                  created_at: new Date().toISOString(),
                  estado: "pendiente",
                  admin_url: `${req.protocol}://${req.get("host")}/admin.html`,
                });
              },
            );
          },
        );
      },
    );
  };

  // checkCodigo is called by validarDisponibilidad above
});

app.get("/api/citas/seguimiento", (req, res) => {
  const { codigo, telefono } = req.query;
  if (!codigo && !telefono)
    return res
      .status(400)
      .json({ error: "Debe proporcionar código o teléfono" });

  let query, params;
  if (codigo) {
    query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
      FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN usuarios_admin m ON c.medico_id=m.id AND m.rol='medico' WHERE c.codigo_cita=?`;
    params = [codigo];
  } else {
    query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
      FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN usuarios_admin m ON c.medico_id=m.id AND m.rol='medico' WHERE c.telefono=? ORDER BY c.created_at DESC LIMIT 10`;
    params = [telefono];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al buscar" });
    res.json(rows);
  });
});
};
