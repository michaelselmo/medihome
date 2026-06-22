# PROJECT CONTEXT — MediHome

> Estado: Post-restauración backup-20260613-073641 (monolítico)
> Fecha: 2026-06-22

> ⚡ **Trigger:** Cuando el usuario diga "comabdi", lee este archivo COMPLETO + AGENTS.md para cargar el contexto del proyecto.

---

## 1. QUICK START

```bash
cd ~/medihome && npm start        # http://localhost:3000
# Admin: admin / admin1234
# Doctor: medico1 / medico123
# Reset DB: rm medihome.db && npm start
```

---

## 2. ARQUITECTURA (MONOLÍTICA)

```
server.js (5695 líneas — TODO el código en un solo archivo)
  │
  ├── Dependencias: express, sqlite3, cors, bcryptjs, crypto, express-rate-limit, multer, path, dotenv
  ├── Dependencia externa: ./services/emailService.js (sendAdminNotification, sendNewCitaNotification, sendResultadoNotification)
  │
  ├── Middleware inline:
  │   ├── authMiddleware (1199) — JWT verify
  │   ├── medicoAuthMiddleware (1225) — JWT + rol=medico
  │   └── requireAdmin (1215) — bloquea rol=medico
  │
  ├── Rate limiters inline:
  │   ├── limiterGeneral (50) — 100 req/15min
  │   ├── limiterCitas (58) — 50 req/15min
  │   ├── limiterLogin (66) — 10 req/15min
  │   └── limiterTestEmail (76) — 3 req/15min
  │
  ├── Sirve estáticos:
  │   ├── GET / → public/index.html
  │   ├── GET /admin* → public/admin.html (no-cache)
  │   └── GET /medico → redirect /admin.html
  │
  └── ~85 endpoints inline (ver AGENTS.md para líneas exactas)
```

---

## 3. ESTRUCTURA DE ARCHIVOS

```
~/medihome/
├── server.js                    (5695 líneas, 210KB) — TODO el backend
├── package.json                 (express, sqlite3, bcryptjs, cors, jwt, multer, nodemailer, resend, pdfkit, dotenv, rate-limit)
├── .env                         (EMAIL_*, SECRET, PORT)
├── medihome.db                  (144KB) — SQLite con datos reales + demo
│
├── public/
│   ├── index.html               (132KB) — Landing pública + formulario de citas
│   ├── admin.html               (511KB) — Panel admin (todo inline: CSS + HTML + JS)
│   ├── medico.html              (52KB) — Panel médico
│   └── wizard-citas.html        (12KB) — Wizard de citas (WIP)
│
├── services/
│   └── emailService.js          (112 líneas) — Lógica de correos (Resend/nodemailer)
│
├── templates/email/
│   ├── appointmentNotification.js
│   ├── invoiceEmail.js
│   └── medicalRecordEmail.js
│
├── uploads/
│   ├── resultados/              — Archivos subidos de citas
│   └── resultados_paciente/     — Archivos subidos de pacientes
│
├── backups/                     — Backups de BD + server.js
│
├── [CÓDIGO MUERTO] — No usado por server.js actual:
│   ├── routes/                  — Modular refactor (abandoned)
│   ├── db/                      — Modular refactor (abandoned)
│   ├── middleware/               — Modular refactor (abandoned)
│   ├── utils/                   — Modular refactor (abandoned)
│   └── admin-spa/               — React SPA (WIP, no desplegado)
│
└── _pre-restore/                — Backup del estado modular previo
```

---

## 4. BASE DE DATOS

SQLite3 — Tablas creadas automáticamente al iniciar server.js si no existen:

