# PROJECT CONTEXT — MediHome

> Documento de contexto completo para retomar el proyecto en sesiones limpias.
> Fecha: 2026-05-15 | Ultima sesion: Sesion 2 (notificaciones por correo)

---

## 1. RESUMEN EJECUTIVO

MediHome es una plataforma de telemedicina y servicios medicos a domicilio. Usa Node.js + Express 5 como backend, SQLite como base de datos, y HTML/CSS/JS vanilla como frontend. Sirve dos paginas: una landing publica para agendar citas y un panel administrativo para gestionarlas.

**Estado actual:** Funcional y desplegable localmente. Diseno visual completado (estilo premium medico claro). Backend completo con 20 endpoints API. Base de datos con 6 tablas y datos demo precargados.

---

## 2. PARA CONTINUAR EN UNA NUEVA SESION

```bash
# Iniciar el proyecto
cd ~/medihome
npm start                 # http://localhost:3000

# Credenciales admin
#   User: admin / Pass: admin123

# Si puerto ocupado:
kill $(lsof -ti:3000)

# Si base de datos corrupta:
rm medihome.db && npm start

# Probar que funciona:
curl http://localhost:3000/api/servicios    # Debe devolver JSON
curl http://localhost:3000                  # Debe devolver HTML
```

---

## 3. ESTRUCTURA COMPLETA DEL PROYECTO

```
~/medihome/                           # 416 bytes en disco
├── server.js                       (~21000 B, ~451 lineas)
│   Backend completo en un solo archivo.
│   ─ Crea/abre BD SQLite
│   ─ Define 6 tablas con datos iniciales
│   ─ 5 rutas publicas
│   ─ 14 rutas admin protegidas con JWT
│   ─ Sirve archivos estaticos de public/
│
├── package.json                     (500 B)
│   7 dependencias de produccion.
│   Scripts: "start" y "dev" → node server.js
│   Type: commonjs (require, no import)
│
├── package-lock.json               (59316 B)
│   Generado automaticamente por npm.
│   NO MODIFICAR. Incluir en Git.
│
├── opencode.json                    (85 B)
│   Config de OpenCode AI tool.
│   Modelo: opencode/big-pickle
│   Schema: https://opencode.ai/config.json
│
├── .gitignore                       (240 B)
│   Ignora: node_modules/, *.db, .env, .vscode/, .DS_Store, *.log
│
├── .git/                            (carpeta)
│   Repositorio Git local. NO TOCAR.
│   Remote: https://github.com/michaelselmo/medihome.git
│   3 commits: "Initial commit", "Clean: remove barberia files",
│      "Implementa notificaciones por correo para nuevas citas"
│
├── .vscode/
│   └── settings.json                (297 B)
│       Config proyecto VS Code:
│       - Oculta node_modules/ y .git/ del explorador
│       - Formato automatico con Prettier
│       - TabSize: 2 espacios
│       - AutoSave: al cambiar de foco
│
├── node_modules/                    (20 MB, 139 paquetes)
│   NO TOCAR. Recrear con npm install.
│
├── medihome.db                      (44 KB)
│   Base de datos SQLite.
│   SE CREA SOLA. Borrar para resetear datos.
│   Contiene: 2 admins, 11 servicios, 5 medicos, 0 citas
│
├── public/                          (116 KB total)
│   ├── index.html                  (67875 B, ~1107 lineas)
│   │   Landing page publica.
│   │   Contiene CSS inline (estilo medico premium claro),
│   │   HTML (navbar, hero, servicios, formulario, FAQ, footer),
│   │   y JS inline (formulario, seguimiento, scroll reveal, FAQ accordion).
│   │   Diseno: glassmorphism, gradientes azules/teal, animaciones suaves.
│   │   API calls: GET /api/servicios, GET /api/medicos,
│   │              POST /api/citas, GET /api/citas/seguimiento
│   │
│   └── admin.html                  (48725 B, ~809 lineas)
│       Panel administrativo.
│       Contiene CSS inline (estilo SaaS premium claro),
│       HTML (sidebar, dashboard, tabla citas, modales),
│       y JS inline (login JWT, CRUD citas/servicios/medicos, stats).
│       Diseno: sidebar blanco, metric cards, tabla con filtros.
│       API calls: todas las rutas /api/admin/* con token JWT
│
├── services/
│   └── emailService.js             (creado en sesion 2)
│       Logica de envio de correos SMTP via nodemailer.
│       Lee config desde .env, construye HTML desde template,
│       envia notificacion al admin + CC a medico.
│       Maneja errores sin crashear el servidor.
│
├── templates/
│   └── emailCita.html              (creado en sesion 2)
│       Plantilla HTML profesional para correo de nueva cita.
│       Estilo medico premium inline (compatible Gmail/Outlook).
│       15 placeholders. Boton CTA hacia panel admin.
│
├── .env                             (creado en sesion 2, NO subir a Git)
│   Variables de entorno: EMAIL_HOST, EMAIL_PORT, EMAIL_USER,
│   EMAIL_APP_PASSWORD, EMAIL_ADMIN, SECRET, PORT, DB_PATH
│
├── .env.example                     (creado en sesion 2)
│   Template del .env con instrucciones de configuracion.
│
├── README.md                        (actualizado en sesion 2)
│   Documentacion profesional del proyecto.
│
└── PROJECT_CONTEXT.md               (ESTE ARCHIVO)
    Contexto completo para reanudar sesiones.
```

