require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { db } = require("./db/database");
const { initSchema } = require("./db/schema");
const { limiterGeneral } = require("./middleware/rateLimit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(function (req, res, next) {
  res.charset = "utf-8";
  next();
});

// Serve admin SPA
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/admin/", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/admin/login", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/medico", (req, res) => res.redirect("/admin.html"));

// Initialize database schema + seed data
initSchema(db);

// Mount route modules
require("./routes/auth")(app);
require("./routes/public")(app);
require("./routes/admin-citas")(app);
require("./routes/admin-recursos")(app);
require("./routes/facturas")(app);
require("./routes/reagendar")(app);
require("./routes/pacientes")(app);
require("./routes/medico")(app);
require("./routes/mensajes")(app);
require("./routes/reportes")(app);
require("./routes/config")(app);
require("./routes/test-email")(app);

// General rate limiter for all /api routes
app.use("/api", limiterGeneral);

// 404 handler for API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// Admin SPA build serves
const distPath = path.join(__dirname, "admin-spa", "dist");
app.use("/admin-spa", express.static(distPath));
app.get("/admin-spa/{*path}", (req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, () => {
  console.log(`✦ MediHomeRD corriendo en http://localhost:${PORT}`);
  console.log(`  Panel admin: http://localhost:${PORT}/admin.html`);
  console.log(`  Panel médico: http://localhost:${PORT}/medico.html`);
  console.log(`  Usuario: admin / Contraseña: admin1234`);
  console.log(`  Usuario: medico1 / Contraseña: medico123 (rol: médico)`);
});
