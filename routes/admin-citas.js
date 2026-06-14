const { db, RESULTADOS_DIR } = require("../db/database");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const path = require("path");
const { sendResultadoNotification } = require("../services/emailService");
const { buildDoctorAssignmentEmail, buildDoctorAssignmentText } = require("../utils/emailHelpers");

function crearNotificacion(usuarioId, titulo, mensaje, tipo, cb) {
  db.run("INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?,?,?,?)", [usuarioId, titulo, mensaje || "", tipo || "info"], cb);
}

module.exports = function(app) {
app.get("/api/admin/stats", async (req, res) => {
  try {
    const q = {
      get: (sql, params = []) =>
        new Promise((resolve, reject) =>
          db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))),
        ),
      all: (sql, params = []) =>
        new Promise((resolve, reject) =>
          db.all(sql, params, (err, rows) =>
            err ? reject(err) : resolve(rows),
          ),
        ),
    };

    const [
      total,
      pend,
      conf,
      comp,
      canc,
      proc,
      topServicios,
      tendencia,
      actividadReciente,
      citasPorDia,
      pacientesCount,
      medicosCount,
      hoyTotal,
      ayerTotal,
    ] = await Promise.all([
      q.get("SELECT COUNT(*) as total FROM citas"),
      q.get(
        "SELECT COUNT(*) as pendientes FROM citas WHERE estado='pendiente'",
      ),
      q.get(
        "SELECT COUNT(*) as confirmadas FROM citas WHERE estado='confirmada'",
      ),
      q.get(
        "SELECT COUNT(*) as completadas FROM citas WHERE estado='completada'",
      ),
      q.get(
        "SELECT COUNT(*) as canceladas FROM citas WHERE estado='cancelada'",
      ),
      q.get(
        "SELECT COUNT(*) as en_proceso FROM citas WHERE estado='en_proceso'",
      ),
      q.all(
        `SELECT s.nombre, COUNT(c.id) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id GROUP BY c.servicio_id ORDER BY total DESC LIMIT 5`,
      ),
      q.all(
        `SELECT DATE(created_at) as dia, COUNT(*) as total FROM citas GROUP BY dia ORDER BY dia DESC LIMIT 7`,
      ),
      q.all(`SELECT 'cita' as tipo, c.nombre_paciente as paciente, COALESCE(s.nombre,'') as servicio, c.estado, c.created_at as fecha
        FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id
        ORDER BY c.created_at DESC LIMIT 5`),
      q.all(`SELECT CASE CAST(strftime('%w',fecha) AS INTEGER)
        WHEN 0 THEN 'Dom' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié'
        WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' END as dia,
        COUNT(*) as total FROM citas
        WHERE fecha >= DATE('now','-7 days')
        GROUP BY strftime('%w',fecha) ORDER BY strftime('%w',fecha)`),
      q.get(
        "SELECT COUNT(DISTINCT nombre_paciente || telefono) as total FROM citas",
      ),
      q.get("SELECT COUNT(*) as total FROM medicos WHERE activo=1"),
      q.get(
        "SELECT COUNT(*) as total FROM citas WHERE DATE(created_at)=DATE('now')",
      ),
      q.get(
        "SELECT COUNT(*) as total FROM citas WHERE DATE(created_at)=DATE('now','-1 day')",
      ),
    ]);

    const variacion =
      ayerTotal?.total > 0
        ? Math.round(
            (((hoyTotal?.total || 0) - ayerTotal.total) / ayerTotal.total) *
              100,
          )
        : 0;

    const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const citasMap = {};
    (citasPorDia || []).forEach((d) => {
      citasMap[d.dia] = d.total;
    });
    const citasPorDiaCompleto = diasSemana.map((dia) => ({
      dia,
      total: citasMap[dia] || 0,
    }));

    res.json({
      total: total?.total || 0,
      pendientes: pend?.pendientes || 0,
      confirmadas: conf?.confirmadas || 0,
      completadas: comp?.completadas || 0,
      canceladas: canc?.canceladas || 0,
      en_proceso: proc?.en_proceso || 0,
      variacion,
      topServicios: topServicios || [],
      tendencia: tendencia || [],
      actividadReciente: actividadReciente || [],
      citasPorDia: citasPorDiaCompleto,
      resumenRapido: {
        totalPacientes: pacientesCount?.total || 0,
        medicosActivos: medicosCount?.total || 0,
        satisfaccion: 4.8,
      },
    });
  } catch (err) {
    console.error("[stats] Error:", err);
    res.status(500).json({ error: "Error al cargar estadísticas" });
  }
});