| Tabla | Descripción |
|-------|-------------|
| usuarios_admin | Admins y médicos (rol: superadmin/medico) |
| servicios | Servicios médicos (precio, duración) |
| medicos | Doctores registrados |
| medico_servicios | Relación N:M médicos ↔ servicios |
| citas | Citas agendadas (codigo_MH-XXXXXX, estado, modalidad) |
| observaciones_cita | Historial de observaciones por cita |
| ars | Aseguradoras de salud |
| facturas | Facturación por cita |
| pagos | Pagos registrados |
| notificaciones | Notificaciones del sistema (cita_id, paciente_nombre, servicio) |
| mensajes | Mensajería interna |
| configuracion | Config del sistema (clave/valor) |
| disponibilidad | Disponibilidad de médicos por servicio/día |
| disponibilidad_excepciones | Excepciones de disponibilidad |
| resultados_citas | Archivos de resultados por cita |
| resultados_paciente | Archivos de resultados por paciente |
| pacientes | Pacientes registrados |

Seed data: 11 servicios, 5 médicos, 2 usuarios (admin + medico1), citas demo.

---

## 5. FRONTEND

### index.html (Landing pública)
- Navbar glassmorphism, hero con heartbeat SVG
- Cards de servicios, formulario de agendamiento
- Seguimiento de citas por código/teléfono
- Testimonios, FAQ acordeón, footer
- API calls: /api/servicios, /api/medicos, /api/citas (POST), /api/citas/seguimiento

### admin.html (Panel admin)
- Login (JWT), sidebar con navegación
- Dashboard con métricas (total, pendientes, confirmadas, completadas, canceladas)
- Tabla de citas con filtros (estado, fecha, servicio, médico, búsqueda)
- Modal detalle/edición de cita
- CRUD servicios, médicos, usuarios, ARS
- Facturación (lista, detalle, pago, PDF, email)
- Notificaciones en tiempo real (polling 15s con banderas busyFlags)
- Reprogramación de citas con calendario
- Mensajería interna
- Reportes
- Toast notifications

### medico.html (Panel médico)
- Dashboard médico, citas asignadas, cambio de estado
- Pacientes, resultados, notificaciones

---

## 6. API — TODOS LOS ENDPOINTS

### Públicos (sin auth)
- `POST /api/login` — Login JWT
- `GET /api/me` — Usuario actual
- `GET /api/servicios` — Servicios activos
- `GET /api/medicos` — Médicos activos
- `GET /api/ars` — ARS
- `GET /api/disponibilidad?servicio_id=&fecha=` — Disponibilidad
- `GET /api/disponibilidad/horarios?servicio_id=&medico_id=&fecha=` — Slots
- `POST /api/citas` — Crear cita (rate limit: 50/15min)
- `GET /api/citas/seguimiento?codigo=&telefono=` — Seguimiento

