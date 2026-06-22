# MediHome — Project Memory

## ⚡ TRIGGER: "comabdi"
Cuando el usuario diga **"comabdi"** (o cualquier variante que lo mencione), DEBES CARGAR TODO EL CONTEXTO del proyecto MediHome inmediatamente. Lee este archivo AGENTS.md COMPLETO y PROJECT_CONTEXT.md para tener el mapa mental del proyecto sin necesidad de explorar el código. Responde confirmando con "✅ MediHome cargado" y un resumen de 1 línea del estado actual.

## Description
Telemedicine & home medical services platform (Dominican Republic). Express 5 + SQLite3 monolithic backend. Vanilla JS frontend (admin.html, index.html, medico.html). Resend/nodemailer for email. JWT auth. Rate limiting.

**Current state:** Monolithic (backup restored 2026-06-22 from backup-20260613-073641). Server.js is 5695 lines, all routes inline.

## Critical Token-Saving Rules
1. NEVER read server.js directly — use grep + line numbers below
2. Read max 100 lines at a time from large files
3. Keep responses under 5 lines unless asked
4. All route line numbers are listed below — use them
5. All function names + line numbers listed below — use them

## Quick Start
```bash
cd ~/medihome && npm start        # http://localhost:3000
```
- Admin: `admin` / `admin1234`
- Doctor: `medico1` / `medico123`
- Reset DB: `rm medihome.db && npm start` (auto-creates with seed data)

## File Index
| File | Lines | Size | Notes |
|------|-------|------|-------|
| server.js | 5695 | 210KB | ALL logic inline (monolithic) |
| public/admin.html | ~12561 | 511KB | Admin dashboard |
| public/index.html | ~4244 | 132KB | Public landing page |
| public/medico.html | ~? | 52KB | Doctor panel |
| public/wizard-citas.html | ~? | 12KB | New appointment wizard (WIP) |
| medihome.db | - | 144KB | SQLite DB |
| services/emailService.js | 112 | 3KB | Email logic (Resend/nodemailer) |

## Architecture (Monolithic)
```
server.js (5695 lines — ALL routes, DB logic, auth, middleware inline)
  │
  ├── Requires: express, sqlite3, cors, bcryptjs, crypto, express-rate-limit, multer, path, dotenv
  ├── Requires: ./services/emailService (sendAdminNotification, sendNewCitaNotification, sendResultadoNotification)
  │
  ├── Middleware (inline in server.js):
  │   ├── authMiddleware — line 1199 (JWT verify)
  │   ├── medicoAuthMiddleware — line 1225 (JWT + rol=medico)
  │   └── requireAdmin — line 1215 (rol != medico)
  │
  ├── Rate Limiters (inline):
  │   ├── limiterGeneral — line 50 (100 req/15min)
  │   ├── limiterCitas — line 58 (50 req/15min)
  │   ├── limiterLogin — line 66 (10 req/15min)
  │   └── limiterTestEmail — line 76
  │
  ├── Static: GET / → index.html, GET /admin* → admin.html, GET /medico → redirect
  ├── Public API (no auth): /api/login, /api/servicios, /api/medicos, /api/ars, /api/disponibilidad, POST /api/citas, /api/citas/seguimiento
  ├── Admin API (authMiddleware): /api/admin/* (stats, citas, servicios, medicos, usuarios, ars, facturas, disponibilidad, reagendar, config, notificaciones, mensajes, reportes, pacientes)
  └── Doctor API (medicoAuthMiddleware): /api/medico/* (dashboard, citas, pacientes, resultados, notificaciones)
```

## All Routes (by line number)

### Public Routes
| Line | Method | Route | Description |
|------|--------|-------|-------------|
| 1250 | POST | /api/login | Login (JWT) |
| 1300 | GET | /api/me | Current user |
| 1327 | GET | /api/servicios | Active services |
| 1334 | GET | /api/medicos | Active doctors |
| 1341 | GET | /api/ars | ARS list |
| 1347 | GET | /api/disponibilidad | Availability by service/date |
| 1359 | GET | /api/disponibilidad/horarios | Time slots |
| 1424 | POST | /api/citas | Create appointment |
| 1772 | GET | /api/citas/seguimiento | Track by code/phone |

