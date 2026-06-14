const { db } = require("../db/database");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const bcrypt = require("bcryptjs");

module.exports = function(app) {
app.get("/api/admin/servicios", authMiddleware, (req, res) => {
  db.all("SELECT * FROM servicios ORDER BY nombre", (err, rows) =>
    res.json(rows),
  );
});

app.post("/api/admin/servicios", authMiddleware, (req, res) => {
  const { nombre, descripcion, icono, precio, duracion } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  db.run(
    "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
    [
      nombre,
      descripcion || "",
      icono || "fa-stethoscope",
      precio || 0,
      duracion || 30,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: "Servicio creado" });
    },
  );
});

app.put("/api/admin/servicios/:id", authMiddleware, (req, res) => {
  const { nombre, descripcion, icono, precio, duracion, activo } = req.body;
  const fields = [];
  const params = [];
  if (nombre !== undefined) {
    fields.push("nombre=?");
    params.push(nombre);
  }
  if (descripcion !== undefined) {
    fields.push("descripcion=?");
    params.push(descripcion);
  }
  if (icono !== undefined) {
    fields.push("icono=?");
    params.push(icono);
  }
  if (precio !== undefined) {
    fields.push("precio=?");
    params.push(precio);
  }
  if (duracion !== undefined) {
    fields.push("duracion=?");
    params.push(duracion);
  }
  if (activo !== undefined) {
    fields.push("activo=?");
    params.push(activo);
  }
  if (fields.length === 0) return res.status(400).json({ error: "Sin campos" });
  params.push(req.params.id);
  db.run(
    `UPDATE servicios SET ${fields.join(",")} WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Servicio actualizado" });
    },
  );
});

app.delete("/api/admin/servicios/:id", authMiddleware, (req, res) => {
  db.run(
    "UPDATE servicios SET activo=0 WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Servicio desactivado" });
    },
  );
});

// --- ADMIN DISPONIBILIDAD (Availability) ---

app.get("/api/admin/disponibilidad", authMiddleware, (req, res) => {
  const { servicio_id } = req.query;
  let sql = `SELECT d.*, s.nombre as servicio_nombre
    FROM disponibilidad d JOIN servicios s ON d.servicio_id=s.id`;
  const params = [];
  if (servicio_id) {
    sql += " WHERE d.servicio_id=?";
    params.push(servicio_id);
  }
  sql += " ORDER BY s.nombre, d.dia_semana, d.hora_inicio";
  db.all(sql, params, (err, rows) => res.json(rows || []));
});

app.post("/api/admin/disponibilidad", authMiddleware, (req, res) => {
  const { servicio_id, dia_semana, hora_inicio, hora_fin, duracion, capacidad } =
    req.body;
  if (!servicio_id || dia_semana === undefined || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: "Todos los campos son requeridos" });
  }
  db.run(
    "INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion, capacidad) VALUES (?,?,?,?,?,?)",
    [servicio_id, dia_semana, hora_inicio, hora_fin, duracion || 30, capacidad || 1],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: "Disponibilidad creada" });
    },
  );
});

app.put("/api/admin/disponibilidad/:id", authMiddleware, (req, res) => {
  const { servicio_id, dia_semana, hora_inicio, hora_fin, duracion, capacidad, activo } =
    req.body;
  const fields = [];
  const params = [];
  if (servicio_id !== undefined) {
    fields.push("servicio_id=?");
    params.push(servicio_id);
  }
  if (dia_semana !== undefined) {
    fields.push("dia_semana=?");
    params.push(dia_semana);
  }
  if (hora_inicio !== undefined) {
    fields.push("hora_inicio=?");
    params.push(hora_inicio);
  }
  if (hora_fin !== undefined) {
    fields.push("hora_fin=?");
    params.push(hora_fin);
  }
  if (duracion !== undefined) {
    fields.push("duracion=?");
    params.push(duracion);
  }
  if (capacidad !== undefined) {
    fields.push("capacidad=?");
    params.push(capacidad);
  }
  if (activo !== undefined) {
    fields.push("activo=?");
    params.push(activo);
  }
  if (fields.length === 0)
    return res.status(400).json({ error: "Sin campos para actualizar" });
  params.push(req.params.id);
  db.run(
    `UPDATE disponibilidad SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Disponibilidad actualizada" });
    },
  );
});

app.delete("/api/admin/disponibilidad/:id", authMiddleware, (req, res) => {
  db.run(
    "DELETE FROM disponibilidad WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Disponibilidad eliminada" });
    },
  );
});

// ── NEW: Disponibilidad grouped by service (for the redesigned admin panel) ──

