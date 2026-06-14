const { db } = require("../db/database");
const { medicoAuthMiddleware } = require("../middleware/auth");

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

module.exports = function(app) {
app.get("/api/medico/dashboard", medicoAuthMiddleware, async (req, res) => {
  try {
    const medicoId = req.medico.medico_id;
    const [
      total,
      pendientes,
      hoy,
      completadas,
      pacientes,
      citasHoy,
      notificaciones,
      noLeidas,
      resultadosPend,
      proximasCitas,
    ] = await Promise.all([
      dbGet("SELECT COUNT(*) as total FROM citas WHERE medico_id=?", [
        medicoId,
      ]),
      dbGet(
        "SELECT COUNT(*) as total FROM citas WHERE medico_id=? AND estado='pendiente'",
        [medicoId],
      ),
      dbGet(
        "SELECT COUNT(*) as total FROM citas WHERE medico_id=? AND fecha=DATE('now')",
        [medicoId],
      ),
      dbGet(
        "SELECT COUNT(*) as total FROM citas WHERE medico_id=? AND estado='completada'",
        [medicoId],
      ),
      dbGet(
        "SELECT COUNT(DISTINCT nombre_paciente || telefono) as total FROM citas WHERE medico_id=?",
        [medicoId],
      ),
      dbAll(
        `SELECT c.*, s.nombre as servicio_nombre FROM citas c
        LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.medico_id=? AND c.fecha=DATE('now')
        ORDER BY c.hora ASC`,
        [medicoId],
      ),
      dbAll(
        `SELECT n.*, u.nombre as usuario_nombre FROM notificaciones n
        JOIN usuarios_admin u ON n.usuario_id=u.id
        WHERE n.usuario_id=? ORDER BY n.created_at DESC LIMIT 10`,
        [req.medico.id],
      ),
      dbGet(
        "SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id=? AND leida=0",
        [req.medico.id],
      ),
      dbGet(
        "SELECT COUNT(*) as total FROM citas WHERE medico_id=? AND estado='completada' AND observaciones IS NULL",
        [medicoId],
      ),
      dbAll(
        `SELECT c.*, s.nombre as servicio_nombre FROM citas c
        LEFT JOIN servicios s ON c.servicio_id=s.id
        WHERE c.medico_id=? AND c.fecha > DATE('now') ORDER BY c.fecha ASC, c.hora ASC LIMIT 5`,
        [medicoId],
      ),
    ]);

    res.json({
      total: total?.total || 0,
      pendientes: pendientes?.total || 0,
      citas_hoy: hoy?.total || 0,
      completadas: completadas?.total || 0,
      pacientes: pacientes?.total || 0,
      resultados_pendientes: resultadosPend?.total || 0,
      pacientes_asignados: pacientes?.total || 0,
      citas_hoy_lista: citasHoy || [],
      proximas_citas: proximasCitas || [],
      notificaciones: notificaciones || [],
      notificaciones_no_leidas: noLeidas?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/medico/citas", medicoAuthMiddleware, (req, res) => {
  const medicoId = req.medico.medico_id;
  let query = `SELECT c.*, s.nombre as servicio_nombre, s.precio
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.medico_id=?`;
  const params = [medicoId];
  const { estado, fecha, busqueda } = req.query;

  if (estado) {
    query += " AND c.estado=?";
    params.push(estado);
  }
  if (fecha) {
    query += " AND c.fecha=?";
    params.push(fecha);
  }
  if (busqueda) {
    query += " AND (c.nombre_paciente LIKE ? OR c.codigo_cita LIKE ?)";
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }

  query += " ORDER BY c.fecha DESC, c.hora DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get("/api/medico/citas/:id", medicoAuthMiddleware, (req, res) => {
  const medicoId = req.medico.medico_id;
  db.get(
    `SELECT c.*, s.nombre as servicio_nombre, s.precio, s.descripcion as servicio_descripcion
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=? AND c.medico_id=?`,
    [req.params.id, medicoId],
    (err, cita) => {
      if (err || !cita)
        return res.status(404).json({ error: "Cita no encontrada" });
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
});

app.put("/api/medico/citas/:id", medicoAuthMiddleware, (req, res) => {
  const medicoId = req.medico.medico_id;
  const { estado, observaciones } = req.body;
  const fields = [];
  const params = [];

  if (estado) {
    fields.push("estado=?");
    params.push(estado);
  }
  if (observaciones !== undefined) {
    fields.push("observaciones=?");
    params.push(observaciones);
  }
  if (fields.length === 0)
    return res.status(400).json({ error: "Sin campos para actualizar" });

  fields.push("updated_at=CURRENT_TIMESTAMP");
  params.push(req.params.id);
  params.push(medicoId);

  db.run(
    `UPDATE citas SET ${fields.join(",")} WHERE id=? AND medico_id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (observaciones) {
        db.run(
          "INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
          [req.params.id, "medico", observaciones, req.medico.nombre],
        );
      }
      res.json({ mensaje: "Cita actualizada correctamente" });
    },
  );
});

app.put("/api/medico/citas/:id/estado", medicoAuthMiddleware, (req, res) => {
  const medicoId = req.medico.medico_id;
  const { estado, observaciones } = req.body;
  const fields = [];
  const params = [];
  if (estado) {
    fields.push("estado=?");
    params.push(estado);
  }
  if (observaciones !== undefined) {
    fields.push("observaciones=?");
    params.push(observaciones);
  }
  if (fields.length === 0) return res.status(400).json({ error: "Sin campos" });
  fields.push("updated_at=CURRENT_TIMESTAMP");
  params.push(req.params.id, medicoId);
  db.run(
    `UPDATE citas SET ${fields.join(",")} WHERE id=? AND medico_id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (observaciones) {
        db.run(
          "INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
          [req.params.id, "medico", observaciones, req.medico.nombre],
        );
      }
      res.json({ mensaje: "Estado actualizado correctamente" });
    },
  );
});

app.get("/api/medico/pacientes", medicoAuthMiddleware, (req, res) => {
  const medicoId = req.medico.medico_id;
  const { busqueda } = req.query;
  let query = `SELECT c.nombre_paciente, c.telefono, c.correo, c.direccion, c.ciudad,
    MAX(c.created_at) as ultima_cita, COUNT(c.id) as total_citas,
    GROUP_CONCAT(DISTINCT s.nombre) as servicios
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.medico_id=?`;
  const params = [medicoId];

  if (busqueda) {
    query += " AND (c.nombre_paciente LIKE ? OR c.telefono LIKE ?)";
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }

  query += " GROUP BY c.nombre_paciente, c.telefono ORDER BY ultima_cita DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const result = (rows || []).map((r, i) => ({
      ...r,
      id: i + 1,
      nombre: r.nombre_paciente,
    }));
    res.json(result);
  });
});