### Admin Routes (all require authMiddleware)
| Line | Method | Route | Description |
|------|--------|-------|-------------|
| 1800 | GET | /api/admin/stats | Dashboard KPIs |
| 1916 | GET | /api/admin/citas | List citas (filters: estado, fecha, servicio, medico, busqueda) |
| 1951 | GET | /api/admin/citas/ultima | Last cita maxId (for polling) |
| 1961 | GET | /api/admin/citas/:id | Detail + observaciones |
| 2020 | PUT | /api/admin/citas/:id | Update (estado, medico_id, observaciones, resultado) |
| 2150 | POST | /api/admin/citas/:id/resultado | Upload result file |
| 2219 | GET | /api/admin/resultados/:archivo | Serve result file |
| 2228 | GET | /api/admin/servicios | All services (incl inactive) |
| 2234 | POST | /api/admin/servicios | Create service |
| 2253 | PUT | /api/admin/servicios/:id | Update service |
| 2293 | DELETE | /api/admin/servicios/:id | Soft-delete service |
| 2306 | GET | /api/admin/disponibilidad | All availability |
| 2319 | POST | /api/admin/disponibilidad | Create availability |
| 2335 | PUT | /api/admin/disponibilidad/:id | Update availability |
| 2381 | DELETE | /api/admin/disponibilidad/:id | Delete availability |
| 2394 | GET | /api/admin/disponibilidad/grupos | Grouped by service |
| 2433 | PUT | /api/admin/disponibilidad/grupos/:servicioId | Update group |
| 2463 | GET | /api/admin/disponibilidad/excepciones | List exceptions |
| 2476 | POST | /api/admin/disponibilidad/excepciones | Create exception |
| 2491 | PUT | /api/admin/disponibilidad/excepciones/:id | Update exception |
| 2512 | DELETE | /api/admin/disponibilidad/excepciones/:id | Delete exception |
| 2521 | GET | /api/admin/disponibilidad/stats | Availability stats |
| 2569 | GET | /api/admin/medicos | All doctors |
| 2578 | POST | /api/admin/medicos | Create doctor |
| 2591 | PUT | /api/admin/medicos/:id | Update doctor |
| 2627 | DELETE | /api/admin/medicos/:id | Soft-delete |
| 2638 | GET | /api/admin/medicos/:id/servicios | Doctor's service IDs |
| 2648 | POST | /api/admin/medicos/:id/servicios | Assign services |
| 2669 | GET | /api/admin/usuarios | List users |
| 2680 | POST | /api/admin/usuarios | Create user |
| 2722 | PUT | /api/admin/usuarios/:id | Update user |
| 2791 | DELETE | /api/admin/usuarios/:id | Soft-delete |
| 2804 | GET | /api/admin/ars | ARS list |
| 2810 | POST | /api/admin/ars | Create ARS |
| 2824 | PUT | /api/admin/ars/:id | Update ARS |
| 2852 | DELETE | /api/admin/ars/:id | Soft-delete |
| 2861 | GET | /api/admin/facturas | Invoices list |
| 2886 | GET | /api/admin/facturas/:id | Invoice detail |
| 2900 | PUT | /api/admin/facturas/:id/pagar | Mark paid |
| 2984 | PUT | /api/admin/facturas/:id/anular | Cancel |
| 2999 | GET | /api/facturas/:cita_id | Invoice by cita_id |
| 3011 | PUT | /api/admin/facturas/:id/enviar-email | Email invoice |
| 3126 | GET | /api/admin/pagos | Payments list |
| 3150 | GET | /api/admin/facturas/:id/pagos | Payments by invoice |
| 3163 | PUT | /api/admin/citas/:id/reprogramar | Reschedule (old) |
| 3251 | PUT | /api/admin/citas/:id/reagendar | Reschedule (new) |
| 3502 | GET | /api/admin/reagendar/calendario | Calendar view |
| 3584 | GET | /api/admin/citas/:id/reagendar/disponibilidad | Reschedule availability |
| 3680 | GET | /api/admin/reagendar/disponibilidad-global | Global availability |
| 3787 | PUT | /api/admin/citas/:id/confirmar | Confirm cita |
| 3837 | GET | /api/admin/expedientes/:cedula | Patient record by cedula |
| 3910 | GET | /api/admin/facturas/:id/pdf | Generate PDF |
| 4197 | PUT | /api/admin/facturas/:id/enviar-email | Email invoice (PUT) |
| 4310 | POST | /api/facturas/:id/enviar-correo | Email invoice (POST) |
| 4428 | GET | /api/pacientes | List patients |
| 4496 | GET | /api/pacientes/:id | Patient detail |
| 4593 | POST | /api/pacientes | Create patient |
| 4626 | PUT | /api/pacientes/:id | Update patient |
| 4658 | DELETE | /api/pacientes/:id | Deactivate patient |
| 4671 | POST | /api/pacientes/:id/resultado | Upload result |
| 4703 | GET | /api/pacientes/resultados/:archivo | Serve result |
| 4716 | DELETE | /api/pacientes/resultados/:id | Delete result |
| 4732 | POST | /api/pacientes/:id/enviar-expediente | Email record |
| 4799 | GET | /api/reportes | Reports |
| 4960 | GET | /api/mensajes | Messages list |
| 4974 | GET | /api/mensajes/entrada | Inbox |
| 4988 | GET | /api/mensajes/enviados | Sent |
| 5002 | POST | /api/mensajes | Send message |
| 5045 | PUT | /api/mensajes/:id/leer | Mark read |
| 5056 | GET | /api/mensajes/no-leidos | Unread count |
| 5069 | GET | /api/notificaciones | Notifications list |
| 5080 | PUT | /api/notificaciones/:id/leer | Mark read |
| 5091 | PUT | /api/notificaciones/leer-todas | Mark all read |
| 5102 | GET | /api/notificaciones/no-leidas | Unread count |
| 5115 | GET | /api/configuracion | Get config |
| 5139 | PUT | /api/configuracion | Update config (+ requireAdmin) |
| 5161 | POST | /api/configuracion/cambiar-password | Change password (+ requireAdmin) |
| 5206 | POST | /api/configuracion/limpiar-sesiones | Clear sessions |
| 5644 | GET | /api/test-email | Email test (token-gated) |

