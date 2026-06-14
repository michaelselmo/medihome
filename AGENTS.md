# MediHome — Project Memory

## Description
Telemedicine & home medical services platform (Dominican Republic). Express 5 + SQLite3 + Vanilla JS frontend + React SPA (admin-spa, WIP). Resend for email. JWT auth.

## Critical Token-Saving Rules
1. NEVER read full server.js/admin.html/index.html — grep + line numbers only
2. Read max 100 lines at a time from large files
3. Keep responses under 5 lines unless asked
4. Batch independent file edits in parallel
5. Use route/function line numbers below to jump directly to code

## File Index
| File | Lines | Size | Notes |
|------|-------|------|-------|
| server.js | 5695 | 210KB | Full backend, all routes |
| public/admin.html | 12561 | 511KB | Admin dashboard (vanilla) |
| public/index.html | 4244 | 132KB | Public landing page + form |
| medihome.db | - | 144KB | SQLite DB (real data) |
| services/emailService.js | 112 | 3KB | Email logic (Resend) |
| utils/mailer.js | 64 | 2KB | Nodemailer/Resend transporter |
| templates/email/ | 3 files | - | Email HTML templates |
| admin-spa/ | React | - | Vite+Tailwind SPA (not live yet) |

## Auth
- `admin` / `admin123` — full admin access
- `medico1` / `medico123` — doctor access
- JWT stored in localStorage, `authMiddleware` at line 1199
- Rate limit: login 10/15min, citas 50/15min, general 100/15min

## DB Schema (key tables & line numbers)
- usuarios_admin (244): id, nombre, usuario, password, rol, medico_id, activo
- ars (272): id, nombre, cobertura
- facturas (280): id, cita_id, monto, estado, created_at
- notificaciones (402): id, usuario_id, titulo, mensaje, tipo, cita_id, leido
- mensajes (442): id, remitente_id, destinatario_id, asunto, mensaje, leido
- configuracion (442): id, clave, valor
- servicios (483): id, nombre, descripcion, icono, precio, duracion, activo
- medicos (494): id, nombre, especialidad, telefono, correo, activo
- medico_servicios (504): medico_id, servicio_id
- citas (512): id, codigo_cita, nombre_paciente, correo, telefono, cedula, direccion, servicio_id, medico_id, fecha, hora, modalidad, ars, estado, monto, created_at, updated_at
- disponibilidad (537): id, servicio_id, medico_id, dia_semana, hora_inicio, hora_fin
- disponibilidad_excepciones (557): id, servicio_id, fecha, disponible
- observaciones_cita (573): id, cita_id, tipo, contenido, created_by
- resultados_citas (583): id, cita_id, archivo, archivo_original, nota
- resultados_paciente (596): id, paciente_id, archivo, archivo_original, nota
- pacientes (613): id, nombre, cedula, telefono, correo, direccion
- pagos (648): id, factura_id, monto, metodo, referencia, created_at

## API Routes (all in server.js)

### Public (no auth)
| Route | Line | Description |
|-------|------|-------------|
| POST /api/login | 1250 | Login (JWT) |
| GET /api/me | 1300 | Current user info |
| GET /api/servicios | 1327 | Active services |
| GET /api/medicos | 1334 | Active doctors |
| GET /api/ars | 1341 | ARS list |
| GET /api/disponibilidad | 1347 | Availability by service/date |
| GET /api/disponibilidad/horarios | 1359 | Available time slots |
| POST /api/citas | 1424 | Create appointment |
| GET /api/citas/seguimiento | 1772 | Track appointment by code/phone |