---

## 4. ARQUITECTURA DEL SISTEMA

### 4.1 Modelo general

```
CLIENTE (navegador)
  │
  ├── index.html ─── fetch() ──► /api/* (publicas)
  │                                │
  └── admin.html ── fetch(JWT) ─► /api/admin/* (protegidas)
                                   │
                                   ▼
                         Express Server (server.js)
                                   │
                                   ▼
                         SQLite3 (medihome.db)
```

### 4.2 Flujo de peticion

```
1. Navegador solicita http://localhost:3000/
2. Express.static sirve public/index.html
3. El HTML contiene el frontend completo (CSS + JS inline)
4. JS en navegador hace fetch() a la API
5. Express recibe la peticion en la ruta correspondiente
6. Si es ruta admin → pasa por authMiddleware (valida JWT)
7. Handler ejecuta consulta SQL contra SQLite
8. Respuesta JSON vuelve al navegador
9. JS actualiza el DOM con los datos recibidos
```

### 4.3 Stack tecnologico detallado

| Componente | Tecnologia | Version | Rol |
|------------|-----------|---------|-----|
| Runtime | Node.js | v26.0.0 | Ejecuta JavaScript en servidor |
| Framework web | Express | ^5.2.1 | Maneja rutas HTTP y middleware |
| Base de datos | SQLite3 | ^6.0.1 | BD embebida sin servidor |
| Autenticacion | jsonwebtoken | ^9.0.3 | Tokens JWT para sesiones |
| Hashing | bcryptjs | ^3.0.3 | Hash de contrasenas |
| CORS | cors | ^2.8.6 | Permite peticiones cross-origin |
| Email | nodemailer | ^8.0.7 | Envio de notificaciones |
| Variables de entorno | dotenv | ^16.4.7 | Gestion de .env |
| Iconos | FontAwesome | 6.5.0 | Iconos en UI |
| Tipografia | Google Fonts | Inter | Tipografia principal |
| Versionado | Git | 2.39.2 | Control de versiones |
| Remoto | GitHub | - | Repositorio remoto |

---

## 5. BASE DE DATOS

### 5.1 Esquema completo

