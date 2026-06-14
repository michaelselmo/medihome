const bcrypt = require("bcryptjs");

function initSchema(db) {
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
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE usuarios_admin ADD COLUMN telefono TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE usuarios_admin ADD COLUMN correo TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
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

    db.run("ALTER TABLE facturas ADD COLUMN cobertura_estado TEXT DEFAULT 'pendiente_de_validacion'", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN numero_autorizacion TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN observacion_ars TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN tipo_calculo TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN porcentaje_autorizado REAL DEFAULT 0", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN monto_autorizado REAL DEFAULT 0", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("UPDATE facturas SET cobertura_estado='pendiente_de_validacion' WHERE cobertura_estado IS NULL", (err) => {
      if (err) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN factura_enviada_email INTEGER DEFAULT 0", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN fecha_envio_email DATETIME", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE facturas ADD COLUMN email_destino TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });

    db.get("SELECT COUNT(*) as count FROM ars", (err, row) => {
      const arsList = [
        ["SENASA", 80], ["ARS Universal", 75], ["ARS Humano", 75], ["ARS Primera", 70],
        ["ARS Reservas", 70], ["ARS Mapfre Salud", 70], ["ARS La Colonial", 65],
        ["ARS Abel González", 65], ["ARS Yunen", 65], ["ARS GMA", 60],
        ["ARS Futuro", 60], ["ARS Renacer", 60], ["ARS Meta Salud", 60],
        ["ARS ASEMAP", 55], ["ARS SEMMA", 55], ["ARS Plan Salud Banco Central", 55],
        ["ARS CMD", 50], ["IDOPPRIL", 50], ["No tengo seguro", 0],
      ];
      if (row && row.count === 0) {
        const stmt = db.prepare("INSERT INTO ars (nombre, cobertura) VALUES (?,?)");
        arsList.forEach((a) => stmt.run(a[0], a[1]));
        stmt.finalize();
        console.log("[seed] ARS por defecto insertadas");
      } else if (row && row.count > 0 && row.count !== arsList.length) {
        db.run("DELETE FROM ars", (err2) => {
          if (err2) return;
          const stmt = db.prepare("INSERT INTO ars (nombre, cobertura) VALUES (?,?)");
          arsList.forEach((a) => stmt.run(a[0], a[1]));
          stmt.finalize();
          console.log("[seed] ARS actualizadas a nueva lista");
        });
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS notificaciones (
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
    )`, function () {
      db.all("PRAGMA table_info(notificaciones)", (err, cols) => {
        if (err) return;
        const names = cols.map((c) => c.name);
        if (!names.includes("cita_id")) db.run("ALTER TABLE notificaciones ADD COLUMN cita_id INTEGER");
        if (!names.includes("paciente_nombre")) db.run("ALTER TABLE notificaciones ADD COLUMN paciente_nombre TEXT");
        if (!names.includes("servicio")) db.run("ALTER TABLE notificaciones ADD COLUMN servicio TEXT");
      });
    });

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

    db.get("SELECT COUNT(*) as count FROM configuracion", (err, row) => {
      if (row && row.count === 0) {
        const configs = [
          ["sitio_nombre", "MediHome"],
          ["sitio_descripcion", "Plataforma de Telemedicina y Servicios Médicos a Domicilio"],
          ["correo_notificaciones", process.env.EMAIL_ADMIN || "admin@medihome.com"],
          ["telefono_institucional", "809-555-0100"],
          ["direccion", "Av. Abraham Lincoln #123, Santo Domingo"],
          ["horario_atencion", "Lun-Vie 8:00 AM - 6:00 PM, Sáb 9:00 AM - 2:00 PM"],
          ["politica_password", "medium"],
          ["logo_url", ""],
          ["auth_activa", "true"],
        ];
        const stmt = db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?,?)");
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

    db.serialize(() => {
      db.run("ALTER TABLE disponibilidad ADD COLUMN capacidad INTEGER DEFAULT 1", (err) => {
        if (err && !err.message.includes("duplicate column")) console.error("[migracion] error add capacidad:", err.message);
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

    db.run("ALTER TABLE citas ADD COLUMN cedula TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE pacientes ADD COLUMN cedula TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE citas ADD COLUMN ars TEXT", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
    });
    db.run("ALTER TABLE citas ADD COLUMN reprogramada_de INTEGER", (err) => {
      if (err && !err.message.includes("duplicate column")) console.error("[db]", err.message);
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
        db.run("INSERT INTO usuarios_admin (nombre, usuario, password, rol) VALUES (?,?,?,?)", ["Administrador", "admin", bcrypt.hashSync("admin1234", 10), "administrador"]);
        db.run("INSERT INTO usuarios_admin (nombre, usuario, password, rol, especialidad) VALUES (?,?,?,?,?)", ["Dr. Carlos García", "medico1", bcrypt.hashSync("medico123", 10), "medico", "Medicina General / Sonografía"]);

        const servicios = [
          ["Sonografía Obstétrica", "Evaluación detallada del desarrollo fetal y bienestar del bebé durante el embarazo.", "fa-baby", 2500, 30],
          ["Sonografía Abdominal", "Visualización de órganos internos del abdomen como hígado, vesícula, riñones y páncreas.", "fa-ribbon", 2200, 30],
          ["Sonografía Pélvica", "Estudio de órganos pélvicos para evaluar el sistema reproductivo femenino y masculino.", "fa-ribbon", 2200, 30],
          ["Sonografía Prostática", "Evaluación de la próstata para detección temprana de anomalías y control de salud masculina.", "fa-ribbon", 2500, 30],
          ["Doppler", "Estudio del flujo sanguíneo en arterias y venas para detectar obstrucciones o alteraciones circulatorias.", "fa-heart-pulse", 2800, 40],
          ["Perfil Hemodinámico", "Evaluación completa del sistema cardiovascular incluyendo presión arterial y flujo sanguíneo.", "fa-heart-circle-check", 3500, 45],
          ["Perfil Morfológico", "Estudio detallado de la anatomía fetal para descartar malformaciones congénitas.", "fa-baby", 3200, 40],
          ["Mapa Cardiológico", "Electrocardiograma y evaluación cardíaca completa para diagnóstico de afecciones del corazón.", "fa-heart", 3000, 45],
          ["Prueba de Covid-19", "Prueba rápida de antígenos para detección de SARS-CoV-2 con resultados en minutos.", "fa-virus", 800, 15],
          ["Consulta Médica a Domicilio", "Atención médica general en la comodidad de tu hogar con profesionales certificados.", "fa-user-doctor", 1800, 30],
          ["Telemedicina", "Consulta médica virtual desde cualquier lugar, sin necesidad de desplazarte.", "fa-video", 1200, 20],
        ];
        const stmtS = db.prepare("INSERT INTO servicios (nombre, descripcion, icono, precio, duracion) VALUES (?,?,?,?,?)");
        servicios.forEach((s) => stmtS.run(s[0], s[1], s[2], s[3], s[4]));
        stmtS.finalize();

        const medicos = [
          ["Dr. Carlos García", "Medicina General / Sonografía", "809-555-0101", "carlos.garcia@medihome.com"],
          ["Dra. María Rodríguez", "Cardiología", "809-555-0102", "maria.rodriguez@medihome.com"],
          ["Dr. Juan Martínez", "Medicina Interna", "809-555-0103", "juan.martinez@medihome.com"],
          ["Dra. Laura Sánchez", "Medicina General", "809-555-0104", "laura.sanchez@medihome.com"],
          ["Dr. Roberto Peña", "Sonografía / Imágenes", "809-555-0105", "roberto.pena@medihome.com"],
        ];
        const stmtM = db.prepare("INSERT INTO medicos (nombre, especialidad, telefono, correo) VALUES (?,?,?,?)");
        medicos.forEach((m) => stmtM.run(m[0], m[1], m[2], m[3]));
        stmtM.finalize();
      }
    });

    db.get("SELECT COUNT(*) as count FROM disponibilidad", (err, row) => {
      if (row && row.count === 0) {
        const insertDispo = (nombre, fn) => {
          db.get("SELECT id, duracion FROM servicios WHERE nombre=?", [nombre], (err, s) => {
            if (s) fn(s);
          });
        };
        insertDispo("Doppler", (s) => {
          const stmt = db.prepare("INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)");
          stmt.run(s.id, 1, "08:00", "12:00", 40);
          stmt.run(s.id, 4, "08:00", "12:00", 40);
          stmt.run(s.id, 5, "14:00", "17:00", 40);
          stmt.finalize();
        });
        insertDispo("Sonografía Obstétrica", (s) => {
          const stmt = db.prepare("INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)");
          for (let d = 1; d <= 5; d++) stmt.run(s.id, d, "08:00", "17:00", 30);
          stmt.finalize();
        });
        insertDispo("Consulta Médica a Domicilio", (s) => {
          const stmt = db.prepare("INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)");
          for (let d = 1; d <= 6; d++) {
            if (d === 6) stmt.run(s.id, d, "09:00", "14:00", 30);
            else stmt.run(s.id, d, "08:00", "18:00", 30);
          }
          stmt.finalize();
        });
        insertDispo("Telemedicina", (s) => {
          const stmt = db.prepare("INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)");
          for (let d = 1; d <= 6; d++) stmt.run(s.id, d, "07:00", "20:00", 20);
          stmt.finalize();
        });
        const otrosServicios = ["Sonografía Abdominal", "Sonografía Pélvica", "Sonografía Prostática", "Perfil Hemodinámico", "Perfil Morfológico", "Mapa Cardiológico", "Prueba de Covid-19"];
        otrosServicios.forEach((nombre) => {
          insertDispo(nombre, (s) => {
            const dur = s.duracion || 30;
            const stmt = db.prepare("INSERT INTO disponibilidad (servicio_id, dia_semana, hora_inicio, hora_fin, duracion) VALUES (?,?,?,?,?)");
            for (let d = 1; d <= 5; d++) stmt.run(s.id, d, "08:00", "17:00", dur);
            stmt.finalize();
          });
        });
        console.log("[seed] Disponibilidad por defecto insertada");
      }
    });

    db.run("UPDATE usuarios_admin SET password=? WHERE usuario='admin'", [bcrypt.hashSync("admin1234", 10)]);

    db.get("SELECT COUNT(*) as count FROM citas", (err, row) => {
      if (row && row.count === 0) {
        const sampleCitas = [
          { pac: "Juan Pérez", ced: "001-0000001-1", tel: "809-555-1001", mail: "juan@mail.com", dir: "Calle 1 #23", ciudad: "Santo Domingo", sv: 1, fecha: "2026-05-15", hora: "09:00", mod: "domicilio", est: "completada", med: 1 },
          { pac: "María López", ced: "001-0000002-2", tel: "809-555-1002", mail: "maria@mail.com", dir: "Av. 2 #45", ciudad: "Santiago", sv: 2, fecha: "2026-05-15", hora: "10:00", mod: "domicilio", est: "completada", med: 1 },
          { pac: "Carlos Ruiz", ced: "001-0000003-3", tel: "809-555-1003", mail: "carlos@mail.com", dir: "Calle 3 #67", ciudad: "Santo Domingo", sv: 3, fecha: "2026-05-15", hora: "11:00", mod: "telemedicina", est: "completada", med: 1 },
          { pac: "Ana Martínez", ced: "001-0000004-4", tel: "809-555-1004", mail: "ana@mail.com", dir: "Av. 4 #89", ciudad: "La Vega", sv: 5, fecha: "2026-05-15", hora: "14:00", mod: "domicilio", est: "completada", med: 1 },
          { pac: "Pedro Sánchez", ced: "001-0000005-5", tel: "809-555-1005", mail: "pedro@mail.com", dir: "Calle 5 #12", ciudad: "Santo Domingo", sv: 8, fecha: "2026-05-16", hora: "08:30", mod: "domicilio", est: "completada", med: 1 },
          { pac: "Laura Fernández", ced: "001-0000006-6", tel: "809-555-1006", mail: "laura@mail.com", dir: "Av. 6 #34", ciudad: "Santiago", sv: 10, fecha: "2026-05-16", hora: "09:30", mod: "domicilio", est: "pendiente", med: 1 },
          { pac: "Roberto Gómez", ced: "001-0000007-7", tel: "809-555-1007", mail: "roberto@mail.com", dir: "Calle 7 #56", ciudad: "Santo Domingo", sv: 1, fecha: "2026-05-16", hora: "10:30", mod: "telemedicina", est: "pendiente", med: 1 },
          { pac: "Sofía Díaz", ced: "001-0000008-8", tel: "809-555-1008", mail: "sofia@mail.com", dir: "Av. 8 #78", ciudad: "La Vega", sv: 4, fecha: "2026-05-17", hora: "09:00", mod: "domicilio", est: "pendiente", med: 1 },
          { pac: "Diego Torres", ced: "001-0000009-9", tel: "809-555-1009", mail: "diego@mail.com", dir: "Calle 9 #90", ciudad: "Santo Domingo", sv: 6, fecha: "2026-05-17", hora: "11:00", mod: "domicilio", est: "pendiente", med: 1 },
          { pac: "Valentina Reyes", ced: "001-0000010-0", tel: "809-555-1010", mail: "vale@mail.com", dir: "Av. 10 #11", ciudad: "Santiago", sv: 7, fecha: "2026-05-17", hora: "14:00", mod: "telemedicina", est: "pendiente", med: 1 },
          { pac: "Andrés Morales", ced: "001-0000011-1", tel: "809-555-1011", mail: "andres@mail.com", dir: "Calle 11 #22", ciudad: "Santo Domingo", sv: 9, fecha: "2026-05-18", hora: "08:00", mod: "domicilio", est: "pendiente", med: 1 },
          { pac: "Carmen Ortiz", ced: "001-0000012-2", tel: "809-555-1012", mail: "carmen@mail.com", dir: "Av. 12 #33", ciudad: "La Vega", sv: 11, fecha: "2026-05-18", hora: "09:00", mod: "telemedicina", est: "pendiente", med: 1 },
          { pac: "Fernando Castillo", ced: "001-0000013-3", tel: "809-555-1013", mail: "fernando@mail.com", dir: "Calle 13 #44", ciudad: "Santo Domingo", sv: 2, fecha: "2026-05-18", hora: "10:00", mod: "domicilio", est: "pendiente", med: 1 },
          { pac: "Gabriela Herrera", ced: "001-0000014-4", tel: "809-555-1014", mail: "gabriela@mail.com", dir: "Av. 14 #55", ciudad: "Santiago", sv: 3, fecha: "2026-05-18", hora: "11:00", mod: "domicilio", est: "pendiente", med: 1 },
        ];
        const stmtCita = db.prepare("INSERT INTO citas (codigo_cita, nombre_paciente, cedula, telefono, correo, direccion, ciudad, servicio_id, fecha, hora, modalidad, estado, medico_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
        sampleCitas.forEach((c, i) => {
          stmtCita.run("MH-" + String(1001 + i), c.pac, c.ced, c.tel, c.mail, c.dir, c.ciudad, c.sv, c.fecha, c.hora, c.mod, c.est, c.med);
        });
        stmtCita.finalize();
        console.log("[seed] 14 citas de ejemplo insertadas");

        setTimeout(() => {
          db.all("SELECT DISTINCT nombre_paciente, cedula, telefono, correo, direccion, ciudad FROM citas", (err2, pts) => {
            if (!err2 && pts && pts.length > 0) {
              let inserted = 0;
              pts.forEach((p) => {
                db.run("INSERT OR IGNORE INTO pacientes (nombre, cedula, telefono, correo, direccion, ciudad, estado) VALUES (?,?,?,?,?,?,'activo')", [p.nombre_paciente, p.cedula || "", p.telefono, p.correo || "", p.direccion || "", p.ciudad || ""], function () { if (this.changes > 0) inserted++; });
              });
              setTimeout(() => console.log("[seed]", pts.length, "pacientes extraídos de citas (" + inserted + " insertados)"), 300);
            }
          });
        }, 200);
      }
    });
  });
}

module.exports = { initSchema };