### Admin (authMiddleware)
| Route | Line | Description |
|-------|------|-------------|
| GET /api/admin/stats | 1800 | Dashboard stats |
| GET /api/admin/citas | 1916 | All appointments |
| GET /api/admin/citas/ultima | 1951 | Last appointment |
| GET /api/admin/citas/:id | 1961 | Appointment detail |
| PUT /api/admin/citas/:id | 2020 | Update appointment |
| POST /api/admin/citas/:id/resultado | 2150 | Upload medical result |
| GET /api/admin/resultados/:archivo | 2219 | Serve result file |
| CRUD /api/admin/servicios | 2228 | Services management |
| CRUD /api/admin/disponibilidad | 2306 | Schedule management |
| CRUD /api/admin/excepciones | 2463 | Schedule exceptions |
| CRUD /api/admin/medicos | 2569 | Doctors management |
| GET/POST /api/admin/medicos/:id/servicios | 2638 | Doctor-service assignment |
| CRUD /api/admin/usuarios | 2669 | Users management |
| CRUD /api/admin/ars | 2804 | ARS management |
| GET /api/admin/facturas | 2861 | Invoices list |
| GET /api/admin/facturas/:id | 2886 | Invoice detail |
| PUT /api/admin/facturas/:id/pagar | 2900 | Mark paid |
| PUT /api/admin/facturas/:id/anular | 2984 | Cancel invoice |
| GET /api/facturas/:cita_id | 2999 | Invoice by cita |
| PUT /api/admin/facturas/:id/enviar-email | 4197 | Email invoice |
| POST /api/facturas/:id/enviar-correo | 4310 | Send invoice email |
| PUT /api/admin/citas/:id/reprogramar | 3163 | Reschedule (old) |
| PUT /api/admin/citas/:id/reagendar | 3251 | Reschedule (new, WIP) |
| GET /api/admin/reagendar/calendario | 3502 | Reschedule calendar |
| GET /api/admin/citas/:id/reagendar/disponibilidad | 3584 | Reschedule availability |
| GET /api/admin/reagendar/disponibilidad-global | 3680 | Global availability |
| PUT /api/admin/citas/:id/confirmar | 3787 | Confirm appointment |
| GET /api/admin/expedientes/:cedula | 3837 | Patient records by cedula |
| GET /api/admin/facturas/:id/pdf | 3910 | Generate invoice PDF |
| CRUD /api/pacientes | 4428 | Patient management |
| GET /api/reportes | 4799 | Reports |
| CRUD /api/mensajes | 4960 | Messaging |
| GET /api/notificaciones | 5069 | Notifications |
| CRUD /api/configuracion | 5115 | App configuration |

### Doctor (medicoAuthMiddleware)
| Route | Line | Description |
|-------|------|-------------|
| GET /api/medico/dashboard | 5232 | Doctor dashboard |
| GET /api/medico/citas | 5312 | Doctor appointments |
| GET /api/medico/citas/:id | 5339 | Appointment detail |
| PUT /api/medico/citas/:id | 5369 | Update appointment |
| PUT /api/medico/citas/:id/estado | 5406 | Change status |
| GET /api/medico/pacientes | 5438 | Doctor's patients |
| POST /api/medico/pacientes | 5513 | Register patient |
| GET /api/medico/resultados | 5566 | Results list |
| CRUD /api/medico/notificaciones | 5580 | Doctor notifications |

## Last Commit (HEAD)
`276d1d7` — "Rediseno completo formulario solicitar cita, nueva seccion medico, y mejoras visuales"
Major redesign of appointment form, new doctor section, visual improvements.

## Pending Changes (3 files, uncommitted)
- `server.js` +587/-7: New ARS data (18 insurers), "presencial" modality, `/api/admin/citas/:id/reagendar` endpoint, reschedule calendar/availability endpoints, confirmation endpoint
- `public/admin.html` large diff: Dashboard wizard redesign (modal, progress bar, 3-column grid, premium cards), badge for "reagendada" status
- `public/index.html` large diff: Appointment form redesign (banner header, new progress tracker, compact calendar+hours layout)

## Commit History (last 5)
1. Rediseno completo formulario + nueva seccion medico
2. Rediseno dashboard + correccion error detalle cita + carga resultados
3. Rate limiting en rutas API
4. Reemplaza Gmail SMTP por Resend
5. Correcciones validaciones, hora desplegable, dos correos separados

## Key Functions / Helpers
- `validarCedulaRD(ced)` — line 1188
- `validarTelefonoRD(tel)` — line 1183
- `validarEmail(email)` — line 1179
- `authMiddleware` — line 1199
- `medicoAuthMiddleware` — line 1215 (est.)
- `crearNotificacion(usuarioId, titulo, mensaje, tipo, cb)` — line 1240
- `sendNewCitaNotification(citaData)` — services/emailService.js:64
- `sendResultadoNotification(resultData)` — services/emailService.js:70

## Git Remote
`https://github.com/michaelselmo/medihome.git` — branch: main

## What NOT to Read (waste of tokens)
- `.gstack/` — browser logs, irrelevant
- `backups/`, `BackUP/`, `server.js.bak` — backups
- `node_modules/` — deps
- `medihome.db.pre-availability` — old DB state
- `database.db` — empty file