```sql
-- Tabla 1: Usuarios del sistema (admin y medicos)
CREATE TABLE usuarios_admin (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT NOT NULL,
  usuario    TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,           -- bcrypt hash
  rol        TEXT DEFAULT 'admin',    -- 'superadmin' | 'medico'
  activo     INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla 2: Servicios medicos ofrecidos
CREATE TABLE servicios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  icono       TEXT DEFAULT 'fa-stethoscope',
  precio      REAL,
  duracion    INTEGER DEFAULT 30,     -- minutos
  activo      INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla 3: Medicos registrados
CREATE TABLE medicos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  especialidad  TEXT,
  telefono      TEXT,
  correo        TEXT,
  activo        INTEGER DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla 4: Relacion N:M entre medicos y servicios
CREATE TABLE medico_servicios (
  medico_id   INTEGER,
  servicio_id INTEGER,
  PRIMARY KEY(medico_id, servicio_id),
  FOREIGN KEY(medico_id)   REFERENCES medicos(id),
  FOREIGN KEY(servicio_id) REFERENCES servicios(id)
);

-- Tabla 5: Citas agendadas
CREATE TABLE citas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_cita      TEXT UNIQUE NOT NULL,   -- formato: MH-XXXXXX
  nombre_paciente  TEXT NOT NULL,
  telefono         TEXT NOT NULL,
  correo           TEXT,
  direccion        TEXT,
  ciudad           TEXT,
  servicio_id      INTEGER,
  fecha            TEXT NOT NULL,           -- YYYY-MM-DD
  hora             TEXT NOT NULL,           -- HH:MM
  modalidad        TEXT DEFAULT 'domicilio', -- 'domicilio' | 'telemedicina' | 'consulta'
  comentario       TEXT,
  estado           TEXT DEFAULT 'pendiente', -- pendiente | confirmada | en_proceso | completada | cancelada
  medico_id        INTEGER,
  observaciones    TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(servicio_id) REFERENCES servicios(id),
  FOREIGN KEY(medico_id)   REFERENCES medicos(id)
);

-- Tabla 6: Historial de observaciones de cada cita
CREATE TABLE observaciones_cita (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cita_id    INTEGER NOT NULL,
  tipo       TEXT DEFAULT 'admin',     -- 'admin' | 'resultado'
  contenido  TEXT,
  created_by TEXT,                     -- nombre del admin que registro
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(cita_id) REFERENCES citas(id)
);
```

### 5.2 Datos iniciales precargados

```sql
-- Usuarios
INSERT INTO usuarios_admin (nombre, usuario, password, rol)
  VALUES ('Administrador', 'admin',   bcrypt('admin123'),  'superadmin');
INSERT INTO usuarios_admin (nombre, usuario, password, rol)
  VALUES ('Dr. García',    'medico1', bcrypt('medico123'), 'medico');

-- 11 servicios medicos (ver server.js lineas 106-127):
-- Sonografía Obstétrica ($2500, 30min) ... Telemedicina ($1200, 20min)

-- 5 medicos (ver server.js lineas 129-138):
-- Dr. Carlos García, Dra. María Rodríguez, Dr. Juan Martínez,
-- Dra. Laura Sánchez, Dr. Roberto Peña
```

### 5.3 Relaciones entre tablas

```
usuarios_admin  (independiente, solo autenticacion)

servicios ──┐
            ├── medico_servicios ── medicos
            │
citas ──────┤
            └── medicos
  │
  └── observaciones_cita
```

---

## 6. API COMPLETA

### 6.1 Rutas publicas (no requieren token)

```
POST /api/login
  Body: { usuario: string, password: string }
  Response 200: { token: string, nombre: string, rol: string }
  Response 401: { error: "Usuario o contraseña incorrectos" }

GET /api/servicios
  Response 200: [ Servicio, ... ]

GET /api/medicos
  Response 200: [ Medico, ... ]

POST /api/citas
  Body: {
    nombre_paciente: string (req),
    telefono: string (req),
    correo: string (opt),
    direccion: string (opt),
    ciudad: string (opt),
    servicio_id: int (req),
    fecha: string YYYY-MM-DD (req),
    hora: string HH:MM (req),
    modalidad: "domicilio" | "telemedicina" | "consulta" (opt, default "domicilio"),
    comentario: string (opt),
    acepto_privacidad: boolean (opt)
  }
  Response 200: {
    id: int,
    codigo_cita: string ("MH-" + 6 chars),
    mensaje: string
  }
  Response 400: { error: "Campos obligatorios: ..." }
  Response 500: { error: "Error al crear la cita" }

GET /api/citas/seguimiento
  Query params (al menos uno):
    codigo: string (MH-XXXXXX)
    telefono: string
  Response 200: [ Cita con join a servicio_nombre, precio, medico_nombre, especialidad ]
```

