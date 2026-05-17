require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { sendAdminNotification, sendNewCitaNotification, sendResultadoNotification } = require('./services/emailService');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'medihome.db');
const SECRET = process.env.SECRET || 'medihome_secret_key_2026';

const db = new sqlite3.Database(DB_PATH);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
  res.charset = 'utf-8';
  next();
});

// ── Rate limiters ──
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente de nuevo en 15 minutos.' },
});

const limiterCitas = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de cita. Espere 15 minutos.' },
});

const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espere 15 minutos.' },
});

const limiterTestEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, mensaje: 'Demasiadas solicitudes de prueba. Espere 15 minutos.' },
});

const RESULTADOS_DIR = path.join(__dirname, 'uploads', 'resultados');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    if (!fs.existsSync(RESULTADOS_DIR)) fs.mkdirSync(RESULTADOS_DIR, { recursive: true });
    cb(null, RESULTADOS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const citaId = req.params.id || 'unknown';
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const safeName = 'resultado_cita_' + citaId + '_' + date + ext;
    cb(null, safeName);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, JPEG, PNG.'), false);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

function generarCodigoCita() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = 'MH-';
  for (let i = 0; i < 6; i++) codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  return codigo;
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios_admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'admin',
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
    comentario TEXT,
    estado TEXT DEFAULT 'pendiente',
    medico_id INTEGER,
    observaciones TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(servicio_id) REFERENCES servicios(id),
    FOREIGN KEY(medico_id) REFERENCES medicos(id)
  )`);

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

  db.get("SELECT COUNT(*) as count FROM usuarios_admin", (err, row) => {
    if (row && row.count === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO usuarios_admin (nombre, usuario, password, rol) VALUES (?,?,?,?)",
        ['Administrador', 'admin', hash, 'superadmin']);
      db.run("INSERT INTO usuarios_admin (nombre, usuario, password, rol) VALUES (?,?,?,?)",
        ['Dr. García', 'medico1', bcrypt.hashSync('medico123', 10), 'medico']);

      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Sonografía Obstétrica', 'Evaluación detallada del desarrollo fetal y bienestar del bebé durante el embarazo.', 'fa-baby', 2500, 30]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Sonografía Abdominal', 'Visualización de órganos internos del abdomen como hígado, vesícula, riñones y páncreas.', 'fa-ribbon', 2200, 30]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Sonografía Pélvica', 'Estudio de órganos pélvicos para evaluar el sistema reproductivo femenino y masculino.', 'fa-ribbon', 2200, 30]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Sonografía Prostática', 'Evaluación de la próstata para detección temprana de anomalías y control de salud masculina.', 'fa-ribbon', 2500, 30]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Doppler', 'Estudio del flujo sanguíneo en arterias y venas para detectar obstrucciones o alteraciones circulatorias.', 'fa-heart-pulse', 2800, 40]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Perfil Hemodinámico', 'Evaluación completa del sistema cardiovascular incluyendo presión arterial y flujo sanguíneo.', 'fa-heart-circle-check', 3500, 45]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Perfil Morfológico', 'Estudio detallado de la anatomía fetal para descartar malformaciones congénitas.', 'fa-baby', 3200, 40]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Mapa Cardiológico', 'Electrocardiograma y evaluación cardíaca completa para diagnóstico de afecciones del corazón.', 'fa-heart', 3000, 45]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Prueba de Covid-19', 'Prueba rápida de antígenos para detección de SARS-CoV-2 con resultados en minutos.', 'fa-virus', 800, 15]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Consulta Médica a Domicilio', 'Atención médica general en la comodidad de tu hogar con profesionales certificados.', 'fa-user-doctor', 1800, 30]);
      db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
        ['Telemedicina', 'Consulta médica virtual desde cualquier lugar, sin necesidad de desplazarte.', 'fa-video', 1200, 20]);

      db.run("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        ['Dr. Carlos García', 'Medicina General / Sonografía', '809-555-0101', 'carlos.garcia@medihome.com']);
      db.run("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        ['Dra. María Rodríguez', 'Cardiología', '809-555-0102', 'maria.rodriguez@medihome.com']);
      db.run("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        ['Dr. Juan Martínez', 'Medicina Interna', '809-555-0103', 'juan.martinez@medihome.com']);
      db.run("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        ['Dra. Laura Sánchez', 'Medicina General', '809-555-0104', 'laura.sanchez@medihome.com']);
      db.run("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
        ['Dr. Roberto Peña', 'Sonografía / Imágenes', '809-555-0105', 'roberto.pena@medihome.com']);
    }
  });
});

function sanitizar(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[<>"'\\]/g, '').trim();
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefonoRD(tel) {
  const limpio = tel.replace(/[\s\-\ ()\+]/g, '');
  return /^\d{10,12}$/.test(limpio);
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const jwt = require('jsonwebtoken');
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch { res.status(401).json({ error: 'Token inválido' }); }
}

// --- PUBLIC ROUTES ---

app.post('/api/login', limiterLogin, (req, res) => {
  const { usuario, password } = req.body;
  db.get("SELECT * FROM usuarios_admin WHERE usuario=? AND activo=1", [usuario], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol }, SECRET, { expiresIn: '24h' });
    res.json({ token, nombre: user.nombre, rol: user.rol });
  });
});

app.get('/api/servicios', (req, res) => {
  db.all("SELECT * FROM servicios WHERE activo=1 ORDER BY nombre", (err, rows) => res.json(rows));
});

app.get('/api/medicos', (req, res) => {
  db.all("SELECT * FROM medicos WHERE activo=1 ORDER BY nombre", (err, rows) => res.json(rows));
});

app.post('/api/citas', limiterCitas, (req, res) => {
  let { nombre_paciente, telefono, correo, direccion, ciudad, servicio_id, fecha, hora, modalidad, comentario, acepto_privacidad } = req.body;

  nombre_paciente = sanitizar(nombre_paciente || '');
  telefono = sanitizar(telefono || '');
  correo = sanitizar(correo || '');
  direccion = sanitizar(direccion || '');
  ciudad = sanitizar(ciudad || '');
  comentario = sanitizar(comentario || '');
  modalidad = sanitizar(modalidad || '');
  servicio_id = parseInt(servicio_id, 10);
  acepto_privacidad = !!acepto_privacidad;

  const errores = [];

  if (!nombre_paciente) errores.push('Nombre del paciente');
  if (!telefono) errores.push('Teléfono');
  else if (!validarTelefonoRD(telefono)) errores.push('Teléfono inválido (10 dígitos)');
  if (!correo) errores.push('Correo electrónico');
  else if (!validarEmail(correo)) errores.push('Correo electrónico inválido');
  if (!direccion) errores.push('Dirección');
  if (!ciudad) errores.push('Sector / Ciudad');
  if (!servicio_id || isNaN(servicio_id)) errores.push('Servicio');
  if (!fecha) errores.push('Fecha');
  if (!hora) errores.push('Hora');
  if (!['domicilio', 'telemedicina'].includes(modalidad)) errores.push('Modalidad (domicilio o telemedicina)');
  if (!acepto_privacidad) errores.push('Aceptación de política de privacidad');

  if (errores.length > 0) {
    return res.status(400).json({ error: `Campos obligatorios: ${errores.join(', ')}` });
  }

  console.log(`[appointment] Cita recibida - paciente: ${nombre_paciente}, servicio: ${servicio_id}, fecha: ${fecha} ${hora}`);

  let codigo = generarCodigoCita();
  const checkCodigo = () => {
    db.get("SELECT id FROM citas WHERE codigo_cita=?", [codigo], (err, row) => {
      if (row) { codigo = generarCodigoCita(); checkCodigo(); return; }
      insertar();
    });
  };

  const insertar = () => {
    db.run(`INSERT INTO citas (codigo_cita, nombre_paciente, telefono, correo, direccion, ciudad, servicio_id, fecha, hora, modalidad, comentario, estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [codigo, nombre_paciente, telefono, correo, direccion, ciudad, servicio_id, fecha, hora, modalidad, comentario, 'pendiente'],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error al crear la cita' });
        const citaId = this.lastID;
        console.log(`[appointment] Cita guardada correctamente - id: ${citaId}, codigo: ${codigo}`);
        res.json({ id: citaId, codigo_cita: codigo, mensaje: 'Su solicitud fue recibida correctamente. Nos comunicaremos con usted para confirmar la cita.' });

        db.get("SELECT s.nombre as servicio_nombre, s.precio FROM servicios s WHERE s.id=?", [servicio_id], (err2, servicio) => {
          const servicio_nombre = servicio ? servicio.nombre : '—';
          db.all(`SELECT m.nombre, m.correo FROM medicos m
            JOIN medico_servicios ms ON m.id=ms.medico_id
            WHERE ms.servicio_id=? AND m.activo=1 AND m.correo IS NOT NULL AND m.correo != ''`,
            [servicio_id], (err3, doctores) => {
              const medico = doctores && doctores.length > 0 ? doctores[0] : null;
              console.log(`[email] Enviando notificaciones para cita ${codigo}...`);
              sendNewCitaNotification({
                nombre_paciente,
                telefono,
                correo,
                servicio_nombre,
                medico_nombre: medico ? medico.nombre : 'Por asignar',
                medico_correo: medico ? medico.correo : null,
                fecha,
                hora,
                direccion,
                ciudad,
                modalidad,
                comentario,
                codigo_cita: codigo,
                created_at: new Date().toISOString(),
                estado: 'pendiente',
                admin_url: `${req.protocol}://${req.get('host')}/admin.html`,
              });
            });
        });
      });
  };

  checkCodigo();
});