app.get("/api/admin/disponibilidad/grupos", authMiddleware, (req, res) => {
  const { servicio_id } = req.query;
  let sql = `SELECT d.*, s.nombre as servicio_nombre, s.descripcion, s.icono, s.activo as servicio_activo
    FROM disponibilidad d JOIN servicios s ON d.servicio_id=s.id`;
  const params = [];
  if (servicio_id) {
    sql += " WHERE d.servicio_id=?";
    params.push(servicio_id);
  }
  sql += " ORDER BY s.nombre, d.dia_semana, d.hora_inicio";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const grouped = {};
    (rows || []).forEach((r) => {
      if (!grouped[r.servicio_id]) {
        grouped[r.servicio_id] = {
          servicio_id: r.servicio_id,
          nombre: r.servicio_nombre,
          descripcion: r.descripcion,
          icono: r.icono || "fa-stethoscope",
          servicio_activo: r.servicio_activo,
          bloques: [],
          capacidad: r.capacidad || 1,
        };
      }
      grouped[r.servicio_id].bloques.push({
        id: r.id,
        dia_semana: r.dia_semana,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        duracion: r.duracion || 30,
        activo: r.activo,
        capacidad: r.capacidad || 1,
      });
    });
    res.json(Object.values(grouped));
  });
});

app.put("/api/admin/disponibilidad/grupos/:servicioId", authMiddleware, (req, res) => {
  const { capacidad, nota_admin, estado } = req.body;
  const servicioId = req.params.servicioId;
  const updates = [];
  const params = [];
  if (capacidad !== undefined) {
    updates.push("capacidad=?");
    params.push(capacidad);
  }
  if (estado !== undefined) {
    updates.push("activo=?");
    params.push(estado === "activo" ? 1 : 0);
  }
  if (updates.length > 0) {
    params.push(servicioId);
    db.run(
      `UPDATE disponibilidad SET ${updates.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE servicio_id=?`,
      params,
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Disponibilidad actualizada" });
      },
    );
  } else {
    res.json({ mensaje: "Sin cambios" });
  }
});

// ── Excepciones y Bloqueos ──

app.get("/api/admin/disponibilidad/excepciones", authMiddleware, (req, res) => {
  const { servicio_id } = req.query;
  let sql = `SELECT e.*, s.nombre as servicio_nombre
    FROM disponibilidad_excepciones e JOIN servicios s ON e.servicio_id=s.id`;
  const params = [];
  if (servicio_id) {
    sql += " WHERE e.servicio_id=?";
    params.push(servicio_id);
  }
  sql += " ORDER BY e.fecha DESC";
  db.all(sql, params, (err, rows) => res.json(rows || []));
});

app.post("/api/admin/disponibilidad/excepciones", authMiddleware, (req, res) => {
  const { servicio_id, fecha, motivo, tipo, hora_inicio, hora_fin, activo, observacion } = req.body;
  if (!servicio_id || !fecha) {
    return res.status(400).json({ error: "servicio_id y fecha son requeridos" });
  }
  db.run(
    "INSERT INTO disponibilidad_excepciones (servicio_id, fecha, motivo, tipo, hora_inicio, hora_fin, activo, observacion) VALUES (?,?,?,?,?,?,?,?)",
    [servicio_id, fecha, motivo || "", tipo || "no_disponible", hora_inicio || null, hora_fin || null, activo !== undefined ? activo : 1, observacion || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: "Excepción creada" });
    },
  );
});

