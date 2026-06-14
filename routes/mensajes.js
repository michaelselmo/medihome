const { db } = require("../db/database");
const { authMiddleware } = require("../middleware/auth");

module.exports = function(app) {
app.get("/api/mensajes", authMiddleware, (req, res) => {
  db.all(
    `SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
    FROM mensajes m JOIN usuarios_admin u ON m.remitente_id=u.id
    WHERE m.destinatario_tipo='admin' OR m.destinatario_id=? OR m.remitente_id=?
    ORDER BY m.created_at DESC LIMIT 50`,
    [req.admin.id, req.admin.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.get("/api/mensajes/entrada", authMiddleware, (req, res) => {
  db.all(
    `SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
    FROM mensajes m JOIN usuarios_admin u ON m.remitente_id=u.id
    WHERE m.destinatario_id=? OR (m.destinatario_tipo='admin' AND u.id!=?)
    ORDER BY m.created_at DESC LIMIT 50`,
    [req.admin.id, req.admin.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.get("/api/mensajes/enviados", authMiddleware, (req, res) => {
  db.all(
    `SELECT m.*, u.nombre as destinatario_nombre
    FROM mensajes m LEFT JOIN usuarios_admin u ON m.destinatario_id=u.id
    WHERE m.remitente_id=?
    ORDER BY m.created_at DESC LIMIT 50`,
    [req.admin.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.post("/api/mensajes", authMiddleware, (req, res) => {
  const { destinatario_id, destinatario_tipo, asunto, contenido } = req.body;
  if (!asunto || !contenido)
    return res.status(400).json({ error: "Asunto y contenido requeridos" });
  if (!destinatario_id && destinatario_tipo !== "todos")
    return res.status(400).json({ error: "Destinatario requerido" });

  if (destinatario_tipo === "todos") {
    db.all(
      "SELECT id FROM usuarios_admin WHERE activo=1 AND id!=?",
      [req.admin.id],
      (err, usuarios) => {
        if (err) return res.status(500).json({ error: err.message });
        const stmt = db.prepare(
          "INSERT INTO mensajes (remitente_id, destinatario_id, destinatario_tipo, asunto, contenido) VALUES (?,?,?,?,?)",
        );
        usuarios.forEach((u) =>
          stmt.run(req.admin.id, u.id, "individual", asunto, contenido),
        );
        stmt.finalize();
        res.json({
          mensaje: "Mensaje enviado a " + usuarios.length + " usuario(s)",
        });
      },
    );
  } else {
    db.run(
      "INSERT INTO mensajes (remitente_id, destinatario_id, destinatario_tipo, asunto, contenido) VALUES (?,?,?,?,?)",
      [
        req.admin.id,
        destinatario_id,
        destinatario_tipo || "individual",
        asunto,
        contenido,
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, mensaje: "Mensaje enviado correctamente" });
      },
    );
  }
});

app.put("/api/mensajes/:id/leer", authMiddleware, (req, res) => {
  db.run(
    "UPDATE mensajes SET leido=1, leido_at=CURRENT_TIMESTAMP WHERE id=? AND (destinatario_id=? OR destinatario_tipo='admin')",
    [req.params.id, req.admin.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Mensaje marcado como leído" });
    },
  );
});

app.get("/api/mensajes/no-leidos", authMiddleware, (req, res) => {
  db.get(
    `SELECT COUNT(*) as total FROM mensajes WHERE (destinatario_id=? OR destinatario_tipo='admin') AND leido=0 AND remitente_id!=?`,
    [req.admin.id, req.admin.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: row?.total || 0 });
    },
  );
});

// ── NOTIFICACIONES API ADMIN ──

app.get("/api/notificaciones", authMiddleware, (req, res) => {
  db.all(
    "SELECT n.*, u.nombre as usuario_nombre FROM notificaciones n JOIN usuarios_admin u ON n.usuario_id=u.id WHERE n.usuario_id=? ORDER BY n.created_at DESC LIMIT 50",
    [req.admin.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.put("/api/notificaciones/:id/leer", authMiddleware, (req, res) => {
  db.run(
    "UPDATE notificaciones SET leida=1 WHERE id=? AND usuario_id=?",
    [req.params.id, req.admin.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Notificación marcada como leída" });
    },
  );
});

app.put("/api/notificaciones/leer-todas", authMiddleware, (req, res) => {
  db.run(
    "UPDATE notificaciones SET leida=1 WHERE usuario_id=? AND leida=0",
    [req.admin.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: "Todas las notificaciones marcadas como leídas" });
    },
  );
});

app.get("/api/notificaciones/no-leidas", authMiddleware, (req, res) => {
  db.get(
    "SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id=? AND leida=0",
    [req.admin.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: row?.total || 0 });
    },
  );
});

};