app.get('/api/citas/seguimiento', (req, res) => {
  const { codigo, telefono } = req.query;
  if (!codigo && !telefono) return res.status(400).json({ error: 'Debe proporcionar código o teléfono' });

  let query, params;
  if (codigo) {
    query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
      FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.codigo_cita=?`;
    params = [codigo];
  } else {
    query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
      FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.telefono=? ORDER BY c.created_at DESC LIMIT 10`;
    params = [telefono];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al buscar' });
    res.json(rows);
  });
});

// --- ADMIN ROUTES ---

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const q = {
      get: (sql, params = []) => new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))),
      all: (sql, params = []) => new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)))
    };

    const [
      total, pend, conf, comp, canc, proc,
      topServicios, tendencia, actividadReciente,
      citasPorDia, pacientesCount, medicosCount,
      hoyTotal, ayerTotal
    ] = await Promise.all([
      q.get("SELECT COUNT(*) as total FROM citas"),
      q.get("SELECT COUNT(*) as pendientes FROM citas WHERE estado='pendiente'"),
      q.get("SELECT COUNT(*) as confirmadas FROM citas WHERE estado='confirmada'"),
      q.get("SELECT COUNT(*) as completadas FROM citas WHERE estado='completada'"),
      q.get("SELECT COUNT(*) as canceladas FROM citas WHERE estado='cancelada'"),
      q.get("SELECT COUNT(*) as en_proceso FROM citas WHERE estado='en_proceso'"),
      q.all(`SELECT s.nombre, COUNT(c.id) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id GROUP BY c.servicio_id ORDER BY total DESC LIMIT 5`),
      q.all(`SELECT DATE(created_at) as dia, COUNT(*) as total FROM citas GROUP BY dia ORDER BY dia DESC LIMIT 7`),
      q.all(`SELECT 'cita' as tipo, c.nombre_paciente as paciente, COALESCE(s.nombre,'') as servicio, c.estado, c.created_at as fecha
        FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id
        ORDER BY c.created_at DESC LIMIT 5`),
      q.all(`SELECT CASE CAST(strftime('%w',fecha) AS INTEGER)
        WHEN 0 THEN 'Dom' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié'
        WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' END as dia,
        COUNT(*) as total FROM citas
        WHERE fecha >= DATE('now','-7 days')
        GROUP BY strftime('%w',fecha) ORDER BY strftime('%w',fecha)`),
      q.get("SELECT COUNT(DISTINCT nombre_paciente || telefono) as total FROM citas"),
      q.get("SELECT COUNT(*) as total FROM medicos WHERE activo=1"),
      q.get("SELECT COUNT(*) as total FROM citas WHERE DATE(created_at)=DATE('now')"),
      q.get("SELECT COUNT(*) as total FROM citas WHERE DATE(created_at)=DATE('now','-1 day')"),
    ]);

    const variacion = ayerTotal?.total > 0
      ? Math.round(((hoyTotal?.total || 0) - ayerTotal.total) / ayerTotal.total * 100)
      : 0;

    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const citasMap = {};
    (citasPorDia || []).forEach(d => { citasMap[d.dia] = d.total; });
    const citasPorDiaCompleto = diasSemana.map(dia => ({ dia, total: citasMap[dia] || 0 }));

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
        satisfaccion: 4.8
      }
    });
  } catch (err) {
    console.error('[stats] Error:', err);
    res.status(500).json({ error: 'Error al cargar estadísticas' });
  }
});