app.put("/api/admin/disponibilidad/excepciones/:id", authMiddleware, (req, res) => {
  const fields = [];
  const params = [];
  ["servicio_id", "fecha", "motivo", "tipo", "hora_inicio", "hora_fin", "activo", "observacion"].forEach((f) => {
    if (req.body[f] !== undefined) {
      fields.push(f + "=?");
      params.push(req.body[f]);
    }
  });
  if (fields.length === 0) return res.status(400).json({ error: "Sin campos para actualizar" });
  params.push(req.params.id);
  db.run(
    `UPDATE disponibilidad_excepciones SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Excepción actualizada" });
    },
  );
});

app.delete("/api/admin/disponibilidad/excepciones/:id", authMiddleware, (req, res) => {
  db.run("DELETE FROM disponibilidad_excepciones WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: "Excepción eliminada" });
  });
});

// ── KPI Stats ──

app.get("/api/admin/disponibilidad/stats", authMiddleware, (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  let serviciosActivos = 0;
  let bloquesActivos = 0;
  let citasHoy = 0;
  let ocupacionPromedio = 0;

  db.get("SELECT COUNT(*) as c FROM servicios WHERE activo=1", (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    serviciosActivos = row.c;
    db.get("SELECT COUNT(*) as c FROM disponibilidad WHERE activo=1", (err2, row2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      bloquesActivos = row2.c;
      db.get("SELECT COUNT(*) as c FROM citas WHERE fecha=?", [hoy], (err3, row3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        citasHoy = row3.c;
        db.get("SELECT COUNT(*) as total FROM citas WHERE estado NOT IN ('cancelada')", (err4, totalRow) => {
          if (err4) return res.status(500).json({ error: err4.message });
          const totalCitas = totalRow.c;
          const totalSlotsQuery = `SELECT SUM(
            CAST(
              (CAST(SUBSTR(hora_fin,1,2) AS INTEGER)*60 + CAST(SUBSTR(hora_fin,4,2) AS INTEGER)
               - CAST(SUBSTR(hora_inicio,1,2) AS INTEGER)*60 - CAST(SUBSTR(hora_inicio,4,2) AS INTEGER))
            AS REAL) / duracion
          ) as total_slots FROM disponibilidad WHERE activo=1`;
          db.get(totalSlotsQuery, (err5, slotsRow) => {
            if (err5) return res.status(500).json({ error: err5.message });
            const raw = slotsRow?.total_slots;
            const totalSlots = (raw != null && isFinite(raw)) ? Math.round(raw) : 1;
            ocupacionPromedio = totalCitas > 0 ? Math.min(100, Math.round((totalCitas / Math.max(totalSlots, 1)) * 100)) : 0;
            res.json({
              servicios_activos: serviciosActivos,
              horarios_configurados: bloquesActivos,
              citas_hoy: citasHoy,
              ocupacion_promedio: ocupacionPromedio + "%",
            });
          });
        });
      });
    });
  });
});

// ── NEW: update horarios endpoint to respect capacity ──
// (the existing GET /api/disponibilidad/horarios is updated in place)

// --- ADMIN DOCTORS ---

app.get("/api/admin/medicos", authMiddleware, (req, res) => {
  db.all(
    `SELECT m.*, GROUP_CONCAT(s.nombre) as servicios_nombres
    FROM medicos m LEFT JOIN medico_servicios ms ON m.id=ms.medico_id LEFT JOIN servicios s ON ms.servicio_id=s.id
    GROUP BY m.id ORDER BY m.nombre`,
    (err, rows) => res.json(rows || []),
  );
});

app.post("/api/admin/medicos", authMiddleware, (req, res) => {
  const { nombre, especialidad, telefono, correo } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  db.run(
    "INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
    [nombre, especialidad || "", telefono || "", correo || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: "Médico registrado" });
    },
  );
});

app.put("/api/admin/medicos/:id", authMiddleware, (req, res) => {
  const { nombre, especialidad, telefono, correo, activo } = req.body;
  const fields = [];
  const params = [];
  if (nombre !== undefined) {
    fields.push("nombre=?");
    params.push(nombre);
  }
  if (especialidad !== undefined) {
    fields.push("especialidad=?");
    params.push(especialidad);
  }
  if (telefono !== undefined) {
    fields.push("telefono=?");
    params.push(telefono);
  }
  if (correo !== undefined) {
    fields.push("correo=?");
    params.push(correo);
  }
  if (activo !== undefined) {
    fields.push("activo=?");
    params.push(activo);
  }
  if (fields.length === 0) return res.status(400).json({ error: "Sin campos" });
  params.push(req.params.id);
  db.run(
    `UPDATE medicos SET ${fields.join(",")} WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Médico actualizado" });
    },
  );
});

app.delete("/api/admin/medicos/:id", authMiddleware, (req, res) => {
  db.run(
    "UPDATE medicos SET activo=0 WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Médico desactivado" });
    },
  );
});

app.get("/api/admin/medicos/:id/servicios", authMiddleware, (req, res) => {
  db.all(
    "SELECT servicio_id FROM medico_servicios WHERE medico_id=?",
    [req.params.id],
    (err, rows) => {
      res.json((rows || []).map((r) => r.servicio_id));
    },
  );
});

app.post("/api/admin/medicos/:id/servicios", authMiddleware, (req, res) => {
  const { servicio_ids } = req.body;
  db.run(
    "DELETE FROM medico_servicios WHERE medico_id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (servicio_ids && servicio_ids.length > 0) {
        const stmt = db.prepare(
          "INSERT INTO medico_servicios (medico_id, servicio_id) VALUES (?,?)",
        );
        for (const sid of servicio_ids) stmt.run(req.params.id, sid);
        stmt.finalize();
      }
      res.json({ mensaje: "Servicios asignados" });
    },
  );
});

// --- ADMIN USER CRUD ---

