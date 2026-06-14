const { db, RESULTADOS_PACIENTE_DIR } = require("../db/database");
const { authMiddleware } = require("../middleware/auth");
const { uploadPaciente } = require("../middleware/upload");
const { escHtml } = require("../utils/validators");
const path = require("path");

module.exports = function(app) {
app.get("/api/pacientes", authMiddleware, (req, res) => {
  const { search, genero, estado, sector, page, limit } = req.query;
  const curPage = Math.max(1, parseInt(page) || 1);
  const curLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const offset = (curPage - 1) * curLimit;

  let where = [];
  let params = [];

  if (search) {
    where.push("(p.nombre LIKE ? OR p.telefono LIKE ? OR p.correo LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (genero && genero !== "todos") {
    where.push("p.genero=?");
    params.push(genero);
  }
  if (estado && estado !== "todos") {
    where.push("p.estado=?");
    params.push(estado);
  }
  if (sector && sector !== "todos") {
    where.push("p.sector=? OR p.ciudad=?");
    params.push(sector, sector);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  db.all(
    `SELECT p.*, (SELECT COUNT(*) FROM citas WHERE nombre_paciente=p.nombre AND telefono=p.telefono) as total_citas,
    (SELECT MAX(fecha) FROM citas WHERE nombre_paciente=p.nombre AND telefono=p.telefono) as ultima_cita
    FROM pacientes p ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, curLimit, offset],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(
        `SELECT COUNT(*) as total FROM pacientes ${whereClause}`,
        params,
        (err2, countRow) => {
          const total = countRow?.total || 0;
          const pages = Math.ceil(total / curLimit);
          res.json({
            success: true,
            pacientes: rows || [],
            estadisticas: {
              totalPacientes: total,
              nuevosEsteMes: 0,
              frecuentes: 0,
              totalCitas: 0,
              edadPromedio: 0,
              trendTotal: "+0%",
              trendNuevos: "—",
              trendFrecuentes: "—",
              trendCitas: "—",
              trendEdad: "—",
              generoFemenino: 0,
              generoMasculino: 0,
              distribucionEdad: [],
              sectores: [],
            },
            paginacion: { total, page: curPage, pages, limit: curLimit },
          });
        },
      );
    },
  );
});

app.get("/api/pacientes/:id", authMiddleware, (req, res) => {
  db.get(
    "SELECT * FROM pacientes WHERE id=?",
    [req.params.id],
    (err, paciente) => {
      if (err || !paciente)
        return res
          .status(404)
          .json({ success: false, error: "Paciente no encontrado" });
      const today = new Date().toISOString().split("T")[0];
      db.all(
        "SELECT c.*, s.nombre as servicio, m.nombre as medico_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY c.created_at DESC",
        [paciente.nombre, paciente.telefono],
        (err2, citas) => {
      db.all(
        "SELECT rc.*, c.fecha as cita_fecha, c.nombre_paciente, s.nombre as servicio_nombre FROM resultados_citas rc JOIN citas c ON rc.cita_id=c.id LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY rc.created_at DESC",
        [paciente.nombre, paciente.telefono],
        (err3, resultados) => {
          db.all(
            "SELECT rp.* FROM resultados_paciente rp WHERE rp.paciente_id=? ORDER BY rp.created_at DESC",
            [req.params.id],
            (err4, resultadosPaciente) => {
              // Next appointment
              db.all(
                "SELECT c.*, s.nombre as servicio, m.nombre as medico_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.nombre_paciente=? AND c.telefono=? AND c.fecha >= ? AND c.estado NOT IN ('completada','cancelada') ORDER BY c.fecha ASC, c.hora ASC LIMIT 1",
                [paciente.nombre, paciente.telefono, today],
                (errProx, proximasCitas) => {
                  const proxima_cita = proximasCitas && proximasCitas.length > 0 ? proximasCitas[0] : null;
                  // Most common medico
                  db.get(
                    "SELECT m.nombre FROM citas c JOIN medicos m ON c.medico_id=m.id WHERE c.nombre_paciente=? AND c.telefono=? AND c.medico_id IS NOT NULL GROUP BY c.medico_id ORDER BY COUNT(*) DESC LIMIT 1",
                    [paciente.nombre, paciente.telefono],
                    (errMed, medicoRow) => {
                      const medico_habitual = medicoRow ? medicoRow.nombre : null;
                      // Observaciones from observaciones_cita
                      db.all(
                        "SELECT oc.* FROM observaciones_cita oc JOIN citas c ON oc.cita_id=c.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY oc.created_at DESC LIMIT 50",
                        [paciente.nombre, paciente.telefono],
                        (errObs, observaciones) => {
                          // Get facturas for billing tab
                          db.all(
                            `SELECT f.* FROM facturas f JOIN citas c ON f.cita_id=c.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY f.created_at DESC LIMIT 50`,
                            [paciente.nombre, paciente.telefono],
                            (errFact, facturas) => {
                              const normalizar = (r) => ({
                                ...r,
                                estudio: r.estudio || r.servicio_nombre || "Estudio",
                                fecha: r.fecha || r.cita_fecha || "",
                                medico_nombre: r.medico_nombre || "",
                                observaciones: r.observaciones || r.nota || "",
                              });
                              const allResultados = [
                                ...(resultadosPaciente || []).map(normalizar),
                                ...(resultados || []).map(normalizar),
                              ];
                              allResultados.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                              // Get ARS from latest cita
                              const ultimaCitaConArs = citas && citas.length > 0 ? citas.find(c => c.ars) || citas[0] : null;
                              const resumen = {
                                totalCitas: citas?.length || 0,
                                ultimaCita: citas && citas.length > 0 ? citas[0].fecha : null,
                                servicioMasSolicitado: null,
                                resultadosCount: allResultados.length,
                                totalEstudios: (resultadosPaciente || []).length,
                              };
                              res.json({
                                success: true,
                                paciente: {
                                  ...paciente,
                                  ars: ultimaCitaConArs ? ultimaCitaConArs.ars || "" : "",
                                },
                                resumen,
                                citas: citas || [],
                                resultados: allResultados,
                                observaciones: observaciones || [],
                                facturas: facturas || [],
                                proxima_cita: proxima_cita,
                                medico_habitual: medico_habitual,
                              });
                            },
                          );
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      );
        },
      );
    },
  );
});

app.post("/api/pacientes", authMiddleware, (req, res) => {
  const {
    nombre,
    telefono,
    correo,
    cedula,
    fecha_nacimiento,
    genero,
    direccion,
    ciudad,
    sector,
  } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  db.run(
    "INSERT INTO pacientes (nombre, telefono, correo, cedula, fecha_nacimiento, genero, direccion, ciudad, sector) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      nombre,
      telefono || "",
      correo || "",
      cedula || "",
      fecha_nacimiento || "",
      genero || "",
      direccion || "",
      ciudad || "",
      sector || "",
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: "Paciente creado correctamente" });
    },
  );
});

app.put("/api/pacientes/:id", authMiddleware, (req, res) => {
  const fields = [];
  const params = [];
  [
    "nombre",
    "telefono",
    "correo",
    "cedula",
    "fecha_nacimiento",
    "genero",
    "direccion",
    "ciudad",
    "sector",
    "estado",
  ].forEach((f) => {
    if (req.body[f] !== undefined) {
      fields.push(f + "=?");
      params.push(req.body[f]);
    }
  });
  if (fields.length === 0) return res.status(400).json({ error: "Sin campos" });
  params.push(req.params.id);
  db.run(
    `UPDATE pacientes SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Paciente actualizado correctamente" });
    },
  );
});

app.delete("/api/pacientes/:id", authMiddleware, (req, res) => {
  db.run(
    "UPDATE pacientes SET estado='inactivo' WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Paciente desactivado" });
    },
  );
});