app.get('/api/admin/citas', authMiddleware, (req, res) => {
  let query = `SELECT c.*, s.nombre as servicio_nombre, s.precio, m.nombre as medico_nombre, m.especialidad
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE 1=1`;
  const params = [];
  const { estado, fecha, servicio, medico, busqueda } = req.query;

  if (estado) { query += ' AND c.estado=?'; params.push(estado); }
  if (fecha) { query += ' AND c.fecha=?'; params.push(fecha); }
  if (servicio) { query += ' AND c.servicio_id=?'; params.push(servicio); }
  if (medico) { query += ' AND c.medico_id=?'; params.push(medico); }
  if (busqueda) {
    query += ' AND (c.nombre_paciente LIKE ? OR c.telefono LIKE ? OR c.codigo_cita LIKE ?)';
    params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }

  query += ' ORDER BY c.created_at DESC';
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/citas/:id', authMiddleware, (req, res) => {
  db.get(`SELECT c.*, s.nombre as servicio_nombre, s.precio, s.descripcion as servicio_descripcion,
    m.nombre as medico_nombre, m.especialidad, m.telefono as medico_telefono
    FROM citas c LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN medicos m ON c.medico_id=m.id WHERE c.id=?`,
    [req.params.id], (err, cita) => {
      if (err || !cita) return res.status(404).json({ error: 'Cita no encontrada' });
      db.all("SELECT * FROM observaciones_cita WHERE cita_id=? ORDER BY created_at DESC", [req.params.id], (err, obs) => {
        db.get("SELECT * FROM resultados_citas WHERE cita_id=? ORDER BY created_at DESC LIMIT 1", [req.params.id], (err, resultado) => {
          res.json({ ...cita, observaciones_lista: obs || [], resultado: resultado || null });
        });
      });
    });
});