app.get("/api/admin/usuarios", authMiddleware, (req, res) => {
  db.all(
    `SELECT u.id, u.nombre, u.usuario, u.rol, u.especialidad, u.telefono, u.correo, u.activo, u.created_at
    FROM usuarios_admin u ORDER BY u.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.post("/api/admin/usuarios", authMiddleware, (req, res) => {
  const { nombre, usuario, password, rol, especialidad, telefono, correo } =
    req.body;
  console.log("[usuarios] POST", { nombre, usuario, rol, especialidad });
  if (!nombre || !usuario || !password)
    return res
      .status(400)
      .json({ error: "Nombre, usuario y contraseña requeridos" });
  if (rol === "medico" && !especialidad)
    return res
      .status(400)
      .json({ error: "Debe especificar una especialidad médica" });
  db.get(
    "SELECT id FROM usuarios_admin WHERE usuario=?",
    [usuario],
    (err, row) => {
      if (row) return res.status(400).json({ error: "El usuario ya existe" });
      const hash = bcrypt.hashSync(password, 10);
      db.run(
        "INSERT INTO usuarios_admin (nombre, usuario, password, rol, especialidad, telefono, correo) VALUES (?,?,?,?,?,?,?)",
        [
          nombre,
          usuario,
          hash,
          rol || "admin",
          rol === "medico" ? especialidad : null,
          telefono || "",
          correo || "",
        ],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          console.log("[usuarios] Creado id=" + this.lastID + " rol=" + rol);
          res.json({
            id: this.lastID,
            mensaje: "Usuario creado correctamente",
          });
        },
      );
    },
  );
});

app.put("/api/admin/usuarios/:id", authMiddleware, (req, res) => {
  const {
    nombre,
    usuario,
    password,
    rol,
    especialidad,
    telefono,
    correo,
    activo,
  } = req.body;
  console.log("[usuarios] PUT id=" + req.params.id, {
    nombre,
    usuario,
    rol,
    especialidad,
    activo,
  });
  if (rol === "medico" && !especialidad)
    return res
      .status(400)
      .json({ error: "Debe especificar una especialidad médica" });
  const fields = [];
  const params = [];
  if (nombre !== undefined) {
    fields.push("nombre=?");
    params.push(nombre);
  }
  if (usuario !== undefined) {
    fields.push("usuario=?");
    params.push(usuario);
  }
  if (password) {
    fields.push("password=?");
    params.push(bcrypt.hashSync(password, 10));
  }
  if (rol !== undefined) {
    fields.push("rol=?");
    params.push(rol);
  }
  if (especialidad !== undefined) {
    fields.push("especialidad=?");
    params.push(rol === "medico" ? especialidad : null);
  }
  if (telefono !== undefined) {
    fields.push("telefono=?");
    params.push(telefono);
  }
  if (correo !== undefined) {
    fields.push("correo=?");
    params.push(correo);
  }
  if (activo !== undefined) {
    fields.push("activo=?");
    params.push(activo);
  }
  if (fields.length === 0)
    return res.status(400).json({ error: "Sin campos para actualizar" });
  params.push(req.params.id);
  db.run(
    `UPDATE usuarios_admin SET ${fields.join(",")} WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Usuario actualizado correctamente" });
    },
  );
});

app.delete("/api/admin/usuarios/:id", authMiddleware, (req, res) => {
  db.run(
    "UPDATE usuarios_admin SET activo=0 WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Usuario desactivado" });
    },
  );
});

// ── ADMIN ARS CRUD ──

app.get("/api/admin/ars", authMiddleware, (req, res) => {
  db.all("SELECT * FROM ars ORDER BY nombre", (err, rows) =>
    res.json(rows || []),
  );
});

app.post("/api/admin/ars", authMiddleware, (req, res) => {
  const { nombre, cobertura } = req.body;
  if (!nombre || cobertura === undefined)
    return res.status(400).json({ error: "Nombre y cobertura requeridos" });
  db.run(
    "INSERT INTO ars (nombre, cobertura) VALUES (?,?)",
    [nombre, cobertura],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: "ARS creada correctamente" });
    },
  );
});

app.put("/api/admin/ars/:id", authMiddleware, (req, res) => {
  const { nombre, cobertura, activo } = req.body;
  const fields = [];
  const params = [];
  if (nombre !== undefined) {
    fields.push("nombre=?");
    params.push(nombre);
  }
  if (cobertura !== undefined) {
    fields.push("cobertura=?");
    params.push(cobertura);
  }
  if (activo !== undefined) {
    fields.push("activo=?");
    params.push(activo);
  }
  if (fields.length === 0) return res.status(400).json({ error: "Sin campos" });
  params.push(req.params.id);
  db.run(
    `UPDATE ars SET ${fields.join(",")} WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "ARS actualizada correctamente" });
    },
  );
});

app.delete("/api/admin/ars/:id", authMiddleware, (req, res) => {
  db.run("UPDATE ars SET activo=0 WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: "ARS desactivada" });
  });
});
};
