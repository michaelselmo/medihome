const { SECRET } = require("../db/database");

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1] || req.query.token;
  if (!token) {
    console.log("[auth] No autorizado - token faltante", req.method, req.path);
    return res.status(401).json({ error: "No autorizado" });
  }
  try {
    const jwt = require("jsonwebtoken");
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    console.log("[auth] Token inválido:", err.message, req.method, req.path);
    res.status(401).json({ error: "Token inválido" });
  }
}

function requireAdmin(req, res, next) {
  if (req.admin.rol !== "administrador") {
    return res.status(403).json({ success: false, error: "Acceso denegado: se requieren permisos de administrador" });
  }
  next();
}

function medicoAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, SECRET);
    if (decoded.rol !== "medico") return res.status(403).json({ error: "Acceso solo para médicos" });
    req.medico = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

module.exports = { authMiddleware, requireAdmin, medicoAuthMiddleware };