app.put('/api/admin/citas/:id', authMiddleware, (req, res) => {
  const { estado, medico_id, observaciones, resultado } = req.body;
  const fields = [];
  const params = [];

  if (estado) { fields.push('estado=?'); params.push(estado); }
  if (medico_id !== undefined) { fields.push('medico_id=?'); params.push(medico_id); }
  if (observaciones !== undefined) { fields.push('observaciones=?'); params.push(observaciones); }

  if (fields.length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  fields.push('updated_at=CURRENT_TIMESTAMP');
  params.push(req.params.id);

  db.run(`UPDATE citas SET ${fields.join(',')} WHERE id=?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (observaciones) {
      db.run("INSERT INTO observaciones_cita (cita_id, tipo, contenido, created_by) VALUES (?,?,?,?)",
        [req.params.id, 'admin', observaciones, req.admin.nombre]);
    }
    res.json({ mensaje: 'Cita actualizada correctamente' });
  });
});

// --- ADMIN RESULTADOS (FILE UPLOAD) ---

app.post('/api/admin/citas/:id/resultado', authMiddleware, (req, res) => {
  upload.single('archivo')(req, res, function(err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo supera el tamaño máximo de 10 MB' });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) return res.status(400).json({ error: 'Debe seleccionar un archivo (PDF, JPG, JPEG o PNG)' });

    const nota = req.body.nota ? String(req.body.nota).trim() : '';

    db.get("SELECT * FROM citas WHERE id=?", [req.params.id], (err, cita) => {
      if (err || !cita) return res.status(404).json({ error: 'Cita no encontrada' });

      db.run(`INSERT INTO resultados_citas (cita_id, archivo_original, archivo_guardado, ruta_archivo, mime_type, size_bytes, nota) VALUES (?,?,?,?,?,?,?)`,
        [req.params.id, req.file.originalname, req.file.filename, req.file.path, req.file.mimetype, req.file.size, nota],
        function(err) {
          if (err) return res.status(500).json({ error: 'Error al guardar el resultado' });

          db.run("UPDATE citas SET estado='completada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado!='cancelada'", [req.params.id]);

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

          res.json({ id: this.lastID, mensaje: 'Resultado registrado correctamente', archivo: req.file.filename });
        });
    });
  });
});

app.get('/api/admin/resultados/:archivo', authMiddleware, (req, res) => {
  const filePath = path.join(RESULTADOS_DIR, req.params.archivo);
  if (!require('fs').existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.sendFile(filePath);
});

// --- ADMIN SERVICES ---

app.get('/api/admin/servicios', authMiddleware, (req, res) => {
  db.all("SELECT * FROM servicios ORDER BY nombre", (err, rows) => res.json(rows));
});

app.post('/api/admin/servicios', authMiddleware, (req, res) => {
  const { nombre, descripcion, icono, precio, duracion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  db.run("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)",
    [nombre, descripcion || '', icono || 'fa-stethoscope', precio || 0, duracion || 30],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Servicio creado' });
    });
});

app.put('/api/admin/servicios/:id', authMiddleware, (req, res) => {
  const { nombre, descripcion, icono, precio, duracion, activo } = req.body;
  const fields = []; const params = [];
  if (nombre !== undefined) { fields.push('nombre=?'); params.push(nombre); }
  if (descripcion !== undefined) { fields.push('descripcion=?'); params.push(descripcion); }
  if (icono !== undefined) { fields.push('icono=?'); params.push(icono); }
  if (precio !== undefined) { fields.push('precio=?'); params.push(precio); }
  if (duracion !== undefined) { fields.push('duracion=?'); params.push(duracion); }
  if (activo !== undefined) { fields.push('activo=?'); params.push(activo); }
  if (fields.length === 0) return res.status(400).json({ error: 'Sin campos' });
  params.push(req.params.id);
  db.run(`UPDATE servicios SET ${fields.join(',')} WHERE id=?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Servicio actualizado' });
  });
});

