const { limiterTestEmail } = require("../middleware/rateLimit");
const { sendAdminNotification } = require("../services/emailService");

module.exports = function(app) {
app.get("/api/test-email", limiterTestEmail, async (req, res) => {
  const expectedToken = process.env.TEST_EMAIL_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({
      success: false,
      mensaje: "Ruta no disponible: TEST_EMAIL_TOKEN no configurado",
    });
  }
  if (req.query.token !== expectedToken) {
    return res.status(401).json({ success: false, mensaje: "Token inválido" });
  }
  console.log("[test-email] Iniciando prueba de envío...");
  const result = await sendAdminNotification({
    nombre_paciente: "Test Render",
    telefono: "809-000-0000",
    correo: "test@render.com",
    servicio_nombre: "Prueba de diagnóstico",
    medico_nombre: "Dr. Diagnóstico",
    fecha: new Date().toISOString().split("T")[0],
    hora: "12:00 PM",
    codigo_cita: "MH-TEST",
    created_at: new Date().toISOString(),
    estado: "pendiente",
    admin_url: `${req.protocol}://${req.get("host")}/admin.html`,
  });
  console.log(
    `[test-email] Resultado: enviado=${result.sent}${result.reason ? ", razón: " + result.reason : ""}`,
  );
  res.json({
    success: result.sent,
    mensaje: result.sent
      ? "Correo de prueba enviado correctamente"
      : "Error al enviar correo de prueba",
    error: result.sent ? null : result.code || result.reason,
  });
});
};
