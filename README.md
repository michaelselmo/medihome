# MediHome

**Plataforma de Telemedicina y Servicios Medicos a Domicilio**

Sistema full-stack para gestion de citas medicas, con landing publica, panel administrativo, autenticacion JWT y base de datos SQLite. Los pacientes pueden agendar citas y dar seguimiento por codigo unico; los administradores gestionan servicios, medicos y estados de citas.

---

## Tecnologias

| Capa | Tecnologia |
|------|-----------|
| Backend | Node.js v26 + Express 5 |
| Base de datos | SQLite 3 (local, sin servidor) |
| Frontend | HTML5 + CSS3 + JavaScript vanilla (sin frameworks) |
| Autenticacion | JWT (jsonwebtoken) + bcryptjs |
| Iconos | FontAwesome 6 |
| Tipografia | Google Fonts (Inter) |
| Versionado | Git + GitHub |

## Dependencias (npm)

| Paquete | Version | Proposito |
|---------|---------|-----------|
| `express` | ^5.2.1 | Framework web |
| `sqlite3` | ^6.0.1 | Base de datos SQLite |
| `bcryptjs` | ^3.0.3 | Hashing de contrasenas |
| `jsonwebtoken` | ^9.0.3 | Tokens JWT |
| `cors` | ^2.8.6 | CORS para peticiones cross-origin |
| `nodemailer` | ^8.0.7 | Envio de correos electronicos |
| `dotenv` | ^16.4.7 | Variables de entorno (.env) |

## Estructura del proyecto

```
medihome/                        # RAIZ DEL PROYECTO
├── server.js                    # Backend: servidor Express con 20 rutas API
├── package.json                 # Configuracion npm y dependencias
├── package-lock.json            # Lock de versiones (generado automaticamente)
├── opencode.json                # Configuracion de la herramienta OpenCode AI
├── .gitignore                   # Archivos que Git debe ignorar
├── .git/                        # Repositorio Git local (no tocar manualmente)
├── node_modules/                # Dependencias instaladas (no trackeadas en Git)
├── medihome.db                  # Base de datos SQLite (se crea sola al iniciar)
├── .vscode/
│   └── settings.json            # Configuracion de VS Code del proyecto
├── public/                      # Frontend (archivos estaticos)
│   ├── index.html               # Landing page publica (agendar cita)
│   └── admin.html               # Dashboard administrativo
├── services/
│   └── emailService.js          # Logica de envio de correos SMTP
├── templates/
│   └── emailCita.html           # Plantilla HTML para correo de nueva cita
├── .env                         # Variables de entorno (NO SUBIR A GIT)
├── .env.example                 # Template del archivo .env
├── README.md                    # Este archivo
└── PROJECT_CONTEXT.md           # Documentacion tecnica detallada
```

## Como ejecutar

```bash
# 1. Clonar (si es primera vez)
git clone https://github.com/michaelselmo/medihome.git
cd medihome

# 2. Instalar dependencias (solo la primera vez o cuando cambie package.json)
npm install

# 3. Iniciar servidor
npm start

# 4. Abrir en navegador
#    Landing:   http://localhost:3000
#    Admin:     http://localhost:3000/admin.html
#    API docs:  ver PROJECT_CONTEXT.md
```

## Credenciales

| Usuario | Contrasena | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Superadmin |
| `medico1` | `medico123` | Medico |

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────┐
│                   NAVEGADOR                          │
│  ┌─────────────────┐    ┌────────────────────────┐   │
│  │  index.html      │    │  admin.html            │   │
│  │  Landing publica │    │  Panel administrativo  │   │
│  └────────┬────────┘    └───────────┬────────────┘   │
│           │                         │                │
│      fetch() GET/POST          fetch() con JWT       │
└───────────┼─────────────────────────┼────────────────┘
            │                         │