// ── PACIENTE RESULTADOS API ──

app.post("/api/pacientes/:id/resultado", authMiddleware, (req, res) => {
  uploadPaciente.single("archivo")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Error al subir archivo" });
    if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
    const { estudio, fecha, observaciones, guardar_expediente } = req.body;
    if (!estudio) return res.status(400).json({ error: "Estudio requerido" });
    if (!fecha) return res.status(400).json({ error: "Fecha requerida" });
    const pacienteId = req.params.id;
    db.run(
      `INSERT INTO resultados_paciente (paciente_id, estudio, fecha, archivo_original, archivo_guardado, ruta_archivo, mime_type, size_bytes, observaciones, medico_nombre, guardar_expediente)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        pacienteId,
        estudio,
        fecha,
        req.file.originalname,
        req.file.filename,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        observaciones || "",
        req.admin?.nombre || null,
        guardar_expediente === "1" ? 1 : 0,
      ],
      function (err) {
        if (err) return res.status(500).json({ error: "Error al guardar resultado" });
        res.json({ success: true, id: this.lastID, mensaje: "Resultado registrado correctamente" });
      },
    );
  });
});

app.get("/api/pacientes/resultados/:archivo", authMiddleware, (req, res) => {
  const archivo = req.params.archivo;
  const filePath = path.join(RESULTADOS_PACIENTE_DIR, archivo);
  const fs = require("fs");
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "Archivo no encontrado" });
  const ext = path.extname(archivo).toLowerCase();
  const mimeMap = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
  res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
  res.setHeader("Content-Disposition", "inline; filename=\"" + archivo + "\"");
  res.sendFile(filePath);
});

app.delete("/api/pacientes/resultados/:id", authMiddleware, (req, res) => {
  db.get("SELECT ruta_archivo FROM resultados_paciente WHERE id=?", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Resultado no encontrado" });
    try {
      const fs = require("fs");
      if (fs.existsSync(row.ruta_archivo)) fs.unlinkSync(row.ruta_archivo);
    } catch (e) {}
    db.run("DELETE FROM resultados_paciente WHERE id=?", [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: "Error al eliminar" });
      res.json({ success: true, mensaje: "Resultado eliminado" });
  });
  });
});

// ── ENVIAR EXPEDIENTE POR EMAIL ──

app.post("/api/pacientes/:id/enviar-expediente", authMiddleware, (req, res) => {
  const { sendEmail } = require("../utils/mailer");
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: "Correo del paciente requerido" });

  db.get("SELECT * FROM pacientes WHERE id=?", [req.params.id], (err, paciente) => {
    if (err || !paciente) return res.status(404).json({ error: "Paciente no encontrado" });

    db.all("SELECT c.*, s.nombre as servicio FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY c.created_at DESC LIMIT 5",
      [paciente.nombre, paciente.telefono],
      (err2, citas) => {
        const citasTexto = (citas || []).map(function(c) {
          return "  - " + c.fecha + " " + c.hora + " | " + (c.servicio || "—") + " | " + (c.estado || "—");
        }).join("\n");

        const html = [
          '<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">',
          '<div style="background:linear-gradient(135deg,#2563eb,#0ea5e5);padding:24px 32px;text-align:center">',
          '<h1 style="color:#fff;font-size:1.3rem;margin:0">Expediente Clinico</h1>',
          '<p style="color:rgba(255,255,255,0.85);font-size:0.82rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>',
          '<div style="padding:24px 32px">',
          "<h3 style='color:#0f172a;font-size:0.95rem'>Datos del Paciente</h3>",
          '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">',
          "<tr><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:100px'><strong>Nombre</strong></td><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#0f172a'>" + escHtml(paciente.nombre) + "</td></tr>",
          "<tr><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc'><strong>Cedula</strong></td><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#0f172a'>" + escHtml(paciente.cedula || "—") + "</td></tr>",
          "<tr><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc'><strong>Telefono</strong></td><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#0f172a'>" + escHtml(paciente.telefono || "—") + "</td></tr>",
          "<tr><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc'><strong>Correo</strong></td><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#0f172a'>" + escHtml(paciente.correo || "—") + "</td></tr>",
          "<tr><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc'><strong>Direccion</strong></td><td style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.82rem;color:#0f172a'>" + escHtml(paciente.direccion || "—") + "</td></tr>",
          "</table>",
          (citas.length > 0 ? "<h3 style='color:#0f172a;font-size:0.95rem;margin-top:16px'>Ultimas Citas</h3><table style='width:100%;border-collapse:collapse;margin-bottom:16px'><thead><tr><th style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.75rem;background:#f8fafc;color:#475569;text-align:left'>Fecha</th><th style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.75rem;background:#f8fafc;color:#475569;text-align:left'>Hora</th><th style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.75rem;background:#f8fafc;color:#475569;text-align:left'>Servicio</th><th style='padding:8px 12px;border:1px solid #e2e8f0;font-size:0.75rem;background:#f8fafc;color:#475569;text-align:left'>Estado</th></tr></thead><tbody>" +
          (citas || []).map(function(c) {
            return "<tr><td style='padding:6px 12px;border:1px solid #e2e8f0;font-size:0.8rem'>" + escHtml(c.fecha || "") + "</td><td style='padding:6px 12px;border:1px solid #e2e8f0;font-size:0.8rem'>" + escHtml(c.hora || "") + "</td><td style='padding:6px 12px;border:1px solid #e2e8f0;font-size:0.8rem'>" + escHtml(c.servicio || "—") + "</td><td style='padding:6px 12px;border:1px solid #e2e8f0;font-size:0.8rem'>" + escHtml(c.estado || "—") + "</td></tr>";
          }).join("") +
          "</tbody></table>" : "") +
          '</div><div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">',
          '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>',
        ].join("");

        const texto = "Expediente Clinico - MediHomeRD\n\nDatos del Paciente:\n" +
          "Nombre: " + (paciente.nombre || "") + "\n" +
          "Cedula: " + (paciente.cedula || "—") + "\n" +
          "Telefono: " + (paciente.telefono || "—") + "\n" +
          "Correo: " + (paciente.correo || "—") + "\n" +
          "Direccion: " + (paciente.direccion || "—") + "\n\n" +
          (citas && citas.length > 0 ? "Ultimas Citas:\n" + citasTexto + "\n\n" : "") +
          "MediHomeRD - Plataforma de Salud Digital";

        sendEmail({ to: correo, subject: "Expediente Clinico - " + paciente.nombre + " - MediHomeRD", html: html, text: texto })
          .then(function(result) {
            if (result.sent) {
              res.json({ success: true, mensaje: "Expediente enviado correctamente" });
            } else {
              res.status(500).json({ error: "Error al enviar: " + result.reason });
            }
          })
          .catch(function(err) {
            res.status(500).json({ error: "Error al enviar expediente" });
          });
      },
    );
  });
});
};