app.get(
  "/api/medico/pacientes/:telefono",
  medicoAuthMiddleware,
  async (req, res) => {
    try {
      const medicoId = req.medico.medico_id;
      const telefono = req.params.telefono;
      const [citas, paciente] = await Promise.all([
        dbAll(
          `SELECT c.*, s.nombre as servicio_nombre FROM citas c
        LEFT JOIN servicios s ON c.servicio_id=s.id
        WHERE c.medico_id=? AND c.telefono=? ORDER BY c.created_at DESC`,
          [medicoId, telefono],
        ),
        dbGet(
          `SELECT nombre_paciente, telefono, correo, direccion, ciudad
        FROM citas WHERE medico_id=? AND telefono=? LIMIT 1`,
          [medicoId, telefono],
        ),
      ]);
      const resultadoIds = citas
        .filter((c) => c.estado === "completada")
        .map((c) => c.id);
      let resultados = [];
      if (resultadoIds.length > 0) {
        const placeholders = resultadoIds.map(() => "?").join(",");
        resultados = await dbAll(
          `SELECT * FROM resultados_citas WHERE cita_id IN (${placeholders}) ORDER BY created_at DESC`,
          resultadoIds,
        );
      }
      res.json({
        success: true,
        paciente: paciente
          ? {
              nombre: paciente.nombre_paciente,
              telefono: paciente.telefono,
              correo: paciente.correo || "",
            }
          : null,
        citas: citas || [],
        resultados: resultados || [],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/medico/citas/:id/resultado",
  medicoAuthMiddleware,
  (req, res) => {
    const medicoId = req.medico.medico_id;
    db.get(
      "SELECT * FROM citas WHERE id=? AND medico_id=?",
      [req.params.id, medicoId],
      (err, cita) => {
        if (err || !cita)
          return res.status(404).json({ error: "Cita no encontrada" });
        upload.single("archivo")(req, res, function (err) {
          if (err) {
            if (err instanceof multer.MulterError)
              return res.status(400).json({ error: err.message });
            return res.status(400).json({ error: err.message });
          }
          if (!req.file)
            return res
              .status(400)
              .json({ error: "Debe seleccionar un archivo" });
          const nota = req.body.nota ? String(req.body.nota).trim() : "";
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
                return res.status(500).json({ error: "Error al guardar" });
              db.run(
                "UPDATE citas SET estado='completada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado!='cancelada'",
                [req.params.id],
              );
              res.json({
                id: this.lastID,
                mensaje: "Resultado registrado correctamente",
                archivo: req.file.filename,
              });
            },
          );
        });
      },
    );
  },
);

app.get("/api/medico/resultados", medicoAuthMiddleware, (req, res) => {
  const medicoId = req.medico.medico_id;
  db.all(
    `SELECT rc.*, c.nombre_paciente, c.codigo_cita, c.fecha as cita_fecha
    FROM resultados_citas rc JOIN citas c ON rc.cita_id=c.id
    WHERE c.medico_id=? ORDER BY rc.created_at DESC`,
    [medicoId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.get("/api/medico/notificaciones", medicoAuthMiddleware, (req, res) => {
  db.all(
    "SELECT * FROM notificaciones WHERE usuario_id=? ORDER BY created_at DESC LIMIT 50",
    [req.medico.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.put(
  "/api/medico/notificaciones/:id/leer",
  medicoAuthMiddleware,
  (req, res) => {
    db.run(
      "UPDATE notificaciones SET leida=1 WHERE id=? AND usuario_id=?",
      [req.params.id, req.medico.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Notificación marcada como leída" });
      },
    );
  },
);

app.put(
  "/api/medico/notificaciones/leer-todas",
  medicoAuthMiddleware,
  (req, res) => {
    db.run(
      "UPDATE notificaciones SET leida=1 WHERE usuario_id=? AND leida=0",
      [req.medico.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Todas las notificaciones marcadas como leídas" });
      },
    );
  },
);

};
