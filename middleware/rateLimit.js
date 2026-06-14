const rateLimit = require("express-rate-limit");

const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intente de nuevo en 15 minutos." },
});

const limiterCitas = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de cita. Espere 15 minutos." },
});

const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Espere 15 minutos." },
});

const limiterTestEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, mensaje: "Demasiadas solicitudes de prueba. Espere 15 minutos." },
});

module.exports = { limiterGeneral, limiterCitas, limiterLogin, limiterTestEmail };