### 6.2 Rutas admin (requieren header `Authorization: Bearer <token>`)

```
GET  /api/admin/stats                    → Dashboard stats
GET  /api/admin/citas                    → Lista citas (filtros: ?estado=&fecha=&servicio=&medico=&busqueda=)
GET  /api/admin/citas/:id                → Detalle cita + observaciones_lista
PUT  /api/admin/citas/:id                → Actualizar {estado, medico_id, observaciones, resultado}
GET  /api/admin/servicios                → Lista todos (incluye inactivos)
POST /api/admin/servicios                → Crear {nombre, descripcion, icono, precio, duracion}
PUT  /api/admin/servicios/:id            → Actualizar
DELETE /api/admin/servicios/:id          → Desactivar (activo=0)
GET  /api/admin/medicos                  → Lista (con servicios_nombres via GROUP_CONCAT)
POST /api/admin/medicos                  → Crear {nombre, especialidad, telefono, correo}
PUT  /api/admin/medicos/:id              → Actualizar
DELETE /api/admin/medicos/:id            → Desactivar
GET  /api/admin/medicos/:id/servicios    → IDs de servicios asignados
POST /api/admin/medicos/:id/servicios    → Asignar {servicio_ids: [1,2,3]}
```

### 6.3 Formato de respuesta de error comun
```json
{ "error": "mensaje descriptivo" }
```

---

## 7. FRONTEND

### 7.1 index.html (Landing publica)

- **Proposito:** Pagina principal donde los pacientes agendan citas
- **Tamano:** ~68KB, ~1107 lineas (todo inline: CSS + HTML + JS)
- **Secciones:**
  1. Navbar con glassmorphism, logo y enlaces
  2. Hero con animacion de latido cardiaco SVG, titulo y CTA
  3. Servicios (cards con iconos, precio, descripcion)
  4. Formulario de agendamiento (nombre, telefono, servicio, fecha, hora, modalidad, etc.)
  5. Seguimiento de citas (buscar por codigo o telefono)
  6. Testimonios (carrusel de cards)
  7. FAQ (acordeon)
  8. Footer con datos de contacto y redes