app.get("/api/admin/citas", authMiddleware, (req, res) => {
  let query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE 1=1`;
  const params = [];
  const { estado, fecha, servicio, medico, busqueda } = req.query;

  if (estado) {
    query += " AND c.estado=?";
    params.push(estado);
  }
  if (fecha) {
    query += " AND c.fecha=?";
    params.push(fecha);
  }
  if (servicio) {
    query += " AND c.servicio_id=?";
    params.push(servicio);
  }
  if (medico) {
    query += " AND c.medico_id=?";
    params.push(medico);
  }
  if (busqueda) {
    query +=
      " AND (c.nombre_paciente LIKE ? OR c.telefono LIKE ? OR c.codigo_cita LIKE ?)";
    params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }

  query += " ORDER BY c.created_at DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/admin/citas/ultima", authMiddleware, (req, res) => {
  db.get(
    "SELECT COALESCE(MAX(id),0) as maxId, COUNT(*) as total FROM citas",
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ maxId: row?.maxId || 0, total: row?.total || 0 });
    },
  );
});

app.get("/api/admin/citas/:id", authMiddleware, (req, res) => {
  db.get(
    `SELECT c.*, s.nombre as servicio_nombre, s.precio, s.descripcion as servicio_descripcion, s.duracion as servicio_duracion,
    m.nombre as medico_nombre, m.especialidad, m.telefono as medico_telefono
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.id=?`,
    [req.params.id],
    (err, cita) => {
      if (err || !cita)
        return res.status(404).json({ error: "Cita no encontrada" });
      console.log("Detalle cita cedula:", cita.cedula);
      // Fallback: si la cita no tiene cedula, buscarla en pacientes
      if (!cita.cedula) {
        db.get(
          "SELECT cedula FROM pacientes WHERE nombre=? AND (telefono=? OR cedula IS NOT NULL) LIMIT 1",
          [cita.nombre_paciente, cita.telefono],
          (err2, pac) => {
            if (pac && pac.cedula) cita.cedula = pac.cedula;
            db.all(
              "SELECT * FROM observaciones_cita WHERE cita_id=? ORDER BY created_at DESC",
              [req.params.id],
              (err, obs) => {
                db.get(
                  "SELECT * FROM resultados_citas WHERE cita_id=? ORDER BY created_at DESC LIMIT 1",
                  [req.params.id],
                  (err, resultado) => {
                    res.json({
                      ...cita,
                      observaciones_lista: obs || [],
                      resultado: resultado || null,
                    });
                  },
                );
              },
            );
          },
        );
      } else {
        db.all(
          "SELECT * FROM observaciones_cita WHERE cita_id=? ORDER BY created_at DESC",
          [req.params.id],
          (err, obs) => {
            db.get(
              "SELECT * FROM resultados_citas WHERE cita_id=? ORDER BY created_at DESC LIMIT 1",
              [req.params.id],
              (err, resultado) => {
                res.json({
                  ...cita,
                  observaciones_lista: obs || [],
                  resultado: resultado || null,
                });
              },
            );
          },
        );
      }
    },
  );
});

app.put("/api/admin/citas/:id", authMiddleware, (req, res) => {
  const { estado, medico_id, observaciones, resultado } = req.body;
  const fields = [];
  const params = [];

  if (estado) {
    fields.push("estado=?");
    params.push(estado);
  }
  if (medico_id !== undefined) {
    fields.push("medico_id=?");
    params.push(medico_id);
  }
  if (observaciones !== undefined) {
    fields.push("observaciones=?");
    params.push(observaciones);
  }

  if (fields.length === 0)
    return res.status(400).json({ error: "Sin campos para actualizar" });

  fields.push("updated_at=CURRENT_TIMESTAMP");
  params.push(req.params.id);

  db.run(
    `UPDATE citas SET ${fields.join(",")} WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (observaciones) {
        db.run(
          "INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
          [req.params.id, "admin", observaciones, req.admin.nombre],
        );
      }

      // Notificar a admins sobre cambios de estado
      if (estado) {
        db.get(
          `SELECT c.nombre_paciente, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=?`,
          [req.params.id],
          (err3, citaData) => {
            if (err3 || !citaData) return;
            var titulo = "Cita " + estado;
            var tipo = "cita_" + estado;
            var mensaje =
              "Paciente " +
              citaData.nombre_paciente +
              " — " +
              (citaData.servicio_nombre || "") +
              " — " +
              estado;
            db.all(
              "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
              [],
              (err4, admins) => {
                if (err4 || !admins) return;
                var stmt = db.prepare(
                  "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                );
                admins.forEach(function (a) {
                  stmt.run(
                    a.id,
                    titulo,
                    mensaje,
                    tipo,
                    parseInt(req.params.id),
                    citaData.nombre_paciente,
                    citaData.servicio_nombre,
                  );
                });
                stmt.finalize();
              },
            );
          },
        );
      }

      // Si se asignó un médico, enviar email + notificación
      if (medico_id !== undefined && medico_id !== null) {
        db.get(
          `SELECT c.*, s.nombre as servicio_nombre, m.nombre as medico_nombre, m.correo as medico_correo
        FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.id=?`,
          [req.params.id],
          (err2, cita) => {
            if (err2 || !cita) return;
            // Notificar al médico
            db.get(
              "SELECT id FROM medicos WHERE id=? AND activo=1",
              [medico_id],
              (err3, user) => {
                if (user) {
                  crearNotificacion(
                    user.id,
                    "Nueva cita asignada",
                    "Se le ha asignado la cita " +
                      (cita.codigo_cita || "") +
                      " para " +
                      (cita.nombre_paciente || "") +
                      " el " +
                      (cita.fecha || "") +
                      " a las " +
                      (cita.hora || ""),
                    "cita_asignada",
                  );
                }
              },
            );
            // Enviar email al médico
            if (cita.medico_correo) {
              const { sendEmail } = require("../utils/mailer");
              sendEmail({
                to: cita.medico_correo,
                subject: "Nueva cita asignada - MediHomeRD",
                html: buildDoctorAssignmentEmail(cita),
                text: buildDoctorAssignmentText(cita),
              });
            }
          },
        );
      }

      res.json({ mensaje: "Cita actualizada correctamente" });
    },
  );
});