┌───────────▼─────────────────────────▼────────────────┐
│              EXPRESS SERVER (server.js)               │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  RUTAS PUBLICAS (sin token)                  │    │
│  │  POST /api/login                             │    │
│  │  GET  /api/servicios                         │    │
│  │  GET  /api/medicos                           │    │
│  │  POST /api/citas                             │    │
│  │  GET  /api/citas/seguimiento                 │    │
│  └──────────────────────┬───────────────────────┘    │
│                         │                            │
│  ┌──────────────────────▼───────────────────────┐    │
│  │  MIDDLEWARE JWT (valida token)               │    │
│  └──────────────────────┬───────────────────────┘    │
│                         │                            │
│  ┌──────────────────────▼───────────────────────┐    │
│  │  RUTAS ADMIN (requieren token)               │    │
│  │  GET/PUT /api/admin/citas                    │    │
│  │  GET/POST/PUT/DELETE /api/admin/servicios    │    │
│  │  GET/POST/PUT/DELETE /api/admin/medicos      │    │
│  └──────────────────────┬───────────────────────┘    │
│                         │                            │
└─────────────────────────┼────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────┐
│              SQLite3 DATABASE (medihome.db)           │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ usuarios_admin│  │ servicios    │                  │
│  ├──────────────┤  ├──────────────┤                  │
│  │ id           │  │ id           │                  │
│  │ nombre       │  │ nombre       │                  │
│  │ usuario (UQ) │  │ descripcion  │                  │
│  │ password     │  │ icono        │                  │
│  │ rol          │  │ precio       │                  │
│  │ activo       │  │ duracion     │                  │
│  │ created_at   │  │ activo       │                  │
│  └──────────────┘  │ created_at   │                  │
│                    └──────┬───────┘                  │
│  ┌──────────────┐         │                          │
│  │ medicos      │         │                          │
│  ├──────────────┤         │                          │
│  │ id           │         │                          │
│  │ nombre       │         │                          │
│  │ especialidad │         │                          │
│  │ telefono     │         │                          │
│  │ correo       │         │                          │
│  │ activo       │         │                          │
│  │ created_at   │         │                          │
│  └──────┬───────┘         │                          │
│         │                 │                          │
│  ┌──────▼───────┐  ┌──────▼───────┐                  │
│  │ medico_      │  │ citas        │                  │
│  │ servicios    │  │              │                  │
│  ├──────────────┤  ├──────────────┤                  │
│  │ medico_id    │  │ id           │                  │
│  │ servicio_id  │  │ codigo_cita  │                  │
│  └──────────────┘  │ nombre_pac   │                  │
│                    │ telefono     │                  │
│  ┌──────────────┐  │ correo       │                  │
│  │ observaciones│  │ direccion    │                  │
│  │ _cita        │  │ ciudad       │                  │
│  ├──────────────┤  │ servicio_id* │                  │
│  │ cita_id      │  │ fecha        │                  │
│  │ tipo         │  │ hora         │                  │
│  │ contenido    │  │ modalidad    │                  │
│  │ created_by   │  │ comentario   │                  │
│  │ created_at   │  │ estado       │                  │
│  └──────────────┘  │ medico_id*   │                  │
│                    │ observaciones│                  │
│                    │ created_at   │                  │
│                    │ updated_at   │                  │
│                    └──────────────┘                  │
└──────────────────────────────────────────────────────┘
```

## Base de datos: 6 tablas

| Tabla | Registros | Descripcion |
|-------|-----------|-------------|
| `usuarios_admin` | 2 | Admin y medico por defecto |
| `servicios` | 11 | Servicios medicos con precio y duracion |
| `medicos` | 5 | Medicos con especialidad y contacto |
| `medico_servicios` | 0 | Relacion N:M entre medicos y servicios |
| `citas` | 0 (inicia vacia) | Citas agendadas por pacientes |
| `observaciones_cita` | 0 | Log de observaciones y resultados por cita |

La base de datos se crea y precarga automaticamente la primera vez que se ejecuta `node server.js`.

## API: 20 endpoints

### Publicos
| Metodo | Ruta | Body / Query | Response |
|--------|------|-------------|----------|
| POST | `/api/login` | `{usuario, password}` | `{token, nombre, rol}` |
| GET | `/api/servicios` | - | `[{id, nombre, descripcion, icono, precio, duracion}]` |
| GET | `/api/medicos` | - | `[{id, nombre, especialidad, telefono, correo}]` |
| POST | `/api/citas` | `{nombre_paciente, telefono, servicio_id, fecha, hora, ...}` | `{id, codigo_cita, mensaje}` |
| GET | `/api/citas/seguimiento` | `?codigo=MH-XXXXXX` o `?telefono=809...` | `[{cita con join a servicio y medico}]` |

### Admin (requieren header `Authorization: Bearer <token>`)
| Metodo | Ruta | Proposito |
|--------|------|-----------|
| GET | `/api/admin/stats` | Dashboard stats (totales, tendencias, top servicios) |
| GET | `/api/admin/citas` | Lista citas con filtros (estado, fecha, servicio, medico, busqueda) |
| GET | `/api/admin/citas/:id` | Detalle de cita + observaciones |
| PUT | `/api/admin/citas/:id` | Actualizar estado, medico, observaciones |
| GET | `/api/admin/servicios` | Lista todos los servicios |
| POST | `/api/admin/servicios` | Crear servicio |
| PUT | `/api/admin/servicios/:id` | Actualizar servicio |
| DELETE | `/api/admin/servicios/:id` | Desactivar servicio (soft delete) |
| GET | `/api/admin/medicos` | Lista medicos con servicios asignados |
| POST | `/api/admin/medicos` | Crear medico |
| PUT | `/api/admin/medicos/:id` | Actualizar medico |
| DELETE | `/api/admin/medicos/:id` | Desactivar medico (soft delete) |
| GET | `/api/admin/medicos/:id/servicios` | Servicios asignados a un medico |
| POST | `/api/admin/medicos/:id/servicios` | Asignar servicios a medico |

## Autenticacion

El sistema usa JWT (JSON Web Token):
1. El usuario envia `POST /api/login` con usuario y contrasena
2. El servidor verifica contra `usuarios_admin` con bcryptjs
3. Si es valido, firma un token con expiracion de 24h usando `SECRET`
4. El frontend guarda el token en `sessionStorage`
5. Cada peticion admin incluye `Authorization: Bearer <token>`
6. El middleware `authMiddleware` verifica el token en cada ruta protegida

**Seguridad:**
- Contrasenas hasheadas con bcryptjs (10 rounds)
- Token JWT con expiracion de 24 horas
- Soft delete en servicios y medicos (activo=0, no se borran)
- El SECRET esta hardcodeado en el codigo (debe moverse a variable de entorno en produccion)

## Flujo completo: agendar cita

```
1. USUARIO: Abre index.html en el navegador
2. USUARIO: Llena formulario (nombre, telefono, servicio, fecha, hora, etc.)
3. FRONTEND: Valida campos obligatorios en JavaScript
4. FRONTEND: Envia fetch POST /api/citas con los datos
5. BACKEND: Recibe datos, valida campos requeridos
6. BACKEND: Genera codigo unico MH-XXXXXX (verifica que no exista)
7. BACKEND: Inserta en tabla `citas` con estado='pendiente'
8. BACKEND: Responde con {id, codigo_cita, mensaje}
9. FRONTEND: Muestra modal con codigo de confirmacion
10. USUARIO: Guarda el codigo para seguimiento futuro
```

## Flujo completo: administrar

```
1. ADMIN: Abre admin.html, ingresa usuario/contresena
2. FRONTEND: POST /api/login → recibe token JWT
3. FRONTEND: Guarda token en sessionStorage, redirige al dashboard
4. FRONTEND: GET /api/admin/stats (con token) → muestra metricas
5. FRONTEND: GET /api/admin/citas (con token) → tabla de citas
6. ADMIN: Filtra citas por estado/fecha/busqueda
7. ADMIN: Abre detalle de cita, cambia estado, asigna medico
8. FRONTEND: PUT /api/admin/citas/:id (con token y datos)
9. BACKEND: Actualiza cita, registra observacion si hay
10: ADMIN: Gestiona servicios y medicos desde el panel
```

## Notificaciones por correo

Cuando un cliente agenda una cita, el sistema envia automaticamente un correo de notificacion al administrador con todos los detalles. Si el servicio seleccionado tiene medicos asociados con correo registrado, se incluyen en copia (CC).

### Configuracion

```bash
# 1. Copiar el template
cp .env.example .env