- **Diseno:** Premium medico claro — blanco/plomo suave, azul medico (#0ea5e9), cyan, teal, gradientes, glassmorphism, sombras suaves, animaciones scroll reveal
- **API calls desde JS:**
  - `fetch('/api/servicios')` al cargar → llena select de servicios
  - `fetch('/api/medicos')` al cargar → llena select de medicos
  - `fetch('/api/citas', {method:'POST', body:formData})` → crea cita
  - `fetch('/api/citas/seguimiento?codigo=...')` → buscar por codigo
  - `fetch('/api/citas/seguimiento?telefono=...')` → buscar por telefono

### 7.2 admin.html (Panel administrativo)

- **Proposito:** Dashboard para administrar citas, servicios y medicos
- **Tamano:** ~49KB, ~809 lineas (todo inline)
- **Secciones:**
  1. Pantalla de login (usuario + contrasena, obtiene JWT)
  2. Sidebar con navegacion (Dashboard, Citas, Servicios, Medicos)
  3. Dashboard con tarjetas de metricas (total, pendientes, confirmadas, completadas, canceladas)
  4. Tabla de citas con filtros (estado, fecha, servicio, medico, busqueda)
  5. Modal de detalle/edicion de cita
  6. Gestion de servicios (CRUD con modal)
  7. Gestion de medicos (CRUD con modal, asignacion de servicios)
  8. Toast notifications
- **Diseno:** SaaS premium claro — fondo gris suave, sidebar blanco, metric cards con borde superior de color, tabla con hover, botones con gradientes
- **API calls desde JS:**
  - `POST /api/login` → autenticacion
  - `GET /api/admin/stats` → metricas del dashboard
  - `GET /api/admin/citas` → listado con filtros
  - `GET /api/admin/citas/:id` → detalle
  - `PUT /api/admin/citas/:id` → actualizar estado
  - CRUD completo de servicios y medicos via `/api/admin/servicios/*` y `/api/admin/medicos/*`

---

## 8. SERVER.JS ANALISIS DETALLADO

### Estructura del codigo

```javascript
// 1. IMPORTS (lineas 1-6)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');     // no se usa actualmente

// 2. CONFIG (lineas 8-11)
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'medihome.db');
const SECRET = 'medihome_secret_key_2026';  // ⚠ hardcodeado

// 3. MIDDLEWARE GLOBAL (lineas 15-17)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4. FUNCION AYUDANTE (lineas 19-24)
generarCodigoCita() → string "MH-XXXXXX"

// 5. INICIALIZACION BD (lineas 26-141)
//    db.serialize() → crea 6 tablas + precarga datos demo

// 6. MIDDLEWARE JWT (lineas 143-151)
authMiddleware → verifica header Authorization: Bearer <token>

// 7. RUTAS PUBLICAS (lineas 153-221)
//    /api/login, /api/servicios, /api/medicos, /api/citas, /api/citas/seguimiento

// 8. RUTAS ADMIN (lineas 223-418)
//    /api/admin/stats, /api/admin/citas, /api/admin/servicios, /api/admin/medicos

// 9. FALLBACK (lineas 420-421)
//    /api/* → 404

// 10. LISTEN (lineas 423-427)
//    app.listen(PORT, callback)
```

### Patrones usados

- **Callback hell** en `/api/admin/stats` — 8 niveles de anidamiento (lineas 225-252)
- **Require inline** de jsonwebtoken dentro del handler en lugar de al inicio del archivo (linea 147 y 160)
- **Validacion manual** de campos requeridos con ifs
- **Prepared statements** con `?` para evitar SQL injection (bien)
- **Soft delete** con `activo=0` en lugar de DELETE real
- **Codigo unico** generado con verificacion de duplicados recursiva

---

## 9. ESTADO ACTUAL DEL PROYECTO

### 9.1 Resumen

| Aspecto | Estado |
|---------|--------|
| Backend API | Completo (20 endpoints) |
| Base de datos | Completa (6 tablas, datos demo) |
| Autenticacion | Funcional (JWT + bcrypt) |
| Landing page | Completa (diseno premium) |
| Admin panel | Completo (CRUD completo) |
| Notificaciones por correo | Implementado (nodemailer, template HTML, .env) |
| Git | Inicializado, 3 commits, push a GitHub |
| Despliegue | Local solamente |
| Tests | No implementados |
| CI/CD | No implementado |
| Docker | No implementado |
| Variables de entorno | No implementado |

### 9.2 Ultimos commits

```
5e7e71b Clean: remove barber shop files, reorganize project structure
32f219e Initial commit: MediHome telemedicine platform
```

### 9.3 Remote GitHub

```
https://github.com/michaelselmo/medihome.git
```

---

## 10. ARCHIVOS TEMPORALES Y LIMPIEZA

### 10.1 Archivos que se pueden eliminar / ignorar

| Archivo | Tamano | Que hacer |
|---------|--------|-----------|
| `medihome.db` | 44 KB | BORRAR con confianza. Se recrea al iniciar. Datos demo se precargan solos. |
| `node_modules/` | 20 MB | NO BORRAR normalmente, pero se puede regenerar con `npm install` |
| `package-lock.json` | 60 KB | CONSERVAR. Es necesario para versionado exacto de dependencias. |
| `.git/` | ~400 KB | NO BORRAR. Es el repositorio Git. Sin el, no hay historial ni remote. |

### 10.2 Archivos que sobran (innecesarios)

Ninguno. Todos los archivos en el proyecto son necesarios. La estructura es minimalista.

### 10.3 Archivos grandes a considerar

- `node_modules/` (20 MB) — ya ignorado por Git, no hay problema
- `package-lock.json` (60 KB) — necesario, normal
- `index.html` (68 KB) y `admin.html` (49 KB) — grandes por CSS/JS inline. Futura mejora: separar en archivos externos
- `server.js` (20 KB, 427 lineas) — archivo unico. Separar en modulos lo reducira.

### 10.4 Optimizacion para contexto

Si se necesita reducir el tamano del proyecto para trabajar con AI o sesiones limpias:

1. **Separar `server.js`** en:
   ```
   server.js              → entry point (10 lineas)
   config/database.js     → conexion + esquema BD
   config/auth.js         → JWT config
   routes/public.js       → rutas publicas
   routes/admin.js        → rutas admin
   middleware/auth.js     → auth middleware
   ```
   Esto permite leer solo los archivos relevantes en cada sesion.

2. **Separar CSS/JS inline**:
   ```
   public/css/style.css   ← de index.html
   public/css/admin.css   ← de admin.html
   public/js/app.js       ← de index.html
   public/js/admin.js     ← de admin.html
   ```
   Los HTML pasarian de 68KB a ~20KB.

3. **Eliminar `medihome.db`** antes de compartir contexto (se recrea solo)

4. **Usar `.env`** en vez de variables hardcodeadas

---

## 11. PARA LA PROXIMA SESION

### 11.1 Posibles tareas prioritarias

1. ~~**Nodemailer:** Implementar envio de confirmacion de citas por correo~~ ✅ Hecho
2. **Mejora:** Enviar correo de confirmacion al PACIENTE (no solo al admin)
3. **Seguridad:** Mover `SECRET` de `server.js` a `.env` (ya hay soporte parcial)
4. **Separacion:** Extraer CSS/JS de HTML a archivos externos
5. **Refactor:** Separar `server.js` en modulos
6. **Testing:** Agregar tests con mocha + supertest
7. **ESLint:** Agregar configuracion de linter

### 11.2 Comandos rapidos para empezar

```bash
# Iniciar
cd ~/medihome && npm start

# Resetear BD
rm medihome.db && npm start

# Ver cambios pendientes
git status

# Commit rapido
git add -A && git commit -m "descripcion del cambio" && git push
```

### 11.3 Probar que todo funciona

```bash
# Verificar que el servidor responde
curl -s http://localhost:3000/api/servicios | head -c 200

# Verificar login
curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"admin123"}'

# Crear cita de prueba
curl -s -X POST http://localhost:3000/api/citas \
  -H "Content-Type: application/json" \
  -d '{"nombre_paciente":"Test","telefono":"809-555-0000","servicio_id":1,"fecha":"2026-06-01","hora":"10:00"}'
```

---

## 12. NOTAS ADICIONALES

### 12.1 Proyectos relacionados

| Proyecto | Ruta | Puerto | Estado |
|----------|------|--------|--------|
| medihome | ~/medihome/ | 3000 | Activo |
| mi-barberia | ~/mi-barberia/ | 8080 (python server) | Activo |
| mlb-stats | ~/mlb-stats/ | ? (ver server.js) | Sin Git aun |

### 12.2 Herramientas instaladas

- Node.js v26.0.0
- npm (viene con Node)
- Git 2.39.2
- GitHub CLI (gh) 2.92.0
- Homebrew (gestor de paquetes macOS)
- Visual Studio Code 1.120.0

### 12.3 Extensiones VS Code instaladas

ESLint, Prettier, GitHub Copilot, GitHub Pull Requests, SQLite Viewer, Live Server, REST Client, Path Intellisense, NPM Intellisense, IntelliCode, Auto Rename Tag, Color Highlight, Code Spell Checker, SQLite

---

*Fin de PROJECT_CONTEXT.md. Proximo desarrollador: lea este documento completo antes de tocar cualquier archivo.*
