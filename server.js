require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const {
  sendAdminNotification,
  sendNewCitaNotification,
  sendResultadoNotification,
} = require("./services/emailService");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "medihome.db");
const SECRET = process.env.SECRET || "medihome_secret_key_2026";

const db = new sqlite3.Database(DB_PATH);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve admin.html (correct version) at /admin, /admin/, /admin/*
function noCache(req, res, next) {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  next();
}
app.get("/admin", noCache, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html")),
);
app.get("/admin/", noCache, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html")),
);
app.get("/admin/login", noCache, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html")),
);
app.get("/medico", (req, res) => res.redirect("/admin.html"));

app.use(function (req, res, next) {
  res.charset = "utf-8";
  next();
});

// ── Rate limiters ──
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
  message: {
    error: "Demasiados intentos de inicio de sesión. Espere 15 minutos.",
  },
});

const limiterTestEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    mensaje: "Demasiadas solicitudes de prueba. Espere 15 minutos.",
  },
});

const RESULTADOS_DIR = path.join(__dirname, "uploads", "resultados");
const RESULTADOS_PACIENTE_DIR = path.join(__dirname, "uploads", "resultados_paciente");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require("fs");
    if (!fs.existsSync(RESULTADOS_DIR))
      fs.mkdirSync(RESULTADOS_DIR, { recursive: true });
    cb(null, RESULTADOS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const citaId = req.params.id || "unknown";
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const safeName = "resultado_cita_" + citaId + "_" + date + ext;
    cb(null, safeName);
  },
});
const fileFilter = (req, file, cb) => {
  const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else
    cb(
      new Error("Tipo de archivo no permitido. Solo PDF, JPG, JPEG, PNG."),
      false,
    );
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const storagePaciente = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require("fs");
    if (!fs.existsSync(RESULTADOS_PACIENTE_DIR))
      fs.mkdirSync(RESULTADOS_PACIENTE_DIR, { recursive: true });
    cb(null, RESULTADOS_PACIENTE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const pacienteId = req.params.id || "unknown";
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const safeName = "resultado_pac_" + pacienteId + "_" + date + "_" + Date.now() + ext;
    cb(null, safeName);
  },
});
const uploadPaciente = multer({ storage: storagePaciente, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

function generarCodigoCita() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "MH-";
  for (let i = 0; i < 6; i++)
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  return codigo;
}

function escHtml(str) {
  if (typeof str !== "string") return str || "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDoctorAssignmentEmail(d) {
  var modalidadIcon = d.modalidad === "telemedicina" ? "📹" : "🏠";
  var modalidadLabel =
    d.modalidad === "telemedicina" ? "Telemedicina" : "A Domicilio";
  return (
    '<div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.04)">' +
    '<div style="background:linear-gradient(135deg,#2563eb,#0ea5e5);padding:28px 32px;text-align:center">' +
    '<div style="font-size:2rem;margin-bottom:8px">🏥</div>' +
    '<h1 style="color:#ffffff;font-size:1.3rem;margin:0;font-weight:700;letter-spacing:-0.3px">Nueva Cita Asignada</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:0.85rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>' +
    '<div style="padding:28px 32px">' +
    '<p style="color:#0f172a;font-size:0.95rem;margin:0 0 20px">Se le ha asignado una nueva cita médica. A continuación los detalles:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:120px;font-weight:600">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' +
    escHtml(d.nombre_paciente) +
    "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Código</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#2563eb;font-weight:700">' +
    escHtml(d.codigo_cita) +
    "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' +
    escHtml(d.servicio_nombre) +
    "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Fecha</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' +
    escHtml(d.fecha) +
    "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Hora</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' +
    escHtml(d.hora) +
    "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Modalidad</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' +
    modalidadIcon +
    " " +
    modalidadLabel +
    "</td></tr>" +
    (d.direccion
      ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Dirección</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' +
        escHtml(d.direccion) +
        (d.ciudad ? ", " + escHtml(d.ciudad) : "") +
        "</td></tr>"
      : "") +
    (d.comentario
      ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Comentarios</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' +
        escHtml(d.comentario) +
        "</td></tr>"
      : "") +
    "</table>" +
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:20px">' +
    '<p style="margin:0;color:#166534;font-size:0.8rem"><strong>💡 Recordatorio:</strong> Puede gestionar esta cita desde su panel de médico. Ingrese los resultados y observaciones después de atender al paciente.</p></div>' +
    '<a href="' +
    escHtml(process.env.PUBLIC_URL || "http://localhost:3000") +
    '/medico.html" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#0ea5e5);color:white;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-size:0.9rem">Ir al Panel Médico</a></div>' +
    '<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>'
  );
}

function buildDoctorAssignmentText(d) {
  var modalidadLabel =
    d.modalidad === "telemedicina" ? "Telemedicina" : "A Domicilio";
  return (
    "NUEVA CITA ASIGNADA\n\n" +
    "Se le ha asignado una nueva cita médica.\n\n" +
    "Paciente: " +
    (d.nombre_paciente || "") +
    "\n" +
    "Código: " +
    (d.codigo_cita || "") +
    "\n" +
    "Servicio: " +
    (d.servicio_nombre || "") +
    "\n" +
    "Fecha: " +
    (d.fecha || "") +
    "\n" +
    "Hora: " +
    (d.hora || "") +
    "\n" +
    "Modalidad: " +
    modalidadLabel +
    "\n" +
    (d.direccion
      ? "Dirección: " + d.direccion + (d.ciudad ? ", " + d.ciudad : "") + "\n"
      : "") +
    (d.comentario ? "Comentarios: " + d.comentario + "\n" : "") +
    "\nPuede gestionar esta cita desde su panel de médico.\n" +
    (process.env.PUBLIC_URL || "http://localhost:3000") +
    "/medico.html\n"
  );
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios_admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'admin',
    especialidad TEXT,
    telefono TEXT,
    correo TEXT,
    medico_id INTEGER,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(medico_id) REFERENCES medicos(id)
  )`);
  db.run("ALTER TABLE usuarios_admin ADD COLUMN especialidad TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE usuarios_admin ADD COLUMN telefono TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE usuarios_admin ADD COLUMN correo TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });

  db.run(`CREATE TABLE IF NOT EXISTS ars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    cobertura INTEGER NOT NULL DEFAULT 0,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_factura TEXT UNIQUE NOT NULL,
    cita_id INTEGER NOT NULL,
    paciente_nombre TEXT NOT NULL,
    cedula TEXT,
    servicio_id INTEGER,
    servicio_nombre TEXT,
    precio_base REAL NOT NULL,
    ars_nombre TEXT,
    cobertura_porcentaje INTEGER DEFAULT 0,
    monto_cubierto REAL DEFAULT 0,
    monto_pagar REAL DEFAULT 0,
    estado TEXT DEFAULT 'pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cita_id) REFERENCES citas(id)
  )`);

  // Migrations: new factura columns
  db.run(
    "ALTER TABLE facturas ADD COLUMN cobertura_estado TEXT DEFAULT 'pendiente_de_validacion'",
    (err) => {
      if (err && !err.message.includes("duplicate column"))
        console.error("[db]", err.message);
    },
  );
  db.run("ALTER TABLE facturas ADD COLUMN numero_autorizacion TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE facturas ADD COLUMN observacion_ars TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE facturas ADD COLUMN tipo_calculo TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run(
    "ALTER TABLE facturas ADD COLUMN porcentaje_autorizado REAL DEFAULT 0",
    (err) => {
      if (err && !err.message.includes("duplicate column"))
        console.error("[db]", err.message);
    },
  );
  db.run(
    "ALTER TABLE facturas ADD COLUMN monto_autorizado REAL DEFAULT 0",
    (err) => {
      if (err && !err.message.includes("duplicate column"))
        console.error("[db]", err.message);
    },
  );
  db.run(
    "UPDATE facturas SET cobertura_estado='pendiente_de_validacion' WHERE cobertura_estado IS NULL",
    (err) => {
      if (err) console.error("[db]", err.message);
    },
  );
  db.run(
    "ALTER TABLE facturas ADD COLUMN factura_enviada_email INTEGER DEFAULT 0",
    (err) => {
      if (err && !err.message.includes("duplicate column"))
        console.error("[db]", err.message);
    },
  );
  db.run(
    "ALTER TABLE facturas ADD COLUMN fecha_envio_email DATETIME",
    (err) => {
      if (err && !err.message.includes("duplicate column"))
        console.error("[db]", err.message);
    },
  );
  db.run("ALTER TABLE facturas ADD COLUMN email_destino TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });

  // Seed ARS defaults
  db.get("SELECT COUNT(*) as count FROM ars", (err, row) => {
    const arsList = [
      ["SENASA", 80],
      ["ARS Universal", 75],
      ["ARS Humano", 75],
      ["ARS Primera", 70],
      ["ARS Reservas", 70],
      ["ARS Mapfre Salud", 70],
      ["ARS La Colonial", 65],
      ["ARS Abel González", 65],
      ["ARS Yunen", 65],
      ["ARS GMA", 60],
      ["ARS Futuro", 60],
      ["ARS Renacer", 60],
      ["ARS Meta Salud", 60],
      ["ARS ASEMAP", 55],
      ["ARS SEMMA", 55],
      ["ARS Plan Salud Banco Central", 55],
      ["ARS CMD", 50],
      ["IDOPPRIL", 50],
      ["No tengo seguro", 0],
    ];
    if (row && row.count === 0) {
      const stmt = db.prepare(
        "INSERT INTO ars (nombre, cobertura) VALUES (?,?)",
      );
      arsList.forEach((a) => stmt.run(a[0], a[1]));
      stmt.finalize();
      console.log("[seed] ARS por defecto insertadas");
    } else if (row && row.count > 0 && row.count !== arsList.length) {
      db.run("DELETE FROM ars", (err2) => {
        if (err2) return;
        const stmt = db.prepare(
          "INSERT INTO ars (nombre, cobertura) VALUES (?,?)",
        );
        arsList.forEach((a) => stmt.run(a[0], a[1]));
        stmt.finalize();
        console.log("[seed] ARS actualizadas a nueva lista");
      });
    }
  });

  db.run(
    `CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    mensaje TEXT,
    tipo TEXT DEFAULT 'info',
    leida INTEGER DEFAULT 0,
    cita_id INTEGER,
    paciente_nombre TEXT,
    servicio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios_admin(id)
  )`,
    function () {
      db.all("PRAGMA table_info(notificaciones)", (err, cols) => {
        if (err) return;
        const names = cols.map((c) => c.name);
        if (!names.includes("cita_id"))
          db.run("ALTER TABLE notificaciones ADD COLUMN cita_id INTEGER");
        if (!names.includes("paciente_nombre"))
          db.run("ALTER TABLE notificaciones ADD COLUMN paciente_nombre TEXT");
        if (!names.includes("servicio"))
          db.run("ALTER TABLE notificaciones ADD COLUMN servicio TEXT");
      });
    },
  );

  db.run(`CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remitente_id INTEGER NOT NULL,
    destinatario_tipo TEXT NOT NULL DEFAULT 'admin',
    destinatario_id INTEGER,
    asunto TEXT NOT NULL,
    contenido TEXT NOT NULL,
    leido INTEGER DEFAULT 0,
    leido_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(remitente_id) REFERENCES usuarios_admin(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    tipo TEXT DEFAULT 'texto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed config defaults
  db.get("SELECT COUNT(*) as count FROM configuracion", (err, row) => {
    if (row && row.count === 0) {
      const configs = [
        ["sitio_nombre", "MediHome"],
        [
          "sitio_descripcion",
          "Plataforma de Telemedicina y Servicios Médicos a Domicilio",
        ],
        [
          "correo_notificaciones",
          process.env.EMAIL_ADMIN || "admin@medihome.com",
        ],
        ["telefono_institucional", "809-555-0100"],
        ["direccion", "Av. Abraham Lincoln #123, Santo Domingo"],
        [
          "horario_atencion",
          "Lun-Vie 8:00 AM - 6:00 PM, Sáb 9:00 AM - 2:00 PM",
        ],
        ["politica_password", "medium"],
        ["logo_url", ""],
        ["auth_activa", "true"],
      ];
      const stmt = db.prepare(
        "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?,?)",
      );
      configs.forEach((c) => stmt.run(c[0], c[1]));
      stmt.finalize();
      console.log("[seed] Configuracion por defecto insertada");
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS servicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    icono TEXT DEFAULT 'fa-stethoscope',
    precio REAL,
    duracion INTEGER DEFAULT 30,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS medicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    especialidad TEXT,
    telefono TEXT,
    correo TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS medico_servicios (
    medico_id INTEGER,
    servicio_id INTEGER,
    PRIMARY KEY(medico_id, servicio_id),
    FOREIGN KEY(medico_id) REFERENCES medicos(id),
    FOREIGN KEY(servicio_id) REFERENCES servicios(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS citas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_cita TEXT UNIQUE NOT NULL,
    nombre_paciente TEXT NOT NULL,
    telefono TEXT NOT NULL,
    correo TEXT,
    direccion TEXT,
    ciudad TEXT,
    servicio_id INTEGER,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    modalidad TEXT DEFAULT 'domicilio',
    cedula TEXT,
    ars TEXT,
    reprogramada_de INTEGER,
    comentario TEXT,
    estado TEXT DEFAULT 'pendiente',
    medico_id INTEGER,
    observaciones TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(servicio_id) REFERENCES servicios(id),
    FOREIGN KEY(medico_id) REFERENCES medicos(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS disponibilidad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    servicio_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    duracion INTEGER DEFAULT 30,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(servicio_id) REFERENCES servicios(id)
  )`);

  // Migration: add columns/tables if not exists (synchronous with serialize)
  db.serialize(() => {
    db.run("ALTER TABLE disponibilidad ADD COLUMN capacidad INTEGER DEFAULT 1", (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("[migracion] error add capacidad:", err.message);
      }
    });
    db.run(`CREATE TABLE IF NOT EXISTS disponibilidad_excepciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      servicio_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      motivo TEXT,
      tipo TEXT DEFAULT 'no_disponible',
      hora_inicio TEXT,
      hora_fin TEXT,
      activo INTEGER DEFAULT 1,
      observacion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(servicio_id) REFERENCES servicios(id)
    )`);
  });

  db.run(`CREATE TABLE IF NOT EXISTS observaciones_cita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cita_id INTEGER NOT NULL,
    tipo TEXT DEFAULT 'admin',
    contenido TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cita_id) REFERENCES citas(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS resultados_citas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cita_id INTEGER NOT NULL,
    archivo_original TEXT NOT NULL,
    archivo_guardado TEXT NOT NULL,
    ruta_archivo TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    nota TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cita_id) REFERENCES citas(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS resultados_paciente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    estudio TEXT NOT NULL,
    fecha TEXT NOT NULL,
    archivo_original TEXT NOT NULL,
    archivo_guardado TEXT NOT NULL,
    ruta_archivo TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    observaciones TEXT,
    medico_nombre TEXT,
    guardar_expediente INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    correo TEXT,
    cedula TEXT,
    fecha_nacimiento TEXT,
    edad INTEGER,
    genero TEXT,
    direccion TEXT,
    ciudad TEXT,
    sector TEXT,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migrations for citas/pacientes (after tables exist)
  db.run("ALTER TABLE citas ADD COLUMN cedula TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE pacientes ADD COLUMN cedula TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE citas ADD COLUMN ars TEXT", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });
  db.run("ALTER TABLE citas ADD COLUMN reprogramada_de INTEGER", (err) => {
    if (err && !err.message.includes("duplicate column"))
      console.error("[db]", err.message);
  });

  db.run(`CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    metodo TEXT NOT NULL,
    referencia TEXT,
    observaciones TEXT,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(factura_id) REFERENCES facturas(id)
  )`);

  db.get("SELECT COUNT(*) as count FROM usuarios_admin", (err, row) => {
    if (row && row.count === 0) {
      const hash = bcrypt.hashSync("admin1234", 10);
      db.run(
        "INSERT INTO usuarios_admin (nombre, usuario, password, rol) VALUES (?,?,?,?)",
        ["Administrador", "admin", hash, "administrador"],
      );
      db.run(
        "INSERT INTO usuarios_admin (nombre, usuario, password, rol, especialidad) VALUES (?,?,?,?,?)",
        [
          "Dr. Carlos García",
          "medico1",
          bcrypt.hashSync("medico123", 10),
          "medico",
          "Medicina General / Sonografía",
        ],
      );

      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Sonografía Obstétrica",
          "Evaluación detallada del desarrollo fetal y bienestar del bebé durante el embarazo.",
          "fa-baby",
          2500,
          30,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Sonografía Abdominal",
          "Visualización de órganos internos del abdomen como hígado, vesícula, riñones y páncreas.",
          "fa-ribbon",
          2200,
          30,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Sonografía Pélvica",
          "Estudio de órganos pélvicos para evaluar el sistema reproductivo femenino y masculino.",
          "fa-ribbon",
          2200,
          30,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Sonografía Prostática",
          "Evaluación de la próstata para detección temprana de anomalías y control de salud masculina.",
          "fa-ribbon",
          2500,
          30,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Doppler",
          "Estudio del flujo sanguíneo en arterias y venas para detectar obstrucciones o alteraciones circulatorias.",
          "fa-heart-pulse",
          2800,
          40,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Perfil Hemodinámico",
          "Evaluación completa del sistema cardiovascular incluyendo presión arterial y flujo sanguíneo.",
          "fa-heart-circle-check",
          3500,
          45,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Perfil Morfológico",
          "Estudio detallado de la anatomía fetal para descartar malformaciones congénitas.",
          "fa-baby",
          3200,
          40,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Mapa Cardiológico",
          "Electrocardiograma y evaluación cardíaca completa para diagnóstico de afecciones del corazón.",
          "fa-heart",
          3000,
          45,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Prueba de Covid-19",
          "Prueba rápida de antígenos para detección de SARS-CoV-2 con resultados en minutos.",
          "fa-virus",
          800,
          15,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Consulta Médica a Domicilio",
          "Atención médica general en la comodidad de tu hogar con profesionales certificados.",
          "fa-user-doctor",
          1800,
          30,
        ],
      );
      db.run(
        "INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        [
          "Telemedicina",
          "Consulta médica virtual desde cualquier lugar, sin necesidad de desplazarte.",
          "fa-video",
          1200,
          20,
        ],
      );

      db.run(
        "INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        [
          "Dr. Carlos García",
          "Medicina General / Sonografía",
          "809-555-0101",
          "carlos.garcia@medihome.com",
        ],
      );
      db.run(
        "INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        [
          "Dra. María Rodríguez",
          "Cardiología",
          "809-555-0102",
          "maria.rodriguez@medihome.com",
        ],
      );
      db.run(
        "INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        [
          "Dr. Juan Martínez",
          "Medicina Interna",
          "809-555-0103",
          "juan.martinez@medihome.com",
        ],
      );
      db.run(
        "INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        [
          "Dra. Laura Sánchez",
          "Medicina General",
          "809-555-0104",
          "laura.sanchez@medihome.com",
        ],
      );
      db.run(
        "INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        [
          "Dr. Roberto Peña",
          "Sonografía / Imágenes",
          "809-555-0105",
          "roberto.pena@medihome.com",
        ],
      );
    }
  });

  // Seed disponibilidad (availability) for services
  db.get("SELECT COUNT(*) as count FROM disponibilidad", (err, row) => {
    if (row && row.count === 0) {
      db.get("SELECT id FROM servicios WHERE nombre='Doppler'", (err, doppler) => {
        if (doppler) {
          const stmt = db.prepare(
            "INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)",
          );
          stmt.run(doppler.id, 1, "08:00", "12:00", 40);
          stmt.run(doppler.id, 4, "08:00", "12:00", 40);
          stmt.run(doppler.id, 5, "14:00", "17:00", 40);
          stmt.finalize();
        }
      });
      db.get("SELECT id FROM servicios WHERE nombre='Sonografía Obstétrica'", (err, s) => {
        if (s) {
          const stmt = db.prepare(
            "INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)",
          );
          for (let d = 1; d <= 5; d++) stmt.run(s.id, d, "08:00", "17:00", 30);
          stmt.finalize();
        }
      });
      db.get("SELECT id FROM servicios WHERE nombre='Consulta Médica a Domicilio'", (err, s) => {
        if (s) {
          const stmt = db.prepare(
            "INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)",
          );
          for (let d = 1; d <= 6; d++) {
            if (d === 6) stmt.run(s.id, d, "09:00", "14:00", 30);
            else stmt.run(s.id, d, "08:00", "18:00", 30);
          }
          stmt.finalize();
        }
      });
      db.get("SELECT id FROM servicios WHERE nombre='Telemedicina'", (err, s) => {
        if (s) {
          const stmt = db.prepare(
            "INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)",
          );
          for (let d = 1; d <= 6; d++) stmt.run(s.id, d, "07:00", "20:00", 20);
          stmt.finalize();
        }
      });
      const otrosServicios = [
        "Sonografía Abdominal", "Sonografía Pélvica", "Sonografía Prostática",
        "Perfil Hemodinámico", "Perfil Morfológico", "Mapa Cardiológico", "Prueba de Covid-19",
      ];
      otrosServicios.forEach((nombre) => {
        db.get("SELECT id, duracion FROM servicios WHERE nombre=?", [nombre], (err, s) => {
          if (s) {
            const dur = s.duracion || 30;
            const stmt = db.prepare(
              "INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)",
            );
            for (let d = 1; d <= 5; d++) stmt.run(s.id, d, "08:00", "17:00", dur);
            stmt.finalize();
          }
        });
      });
      console.log("[seed] Disponibilidad por defecto insertada");
    }
  });

  // Ensure admin user password is "admin1234" (for existing databases)
  db.run("UPDATE usuarios_admin SET password=? WHERE usuario='admin'", [bcrypt.hashSync("admin1234", 10)]);

  // Seed citas if empty
  db.get("SELECT COUNT(*) as count FROM citas", (err, row) => {
    if (row && row.count === 0) {
      const sampleCitas = [
        {
          pac: "Juan Pérez",
          ced: "001-0000001-1",
          tel: "809-555-1001",
          mail: "juan@mail.com",
          dir: "Calle 1 #23",
          ciudad: "Santo Domingo",
          sv: 1,
          fecha: "2026-05-15",
          hora: "09:00",
          mod: "domicilio",
          est: "completada",
          med: 1,
        },
        {
          pac: "María López",
          ced: "001-0000002-2",
          tel: "809-555-1002",
          mail: "maria@mail.com",
          dir: "Av. 2 #45",
          ciudad: "Santiago",
          sv: 2,
          fecha: "2026-05-15",
          hora: "10:00",
          mod: "domicilio",
          est: "completada",
          med: 1,
        },
        {
          pac: "Carlos Ruiz",
          ced: "001-0000003-3",
          tel: "809-555-1003",
          mail: "carlos@mail.com",
          dir: "Calle 3 #67",
          ciudad: "Santo Domingo",
          sv: 3,
          fecha: "2026-05-15",
          hora: "11:00",
          mod: "telemedicina",
          est: "completada",
          med: 1,
        },
        {
          pac: "Ana Martínez",
          ced: "001-0000004-4",
          tel: "809-555-1004",
          mail: "ana@mail.com",
          dir: "Av. 4 #89",
          ciudad: "La Vega",
          sv: 5,
          fecha: "2026-05-15",
          hora: "14:00",
          mod: "domicilio",
          est: "completada",
          med: 1,
        },
        {
          pac: "Pedro Sánchez",
          ced: "001-0000005-5",
          tel: "809-555-1005",
          mail: "pedro@mail.com",
          dir: "Calle 5 #12",
          ciudad: "Santo Domingo",
          sv: 8,
          fecha: "2026-05-16",
          hora: "08:30",
          mod: "domicilio",
          est: "completada",
          med: 1,
        },
        {
          pac: "Laura Fernández",
          ced: "001-0000006-6",
          tel: "809-555-1006",
          mail: "laura@mail.com",
          dir: "Av. 6 #34",
          ciudad: "Santiago",
          sv: 10,
          fecha: "2026-05-16",
          hora: "09:30",
          mod: "domicilio",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Roberto Gómez",
          ced: "001-0000007-7",
          tel: "809-555-1007",
          mail: "roberto@mail.com",
          dir: "Calle 7 #56",
          ciudad: "Santo Domingo",
          sv: 1,
          fecha: "2026-05-16",
          hora: "10:30",
          mod: "telemedicina",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Sofía Díaz",
          ced: "001-0000008-8",
          tel: "809-555-1008",
          mail: "sofia@mail.com",
          dir: "Av. 8 #78",
          ciudad: "La Vega",
          sv: 4,
          fecha: "2026-05-17",
          hora: "09:00",
          mod: "domicilio",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Diego Torres",
          ced: "001-0000009-9",
          tel: "809-555-1009",
          mail: "diego@mail.com",
          dir: "Calle 9 #90",
          ciudad: "Santo Domingo",
          sv: 6,
          fecha: "2026-05-17",
          hora: "11:00",
          mod: "domicilio",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Valentina Reyes",
          ced: "001-0000010-0",
          tel: "809-555-1010",
          mail: "vale@mail.com",
          dir: "Av. 10 #11",
          ciudad: "Santiago",
          sv: 7,
          fecha: "2026-05-17",
          hora: "14:00",
          mod: "telemedicina",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Andrés Morales",
          ced: "001-0000011-1",
          tel: "809-555-1011",
          mail: "andres@mail.com",
          dir: "Calle 11 #22",
          ciudad: "Santo Domingo",
          sv: 9,
          fecha: "2026-05-18",
          hora: "08:00",
          mod: "domicilio",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Carmen Ortiz",
          ced: "001-0000012-2",
          tel: "809-555-1012",
          mail: "carmen@mail.com",
          dir: "Av. 12 #33",
          ciudad: "La Vega",
          sv: 11,
          fecha: "2026-05-18",
          hora: "09:00",
          mod: "telemedicina",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Fernando Castillo",
          ced: "001-0000013-3",
          tel: "809-555-1013",
          mail: "fernando@mail.com",
          dir: "Calle 13 #44",
          ciudad: "Santo Domingo",
          sv: 2,
          fecha: "2026-05-18",
          hora: "10:00",
          mod: "domicilio",
          est: "pendiente",
          med: 1,
        },
        {
          pac: "Gabriela Herrera",
          ced: "001-0000014-4",
          tel: "809-555-1014",
          mail: "gabriela@mail.com",
          dir: "Av. 14 #55",
          ciudad: "Santiago",
          sv: 3,
          fecha: "2026-05-18",
          hora: "11:00",
          mod: "domicilio",
          est: "pendiente",
          med: 1,
        },
      ];
      const stmtCita = db.prepare(
        "INSERT INTO citas (codigo_cita, nombre_paciente, cedula, telefono, correo, direccion, ciudad, servicio_id, fecha, hora, modalidad, estado, medico_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      );
      sampleCitas.forEach((c, i) => {
        const cod = "MH-" + String(1001 + i);
        stmtCita.run(
          cod,
          c.pac,
          c.ced,
          c.tel,
          c.mail,
          c.dir,
          c.ciudad,
          c.sv,
          c.fecha,
          c.hora,
          c.mod,
          c.est,
          c.med,
        );
      });
      stmtCita.finalize();
      console.log("[seed] 14 citas de ejemplo insertadas");

      // Extract unique patients from citas after inserts complete
      setTimeout(() => {
        db.all(
          "SELECT DISTINCT nombre_paciente, cedula, telefono, correo, direccion, ciudad FROM citas",
          (err2, pts) => {
            if (!err2 && pts && pts.length > 0) {
              let inserted = 0;
              pts.forEach((p) => {
                db.run(
                  "INSERT OR IGNORE INTO pacientes (nombre, cedula, telefono, correo, direccion, ciudad, estado) VALUES (?,?,?,?,?,?,'activo')",
                  [
                    p.nombre_paciente,
                    p.cedula || "",
                    p.telefono,
                    p.correo || "",
                    p.direccion || "",
                    p.ciudad || "",
                  ],
                  function () {
                    if (this.changes > 0) inserted++;
                  },
                );
              });
              setTimeout(
                () =>
                  console.log(
                    "[seed]",
                    pts.length,
                    "pacientes extraídos de citas (" +
                      inserted +
                      " insertados)",
                  ),
                300,
              );
            }
          },
        );
      }, 200);
    }
  });
});

function sanitizar(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'\\]/g, "")
    .trim();
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefonoRD(tel) {
  const limpio = tel.replace(/[\s\-\ ()\+]/g, "");
  return /^\d{10,12}$/.test(limpio);
}

function validarCedulaRD(ced) {
  return /^\d{11}$/.test(ced);
}

function convertirHoraAMinutos(hora) {
  if (!hora) return 0;
  const partes = hora.split(":");
  if (partes.length < 2) return 0;
  return parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
}

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
    return res.status(403).json({
      success: false,
      error: "Acceso denegado: se requieren permisos de administrador",
    });
  }
  next();
}

function medicoAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, SECRET);
    if (decoded.rol !== "medico")
      return res.status(403).json({ error: "Acceso solo para médicos" });
    req.medico = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function crearNotificacion(usuarioId, titulo, mensaje, tipo, cb) {
  db.run(
    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES (?,?,?,?)",
    [usuarioId, titulo, mensaje || "", tipo || "info"],
    cb,
  );
}

// --- PUBLIC ROUTES ---

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

app.get("/api/servicios", (req, res) => {
  db.all(
    "SELECT * FROM servicios WHERE activo=1 ORDER BY nombre",
    (err, rows) => res.json(rows),
  );
});

app.get("/api/medicos", (req, res) => {
  db.all(
    "SELECT id, nombre, especialidad, telefono, correo FROM usuarios_admin WHERE rol='medico' AND activo=1 ORDER BY nombre",
    (err, rows) => res.json(rows || []),
  );
});

app.get("/api/ars", (req, res) => {
  db.all("SELECT * FROM ars WHERE activo=1 ORDER BY nombre", (err, rows) =>
    res.json(rows || []),
  );
});

app.get("/api/disponibilidad", (req, res) => {
  const { servicio_id } = req.query;
  if (!servicio_id) {
    return res.status(400).json({ error: "servicio_id es requerido" });
  }
  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND activo=1 ORDER BY dia_semana, hora_inicio",
    [servicio_id],
    (err, rows) => res.json(rows || []),
  );
});

app.get("/api/disponibilidad/horarios", (req, res) => {
  const { servicio_id, fecha } = req.query;
  if (!servicio_id || !fecha) {
    return res.status(400).json({ error: "servicio_id y fecha son requeridos" });
  }
  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();
  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1 ORDER BY hora_inicio",
    [servicio_id, diaSemana],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) {
        return res.json({ disponible: false, slots: [], mensaje: "No hay disponibilidad para este servicio en la fecha seleccionada." });
      }
      const slots = [];
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const isToday = fecha === todayStr;
      rows.forEach((config) => {
        const [hInicio, mInicio] = config.hora_inicio.split(":").map(Number);
        const [hFin, mFin] = config.hora_fin.split(":").map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const finMinutos = hFin * 60 + mFin;
        const duracion = config.duracion || 30;
        for (let m = inicioMinutos; m + duracion <= finMinutos; m += duracion) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const horaStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
          const hora12 = formatHora12(h, min);
          if (isToday) {
            const nowMin = today.getHours() * 60 + today.getMinutes();
            if (m <= nowMin) continue;
          }
          slots.push({ hora: horaStr, hora12, label: hora12 });
        }
      });
      const capacidad = rows[0]?.capacidad || 1;
      db.all(
        "SELECT hora, COUNT(*) as count FROM citas WHERE servicio_id=? AND fecha=? AND estado NOT IN ('cancelada') GROUP BY hora",
        [servicio_id, fecha],
        (err2, ocupadas) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const ocupMap = {};
          (ocupadas || []).forEach((o) => { ocupMap[o.hora] = o.count; });
          const conEstado = slots.map((s) => ({
            ...s,
            ocupado: (ocupMap[s.hora] || 0) >= capacidad,
            reservas: ocupMap[s.hora] || 0,
            capacidad,
          }));
          const disponibles = conEstado.filter((s) => !s.ocupado);
          res.json({ disponible: disponibles.length > 0, slots: conEstado });
        },
      );
    },
  );
});

function formatHora12(h, min) {
  const periodo = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(min).padStart(2, "0")} ${periodo}`;
}

app.post("/api/citas", limiterCitas, (req, res) => {
  console.log("[appointment] req.body completo:", JSON.stringify(req.body));
  let {
    nombre_paciente,
    cedula,
    telefono,
    correo,
    direccion,
    ciudad,
    servicio_id,
    ars,
    fecha,
    hora,
    modalidad,
    comentario,
    acepto_privacidad,
  } = req.body;

  nombre_paciente = sanitizar(nombre_paciente || "");
  cedula = sanitizar(cedula || "");
  telefono = sanitizar(telefono || "");
  correo = sanitizar(correo || "");
  direccion = sanitizar(direccion || "");
  ciudad = sanitizar(ciudad || "");
  comentario = sanitizar(comentario || "");
  modalidad = sanitizar(modalidad || "");
  ars = sanitizar(ars || "");
  servicio_id = parseInt(servicio_id, 10);
  acepto_privacidad = !!acepto_privacidad;

  const errores = [];

  if (!nombre_paciente) errores.push("Nombre del paciente");
  if (!telefono) errores.push("Teléfono");
  else if (!validarTelefonoRD(telefono))
    errores.push("Teléfono inválido (10 dígitos)");
  if (!correo) errores.push("Correo electrónico");
  else if (!validarEmail(correo)) errores.push("Correo electrónico inválido");
  if (!direccion) errores.push("Dirección");
  if (!ciudad) errores.push("Sector / Ciudad");
  if (!servicio_id || isNaN(servicio_id)) errores.push("Servicio");
  if (!fecha) errores.push("Fecha");
  if (!hora) errores.push("Hora");
  if (!["domicilio", "telemedicina", "presencial"].includes(modalidad))
    errores.push("Modalidad (presencial, domicilio o telemedicina)");
  if (!ars) errores.push("ARS / Seguro médico");
  if (!cedula) errores.push("Cédula");
  else if (!validarCedulaRD(cedula))
    errores.push("Cédula inválida (11 dígitos)");
  if (!acepto_privacidad) errores.push("Aceptación de política de privacidad");

  if (errores.length > 0) {
    return res
      .status(400)
      .json({ error: `Campos obligatorios: ${errores.join(", ")}` });
  }

  console.log(
    `[appointment] Cita recibida - paciente: ${nombre_paciente}, servicio: ${servicio_id}, fecha: ${fecha} ${hora}`,
  );

  // ── Availability validation ──
  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();
  const validarDisponibilidad = (callback) => {
    db.all(
      "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1",
      [servicio_id, diaSemana],
      (err, rows) => {
        if (err) {
          console.error("[disponibilidad] Error:", err.message);
          return res.status(500).json({ error: "Error al validar disponibilidad" });
        }
        if (!rows || rows.length === 0) {
          return res.status(400).json({
            error: "Este servicio no tiene horario disponible para la fecha seleccionada.",
          });
        }
        const horaMinutos = convertirHoraAMinutos(hora);
        let valida = false;
        for (const config of rows) {
          const ini = convertirHoraAMinutos(config.hora_inicio);
          const fin = convertirHoraAMinutos(config.hora_fin);
          if (horaMinutos >= ini && horaMinutos + (config.duracion || 30) <= fin) {
            valida = true;
            break;
          }
        }
        if (!valida) {
          return res.status(400).json({
            error: "La hora seleccionada no está dentro del horario disponible del servicio.",
          });
        }
        db.get(
          "SELECT COUNT(*) as count FROM citas WHERE servicio_id=? AND fecha=? AND hora=? AND estado NOT IN ('cancelada')",
          [servicio_id, fecha, hora],
          (err2, existing) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const capacidad = rows[0]?.capacidad || 1;
            if ((existing?.count || 0) >= capacidad) {
              return res.status(400).json({
                error: "Ya se alcanzó la capacidad máxima para esta fecha y hora.",
              });
            }
            callback();
          },
        );
      },
    );
  };

  let codigo = generarCodigoCita();
  const checkCodigo = () => {
    db.get("SELECT id FROM citas WHERE codigo_cita=?", [codigo], (err, row) => {
      if (row) {
        codigo = generarCodigoCita();
        checkCodigo();
        return;
      }
      insertar();
    });
  };

  validarDisponibilidad(() => checkCodigo());

  const insertar = () => {
    console.log("Cedula recibida en backend:", cedula);
    console.log(
      "[insertar] valores:",
      JSON.stringify([
        codigo,
        nombre_paciente,
        cedula,
        telefono,
        correo,
        direccion,
        ciudad,
        servicio_id,
        ars,
        fecha,
        hora,
        modalidad,
        comentario,
      ]),
    );
    db.run(
      `INSERT INTO citas (codigo_cita, nombre_paciente, cedula, telefono, correo, direccion, ciudad, servicio_id, ars, fecha, hora, modalidad, comentario, estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        codigo,
        nombre_paciente,
        cedula,
        telefono,
        correo,
        direccion,
        ciudad,
        servicio_id,
        ars,
        fecha,
        hora,
        modalidad,
        comentario,
        "pendiente",
      ],
      function (err) {
        if (err) {
          console.error("[cita] Error al insertar:", err.message);
          return res
            .status(500)
            .json({ error: "Error al crear la cita: " + err.message });
        }
        const citaId = this.lastID;
        console.log("Cedula guardada en cita:", cedula);
        console.log(
          `[appointment] Cita guardada correctamente - id: ${citaId}, codigo: ${codigo}`,
        );

        // Crear o actualizar paciente (expediente por cedula)
        db.get(
          "SELECT id FROM pacientes WHERE cedula=?",
          [cedula],
          (err3, existingPac) => {
            if (err3)
              console.error("[paciente] Error al buscar:", err3.message);
            else if (existingPac) {
              db.run(
                "UPDATE pacientes SET nombre=?, telefono=?, correo=?, direccion=?, ciudad=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                [
                  nombre_paciente,
                  telefono,
                  correo,
                  direccion,
                  ciudad,
                  existingPac.id,
                ],
              );
            } else {
              db.run(
                "INSERT INTO pacientes (nombre, cedula, telefono, correo, direccion, ciudad, estado) VALUES (?,?,?,?,?,?,'activo')",
                [nombre_paciente, cedula, telefono, correo, direccion, ciudad],
              );
            }
          },
        );

        res.json({
          id: citaId,
          codigo_cita: codigo,
          mensaje:
            "Su solicitud fue recibida correctamente. Nos comunicaremos con usted para confirmar la cita.",
        });

        // Auto-generate invoice
        db.get(
          "SELECT s.nombre as servicio_nombre, s.precio FROM servicios s WHERE s.id=?",
          [servicio_id],
          (err2, servicio) => {
            const servicio_nombre = servicio ? servicio.servicio_nombre : "—";
            const precio_base = servicio ? servicio.precio : 0;

            // Generate invoice number
            const year = new Date().getFullYear();
            db.get(
              "SELECT COALESCE(MAX(CAST(SUBSTR(numero_factura, -6) AS INTEGER)) + 1, 1) as next FROM facturas WHERE numero_factura LIKE ?",
              [`FAC-${year}-%`],
              (err4, row) => {
                const nextNum = String(row ? row.next : 1).padStart(6, "0");
                const numero_factura = `FAC-${year}-${nextNum}`;

                const esSinSeguro = ars === "No tengo seguro";
                const estado = esSinSeguro
                  ? "pendiente_de_pago"
                  : "pendiente_de_validacion";
                const cobertura_estado = esSinSeguro
                  ? "no_aplica"
                  : "pendiente_de_validacion";
                const monto_pagar = precio_base;

                db.run(
                  `INSERT INTO facturas (numero_factura, cita_id, paciente_nombre, cedula, servicio_id, servicio_nombre, precio_base, ars_nombre, cobertura_porcentaje, monto_cubierto, monto_pagar, estado, cobertura_estado)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    numero_factura,
                    citaId,
                    nombre_paciente,
                    cedula,
                    servicio_id,
                    servicio_nombre,
                    precio_base,
                    ars,
                    0,
                    0,
                    monto_pagar,
                    estado,
                    cobertura_estado,
                  ],
                  function (err5) {
                    if (err5)
                      console.error(
                        "[invoice] Error al crear factura:",
                        err5.message,
                      );
                    else
                      console.log(
                        `[invoice] Factura ${numero_factura} generada para cita ${citaId} (${cobertura_estado})`,
                      );
                  },
                );

                // Create in-app notifications for admin users
                db.all(
                  "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
                  [],
                  (err6, admins) => {
                    if (err6) {
                      console.error(
                        "[notificacion] Error al buscar admins:",
                        err6.message,
                      );
                      return;
                    }
                    if (admins && admins.length > 0) {
                      const stmt = db.prepare(
                        "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                      );
                      admins.forEach((a) => {
                        stmt.run(
                          a.id,
                          "Nueva cita agendada",
                          `Paciente ${nombre_paciente} — ${servicio_nombre}`,
                          "nueva_cita",
                          citaId,
                          nombre_paciente,
                          servicio_nombre,
                        );
                      });
                      stmt.finalize();
                      console.log(
                        `[notificacion] Notificaciones creadas para ${admins.length} admin(s)`,
                      );
                    }
                  },
                );
              },
            );

            // Send email notifications
            db.all(
              `SELECT m.nombre, m.correo FROM medicos m
            JOIN medico_servicios ms ON m.id=ms.medico_id
            WHERE ms.servicio_id=? AND m.activo=1 AND m.correo IS NOT NULL AND m.correo != ''`,
              [servicio_id],
              (err3, doctores) => {
                const medico =
                  doctores && doctores.length > 0 ? doctores[0] : null;
                console.log(
                  `[email] Enviando notificaciones para cita ${codigo}...`,
                );
                sendNewCitaNotification({
                  nombre_paciente,
                  cedula,
                  telefono,
                  correo,
                  servicio_nombre,
                  medico_nombre: medico ? medico.nombre : "Por asignar",
                  medico_correo: medico ? medico.correo : null,
                  fecha,
                  hora,
                  direccion,
                  ciudad,
                  modalidad,
                  comentario,
                  codigo_cita: codigo,
                  created_at: new Date().toISOString(),
                  estado: "pendiente",
                  admin_url: `${req.protocol}://${req.get("host")}/admin.html`,
                });
              },
            );
          },
        );
      },
    );
  };

  // checkCodigo is called by validarDisponibilidad above
});

app.get("/api/citas/seguimiento", (req, res) => {
  const { codigo, telefono } = req.query;
  if (!codigo && !telefono)
    return res
      .status(400)
      .json({ error: "Debe proporcionar código o teléfono" });

  let query, params;
  if (codigo) {
    query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
      FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN usuarios_admin m ON c.medico_id=m.id AND m.rol='medico' WHERE c.codigo_cita=?`;
    params = [codigo];
  } else {
    query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
      FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN usuarios_admin m ON c.medico_id=m.id AND m.rol='medico' WHERE c.telefono=? ORDER BY c.created_at DESC LIMIT 10`;
    params = [telefono];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al buscar" });
    res.json(rows);
  });
});

// --- ADMIN ROUTES ---

app.use("/api/admin", authMiddleware, requireAdmin);

app.get("/api/admin/stats", async (req, res) => {
  try {
    const q = {
      get: (sql, params = []) =>
        new Promise((resolve, reject) =>
          db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))),
        ),
      all: (sql, params = []) =>
        new Promise((resolve, reject) =>
          db.all(sql, params, (err, rows) =>
            err ? reject(err) : resolve(rows),
          ),
        ),
    };

    const [
      total,
      pend,
      conf,
      comp,
      canc,
      proc,
      topServicios,
      tendencia,
      actividadReciente,
      citasPorDia,
      pacientesCount,
      medicosCount,
      hoyTotal,
      ayerTotal,
    ] = await Promise.all([
      q.get("SELECT COUNT(*) as total FROM citas"),
      q.get(
        "SELECT COUNT(*) as pendientes FROM citas WHERE estado='pendiente'",
      ),
      q.get(
        "SELECT COUNT(*) as confirmadas FROM citas WHERE estado='confirmada'",
      ),
      q.get(
        "SELECT COUNT(*) as completadas FROM citas WHERE estado='completada'",
      ),
      q.get(
        "SELECT COUNT(*) as canceladas FROM citas WHERE estado='cancelada'",
      ),
      q.get(
        "SELECT COUNT(*) as en_proceso FROM citas WHERE estado='en_proceso'",
      ),
      q.all(
        `SELECT s.nombre, COUNT(c.id) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id GROUP BY c.servicio_id ORDER BY total DESC LIMIT 5`,
      ),
      q.all(
        `SELECT DATE(created_at) as dia, COUNT(*) as total FROM citas GROUP BY dia ORDER BY dia DESC LIMIT 7`,
      ),
      q.all(`SELECT 'cita' as tipo, c.nombre_paciente as paciente, COALESCE(s.nombre,'') as servicio, c.estado, c.created_at as fecha
        FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id
        ORDER BY c.created_at DESC LIMIT 5`),
      q.all(`SELECT CASE CAST(strftime('%w',fecha) AS INTEGER)
        WHEN 0 THEN 'Dom' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié'
        WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' END as dia,
        COUNT(*) as total FROM citas
        WHERE fecha >= DATE('now','-7 days')
        GROUP BY strftime('%w',fecha) ORDER BY strftime('%w',fecha)`),
      q.get(
        "SELECT COUNT(DISTINCT nombre_paciente || telefono) as total FROM citas",
      ),
      q.get("SELECT COUNT(*) as total FROM medicos WHERE activo=1"),
      q.get(
        "SELECT COUNT(*) as total FROM citas WHERE DATE(created_at)=DATE('now')",
      ),
      q.get(
        "SELECT COUNT(*) as total FROM citas WHERE DATE(created_at)=DATE('now','-1 day')",
      ),
    ]);

    const variacion =
      ayerTotal?.total > 0
        ? Math.round(
            (((hoyTotal?.total || 0) - ayerTotal.total) / ayerTotal.total) *
              100,
          )
        : 0;

    const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const citasMap = {};
    (citasPorDia || []).forEach((d) => {
      citasMap[d.dia] = d.total;
    });
    const citasPorDiaCompleto = diasSemana.map((dia) => ({
      dia,
      total: citasMap[dia] || 0,
    }));

    res.json({
      total: total?.total || 0,
      pendientes: pend?.pendientes || 0,
      confirmadas: conf?.confirmadas || 0,
      completadas: comp?.completadas || 0,
      canceladas: canc?.canceladas || 0,
      en_proceso: proc?.en_proceso || 0,
      variacion,
      topServicios: topServicios || [],
      tendencia: tendencia || [],
      actividadReciente: actividadReciente || [],
      citasPorDia: citasPorDiaCompleto,
      resumenRapido: {
        totalPacientes: pacientesCount?.total || 0,
        medicosActivos: medicosCount?.total || 0,
        satisfaccion: 4.8,
      },
    });
  } catch (err) {
    console.error("[stats] Error:", err);
    res.status(500).json({ error: "Error al cargar estadísticas" });
  }
});

app.get("/api/admin/citas", authMiddleware, (req, res) => {
  let query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE 1=1`;
  const params = [];
  const { estado, fecha, servicio, medico, busqueda } = req.query;

  if (estado) {
    query += " AND c.estado=?";
    params.push(estado);
  }
  if (fecha) {
    query += " AND c.fecha=?";
    params.push(fecha);
  }
  if (servicio) {
    query += " AND c.servicio_id=?";
    params.push(servicio);
  }
  if (medico) {
    query += " AND c.medico_id=?";
    params.push(medico);
  }
  if (busqueda) {
    query +=
      " AND (c.nombre_paciente LIKE ? OR c.telefono LIKE ? OR c.codigo_cita LIKE ?)";
    params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }

  query += " ORDER BY c.created_at DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/admin/citas/ultima", authMiddleware, (req, res) => {
  db.get(
    "SELECT COALESCE(MAX(id),0) as maxId, COUNT(*) as total FROM citas",
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ maxId: row?.maxId || 0, total: row?.total || 0 });
    },
  );
});

app.get("/api/admin/citas/:id", authMiddleware, (req, res) => {
  db.get(
    `SELECT c.*, s.nombre as servicio_nombre, s.precio, s.descripcion as servicio_descripcion, s.duracion as servicio_duracion,
    m.nombre as medico_nombre, m.especialidad, m.telefono as medico_telefono
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.id=?`,
    [req.params.id],
    (err, cita) => {
      if (err || !cita)
        return res.status(404).json({ error: "Cita no encontrada" });
      console.log("Detalle cita cedula:", cita.cedula);
      // Fallback: si la cita no tiene cedula, buscarla en pacientes
      if (!cita.cedula) {
        db.get(
          "SELECT cedula FROM pacientes WHERE nombre=? AND (telefono=? OR cedula IS NOT NULL) LIMIT 1",
          [cita.nombre_paciente, cita.telefono],
          (err2, pac) => {
            if (pac && pac.cedula) cita.cedula = pac.cedula;
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
      } else {
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
      }
    },
  );
});

app.put("/api/admin/citas/:id", authMiddleware, (req, res) => {
  const { estado, medico_id, observaciones, resultado } = req.body;
  const fields = [];
  const params = [];

  if (estado) {
    fields.push("estado=?");
    params.push(estado);
  }
  if (medico_id !== undefined) {
    fields.push("medico_id=?");
    params.push(medico_id);
  }
  if (observaciones !== undefined) {
    fields.push("observaciones=?");
    params.push(observaciones);
  }

  if (fields.length === 0)
    return res.status(400).json({ error: "Sin campos para actualizar" });

  fields.push("updated_at=CURRENT_TIMESTAMP");
  params.push(req.params.id);

  db.run(
    `UPDATE citas SET ${fields.join(",")} WHERE id=?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (observaciones) {
        db.run(
          "INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
          [req.params.id, "admin", observaciones, req.admin.nombre],
        );
      }

      // Notificar a admins sobre cambios de estado
      if (estado) {
        db.get(
          `SELECT c.nombre_paciente, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=?`,
          [req.params.id],
          (err3, citaData) => {
            if (err3 || !citaData) return;
            var titulo = "Cita " + estado;
            var tipo = "cita_" + estado;
            var mensaje =
              "Paciente " +
              citaData.nombre_paciente +
              " — " +
              (citaData.servicio_nombre || "") +
              " — " +
              estado;
            db.all(
              "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
              [],
              (err4, admins) => {
                if (err4 || !admins) return;
                var stmt = db.prepare(
                  "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                );
                admins.forEach(function (a) {
                  stmt.run(
                    a.id,
                    titulo,
                    mensaje,
                    tipo,
                    parseInt(req.params.id),
                    citaData.nombre_paciente,
                    citaData.servicio_nombre,
                  );
                });
                stmt.finalize();
              },
            );
          },
        );
      }

      // Si se asignó un médico, enviar email + notificación
      if (medico_id !== undefined && medico_id !== null) {
        db.get(
          `SELECT c.*, s.nombre as servicio_nombre, m.nombre as medico_nombre, m.correo as medico_correo
        FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.id=?`,
          [req.params.id],
          (err2, cita) => {
            if (err2 || !cita) return;
            // Notificar al médico
            db.get(
              "SELECT id FROM medicos WHERE id=? AND activo=1",
              [medico_id],
              (err3, user) => {
                if (user) {
                  crearNotificacion(
                    user.id,
                    "Nueva cita asignada",
                    "Se le ha asignado la cita " +
                      (cita.codigo_cita || "") +
                      " para " +
                      (cita.nombre_paciente || "") +
                      " el " +
                      (cita.fecha || "") +
                      " a las " +
                      (cita.hora || ""),
                    "cita_asignada",
                  );
                }
              },
            );
            // Enviar email al médico
            if (cita.medico_correo) {
              const { sendEmail } = require("./utils/mailer");
              sendEmail({
                to: cita.medico_correo,
                subject: "Nueva cita asignada - MediHomeRD",
                html: buildDoctorAssignmentEmail(cita),
                text: buildDoctorAssignmentText(cita),
              });
            }
          },
        );
      }

      res.json({ mensaje: "Cita actualizada correctamente" });
    },
  );
});

// --- ADMIN RESULTADOS (FILE UPLOAD) ---

app.post("/api/admin/citas/:id/resultado", authMiddleware, (req, res) => {
  upload.single("archivo")(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res
            .status(400)
            .json({ error: "El archivo supera el tamaño máximo de 10 MB" });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file)
      return res
        .status(400)
        .json({ error: "Debe seleccionar un archivo (PDF, JPG, JPEG o PNG)" });

    const nota = req.body.nota ? String(req.body.nota).trim() : "";

    db.get("SELECT * FROM citas WHERE id=?", [req.params.id], (err, cita) => {
      if (err || !cita)
        return res.status(404).json({ error: "Cita no encontrada" });

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
            return res
              .status(500)
              .json({ error: "Error al guardar el resultado" });

          db.run(
            "UPDATE citas SET estado='completada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado!='cancelada'",
            [req.params.id],
          );

          const resultData = {
            cita_id: parseInt(req.params.id),
            nombre_paciente: cita.nombre_paciente,
            correo: cita.correo,
            codigo_cita: cita.codigo_cita,
            archivo_original: req.file.originalname,
            archivo_guardado: req.file.filename,
            nota: nota,
          };

          sendResultadoNotification(resultData);

          res.json({
            id: this.lastID,
            mensaje: "Resultado registrado correctamente",
            archivo: req.file.filename,
          });
        },
      );
    });
  });
});

app.get("/api/admin/resultados/:archivo", authMiddleware, (req, res) => {
  const filePath = path.join(RESULTADOS_DIR, req.params.archivo);
  if (!require("fs").existsSync(filePath))
    return res.status(404).json({ error: "Archivo no encontrado" });
  res.sendFile(filePath);
});

// --- ADMIN SERVICES ---

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

// ── ADMIN FACTURAS ──

app.get("/api/admin/facturas", authMiddleware, (req, res) => {
  let query = `SELECT f.*, c.codigo_cita, c.fecha as cita_fecha, c.hora as cita_hora, s.nombre as servicio_nombre
    FROM facturas f LEFT JOIN citas c ON f.cita_id=c.id LEFT JOIN servicios s ON f.servicio_id=s.id WHERE 1=1`;
  const params = [];
  const { estado, busqueda, cobertura_estado } = req.query;
  if (estado) {
    query += " AND f.estado=?";
    params.push(estado);
  }
  if (cobertura_estado) {
    query += " AND f.cobertura_estado=?";
    params.push(cobertura_estado);
  }
  if (busqueda) {
    query +=
      " AND (f.numero_factura LIKE ? OR f.paciente_nombre LIKE ? OR f.cedula LIKE ?)";
    params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }
  query += " ORDER BY f.created_at DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get("/api/admin/facturas/:id", authMiddleware, (req, res) => {
  db.get(
    `SELECT f.*, c.codigo_cita, c.fecha as cita_fecha, c.hora as cita_hora, c.nombre_paciente, c.telefono, c.direccion, c.ciudad, c.modalidad,
    s.nombre as servicio_nombre, s.precio
    FROM facturas f LEFT JOIN citas c ON f.cita_id=c.id LEFT JOIN servicios s ON f.servicio_id=s.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });
      res.json(factura);
    },
  );
});

app.put("/api/admin/facturas/:id/pagar", authMiddleware, (req, res) => {
  const { metodo, referencia, observaciones } = req.body;
  if (!metodo)
    return res.status(400).json({
      error:
        "Método de pago requerido (efectivo, transferencia, tarjeta, pago_movil)",
    });

  db.get(
    "SELECT * FROM facturas WHERE id=? AND estado IN ('pendiente','pendiente_de_pago')",
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res
          .status(400)
          .json({ error: "La factura no está pendiente o no existe" });

      const monto = factura.monto_pagar;
      db.run(
        "INSERT INTO pagos (factura_id, monto, metodo, referencia, observaciones) VALUES (?,?,?,?,?)",
        [req.params.id, monto, metodo, referencia || "", observaciones || ""],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });

          db.run(
            "UPDATE facturas SET estado='pagada', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            [req.params.id],
            function (err3) {
              if (err3) return res.status(500).json({ error: err3.message });

              // Auto-confirmar la cita
              db.run(
                "UPDATE citas SET estado='confirmada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado NOT IN ('cancelada','completada')",
                [factura.cita_id],
                function (err4) {
                  if (err4)
                    console.error(
                      "[pago] Error al confirmar cita:",
                      err4.message,
                    );
                },
              );

              // Notificar a admins
              db.all(
                "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
                [],
                function (err5, admins) {
                  if (err5 || !admins) return;
                  var stmt = db.prepare(
                    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                  );
                  admins.forEach(function (a) {
                    stmt.run(
                      a.id,
                      "Pago registrado",
                      "Pago de " +
                        factura.paciente_nombre +
                        " — " +
                        (factura.servicio_nombre || "") +
                        " — $" +
                        monto,
                      "factura_pagada",
                      factura.cita_id,
                      factura.paciente_nombre,
                      factura.servicio_nombre,
                    );
                  });
                  stmt.finalize();
                },
              );

              res.json({
                mensaje:
                  "Pago registrado correctamente. Factura marcada como pagada y cita confirmada.",
              });
            },
          );
        },
      );
    },
  );
});

app.put("/api/admin/facturas/:id/anular", authMiddleware, (req, res) => {
  db.run(
    "UPDATE facturas SET estado='anulada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado IN ('pendiente','pendiente_de_validacion','pendiente_de_pago')",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res
          .status(400)
          .json({ error: "La factura no está pendiente o no existe" });
      res.json({ mensaje: "Factura anulada" });
    },
  );
});

app.get("/api/facturas/:cita_id", authMiddleware, (req, res) => {
  db.get(
    "SELECT * FROM facturas WHERE cita_id=?",
    [req.params.cita_id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });
      res.json(factura);
    },
  );
});

app.put(
  "/api/admin/facturas/:id/validar-cobertura",
  authMiddleware,
  (req, res) => {
    const {
      tipo_calculo,
      porcentaje_autorizado,
      monto_autorizado,
      numero_autorizacion,
      observacion_ars,
      cobertura_estado,
    } = req.body;

    db.get(
      "SELECT * FROM facturas WHERE id=?",
      [req.params.id],
      (err, factura) => {
        if (err || !factura)
          return res.status(404).json({ error: "Factura no encontrada" });
        const ce = factura.cobertura_estado;
        if (
          ce !== "pendiente_de_validacion" &&
          ce !== "pendiente" &&
          ce !== null
        ) {
          return res
            .status(400)
            .json({ error: "La cobertura ya fue validada o no aplica" });
        }

        const precio_base = factura.precio_base;
        let monto_cubierto = 0;
        let monto_pagar = precio_base;
        const newCoberturaEstado = cobertura_estado || "autorizada";

        if (newCoberturaEstado === "rechazada") {
          monto_cubierto = 0;
          monto_pagar = precio_base;
        } else if (tipo_calculo === "porcentaje") {
          const pct = parseFloat(porcentaje_autorizado) || 0;
          monto_cubierto = Math.round(precio_base * (pct / 100));
          monto_pagar = precio_base - monto_cubierto;
        } else if (tipo_calculo === "monto_fijo") {
          monto_cubierto = Math.min(
            parseFloat(monto_autorizado) || 0,
            precio_base,
          );
          monto_pagar = precio_base - monto_cubierto;
        }

        if (monto_pagar < 0) monto_pagar = 0;

        db.run(
          `UPDATE facturas SET
      cobertura_estado=?, numero_autorizacion=?, observacion_ars=?, tipo_calculo=?,
      porcentaje_autorizado=?, monto_autorizado=?, monto_cubierto=?, monto_pagar=?,
      estado='pendiente_de_pago', updated_at=CURRENT_TIMESTAMP
      WHERE id=?`,
          [
            newCoberturaEstado,
            numero_autorizacion || "",
            observacion_ars || "",
            tipo_calculo || "",
            parseFloat(porcentaje_autorizado) || 0,
            parseFloat(monto_autorizado) || 0,
            monto_cubierto,
            monto_pagar,
            req.params.id,
          ],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            // Notificar a admins
            var estadoLabel =
              newCoberturaEstado === "rechazada" ? "rechazada" : "autorizada";
            db.all(
              "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
              [],
              function (err2, admins) {
                if (err2 || !admins) return;
                var stmt = db.prepare(
                  "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                );
                admins.forEach(function (a) {
                  stmt.run(
                    a.id,
                    "Cobertura " + estadoLabel,
                    "Cobertura " +
                      estadoLabel +
                      " para " +
                      factura.paciente_nombre +
                      " — " +
                      (factura.servicio_nombre || ""),
                    "cobertura_" + estadoLabel,
                    factura.cita_id,
                    factura.paciente_nombre,
                    factura.servicio_nombre,
                  );
                });
                stmt.finalize();
              },
            );
            res.json({
              mensaje: "Cobertura validada correctamente",
              monto_cubierto,
              monto_pagar,
            });
          },
        );
      },
    );
  },
);

// ── PAYMENTS ──

app.get("/api/admin/pagos", authMiddleware, (req, res) => {
  let query = `SELECT p.*, f.numero_factura, f.paciente_nombre, f.cedula
    FROM pagos p JOIN facturas f ON p.factura_id=f.id WHERE 1=1`;
  const params = [];
  const { metodo, desde, hasta } = req.query;
  if (metodo) {
    query += " AND p.metodo=?";
    params.push(metodo);
  }
  if (desde) {
    query += " AND p.fecha_pago>=?";
    params.push(desde);
  }
  if (hasta) {
    query += " AND p.fecha_pago<=?";
    params.push(hasta);
  }
  query += " ORDER BY p.created_at DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get("/api/admin/facturas/:id/pagos", authMiddleware, (req, res) => {
  db.all(
    "SELECT * FROM pagos WHERE factura_id=? ORDER BY created_at DESC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

// ── REPROGRAMAR CITA ──

app.put("/api/admin/citas/:id/reprogramar", authMiddleware, (req, res) => {
  const { fecha, hora, motivo } = req.body;
  if (!fecha || !hora)
    return res.status(400).json({ error: "Fecha y hora requeridas" });

  db.get("SELECT * FROM citas WHERE id=?", [req.params.id], (err, cita) => {
    if (err || !cita)
      return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.estado === "completada" || cita.estado === "cancelada") {
      return res.status(400).json({
        error: "No se puede reprogramar una cita completada o cancelada",
      });
    }

    // Crear nueva cita con los mismos datos pero nueva fecha/hora
    db.run(
      `INSERT INTO citas (codigo_cita, nombre_paciente, cedula, telefono, correo, direccion, ciudad,
      servicio_id, fecha, hora, modalidad, ars, comentario, estado, medico_id, reprogramada_de)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cita.codigo_cita + "-R",
        cita.nombre_paciente,
        cita.cedula,
        cita.telefono,
        cita.correo,
        cita.direccion,
        cita.ciudad,
        cita.servicio_id,
        fecha,
        hora,
        cita.modalidad,
        cita.ars,
        (motivo || "Reprogramada") +
          (cita.comentario ? " | " + cita.comentario : ""),
        "pendiente",
        cita.medico_id,
        cita.id,
      ],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        // Cancelar cita original
        db.run(
          "UPDATE citas SET estado='cancelada', updated_at=CURRENT_TIMESTAMP WHERE id=?",
          [cita.id],
        );

        // Notificar a admins
        db.all(
          "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
          [],
          function (err3, admins) {
            if (err3 || !admins) return;
            var stmt = db.prepare(
              "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
            );
            admins.forEach(function (a) {
              stmt.run(
                a.id,
                "Cita reprogramada",
                "Cita de " +
                  cita.nombre_paciente +
                  " reprogramada para " +
                  fecha +
                  " " +
                  hora,
                "cita_reprogramada",
                cita.id,
                cita.nombre_paciente,
                "",
              );
            });
            stmt.finalize();
          },
        );

        res.json({
          id: this.lastID,
          mensaje:
            "Cita reprogramada correctamente. Se ha generado una nueva cita.",
        });
      },
    );
  });
});

// ── REAGENDAR CITA (actualiza en-place) ──

app.put("/api/admin/citas/:id/reagendar", authMiddleware, (req, res) => {
  const { nueva_fecha, nueva_hora, medico_id, motivo } = req.body;
  if (!nueva_fecha || !nueva_hora || !medico_id) {
    return res.status(400).json({ error: "Todos los campos son obligatorios: nueva_fecha, nueva_hora, medico_id" });
  }
  const motivoFinal = motivo || "Reagendamiento administrativo";

  db.get(
    "SELECT c.*, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=?",
    [req.params.id],
    (err, cita) => {
    if (err || !cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.estado === "completada" || cita.estado === "cancelada") {
      return res.status(400).json({ error: "No se puede reagendar una cita completada o cancelada" });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const nuevaFechaObj = new Date(nueva_fecha + "T12:00:00");
    if (nuevaFechaObj < hoy) {
      return res.status(400).json({ error: "No se puede reagendar a una fecha pasada" });
    }

    const oldFecha = cita.fecha;
    const oldHora = cita.hora;

    db.get("SELECT nombre FROM medicos WHERE id=?", [medico_id], (err, medicoNuevo) => {
      if (err || !medicoNuevo) return res.status(400).json({ error: "Médico no encontrado" });

      // Validar doble reserva del mismo médico en la misma fecha y hora
      db.get(
        "SELECT id FROM citas WHERE medico_id=? AND fecha=? AND hora=? AND estado NOT IN ('cancelada','completada') AND id!=?",
        [medico_id, nueva_fecha, nueva_hora, req.params.id],
        (err2, conflicto) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (conflicto) {
            return res.status(400).json({ error: "El médico ya tiene una cita en esa fecha y hora" });
          }

          const adminNombre = req.admin ? req.admin.nombre || req.admin.usuario || "Administrador" : "Administrador";
          const oldMedicoNombre = cita.medico_nombre || "No asignado";

          // Actualizar la cita
          db.run(
            "UPDATE citas SET fecha=?, hora=?, medico_id=?, estado='reagendada', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            [nueva_fecha, nueva_hora, medico_id, req.params.id],
            function (err3) {
              if (err3) return res.status(500).json({ error: err3.message });

              // Registrar en el historial
              const historial = JSON.stringify({
                tipo: "reagendada",
                fecha_anterior: oldFecha,
                hora_anterior: oldHora,
                medico_anterior: oldMedicoNombre,
                medico_anterior_id: cita.medico_id,
                fecha_nueva: nueva_fecha,
                hora_nueva: nueva_hora,
                medico_nuevo: medicoNuevo.nombre,
                medico_nuevo_id: medico_id,
                motivo: motivoFinal,
                realizado_por: adminNombre,
                fecha_cambio: new Date().toISOString(),
              });
              db.run(
                "INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
                [req.params.id, "reagendamiento", historial, adminNombre],
                function () {
                  // Enviar notificaciones a admins
                  db.all("SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'", [], (err4, admins) => {
                    if (admins && admins.length > 0) {
                      const stmt = db.prepare(
                        "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)"
                      );
                      admins.forEach(function (a) {
                        stmt.run(a.id,
                          "Cita reagendada",
                          "Cita de " + cita.nombre_paciente + " reagendada de " + oldFecha + " " + cita.hora + " a " + nueva_fecha + " " + nueva_hora + ". Motivo: " + motivoFinal,
                          "cita_reagendada",
                          parseInt(req.params.id),
                          cita.nombre_paciente,
                          cita.servicio_nombre || ""
                        );
                      });
                      stmt.finalize();
                    }
                  });

                  // Notificar al nuevo médico (in-app + email)
                  db.get("SELECT * FROM medicos WHERE id=? AND activo=1", [medico_id], (err5, med) => {
                    if (med) {
                      db.get("SELECT id FROM usuarios_admin WHERE medico_id=? AND activo=1 LIMIT 1", [medico_id], (err6, userMed) => {
                        if (userMed) {
                          crearNotificacion(userMed.id,
                            "Cita reagendada - " + cita.nombre_paciente,
                            "Se le ha reasignado la cita " + (cita.codigo_cita || "") + " para " + cita.nombre_paciente + " el " + nueva_fecha + " a las " + nueva_hora + ". Motivo: " + motivoFinal,
                            "cita_reagendada"
                          );
                        }
                      });

                      // Enviar email al médico
                      if (med.correo) {
                        const { sendEmail } = require("./utils/mailer");
                        const cambioMedico = parseInt(medico_id) !== parseInt(cita.medico_id);
                        sendEmail({
                          to: med.correo,
                          subject: "Cita reagendada - " + cita.nombre_paciente + " - MediHomeRD",
                          html: buildRescheduleDoctorEmail(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                          text: buildRescheduleDoctorText(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                        });
                      }
                    }
                  });

                  // Notificar al paciente (email)
                  if (cita.correo) {
                    const { sendEmail } = require("./utils/mailer");
                    const cambioMedico = parseInt(medico_id) !== parseInt(cita.medico_id);
                    sendEmail({
                      to: cita.correo,
                      subject: "Su cita ha sido reagendada - MediHomeRD (Código: " + (cita.codigo_cita || "") + ")",
                      html: buildReschedulePatientEmail(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                      text: buildReschedulePatientText(cita, nueva_fecha, nueva_hora, medicoNuevo.nombre, motivoFinal, cambioMedico),
                    });
                  }

                  res.json({
                    mensaje: "Cita reagendada correctamente",
                    cita: {
                      id: parseInt(req.params.id),
                      fecha_anterior: oldFecha,
                      hora_anterior: oldHora,
                      medico_anterior: oldMedicoNombre,
                      nueva_fecha: nueva_fecha,
                      nueva_hora: nueva_hora,
                      nuevo_medico: medicoNuevo.nombre,
                      estado: "reagendada",
                    },
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

function buildRescheduleDoctorEmail(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var cambioMedicoLine = cambioMedico
    ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nuevo Médico</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(medicoNombre) + "</td></tr>"
    : "";
  var headerTitle = cambioMedico ? "Cita Reagendada - Nuevo Médico Asignado" : "Cita Reagendada";
  return (
    '<div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.04)">' +
    '<div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;text-align:center">' +
    '<div style="font-size:2rem;margin-bottom:8px">📅</div>' +
    '<h1 style="color:#ffffff;font-size:1.3rem;margin:0;font-weight:700;letter-spacing:-0.3px">' + headerTitle + '</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:0.85rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>' +
    '<div style="padding:28px 32px">' +
    '<p style="color:#0f172a;font-size:0.95rem;margin:0 0 20px">Se ha reagendado una cita. A continuación los nuevos detalles:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:120px;font-weight:600">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(cita.nombre_paciente) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Código</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#2563eb;font-weight:700">' + escHtml(cita.codigo_cita) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(cita.servicio_nombre) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Fecha</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaFecha) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Hora</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaHora) + "</td></tr>" +
    cambioMedicoLine +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Motivo</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-style:italic">' + escHtml(motivo) + "</td></tr>" +
    "</table>" +
    '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:16px 20px"><p style="margin:0;color:#92400e;font-size:0.8rem">💡 La cita original fue reagendada. Consulte el panel médico para ver los detalles actualizados.</p></div></div>' +
    '<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>'
  );
}

function buildRescheduleDoctorText(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var lines = [
    "CITA REAGENDADA",
    "================",
    "",
    (cambioMedico ? "Se le ha reasignado una cita reagendada." : "Una cita ha sido reagendada."),
    "",
    "Paciente: " + cita.nombre_paciente,
    "Código: " + (cita.codigo_cita || ""),
    "Servicio: " + (cita.servicio_nombre || ""),
    "Nueva Fecha: " + nuevaFecha,
    "Nueva Hora: " + nuevaHora,
    cambioMedico ? "Nuevo Médico: " + medicoNombre : "",
    "Motivo: " + motivo,
    "",
    "MediHomeRD — Plataforma de Salud Digital",
  ];
  return lines.filter(Boolean).join("\n");
}

function buildReschedulePatientEmail(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var cambioMedicoLine = cambioMedico
    ? '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Médico</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(medicoNombre) + "</td></tr>"
    : "";
  return (
    '<div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.04)">' +
    '<div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;text-align:center">' +
    '<div style="font-size:2rem;margin-bottom:8px">📅</div>' +
    '<h1 style="color:#ffffff;font-size:1.3rem;margin:0;font-weight:700;letter-spacing:-0.3px">Su cita ha sido reagendada</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:0.85rem;margin:6px 0 0">MediHomeRD — Plataforma de Salud Digital</p></div>' +
    '<div style="padding:28px 32px">' +
    '<p style="color:#0f172a;font-size:0.95rem;margin:0 0 20px">Su cita ha sido reagendada con los siguientes nuevos detalles:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;width:120px;font-weight:600">Paciente</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:500">' + escHtml(cita.nombre_paciente) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Código</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#2563eb;font-weight:700">' + escHtml(cita.codigo_cita) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Servicio</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a">' + escHtml(cita.servicio_nombre) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Fecha</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaFecha) + "</td></tr>" +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Nueva Hora</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-weight:600">' + escHtml(nuevaHora) + "</td></tr>" +
    cambioMedicoLine +
    '<tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;background:#f8fafc;font-weight:600">Motivo</td><td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:0.85rem;color:#0f172a;font-style:italic">' + escHtml(motivo) + "</td></tr>" +
    "</table>" +
    '<p style="color:#64748b;font-size:0.82rem;margin:0 0 16px">Si tiene alguna pregunta, contáctenos al <strong>+1 (829) 901-7488</strong>.</p>' +
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;text-align:center">' +
    '<p style="margin:0;color:#166534;font-size:0.8rem">Puede dar seguimiento a su cita usando el código <strong>' + escHtml(cita.codigo_cita) + '</strong> en nuestra plataforma.</p></div></div>' +
    '<div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">' +
    '<p style="font-size:0.72rem;color:#94a3b8;margin:0">MediHomeRD — Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>'
  );
}

function buildReschedulePatientText(cita, nuevaFecha, nuevaHora, medicoNombre, motivo, cambioMedico) {
  var lines = [
    "SU CITA HA SIDO REAGENDADA",
    "===========================",
    "",
    "Estimado/a " + cita.nombre_paciente + ", su cita ha sido reagendada.",
    "",
    "Nuevos detalles:",
    "Código: " + (cita.codigo_cita || ""),
    "Servicio: " + (cita.servicio_nombre || ""),
    "Nueva Fecha: " + nuevaFecha,
    "Nueva Hora: " + nuevaHora,
    cambioMedico ? "Médico: " + medicoNombre : "",
    "Motivo: " + motivo,
    "",
    "Si tiene alguna pregunta, contáctenos al +1 (829) 901-7488",
    "",
    "MediHomeRD — Plataforma de Salud Digital",
  ];
  return lines.filter(Boolean).join("\n");
}

// ── CALENDARIO DE DISPONIBILIDAD (vista mensual) ──

app.get("/api/admin/reagendar/calendario", authMiddleware, (req, res) => {
  const { servicio_id, medico_id, year, month } = req.query;
  if (!servicio_id || !year || month === undefined) {
    return res.status(400).json({ error: "servicio_id, year y month son requeridos" });
  }

  const y = parseInt(year);
  const m = parseInt(month);
  const diasEnMes = new Date(y, m + 1, 0).getDate();
  const results = [];

  // Obtener la disponibilidad del servicio por día de semana
  db.all(
    "SELECT dia_semana FROM disponibilidad WHERE servicio_id=? AND activo=1 GROUP BY dia_semana",
    [servicio_id],
    (err, diasDisponibles) => {
      if (err) return res.status(500).json({ error: err.message });

      const diasSemanaSet = {};
      (diasDisponibles || []).forEach(function (d) { diasSemanaSet[d.dia_semana] = true; });

      // Obtener excepciones del servicio para el mes
      const primerDia = y + "-" + String(m + 1).padStart(2, "0") + "-01";
      const ultimoDia = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(diasEnMes).padStart(2, "0");
      db.all(
        "SELECT fecha FROM disponibilidad_excepciones WHERE servicio_id=? AND fecha>=? AND fecha<=? AND activo=1 AND tipo='no_disponible'",
        [servicio_id, primerDia, ultimoDia],
        (err2, excepciones) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const excSet = {};
          (excepciones || []).forEach(function (e) {
            if (e.fecha) excSet[e.fecha] = true;
          });

          // Si hay medico_id, obtener sus citas en este mes (para detectar días completamente ocupados)
          var citasMedico = {};
          var cargoMedico = false;
          if (medico_id) {
            cargoMedico = true;
            db.all(
              "SELECT fecha, COUNT(*) as count FROM citas WHERE medico_id=? AND fecha>=? AND fecha<=? AND estado NOT IN ('cancelada','completada') GROUP BY fecha",
              [medico_id, primerDia, ultimoDia],
              (err3, ocupadas) => {
                if (err3) return res.status(500).json({ error: err3.message });
                (ocupadas || []).forEach(function (o) {
                  citasMedico[o.fecha] = o.count;
                });
                construirCalendario();
              }
            );
          }

          function construirCalendario() {
            for (let d = 1; d <= diasEnMes; d++) {
              const dateStr = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
              const dateObj = new Date(dateStr + "T12:00:00");
              const dow = dateObj.getDay();
              const isPast = dateObj <= new Date(new Date().toDateString());
              if (isPast) {
                results.push({ fecha: dateStr, dia: d, disponible: false, razon: "pasado" });
              } else if (excSet[dateStr]) {
                results.push({ fecha: dateStr, dia: d, disponible: false, razon: "excepcion" });
              } else if (!diasSemanaSet[dow]) {
                results.push({ fecha: dateStr, dia: d, disponible: false, razon: "no_disponible" });
              } else {
                results.push({ fecha: dateStr, dia: d, disponible: true, razon: null });
              }
            }

            res.json({ year: y, month: m, total_dias: diasEnMes, dias: results });
          }

          if (!cargoMedico) construirCalendario();
        }
      );
    }
  );
});

// ── VERIFICAR DISPONIBILIDAD PARA REAGENDAR ──

app.get("/api/admin/citas/:id/reagendar/disponibilidad", authMiddleware, (req, res) => {
  const { servicio_id, medico_id, fecha } = req.query;
  if (!servicio_id || !medico_id || !fecha) {
    return res.status(400).json({ error: "servicio_id, medico_id y fecha son requeridos" });
  }

  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();

  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1 ORDER BY hora_inicio",
    [servicio_id, diaSemana],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) {
        return res.json({ disponible: false, slots: [], mensaje: "No hay disponibilidad para este servicio en la fecha seleccionada." });
      }

      const slots = [];
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const isToday = fecha === todayStr;

      rows.forEach(function (config) {
        const [hInicio, mInicio] = config.hora_inicio.split(":").map(Number);
        const [hFin, mFin] = config.hora_fin.split(":").map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const finMinutos = hFin * 60 + mFin;
        const duracion = config.duracion || 30;
        for (let m = inicioMinutos; m + duracion <= finMinutos; m += duracion) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const horaStr = String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
          const periodo = h >= 12 ? "PM" : "AM";
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const hora12 = h12 + ":" + String(min).padStart(2, "0") + " " + periodo;
          if (isToday) {
            const nowMin = today.getHours() * 60 + today.getMinutes();
            if (m <= nowMin) continue;
          }
          slots.push({ hora: horaStr, hora12: hora12, label: hora12 });
        }
      });

      var capacidad = rows[0]?.capacidad || 1;

      // Obtener citas ocupadas para este servicio y fecha (para verificar capacidad del servicio)
      // y también verificar si el médico específico ya tiene cita en esta fecha/hora
      db.all(
        "SELECT hora, COUNT(*) as count FROM citas WHERE servicio_id=? AND fecha=? AND estado NOT IN ('cancelada') AND id!=? GROUP BY hora",
        [servicio_id, fecha, req.params.id],
        (err2, ocupadasServicio) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // Obtener citas del médico específico en esta fecha
          db.all(
            "SELECT hora FROM citas WHERE medico_id=? AND fecha=? AND estado NOT IN ('cancelada','completada') AND id!=?",
            [medico_id, fecha, req.params.id],
            (err3, ocupadasMedico) => {
              if (err3) return res.status(500).json({ error: err3.message });

              const ocupMapServicio = {};
              (ocupadasServicio || []).forEach(function (o) { ocupMapServicio[o.hora] = o.count; });

              const ocupMapMedico = {};
              (ocupadasMedico || []).forEach(function (o) { ocupMapMedico[o.hora] = true; });

              const conEstado = slots.map(function (s) {
                const servicioOcupado = (ocupMapServicio[s.hora] || 0) >= capacidad;
                const medicoOcupado = !!ocupMapMedico[s.hora];
                return {
                  ...s,
                  ocupado: servicioOcupado || medicoOcupado,
                  ocupado_servicio: servicioOcupado,
                  ocupado_medico: medicoOcupado,
                  reservas: ocupMapServicio[s.hora] || 0,
                  capacidad: capacidad,
                };
              });

              const disponibles = conEstado.filter(function (s) { return !s.ocupado; });
              const mensaje = conEstado.length > 0 && disponibles.length === 0
                ? "El médico seleccionado no tiene disponibilidad para la fecha seleccionada."
                : null;

              res.json({ disponible: disponibles.length > 0, slots: conEstado, mensaje: mensaje });
            }
          );
        }
      );
    }
  );
});

// ── DISPONIBILIDAD GLOBAL (slots across ALL doctors for a service+date) ──

app.get("/api/admin/reagendar/disponibilidad-global", authMiddleware, (req, res) => {
  const { servicio_id, fecha, excluir_cita_id } = req.query;
  if (!servicio_id || !fecha) {
    return res.status(400).json({ error: "servicio_id y fecha son requeridos" });
  }

  const dateObj = new Date(fecha + "T12:00:00");
  const diaSemana = dateObj.getDay();

  db.all(
    "SELECT * FROM disponibilidad WHERE servicio_id=? AND dia_semana=? AND activo=1 ORDER BY hora_inicio",
    [servicio_id, diaSemana],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) {
        return res.json({ disponible: false, slots: [], mensaje: "No hay disponibilidad para este servicio en la fecha seleccionada." });
      }

      const slotsBase = [];
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const isToday = fecha === todayStr;

      rows.forEach(function(config) {
        const [hInicio, mInicio] = config.hora_inicio.split(":").map(Number);
        const [hFin, mFin] = config.hora_fin.split(":").map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const finMinutos = hFin * 60 + mFin;
        const duracion = config.duracion || 30;
        for (let m = inicioMinutos; m + duracion <= finMinutos; m += duracion) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const horaStr = String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
          const periodo = h >= 12 ? "PM" : "AM";
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const hora12 = h12 + ":" + String(min).padStart(2, "0") + " " + periodo;
          if (isToday) {
            const nowMin = today.getHours() * 60 + today.getMinutes();
            if (m <= nowMin) continue;
          }
          slotsBase.push({ hora: horaStr, hora12: hora12 });
        }
      });

      const capacidad = rows[0].capacidad || 1;

      // Get all active doctors for this service
      db.all(
        "SELECT m.id, m.nombre, m.especialidad FROM medicos m JOIN medico_servicios ms ON m.id=ms.medico_id WHERE ms.servicio_id=? AND m.activo=1",
        [servicio_id],
        (err2, doctores) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const excluirId = parseInt(excluir_cita_id) || 0;

          // Get all booked citas for this service+date excluding the current cita
          db.all(
            "SELECT medico_id, hora FROM citas WHERE servicio_id=? AND fecha=? AND estado NOT IN ('cancelada','completada') AND id!=?",
            [servicio_id, fecha, excluirId],
            (err3, ocupadas) => {
              if (err3) return res.status(500).json({ error: err3.message });

              const ocupMap = {};
              (ocupadas || []).forEach(function(o) {
                if (!ocupMap[o.hora]) ocupMap[o.hora] = {};
                ocupMap[o.hora][o.medico_id] = true;
              });

              const servOcupMap = {};
              (ocupadas || []).forEach(function(o) {
                servOcupMap[o.hora] = (servOcupMap[o.hora] || 0) + 1;
              });

              const resultSlots = slotsBase.map(function(s) {
                const doctorsAvailable = doctores.filter(function(d) {
                  return !(ocupMap[s.hora] && ocupMap[s.hora][d.id]);
                });
                const servicioOcupado = (servOcupMap[s.hora] || 0) >= capacidad;

                return {
                  hora: s.hora,
                  hora12: s.hora12,
                  ocupado: servicioOcupado || doctorsAvailable.length === 0,
                  doctores_disponibles: doctorsAvailable.map(function(d) {
                    return { id: d.id, nombre: d.nombre, especialidad: d.especialidad || "General" };
                  }),
                };
              });

              const disponibles = resultSlots.filter(function(s) { return !s.ocupado; });
              res.json({
                disponible: disponibles.length > 0,
                slots: resultSlots,
                doctores_registrados: doctores.map(function(d) {
                  return { id: d.id, nombre: d.nombre, especialidad: d.especialidad || "General" };
                }),
              });
            }
          );
        }
      );
    }
  );
});

// ── CONFIRMAR CITA MANUAL ──

app.put("/api/admin/citas/:id/confirmar", authMiddleware, (req, res) => {
  db.run(
    "UPDATE citas SET estado='confirmada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado='pendiente'",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res
          .status(400)
          .json({ error: "La cita no está pendiente o no existe" });
      // Notificar a admins
      db.get(
        "SELECT c.nombre_paciente, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.id=?",
        [req.params.id],
        function (err2, cita2) {
          if (err2 || !cita2) return;
          db.all(
            "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
            [],
            function (err3, admins) {
              if (err3 || !admins) return;
              var stmt = db.prepare(
                "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
              );
              admins.forEach(function (a) {
                stmt.run(
                  a.id,
                  "Cita confirmada",
                  "Cita de " +
                    cita2.nombre_paciente +
                    " confirmada — " +
                    (cita2.servicio_nombre || ""),
                  "cita_confirmada",
                  parseInt(req.params.id),
                  cita2.nombre_paciente,
                  cita2.servicio_nombre,
                );
              });
              stmt.finalize();
            },
          );
        },
      );
      res.json({ mensaje: "Cita confirmada correctamente" });
    },
  );
});

// ── EXPEDIENTE POR CÉDULA ──

app.get("/api/admin/expedientes/:cedula", authMiddleware, (req, res) => {
  db.get(
    "SELECT * FROM pacientes WHERE cedula=?",
    [req.params.cedula],
    (err, paciente) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!paciente)
        return res.json({
          existe: false,
          paciente: null,
          citas: [],
          resultados: [],
        });

      db.all(
        "SELECT c.*, s.nombre as servicio_nombre FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.nombre_paciente=? AND c.telefono=? ORDER BY c.created_at DESC",
        [paciente.nombre, paciente.telefono],
        (err2, citas) => {
          const citaIds = (citas || []).map((c) => c.id);

          console.log("[expedientes] paciente.id:", paciente.id, typeof paciente.id);
          db.all(
            "SELECT rp.* FROM resultados_paciente rp WHERE rp.paciente_id=? ORDER BY rp.created_at DESC",
            [paciente.id],
            (err4, rowsRp) => {
              console.log("[expedientes] rp callback err:", err4?.message, "rows:", rowsRp?.length);
              if (err4) return res.status(500).json({ error: err4.message });
              const resultadosPaciente = rowsRp || [];

              if (citas.length === 0) {
                const allResultados = resultadosPaciente.map(r => ({
                  ...r,
                  estudio: r.estudio || "Estudio",
                  fecha: r.fecha || "",
                  medico_nombre: r.medico_nombre || "",
                  observaciones: r.observaciones || "",
                }));
                allResultados.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                return res.json({ existe: true, paciente, citas: citas || [], resultados: allResultados });
              }

              const rcitaIds = citas.map((c) => c.id);
              db.all(
                `SELECT rc.*, c.codigo_cita, c.fecha as cita_fecha, c.nombre_paciente, s.nombre as servicio_nombre FROM resultados_citas rc JOIN citas c ON rc.cita_id=c.id LEFT JOIN servicios s ON c.servicio_id=s.id WHERE rc.cita_id IN (${rcitaIds.map(() => "?").join(",")}) ORDER BY rc.created_at DESC`,
                rcitaIds,
                (err5, rowsRc) => {
                  if (err5) return res.status(500).json({ error: err5.message });
                  const resultadosCitas = rowsRc || [];
                  const normalizar = (r) => ({
                    ...r,
                    estudio: r.estudio || r.servicio_nombre || "Estudio",
                    fecha: r.fecha || r.cita_fecha || "",
                    medico_nombre: r.medico_nombre || "",
                    observaciones: r.observaciones || r.nota || "",
                  });
                  const allResultados = [
                    ...resultadosPaciente.map(normalizar),
                    ...resultadosCitas.map(normalizar),
                  ];
                  allResultados.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                  res.json({ existe: true, paciente, citas: citas || [], resultados: allResultados });
                },
              );
            },
          );
        },
      );
    },
  );
});

// ── GENERAR PDF FACTURA ──

app.get("/api/admin/facturas/:id/pdf", (req, res) => {
  // Allow token via query param for direct download links
  const queryToken = req.query.token;
  if (!queryToken) {
    // If no query token, require normal auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const headerToken = authHeader.split(" ")[1];
    try {
      const decoded = require("jsonwebtoken").verify(headerToken, SECRET);
      req.admin = decoded;
    } catch (e) {
      return res.status(401).json({ error: "Token inválido" });
    }
  } else {
    try {
      const decoded = require("jsonwebtoken").verify(queryToken, SECRET);
      req.admin = decoded;
    } catch (e) {
      return res.status(401).json({ error: "Token inválido" });
    }
  }
  db.get(
    `SELECT f.*, c.codigo_cita, c.fecha as cita_fecha, c.hora as cita_hora, c.nombre_paciente,
    c.telefono, c.direccion, c.ciudad, c.modalidad, s.nombre as servicio_nombre, s.precio
    FROM facturas f LEFT JOIN citas c ON f.cita_id=c.id LEFT JOIN servicios s ON f.servicio_id=s.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });

      try {
        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({ margin: 50, size: "LETTER" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="factura-${factura.numero_factura}.pdf"`,
        );
        doc.pipe(res);

        const coberturaLabels = {
          autorizada: "Autorizada",
          rechazada: "Rechazada",
          no_aplica: "No aplica",
          pendiente_de_validacion: "Pendiente",
        };
        const estadoLabels = {
          pendiente_de_validacion: "Pendiente Validación",
          pendiente_de_pago: "Pendiente de Pago",
          pagada: "Pagada",
          anulada: "Anulada",
          pendiente: "Pendiente",
        };

        const top = 50;
        // Header
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text("MediHomeRD", top, top, { align: "center" });
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#64748b")
          .text("Plataforma de Salud Digital", { align: "center" });
        doc.moveDown(0.5);

        // Title
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("FACTURA DE SERVICIO MÉDICO", { align: "center" });
        doc.moveDown(0.3);

        // Separator
        doc
          .moveTo(50, doc.y)
          .lineTo(565, doc.y)
          .strokeColor("#e2e8f0")
          .stroke();
        doc.moveDown(0.5);

        const leftX = 50;
        const rightX = 350;
        const colY = doc.y;

        // Left column - patient info
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("DATOS DEL PACIENTE", leftX, colY);
        let ly = doc.y + 4;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Paciente: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.nombre_paciente || factura.paciente_nombre);
        ly = doc.y + 2;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Cédula: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.cedula || "—");
        ly = doc.y + 2;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Dirección: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(
            (factura.direccion || "") +
              (factura.ciudad ? ", " + factura.ciudad : ""),
          );
        ly = doc.y + 2;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Teléfono: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.telefono || "—");

        // Right column - invoice info
        const invoiceY = colY;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`N. Factura: `, rightX, invoiceY, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text(factura.numero_factura);
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Código Cita: `, rightX, doc.y + 2, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.codigo_cita || "—");
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Fecha Emisión: `, rightX, doc.y + 2, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(
            factura.created_at
              ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—",
          );
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Estado: `, rightX, doc.y + 2, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(estadoLabels[factura.estado] || factura.estado);

        doc.moveDown(1.5);
        const tableTop = doc.y;

        // Table header
        doc.rect(50, tableTop, 515, 20).fill("#f8fafc");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("Servicio", 60, tableTop + 5, { width: 200 });
        doc.text("Precio Base", 270, tableTop + 5, {
          width: 90,
          align: "center",
        });
        doc.text("Cobertura ARS", 360, tableTop + 5, {
          width: 90,
          align: "center",
        });
        doc.text("Total Pagar", 460, tableTop + 5, {
          width: 90,
          align: "center",
        });

        // Table row
        const rowY = tableTop + 22;
        doc.fontSize(9).font("Helvetica").fillColor("#0f172a");
        doc.text(factura.servicio_nombre || "—", 60, rowY, { width: 200 });
        doc.text(
          `RD$ ${Number(factura.precio_base || 0).toLocaleString()}`,
          270,
          rowY,
          { width: 90, align: "center" },
        );
        doc.text(
          `RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}`,
          360,
          rowY,
          { width: 90, align: "center" },
        );
        doc
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text(
            `RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}`,
            460,
            rowY,
            { width: 90, align: "center" },
          );

        // Separator
        const sepY = rowY + 22;
        doc.moveTo(50, sepY).lineTo(565, sepY).strokeColor("#e2e8f0").stroke();

        // Summary
        const sumY = sepY + 10;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc.text("Precio Base:", 380, sumY);
        doc.text(
          `RD$ ${Number(factura.precio_base || 0).toLocaleString()}`,
          470,
          sumY,
          { align: "right" },
        );
        doc.text(
          `Cobertura ARS (${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}):`,
          380,
          doc.y + 2,
        );
        doc
          .font("Helvetica")
          .fillColor("#059669")
          .text(
            `RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}`,
            470,
            doc.y - 12,
            { align: "right" },
          );
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("TOTAL A PAGAR:", 350, doc.y + 6);
        doc
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text(
            `RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}`,
            470,
            doc.y - 14,
            { align: "right" },
          );

        // ARS info
        doc.moveDown(1);
        const arsY = doc.y + 6;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc.text(`ARS: ${factura.ars_nombre || "—"}`, 50, arsY);
        if (factura.numero_autorizacion)
          doc.text(
            `Autorización: ${factura.numero_autorizacion}`,
            50,
            doc.y + 2,
          );
        if (factura.observacion_ars)
          doc.text(`Observación: ${factura.observacion_ars}`, 50, doc.y + 2);

        // Footer
        const footerY = doc.y + 30;
        doc.moveTo(50, footerY).strokeColor("#e2e8f0").stroke();
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#94a3b8")
          .text("MediHomeRD — Plataforma de Salud Digital", 50, footerY + 6, {
            align: "center",
          });

        doc.end();
      } catch (err) {
        console.error("[pdf] Error:", err.message);
        res.status(500).json({ error: "Error al generar PDF: " + err.message });
      }
    },
  );
});

// ── SEND INVOICE EMAIL ──

app.put("/api/admin/facturas/:id/enviar-email", authMiddleware, (req, res) => {
  db.get(
    `SELECT f.*, c.correo, c.nombre_paciente FROM facturas f
    LEFT JOIN citas c ON f.cita_id=c.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });

      if (
        factura.cobertura_estado === "pendiente_de_validacion" &&
        factura.ars_nombre !== "No tengo seguro"
      ) {
        return res.status(400).json({
          error: "Debe validar la cobertura antes de enviar la factura",
        });
      }

      const emailDestino = factura.correo || factura.email_destino;
      if (!emailDestino)
        return res.status(400).json({
          error: "El paciente no tiene correo electrónico registrado",
        });

      const coberturaLabels = {
        autorizada: "Autorizada",
        rechazada: "Rechazada",
        no_aplica: "No aplica",
        pendiente_de_validacion: "Pendiente de validación",
      };
      const estadoLabels = {
        pendiente_de_validacion: "Pendiente de validación",
        pendiente_de_pago: "Pendiente de pago",
        pagada: "Pagada",
        anulada: "Anulada",
        pendiente: "Pendiente",
      };

      const html = `
<div style="font-family:Inter, system-ui, sans-serif; max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(0,0,0,0.04)">
  <div style="background:linear-gradient(135deg,#2563eb,#0ea5e5); padding:28px 32px; text-align:center">
    <h1 style="color:#fff; font-size:1.3rem; margin:0; font-weight:700">Factura de Servicio Médico</h1>
    <p style="color:rgba(255,255,255,0.85); font-size:0.85rem; margin:6px 0 0">MediHomeRD &mdash; Plataforma de Salud Digital</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#0f172a; font-size:0.95rem; margin:0 0 20px">Estimado(a) <strong>${escHtml(factura.nombre_paciente || factura.paciente_nombre)}</strong>, se ha generado su factura de servicio médico.</p>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px">
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600; width:140px">N. Factura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#2563eb; font-weight:700">${escHtml(factura.numero_factura)}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Servicio</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.servicio_nombre)}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Precio Base</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">RD$ ${Number(factura.precio_base || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.ars_nombre || "—")}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Cobertura ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#059669">RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado Cobertura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}</td></tr>
      <tr style="font-weight:700"><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; background:#f8fafc; color:#0f172a">Total a Pagar</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; color:#2563eb">RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${estadoLabels[factura.estado] || factura.estado}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Fecha Emisión</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td></tr>
    </table>
  </div>
  <div style="background:#f8fafc; padding:20px 32px; text-align:center; border-top:1px solid #e2e8f0">
    <p style="font-size:0.72rem; color:#94a3b8; margin:0">MediHomeRD &mdash; Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p>
  </div>
</div>`;

      const text =
        `FACTURA DE SERVICIO MÉDICO - MediHomeRD\n\n` +
        `Estimado(a) ${factura.nombre_paciente || factura.paciente_nombre},\n\n` +
        `Se ha generado su factura de servicio médico.\n\n` +
        `N. Factura: ${factura.numero_factura}\n` +
        `Servicio: ${factura.servicio_nombre}\n` +
        `Precio Base: RD$ ${Number(factura.precio_base || 0).toLocaleString()}\n` +
        `ARS: ${factura.ars_nombre || "—"}\n` +
        `Cobertura ARS: RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}\n` +
        `Estado Cobertura: ${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}\n` +
        `Total a Pagar: RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}\n` +
        `Estado: ${estadoLabels[factura.estado] || factura.estado}\n` +
        `Fecha Emisión: ${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES") : "—"}\n\n` +
        `MediHomeRD - Plataforma de Salud Digital`;

      const { sendEmail } = require("./utils/mailer");
      sendEmail({
        to: emailDestino,
        subject: "Factura de servicio médico - Medi Home RD",
        html,
        text,
      }).then((result) => {
        if (!result.sent)
          return res.status(500).json({
            error:
              "Error al enviar el correo: " + (result.reason || "desconocido"),
          });
        db.run(
          "UPDATE facturas SET factura_enviada_email=1, fecha_envio_email=CURRENT_TIMESTAMP, email_destino=? WHERE id=?",
          [emailDestino, req.params.id],
          function (err2) {
            if (err2)
              console.error(
                "[email] Error al actualizar factura:",
                err2.message,
              );
            res.json({
              success: true,
              mensaje:
                "Factura enviada correctamente al correo " + emailDestino,
            });
          },
        );
      });
    },
  );
});

// ── ENVIAR FACTURA POR CORREO (POST) ──

app.post("/api/facturas/:id/enviar-correo", authMiddleware, (req, res) => {
  db.get(
    `SELECT f.*, c.correo, c.nombre_paciente FROM facturas f
    LEFT JOIN citas c ON f.cita_id=c.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res
          .status(404)
          .json({ success: false, error: "Factura no encontrada" });

      if (
        factura.cobertura_estado === "pendiente_de_validacion" &&
        factura.ars_nombre !== "No tengo seguro"
      ) {
        return res.status(400).json({
          success: false,
          error: "Debe validar la cobertura antes de enviar la factura",
        });
      }

      const emailDestino = factura.correo || factura.email_destino;
      if (!emailDestino)
        return res.status(400).json({
          success: false,
          error: "El paciente no tiene correo electrónico registrado",
        });

      const coberturaLabels = {
        autorizada: "Autorizada",
        rechazada: "Rechazada",
        no_aplica: "No aplica",
        pendiente_de_validacion: "Pendiente de validación",
      };
      const estadoLabels = {
        pendiente_de_validacion: "Pendiente de validación",
        pendiente_de_pago: "Pendiente de pago",
        pagada: "Pagada",
        anulada: "Anulada",
        pendiente: "Pendiente",
      };

      const html = `
<div style="font-family:Inter, system-ui, sans-serif; max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(0,0,0,0.04)">
  <div style="background:linear-gradient(135deg,#2563eb,#0ea5e5); padding:28px 32px; text-align:center">
    <h1 style="color:#fff; font-size:1.3rem; margin:0; font-weight:700">Factura de Servicio Médico</h1>
    <p style="color:rgba(255,255,255,0.85); font-size:0.85rem; margin:6px 0 0">MediHomeRD &mdash; Plataforma de Salud Digital</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#0f172a; font-size:0.95rem; margin:0 0 20px">Estimado(a) <strong>${escHtml(factura.nombre_paciente || factura.paciente_nombre)}</strong>, se ha generado su factura de servicio médico.</p>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px">
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600; width:140px">N. Factura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#2563eb; font-weight:700">${escHtml(factura.numero_factura)}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Servicio</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.servicio_nombre)}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Precio Base</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">RD$ ${Number(factura.precio_base || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.ars_nombre || "—")}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Cobertura ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#059669">RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado Cobertura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}</td></tr>
      <tr style="font-weight:700"><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; background:#f8fafc; color:#0f172a">Total a Pagar</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; color:#2563eb">RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${estadoLabels[factura.estado] || factura.estado}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Fecha Emisión</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td></tr>
    </table>
  </div>
  <div style="background:#f8fafc; padding:20px 32px; text-align:center; border-top:1px solid #e2e8f0">
    <p style="font-size:0.72rem; color:#94a3b8; margin:0">MediHomeRD &mdash; Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p>
  </div>
</div>`;

      const text =
        `FACTURA DE SERVICIO MÉDICO - MediHomeRD\n\n` +
        `Estimado(a) ${factura.nombre_paciente || factura.paciente_nombre},\n\n` +
        `Se ha generado su factura de servicio médico.\n\n` +
        `N. Factura: ${factura.numero_factura}\n` +
        `Servicio: ${factura.servicio_nombre}\n` +
        `Precio Base: RD$ ${Number(factura.precio_base || 0).toLocaleString()}\n` +
        `ARS: ${factura.ars_nombre || "—"}\n` +
        `Cobertura ARS: RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}\n` +
        `Estado Cobertura: ${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}\n` +
        `Total a Pagar: RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}\n` +
        `Estado: ${estadoLabels[factura.estado] || factura.estado}\n` +
        `Fecha Emisión: ${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES") : "—"}\n\n` +
        `MediHomeRD - Plataforma de Salud Digital`;

      const { sendEmail } = require("./utils/mailer");
      sendEmail({
        to: emailDestino,
        subject: "Factura de servicio médico - Medi Home RD",
        html,
        text,
      }).then((result) => {
        if (!result.sent)
          return res.status(500).json({
            success: false,
            error:
              "Error al enviar el correo: " + (result.reason || "desconocido"),
          });
        db.run(
          "UPDATE facturas SET factura_enviada_email=1, fecha_envio_email=CURRENT_TIMESTAMP, email_destino=? WHERE id=?",
          [emailDestino, req.params.id],
          function (err2) {
            if (err2)
              console.error(
                "[email] Error al actualizar factura:",
                err2.message,
              );
            res.json({
              success: true,
              mensaje:
                "Factura enviada correctamente al correo " + emailDestino,
            });
          },
        );
      });
    },
  );
});

// ── PUBLIC PATIENTS API ──

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
  const { sendEmail } = require("./utils/mailer");
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: "Correo del paciente requerido" });

  db.get("SELECT * FROM pacientes WHERE id=?", [req.params.id], (err, paciente) => {
    if (err || !paciente) return res.status(404).json({ error: "Paciente no encontrado" });

    const today = new Date().toISOString().split("T")[0];

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

// ── REPORTES API ──

app.get("/api/reportes", authMiddleware, (req, res) => {
  const { periodo } = req.query;
  let dateFilter;
  const now = new Date();
  switch (periodo) {
    case "hoy":
      dateFilter = "DATE(c.fecha)=DATE('now')";
      break;
    case "semana":
      dateFilter = "c.fecha >= DATE('now','-7 days')";
      break;
    case "anio":
      dateFilter = "strftime('%Y',c.fecha)=strftime('%Y','now')";
      break;
    default:
      dateFilter = "c.fecha >= DATE('now','-30 days')";
      break;
  }

  try {
    const resumen = {};
    const queries = [
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter}`,
          (err, r) =>
            err ? reject(err) : resolve((resumen.totalCitas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter} AND c.estado='completada'`,
          (err, r) =>
            err ? reject(err) : resolve((resumen.completadas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter} AND c.estado='cancelada'`,
          (err, r) =>
            err ? reject(err) : resolve((resumen.canceladas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COALESCE(SUM(s.precio),0) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id WHERE ${dateFilter} AND c.estado='completada'`,
          (err, r) =>
            err
              ? reject(err)
              : resolve((resumen.ingresosCompletadas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM pacientes WHERE created_at >= DATE('now','-30 days')`,
          (err, r) =>
            err
              ? reject(err)
              : resolve((resumen.pacientesNuevos = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter} AND c.estado='cancelada'`,
          (err, cancel) => {
            db.get(
              `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter}`,
              (err2, total) => {
                const t = total?.total || 0;
                resolve(
                  (resumen.tasaCancelacion =
                    t > 0 ? Math.round(((cancel?.total || 0) / t) * 100) : 0),
                );
              },
            );
          },
        );
      }),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT c.estado, COUNT(*) as total FROM citas c WHERE ${dateFilter} GROUP BY c.estado`,
          (err, rows) => resolve((resumen.citasPorEstado = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT s.nombre, COUNT(c.id) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id WHERE ${dateFilter} GROUP BY c.servicio_id ORDER BY total DESC LIMIT 10`,
          (err, rows) =>
            resolve((resumen.serviciosMasSolicitados = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT c.fecha as label, COUNT(*) as total FROM citas c WHERE ${dateFilter} GROUP BY c.fecha ORDER BY c.fecha`,
          (err, rows) => resolve((resumen.citasPorDia = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT rc.*, c.nombre_paciente, s.nombre as servicio_nombre, m.nombre as medico_nombre FROM resultados_citas rc JOIN citas c ON rc.cita_id=c.id LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN usuarios_admin m ON c.medico_id=m.id ORDER BY rc.created_at DESC LIMIT 20`,
          (err, rows) => resolve((resumen.resultadosRegistrados = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT c.nombre_paciente, COUNT(c.id) as total FROM citas c WHERE ${dateFilter} GROUP BY c.nombre_paciente, c.telefono ORDER BY total DESC LIMIT 5`,
          (err, rows) => resolve((resumen.pacientesFrecuentes = rows || [])),
        ),
      ),
    ];

    Promise.all(queries).then(() => {
      const insights = [];
      if (resumen.completadas > resumen.canceladas) {
        insights.push({
          tipo: "positivo",
          titulo: "Buen ritmo de atención",
          texto: `${resumen.completadas} citas completadas superan las canceladas.`,
        });
      }
      if (resumen.canceladas > 3) {
        insights.push({
          tipo: "alerta",
          titulo: "Tasa de cancelación elevada",
          texto: `${resumen.canceladas} cancelaciones. Revise la agenda.`,
        });
      }
      if (resumen.pacientesNuevos > 0) {
        insights.push({
          tipo: "info",
          titulo: "Nuevos pacientes",
          texto: `${resumen.pacientesNuevos} pacientes nuevos registrados.`,
        });
      }
      if (resumen.ingresosCompletadas > 0) {
        insights.push({
          tipo: "azul",
          titulo: "Ingresos del período",
          texto: `RD$${Number(resumen.ingresosCompletadas).toLocaleString()} generados.`,
        });
      }
      resumen.insights = insights;
      res.json({
        success: true,
        resumen,
        citasPorEstado: resumen.citasPorEstado,
        serviciosMasSolicitados: resumen.serviciosMasSolicitados,
        citasPorDia: resumen.citasPorDia,
        resultadosRegistrados: resumen.resultadosRegistrados,
        pacientesFrecuentes: resumen.pacientesFrecuentes,
        insights,
      });
    });
  } catch (err) {
    console.error("[reportes] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── MENSAJES API ──

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

// ── CONFIGURACION API ──

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

app.post(
  "/api/medico/notificaciones/leer",
  medicoAuthMiddleware,
  (req, res) => {
    db.run(
      "UPDATE notificaciones SET leida=1 WHERE usuario_id=? AND leida=0",
      [req.medico.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Notificaciones marcadas como leídas" });
      },
    );
  },
);

// ── Diagnóstico de entorno ──
console.log("\n✦ Diagnóstico de configuración:");
["EMAIL_HOST", "EMAIL_USER", "EMAIL_FROM", "EMAIL_ADMIN", "SECRET"].forEach(
  (v) => console.log(`  ${v}: ${process.env[v] ? "✓ presente" : "✗ faltante"}`),
);
console.log("");

// ── Ruta de prueba de correo (protegida con token desde .env) ──
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

// General rate limiter for all /api routes
app.use("/api", limiterGeneral);

// Serve static files or 404
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Ruta no encontrada" }),
);

app.listen(PORT, () => {
  console.log(`✦ MediHomeRD corriendo en http://localhost:${PORT}`);
  console.log(`  Panel admin: http://localhost:${PORT}/admin.html`);
  console.log(`  Panel médico: http://localhost:${PORT}/medico.html`);
  console.log(`  Usuario: admin / Contraseña: admin1234`);
  console.log(`  Usuario: medico1 / Contraseña: medico123 (rol: médico)`);
});