app.delete('/api/admin/servicios/:id', authMiddleware, (req, res) => {
  db.run("UPDATE servicios SET activo=0 WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Servicio desactivado' });
  });
});

// --- ADMIN DOCTORS ---

app.get('/api/admin/medicos', authMiddleware, (req, res) => {
  db.all(`SELECT m.*, GROUP_CONCAT(s.nombre) as servicios_nombres
    FROM medicos m LEFT JOIN medico_servicios ms ON m.id=ms.medico_id LEFT JOIN servicios s ON ms.servicio_id=s.id
    GROUP BY m.id ORDER BY m.nombre`, (err, rows) => res.json(rows || []));
});

app.post('/api/admin/medicos', authMiddleware, (req, res) => {
  const { nombre, especialidad, telefono, correo } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  db.run("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)",
    [nombre, especialidad || '', telefono || '', correo || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Médico registrado' });
    });
});

app.put('/api/admin/medicos/:id', authMiddleware, (req, res) => {
  const { nombre, especialidad, telefono, correo, activo } = req.body;
  const fields = []; const params = [];
  if (nombre !== undefined) { fields.push('nombre=?'); params.push(nombre); }
  if (especialidad !== undefined) { fields.push('especialidad=?'); params.push(especialidad); }
  if (telefono !== undefined) { fields.push('telefono=?'); params.push(telefono); }
  if (correo !== undefined) { fields.push('correo=?'); params.push(correo); }
  if (activo !== undefined) { fields.push('activo=?'); params.push(activo); }
  if (fields.length === 0) return res.status(400).json({ error: 'Sin campos' });
  params.push(req.params.id);
  db.run(`UPDATE medicos SET ${fields.join(',')} WHERE id=?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Médico actualizado' });
  });
});

app.delete('/api/admin/medicos/:id', authMiddleware, (req, res) => {
  db.run("UPDATE medicos SET activo=0 WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Médico desactivado' });
  });
});

app.get('/api/admin/medicos/:id/servicios', authMiddleware, (req, res) => {
  db.all("SELECT servicio_id FROM medico_servicios WHERE medico_id=?", [req.params.id], (err, rows) => {
    res.json((rows || []).map(r => r.servicio_id));
  });
});

app.post('/api/admin/medicos/:id/servicios', authMiddleware, (req, res) => {
  const { servicio_ids } = req.body;
  db.run("DELETE FROM medico_servicios WHERE medico_id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (servicio_ids && servicio_ids.length > 0) {
      const stmt = db.prepare("INSERT INTO medico_servicios (medico_id, servicio_id) VALUES (?,?)");
      for (const sid of servicio_ids) stmt.run(req.params.id, sid);
      stmt.finalize();
    }
    res.json({ mensaje: 'Servicios asignados' });
  });
});

// ── Diagnóstico de entorno ──
console.log('\n✦ Diagnóstico de configuración:');
['RESEND_API_KEY','EMAIL_FROM','EMAIL_ADMIN','SECRET'].forEach(v =>
  console.log(`  ${v}: ${process.env[v] ? '✓ presente' : '✗ faltante'}`)
);
console.log('');

// ── Ruta de prueba de correo (protegida con token desde .env) ──
app.get('/api/test-email', limiterTestEmail, async (req, res) => {
  const expectedToken = process.env.TEST_EMAIL_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ success: false, mensaje: 'Ruta no disponible: TEST_EMAIL_TOKEN no configurado' });
  }
  if (req.query.token !== expectedToken) {
    return res.status(401).json({ success: false, mensaje: 'Token inválido' });
  }
  console.log('[test-email] Iniciando prueba de envío...');
  const result = await sendAdminNotification({
    nombre_paciente: 'Test Render',
    telefono: '809-000-0000',
    correo: 'test@render.com',
    servicio_nombre: 'Prueba de diagnóstico',
    medico_nombre: 'Dr. Diagnóstico',
    fecha: new Date().toISOString().split('T')[0],
    hora: '12:00 PM',
    codigo_cita: 'MH-TEST',
    created_at: new Date().toISOString(),
    estado: 'pendiente',
    admin_url: `${req.protocol}://${req.get('host')}/admin.html`,
  });
  console.log(`[test-email] Resultado: enviado=${result.sent}${result.reason ? ', razón: ' + result.reason : ''}`);
  res.json({
    success: result.sent,
    mensaje: result.sent ? 'Correo de prueba enviado correctamente' : 'Error al enviar correo de prueba',
    error: result.sent ? null : (result.code || result.reason),
  });
});

// General rate limiter for all /api routes
app.use('/api', limiterGeneral);

// Serve static files or 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => {
  console.log(`✦ MediHome corriendo en http://localhost:${PORT}`);
  console.log(`  Panel admin: http://localhost:${PORT}/admin.html`);
  console.log(`  Usuario: admin / Contraseña: admin123`);
});