// --- ADMIN RESULTADOS (FILE UPLOAD) ---

app.post("/api/admin/citas/:id/resultado", authMiddleware, (req, res) => {
  upload.single("archivo")(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res
            .status(400)
            .json({ error: "El archivo supera el tamaño máximo de 10 MB" });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file)
      return res
        .status(400)
        .json({ error: "Debe seleccionar un archivo (PDF, JPG, JPEG o PNG)" });

    const nota = req.body.nota ? String(req.body.nota).trim() : "";

    db.get("SELECT * FROM citas WHERE id=?", [req.params.id], (err, cita) => {
      if (err || !cita)
        return res.status(404).json({ error: "Cita no encontrada" });

      db.run(
        `INSERT INTO resultados_citas (cita_id, archivo_original, archivo_guardado, ruta_archivo, mime_type, size_bytes, nota) VALUES (?,?,?,?,?,?,?)`,
        [
          req.params.id,
          req.file.originalname,
          req.file.filename,
          req.file.path,
          req.file.mimetype,
          req.file.size,
          nota,
        ],
        function (err) {
          if (err)
            return res
              .status(500)
              .json({ error: "Error al guardar el resultado" });

          db.run(
            "UPDATE citas SET estado='completada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado!='cancelada'",
            [req.params.id],
          );

          const resultData = {
            cita_id: parseInt(req.params.id),
            nombre_paciente: cita.nombre_paciente,
            correo: cita.correo,
            codigo_cita: cita.codigo_cita,
            archivo_original: req.file.originalname,
            archivo_guardado: req.file.filename,
            nota: nota,
          };

          sendResultadoNotification(resultData);

          res.json({
            id: this.lastID,
            mensaje: "Resultado registrado correctamente",
            archivo: req.file.filename,
          });
        },
      );
    });
  });
});

app.get("/api/admin/resultados/:archivo", authMiddleware, (req, res) => {
  const filePath = path.join(RESULTADOS_DIR, req.params.archivo);
  if (!require("fs").existsSync(filePath))
    return res.status(404).json({ error: "Archivo no encontrado" });
  res.sendFile(filePath);
});
};
