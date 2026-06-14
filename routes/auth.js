const { db, SECRET } = require("../db/database");
const bcrypt = require("bcryptjs");
const { limiterLogin } = require("../middleware/rateLimit");
const { authMiddleware } = require("../middleware/auth");

module.exports = function(app) {
app.post("/api/login", limiterLogin, (req, res) => {
  const username = req.body.username || req.body.usuario || "";
  const password = req.body.password || "";
  db.get(
    "SELECT * FROM usuarios_admin WHERE usuario=?",
    [username],
    (err, user) => {
      if (!user)
        return res
          .status(401)
          .json({ success: false, error: "Usuario o contraseña incorrectos" });
      if (!user.activo)
        return res.status(401).json({
          success: false,
          error: "Usuario bloqueado. Contacte al administrador.",
        });
      if (!bcrypt.compareSync(password, user.password))
        return res
          .status(401)
          .json({ success: false, error: "Usuario o contraseña incorrectos" });
      const jwt = require("jsonwebtoken");
      const redirect = "/admin.html";
      const token = jwt.sign(
        {
          id: user.id,
          nombre: user.nombre,
          username: user.usuario,
          rol: user.rol,
          medico_id: user.rol === "medico" ? user.id : null,
          especialidad: user.especialidad || null,
        },
        SECRET,
        { expiresIn: "24h" },
      );
      res.json({
        success: true,
        token,
        redirect,
        usuario: {
          id: user.id,
          nombre: user.nombre,
          username: user.usuario,
          rol: user.rol,
          especialidad: user.especialidad || null,
        },
      });
    },
  );
});

app.get("/api/me", authMiddleware, (req, res) => {
  db.get(
    "SELECT id, nombre, usuario, rol, especialidad, telefono, correo, activo FROM usuarios_admin WHERE id=? AND activo=1",
    [req.admin.id],
    (err, user) => {
      if (err || !user)
        return res.status(401).json({
          success: false,
          error: "Usuario no encontrado o deshabilitado",
        });
      res.json({
        success: true,
        usuario: {
          id: user.id,
          nombre: user.nombre,
          username: user.usuario,
          rol: user.rol,
          especialidad: user.especialidad || null,
          telefono: user.telefono || null,
          correo: user.correo || null,
          activo: user.activo,
        },
      });
    },
  );
});
};