### Doctor Routes (all require medicoAuthMiddleware)
| Line | Method | Route | Description |
|------|--------|-------|-------------|
| 5232 | GET | /api/medico/dashboard | Doctor dashboard |
| 5312 | GET | /api/medico/citas | Doctor's citas |
| 5339 | GET | /api/medico/citas/:id | Cita detail |
| 5369 | PUT | /api/medico/citas/:id | Update cita |
| 5406 | PUT | /api/medico/citas/:id/estado | Change status |
| 5438 | GET | /api/medico/pacientes | Doctor's patients |
| 5464 | GET | /api/medico/pacientes/:telefono | Patient by phone |
| 5513 | POST | /api/medico/pacientes | Register patient |
| 5566 | GET | /api/medico/resultados | Results list |
| 5580 | GET | /api/medico/notificaciones | Doctor notifications |
| 5591 | PUT | /api/medico/notificaciones/:id/leer | Mark read |
| 5606 | PUT | /api/medico/notificaciones/leer-todas | Mark all read |
| 5621 | POST | /api/medico/test-email | Doctor email test |

## Key Functions (inline in server.js)
| Line | Function | Purpose |
|------|----------|---------|
| 29 | noCache(req,res,next) | No-cache headers |
| 87 | RESULTADOS_DIR | Uploads/resultados path |
| 88 | RESULTADOS_PACIENTE_DIR | Uploads/resultados_paciente path |
| 89-118 | storage, fileFilter, upload | Multer config for cita results |
| 120-135 | storagePaciente, uploadPaciente | Multer config for patient results |
| 137 | generarCodigoCita() | MH-XXXXXX random code |
| 145 | escHtml(str) | Escape HTML entities |
| 155 | buildDoctorAssignmentEmail(d) | Email HTML for doc assignment |
| 210 | buildDoctorAssignmentText(d) | Email plaintext for doc assignment |
| 1171 | sanitizar(str) | Strip HTML tags |
| 1179 | validarEmail(email) | Email validation |
| 1183 | validarTelefonoRD(tel) | RD phone validation |
| 1188 | validarCedulaRD(ced) | RD cedula validation |
| 1192 | convertirHoraAMinutos(hora) | "HH:MM" → minutes |
| 1199 | authMiddleware | JWT verify for admin |
| 1215 | requireAdmin | Reject if rol=medico |
| 1225 | medicoAuthMiddleware | JWT verify for doctors |
| 1240 | crearNotificacion | Insert notification + count |
| 1418 | formatHora12(h, min) | 24h → 12h format |
| 3401 | buildRescheduleDoctorEmail | Reschedule email (doctor) |
| 3429 | buildRescheduleDoctorText | Reschedule text (doctor) |
| 3449 | buildReschedulePatientEmail | Reschedule email (patient) |
| 3478 | buildReschedulePatientText | Reschedule text (patient) |
| 5131 | tryParse(str) | Safe JSON parse |
| 5221 | dbGet(sql, params) | Promise wrapper for db.get |
| 5226 | dbAll(sql, params) | Promise wrapper for db.all |

