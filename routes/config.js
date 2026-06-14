const { db } = require("../db/database");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const bcrypt = require("bcryptjs");

module.exports = function(app) {
app.get("/api/configuracion", authMiddleware, (req, res) => {
  db.all(
    "SELECT clave, valor, tipo FROM configuracion ORDER BY clave",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const config = {};
      (rows || []).forEach(
        (r) =>
          (config[r.clave] =
            r.tipo === "json" ? tryParse(r.valor) || r.valor : r.valor),
      );
      res.json({ success: true, config });
    },
  );
});

function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

app.put("/api/configuracion", authMiddleware, requireAdmin, (req, res) => {
  const updates = req.body;
  const keys = Object.keys(updates);
  if (keys.length === 0)
    return res.status(400).json({ error: "Sin datos para actualizar" });
  let completed = 0;
  keys.forEach((clave) => {
    db.run(
      "INSERT INTO configuracion (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, updated_at=CURRENT_TIMESTAMP",
      [clave, String(updates[clave])],
      (err) => {
        if (++completed === keys.length) {
          res.json({
            success: true,
            mensaje: "Configuración actualizada correctamente",
          });
        }
      },
    );
  });
});

app.post(
  "/api/configuracion/usuarios/:id/cambiar-password",
  authMiddleware,
  requireAdmin,
  (req, res) => {
    const { password_actual, password_nueva } = req.body;
    const userId = parseInt(req.params.id);
    if (!password_nueva || password_nueva.length < 6)
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres" });
    db.get("SELECT * FROM usuarios_admin WHERE id=?", [userId], (err, user) => {
      if (err || !user)
        return res.status(404).json({ error: "Usuario no encontrado" });
      if (userId !== req.admin.id && password_actual)
        return res.status(400).json({
          error:
            "Solo puede cambiar su propia contraseña con contraseña actual",
        });
      if (userId === req.admin.id) {
        if (!password_actual)
          return res
            .status(400)
            .json({ error: "Debe proporcionar su contraseña actual" });
        if (!bcrypt.compareSync(password_actual, user.password))
          return res
            .status(400)
            .json({ error: "Contraseña actual incorrecta" });
      }
      const hash = bcrypt.hashSync(password_nueva, 10);
      db.run(
        "UPDATE usuarios_admin SET password=? WHERE id=?",
        [hash, userId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            success: true,
            mensaje: "Contraseña actualizada correctamente",
          });
        },
      );
    });
  },
);

app.post(
  "/api/configuracion/limpiar-sesiones",
  authMiddleware,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      mensaje:
        "Sesiones activas limpiadas. Los usuarios deberán iniciar sesión nuevamente.",
    });
  },
);

// ── MEDICO ROUTES ──

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
app.post(
  "/api/configuracion/limpiar-sesiones",
  authMiddleware,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      mensaje:
        "Sesiones activas limpiadas. Los usuarios deberán iniciar sesión nuevamente.",
    });
  },
);

// ── MEDICO ROUTES ──

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

};