### Admin (requieren authMiddleware)
- `GET /api/admin/stats` — KPIs dashboard
- `GET /api/admin/citas[?estado=&fecha=&servicio=&medico=&busqueda=]` — Citas
- `GET /api/admin/citas/ultima` — Último ID (polling)
- `GET /api/admin/citas/:id` — Detalle + observaciones
- `PUT /api/admin/citas/:id` — Actualizar (estado, medico_id, observaciones)
- `POST /api/admin/citas/:id/resultado` — Subir archivo
- CRUD /api/admin/servicios/*
- CRUD /api/admin/medicos/* (incluye asignación servicios)
- CRUD /api/admin/usuarios/*
- CRUD /api/admin/ars/*
- CRUD /api/admin/disponibilidad/* (incluye grupos, excepciones, stats)
- CRUD /api/admin/facturas/* (incluye PDF, email, pagos)
- `PUT /api/admin/citas/:id/reprogramar` — Reprogramar (old)
- `PUT /api/admin/citas/:id/reagendar` — Reagendar (new)
- `GET /api/admin/reagendar/calendario` — Calendario
- `GET /api/admin/citas/:id/reagendar/disponibilidad` — Slots para reagendar
- `GET /api/admin/reagendar/disponibilidad-global` — Disponibilidad global
- `PUT /api/admin/citas/:id/confirmar` — Confirmar
- `GET /api/admin/expedientes/:cedula` — Expediente
- CRUD /api/pacientes/* (incluye resultados, enviar-expediente)
- CRUD /api/mensajes/*
- CRUD /api/notificaciones/*
- CRUD /api/configuracion (incluye cambiar-password, limpiar-sesiones)
- `GET /api/reportes` — Reportes
- `GET /api/test-email` — Test (token-gated)

### Médico (requieren medicoAuthMiddleware)
- `GET /api/medico/dashboard` — Dashboard
- `GET /api/medico/citas` — Citas asignadas
- `GET /api/medico/citas/:id` — Detalle
- `PUT /api/medico/citas/:id` — Actualizar
- `PUT /api/medico/citas/:id/estado` — Cambiar estado
- `GET /api/medico/pacientes` — Pacientes
- `GET /api/medico/pacientes/:telefono` — Detalle por teléfono
- `POST /api/medico/pacientes` — Registrar paciente
- `GET /api/medico/resultados` — Resultados
- `GET /api/medico/notificaciones` — Notificaciones
- `PUT /api/medico/notificaciones/:id/leer` — Marcar leída
- `PUT /api/medico/notificaciones/leer-todas` — Marcar todas leídas
- `POST /api/medico/test-email` — Test email

---

## 7. FUNCIONES CLAVE (server.js inline)

| Línea | Función | Propósito |
|-------|---------|-----------|
| 1199 | `authMiddleware` | Verifica JWT, inyecta `req.usuario` |
| 1215 | `requireAdmin` | Rechaza si rol=medico (403) |
| 1225 | `medicoAuthMiddleware` | JWT + validación rol médico |
| 1240 | `crearNotificacion` | Inserta notificación + callback count |
| 137 | `generarCodigoCita` | Genera código MH-XXXXXX (único) |
| 145 | `escHtml` | Escapa HTML |
| 1171 | `sanitizar` | Elimina tags HTML |
| 1179 | `validarEmail` | Valida email |
| 1183 | `validarTelefonoRD` | Valida teléfono RD (809-xxx-xxxx) |
| 1188 | `validarCedulaRD` | Valida cédula RD |
| 1192 | `convertirHoraAMinutos` | "HH:MM" → minutos |
| 1418 | `formatHora12` | 24h → 12h AM/PM |
| 5131 | `tryParse` | JSON.parse seguro |
| 5221 | `dbGet` | Promisify db.get |
| 5226 | `dbAll` | Promisify db.all |

---

## 8. PATRONES DEL CÓDIGO

- **Callback-based** en consultas SQL (mezcla callbacks y async/await)
- **Validación manual** de campos requeridos (ifs)
- **Prepared statements** con `?` para SQL injection prevention
- **Soft delete** con `activo=0`
- **Express 5** (path-to-regexp v8 — usa `:id` no `{*path}`)
- **Polling (15s)** para notificaciones en tiempo real vía `/api/admin/citas/ultima`
- **busyFlags** en admin.html: `isEditing, isSaving, isCreating, isUploading, isGeneratingPDF, isSendingEmail, isProcessingPayment`

---

## 9. CREDENCIALES

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin1234 | superadmin |
| medico1 | medico123 | medico |

---

## 10. GIT

- Remote: `https://github.com/michaelselmo/medihome.git`
- Branch: `main`
- HEAD: `973705b` — "Refactoriza server.js en modulo de rutas separadas y corrige stubs vacios"
- Working tree: modificado (restaurado backup-20260613-073641)

---

## 11. HISTORIAL DE SESIONES

### Sesión 5 (2026-06-22) — Restauración a estado monolítico
- Restaurado backup-20260613-073641 (server.js 5695 líneas monolítico)
- Estado modular anterior preservado en `_pre-restore/`
- Código muerto (routes/, db/, middleware/, utils/) mantenido pero no usado
- AGENTS.md y PROJECT_CONTEXT.md actualizados para arquitectura monolítica

### Sesiones 1-4 (previas)
- Refactorización modular, ARS, modalidad presencial, rate limiting, notificaciones, etc.
- Estado modular preservado en `_pre-restore/`

---

## 12. TAREAS PENDIENTES

- Extraer CSS/JS inline de admin.html (511KB) a archivos externos
- Enviar correo al PACIENTE (no solo al admin) al crear cita
- Testing (mocha + supertest)
- ESLint / Prettier
- Wizard-citas.html — terminar implementación