## DB Schema (SQLite — created inline in server.js startup)
- usuarios_admin (id, nombre, usuario, password, rol, activo, created_at)
- servicios (id, nombre, descripcion, icono, precio, duracion, activo, created_at)
- medicos (id, nombre, especialidad, telefono, correo, activo, created_at)
- medico_servicios (medico_id, servicio_id) — PK composite
- citas (id, codigo_cita, nombre_paciente, telefono, correo, direccion, ciudad, servicio_id, cedula, fecha, hora, modalidad, comentario, estado, medico_id, observaciones, created_at, updated_at)
- observaciones_cita (id, cita_id, tipo, contenido, created_by, created_at)
- ars (id, nombre, created_at)
- facturas (id, cita_id, paciente, monto, ...)
- notificaciones (id, usuario_id, titulo, mensaje, cita_id, paciente_nombre, servicio, leido, created_at)
- mensajes (id, de, para, asunto, mensaje, leido, created_at)
- configuracion (id, clave, valor)
- disponibilidad (id, servicio_id, medico_id, dia_semana, hora_inicio, hora_fin, created_at)
- disponibilidad_excepciones (id, servicio_id, fecha, hora_inicio, hora_fin, motivo, created_at)
- resultados_citas (id, cita_id, archivo, ...)
- resultados_paciente (id, paciente_id, archivo, ...)
- pacientes (id, nombre, telefono, correo, ...)
- pagos (id, factura_id, monto, ...)

## Credentials
- `admin` / `admin1234` — superadmin
- `medico1` / `medico123` — doctor
- Rate limits: login 10/15min, citas 50/15min, general 100/15min

## Git
- Remote: `https://github.com/michaelselmo/medihome.git` — branch: main
- HEAD: `973705b` (pre-restore). Working tree has restored files.

## Dead Code (can ignore)
These directories exist but are NOT referenced by the current monolithic server.js:
- `routes/` (13 files) — modular refactor (abandoned)
- `db/` (2 files) — modular refactor (abandoned)
- `middleware/` (3 files) — modular refactor (abandoned)
- `utils/` (3 files) — modular refactor (abandoned)
- `admin-spa/` — React SPA (WIP, not deployed)

## What NOT to read
- `.gstack/` — browser logs
- `backups/`, `BackUP/`, `_pre-restore/` — backups
- `node_modules/` — deps
- `admin.html.bak`, `admin.html.backup2` — backups
- `*.db.bak`, `*.db.pre-availability` — old DB states