# 2. Editar .env con tus credenciales de Gmail
#    EMAIL_APP_PASSWORD debe ser un App Password de Gmail
#    (NO la contraseña normal de la cuenta)

# 3. Obtener App Password en:
#    https://myaccount.google.com/apppasswords
#    Requisito: tener verificacion en 2 pasos activada
```

### Variables .env

| Variable | Descripcion |
|----------|-------------|
| `EMAIL_HOST` | Servidor SMTP (smtp.gmail.com) |
| `EMAIL_PORT` | Puerto SMTP (587 para TLS) |
| `EMAIL_SECURE` | false para TLS, true para SSL |
| `EMAIL_USER` | Correo remitente |
| `EMAIL_APP_PASSWORD` | App Password de Gmail (16 caracteres) |
| `EMAIL_ADMIN` | Correo del administrador que recibe notificaciones |

### Comportamiento

- El correo se envia DESPUES de guardar la cita en la base de datos
- Si falla el envio del correo, la cita NO se pierde (se registra el error en consola)
- Si ningun medico tiene correo registrado, se envia solo al administrador
- El correo incluye: datos del paciente, servicio, fecha, hora, modalidad, codigo unico y enlace al panel admin

## Funcionalidades implementadas

- Landing page con diseño medico premium (gradientes azules, glassmorphism, animaciones)
- Formulario de agendamiento de citas con validacion
- Sistema de seguimiento de citas por codigo unico MH-XXXXXX
- Panel administrativo con dashboard de metricas
- CRUD completo de servicios medicos
- CRUD completo de medicos
- Asignacion de servicios a medicos
- Gestion de estados de citas (pendiente, confirmada, en_proceso, completada, cancelada)
- Historial de observaciones por cita
- Autenticacion JWT con roles (admin, medico)
- Filtros de busqueda en listado de citas
- Diseño responsive (funciona en celulares)
- Base de datos precargada con datos demo
- Soft delete en medicos y servicios

## Funcionalidades pendientes

- [ ] Mover SECRET a variable de entorno (.env)
- [ ] Envio de notificaciones por correo (nodemailer ya instalado)
- [ ] Envio de notificaciones SMS/WhatsApp
- [ ] Panel de perfil de medico (ver solo sus citas)
- [ ] Recordatorio automatico de citas (cron job)
- [ ] Reportes PDF / exportacion de datos (CSV, Excel)
- [ ] Subida de archivos (resultados de examenes, recetas)
- [ ] Tests automatizados (mocha + supertest)
- [ ] Paginacion en listado de citas
- [ ] Multi-tenant (multiples clinicas)
- [ ] Internacionalizacion (i18n)
- [ ] Dockerizar la aplicacion

## Posibles errores conocidos

| Error | Causa | Solucion |
|-------|-------|----------|
| `Error: Cannot find module 'express'` | Falta `npm install` | Ejecutar `npm install` |
| `EADDRINUSE :::3000` | Puerto ocupado | `kill $(lsof -ti:3000)` y reiniciar |
| `SQLITE_ERROR: no such table` | DB corrupta o vieja | Borrar `medihome.db` y reiniciar |
| Token invalido al recargar admin | SessionStorage limpio | Volver a iniciar sesion |
| `ERR_REQUIRE_ESM` en Express 5 | Mala importacion | Usar `require()` normal con `"type": "commonjs"` |

## Variables de entorno

Actualmente el proyecto NO usa `.env`. Para produccion se recomienda:

```
PORT=3000
SECRET=clave_secreta_segura_para_jwt
DB_PATH=./medihome.db
```

## Recomendaciones tecnicas

1. **Mover SECRET a `.env`** — no hardcodear claves en el codigo
2. **Separar CSS/JS** de los HTML — actualmente ~68KB de CSS inline en index.html
3. **Separar `server.js`** en modulos: `routes/`, `middleware/`, `db/`, `config/`
4. **Agregar ESLint + Prettier** — mantener consistencia de codigo
5. **Agregar tests** con mocha + supertest para las rutas API
6. **Usar migraciones** en lugar de `CREATE TABLE IF NOT EXISTS`
7. **Validacion de datos** con express-validator en vez de manual
8. **Manejo de errores** con middleware global en vez de try/catch por ruta
9. **Paginacion** en endpoints que devuelven listas
10. **Logging** con morgan o winston en vez de console.log

## Comandos utiles

```bash
npm start              # Iniciar servidor
npm install <paquete>  # Instalar nueva dependencia

git status             # Ver cambios
git diff               # Ver cambios detallados
git add -A             # Stagear todo
git commit -m "msg"    # Commit
git push               # Subir a GitHub
git pull               # Bajar cambios
git log --oneline      # Historial resumido

kill $(lsof -ti:3000)  # Matar proceso en puerto 3000
rm medihome.db         # Resetear base de datos (se recrea al iniciar)
```

---

*Proyecto educativo full-stack. Documentacion generada el 2026-05-15.*
