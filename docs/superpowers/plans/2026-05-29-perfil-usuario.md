# Perfil de usuario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar `fotoUrl`, `distintivo` (callsign único) y `descripcionPuesto` al usuario, exponer `/mi-perfil` para auto-edición, y propagar foto + callsign a Header, cards de personal en O/T, firmas UI de cierre y bloque de firmas del PDF HYDRA.

**Architecture:** Migración aditiva manual (sin `migrate dev`), 4 endpoints nuevos en `routes/usuarios.js` (`GET/PATCH /me`, `POST/DELETE /:id/foto`), un middleware `requireDueñoOGerente`, multer local con límite 2MB y filtro JPG/PNG/WebP que reusa la capa `lib/storage/`. Frontend introduce un único componente `<Avatar />` en `components/ui.jsx` que reemplaza todos los círculos de iniciales actuales (Header, cards, firmas), más una página dedicada `MiPerfilPage.jsx`. El PDF extiende `signatureCard` para aceptar foto y callsign y embeber la imagen con `doc.save()/.clip()/.restore()` siguiendo el patrón de `evidenceGallery` (`pdf/ui.js:459`).

**Tech Stack:** Prisma + Postgres, Express + multer + JWT, capa storage `local|minio|s3`, pdfkit (estilo HYDRA en `backend/src/pdf/`), React 18 + react-router-dom + zustand + axios (`api/client.js`).

**Spec:** `docs/superpowers/specs/2026-05-29-perfil-usuario-design.md`

---

## File Structure

**Backend (7 archivos):**
- Modify: `aeromx/backend/prisma/schema.prisma` — 3 campos en `model Usuario`.
- Create: `aeromx/backend/prisma/migrations/<ts>_perfil_usuario/migration.sql` — `ALTER TABLE` + `CREATE UNIQUE INDEX`.
- Modify: `aeromx/backend/src/middleware/auth.js` — exportar `requireDueñoOGerente`.
- Modify: `aeromx/backend/src/routes/usuarios.js` — 4 endpoints nuevos + multer local.
- Modify: `aeromx/backend/src/controllers/usuariosController.js` — 4 handlers nuevos.
- Modify: `aeromx/backend/src/services/usuariosService.js` — `SELECT_USUARIO` extendido + whitelist en `actualizarUsuario`.
- Modify: `aeromx/backend/src/pdf/ui.js` — `signatureCard` acepta `fotoUrl`/`distintivo` + buffer map.
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js` y `aeromx/backend/src/controllers/fallas/pdfController.js` (lo que aplique) — pasar fotos firmantes al bloque de firmas.

**Frontend (10 archivos):**
- Create: `aeromx/frontend/src/pages/MiPerfilPage.jsx` — página de auto-edición.
- Modify: `aeromx/frontend/src/App.jsx` — ruta `/mi-perfil`.
- Modify: `aeromx/frontend/src/components/ui.jsx` — componente `<Avatar />`.
- Modify: `aeromx/frontend/src/components/Header.jsx` — avatar usa `<Avatar />` + click → `/mi-perfil`.
- Modify: `aeromx/frontend/src/api/usuariosService.js` — 4 métodos nuevos.
- Modify: `aeromx/frontend/src/pages/UsuariosPage.jsx` — modal de alta/edición con foto + distintivo + descripción.
- Modify: `aeromx/frontend/src/pages/CrearOTPage.jsx` — cards de personal con `<Avatar />`.
- Modify: `aeromx/frontend/src/pages/CierreOTPage.jsx` — cards + firmas con `<Avatar />`.
- Modify: `aeromx/frontend/src/pages/InspeccionPage.jsx` — cards con `<Avatar />`.
- Modify: `aeromx/frontend/src/pages/FallaDetallePage.jsx` — cards con `<Avatar />`.

**Docs (2):**
- Modify: `docs/PENDIENTES.md` — marcar #2 ✅.
- Modify: `CLAUDE.md` — bullet Sesión 27.

> **Sin tests automatizados** — el repo no tiene framework de pruebas frontend ni backend instalado. Verificación = `npm run build` + smoke `curl` con token + smoke UI manual por rol.

---

## Phase 1 — Schema + backend core (Tasks 1–6)

### Task 1: Migración aditiva del schema

**Files:**
- Modify: `aeromx/backend/prisma/schema.prisma`
- Create: `aeromx/backend/prisma/migrations/<ts>_perfil_usuario/migration.sql`

- [ ] **Step 1: Backup de la BD de dev**

```bash
cd aeromx/backend
mkdir -p backups
TS=$(date +%Y%m%d-%H%M%S)
pg_dump "$DATABASE_URL" -F p -f "backups/${TS}-pre-perfil.sql"
```

Expected: archivo `backups/<ts>-pre-perfil.sql` creado, > 0 bytes. Si `pg_dump` no está en PATH, usar el de la instalación de Postgres local.

- [ ] **Step 2: Editar `schema.prisma` — modelo `Usuario`**

Localizar `model Usuario { ... }` (línea 82 aprox). Después del campo `telefono` y antes de `activo` insertar:

```prisma
  fotoUrl            String?   @map("foto_url")
  distintivo         String?   @unique
  descripcionPuesto  String?   @map("descripcion_puesto")
```

(El bloque queda alineado con los demás campos.)

- [ ] **Step 3: Generar el SQL diff**

Detener el backend antes (Windows EPERM al regenerar cliente). Entonces:

```bash
cd aeromx/backend
TS=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_perfil_usuario
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/${TS}_perfil_usuario/migration.sql
```

Expected: archivo creado con `ALTER TABLE "usuarios" ADD COLUMN "foto_url" TEXT;`, `ALTER TABLE "usuarios" ADD COLUMN "distintivo" TEXT;`, `ALTER TABLE "usuarios" ADD COLUMN "descripcion_puesto" TEXT;`, y `CREATE UNIQUE INDEX "Usuario_distintivo_key" ON "usuarios"("distintivo");`.

Si la salida trae cambios ajenos (otro modelo modificado), abortar y revisar — el schema debe estar limpio salvo los 3 campos.

- [ ] **Step 4: Aplicar la migración**

```bash
npx prisma migrate deploy
npx prisma generate
```

Expected: `1 migration deployed`. `generate` OK sin EPERM (backend detenido).

- [ ] **Step 5: Smoke SQL**

```bash
psql "$DATABASE_URL" -c "SELECT id, nombre, foto_url, distintivo, descripcion_puesto FROM usuarios LIMIT 3;"
```

Expected: 3 filas, columnas nuevas todas `NULL`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/prisma/schema.prisma
# La carpeta prisma/migrations/ está en .gitignore — NO committear la migración.
git commit -m "feat(perfil): schema Usuario con fotoUrl, distintivo unico, descripcionPuesto"
```

> **Recordatorio:** `prisma/migrations/` está en `.gitignore` (convención del repo). El SQL queda en el servidor de dev, no en git. Si en el futuro se decide versionarlo (Frente 1 hardening), es otra tarea.

---

### Task 2: Service — `SELECT_USUARIO` extendido + whitelist en `actualizarUsuario`

**Files:**
- Modify: `aeromx/backend/src/services/usuariosService.js`

- [ ] **Step 1: Extender `SELECT_USUARIO`**

Reemplazar el bloque `SELECT_USUARIO` (líneas 13-24) por:

```js
const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  superusuario: true,
  licenciaNum: true,
  telefono: true,
  activo: true,
  ultimoAcceso: true,
  createdAt: true,
  fotoUrl: true,
  distintivo: true,
  descripcionPuesto: true,
}
```

- [ ] **Step 2: Extender `actualizarUsuario` con whitelist y normalización**

Reemplazar `actualizarUsuario` (líneas 61-79) por:

```js
const MAX_DISTINTIVO = 16
const MAX_DESCRIPCION = 200

function normDistintivo(v) {
  if (v === null) return null
  const s = String(v).trim().toUpperCase()
  if (s === '') return null
  if (s.length > MAX_DISTINTIVO) {
    throw Object.assign(new Error(`Distintivo debe ser ≤ ${MAX_DISTINTIVO} caracteres`), { code: 'VALIDATION' })
  }
  return s
}

function normDescripcion(v) {
  if (v === null) return null
  const s = String(v).trim()
  if (s === '') return null
  if (s.length > MAX_DESCRIPCION) {
    throw Object.assign(new Error(`Descripción debe ser ≤ ${MAX_DESCRIPCION} caracteres`), { code: 'VALIDATION' })
  }
  return s
}

export async function actualizarUsuario(id, data) {
  const {
    nombre, email, password, rol, licenciaNum, telefono, activo, superusuario,
    distintivo, descripcionPuesto, fotoUrl,
  } = data
  const updateData = {}
  if (nombre        !== undefined) updateData.nombre        = nombre
  if (email         !== undefined) updateData.email         = email
  if (rol           !== undefined) {
    if (!ROLES_VALIDOS.includes(rol)) {
      throw Object.assign(new Error(`rol debe ser: ${ROLES_VALIDOS.join(', ')}`), { code: 'VALIDATION' })
    }
    updateData.rol = rol
  }
  if (licenciaNum   !== undefined) updateData.licenciaNum   = licenciaNum
  if (telefono      !== undefined) updateData.telefono      = telefono
  if (activo        !== undefined) updateData.activo        = activo
  if (superusuario  !== undefined) updateData.superusuario  = Boolean(superusuario)
  if (password)                    updateData.passwordHash  = await bcrypt.hash(password, 10)
  if (distintivo        !== undefined) updateData.distintivo        = normDistintivo(distintivo)
  if (descripcionPuesto !== undefined) updateData.descripcionPuesto = normDescripcion(descripcionPuesto)
  if (fotoUrl           !== undefined) updateData.fotoUrl           = fotoUrl || null

  return prisma.usuario.update({ where: { id }, data: updateData, select: SELECT_USUARIO })
}
```

- [ ] **Step 3: Verificar arranque backend**

```bash
cd aeromx/backend
npm run dev
# Esperar "API escuchando en :3001" y matar (Ctrl-C) tras el arranque limpio
```

Expected: arranque sin error de Prisma client (nuevos campos visibles).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/services/usuariosService.js
git commit -m "feat(perfil): SELECT_USUARIO + whitelist con distintivo, descripcion, fotoUrl"
```

---

### Task 3: Middleware `requireDueñoOGerente`

**Files:**
- Modify: `aeromx/backend/src/middleware/auth.js`

- [ ] **Step 1: Agregar el helper al final del archivo**

Justo después de `requireRole`, agregar:

```js
// Permite si el id de la ruta es el del propio usuario autenticado, o si el
// usuario es gerente_soporte / superusuario.
export function requireDueñoOGerente(req, res, next) {
  const u = req.user
  if (!u) return res.status(401).json({ error: 'No autenticado' })
  const esDueño   = u.id === req.params.id
  const esGerente = u.rol === 'gerente_soporte' || u.superusuario === true
  if (esDueño || esGerente) return next()
  return res.status(403).json({ error: 'Acceso no autorizado' })
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/middleware/auth.js
git commit -m "feat(perfil): middleware requireDueñoOGerente"
```

---

### Task 4: Routes — endpoints `me` + foto + multer local

**Files:**
- Modify: `aeromx/backend/src/routes/usuarios.js`

- [ ] **Step 1: Reemplazar el archivo completo**

Sobrescribir `usuarios.js` con:

```js
import { Router } from 'express'
import multer from 'multer'
import { verifyToken, requireRole, requireDueñoOGerente } from '../middleware/auth.js'
import * as ctrl from '../controllers/usuariosController.js'

const router = Router()
router.use(verifyToken)

// Multer local: 2MB, JPG/PNG/WebP únicamente.
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : Object.assign(new Error('TIPO_FOTO_INVALIDO'), { status: 400 }), ok)
  },
})

const SOLO_GERENTE = ['gerente_soporte']

// ── Auto-servicio ───────────────────────────────────────────────
router.get('/me',    ctrl.obtenerMe)
router.patch('/me',  ctrl.actualizarMe)

// ── Lectura ─────────────────────────────────────────────────────
router.get('/',    ctrl.listar)
router.get('/:id', ctrl.obtener)

// ── Foto (dueño o gerente) ──────────────────────────────────────
router.post('/:id/foto',   requireDueñoOGerente, uploadFoto.single('foto'), ctrl.subirFoto)
router.delete('/:id/foto', requireDueñoOGerente, ctrl.eliminarFoto)

// ── Escritura (solo gerente) ────────────────────────────────────
router.post('/',      requireRole(SOLO_GERENTE), ctrl.crear)
router.put('/:id',    requireRole(SOLO_GERENTE), ctrl.actualizar)
router.delete('/:id', requireRole(SOLO_GERENTE), ctrl.desactivar)

export default router
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/routes/usuarios.js
git commit -m "feat(perfil): rutas /me y /:id/foto con multer 2MB JPG/PNG/WebP"
```

---

### Task 5: Controllers — `obtenerMe`, `actualizarMe`, `subirFoto`, `eliminarFoto`

**Files:**
- Modify: `aeromx/backend/src/controllers/usuariosController.js`

- [ ] **Step 1: Agregar imports al tope**

Después de la línea `import * as svc from '../services/usuariosService.js'` (línea 1), agregar:

```js
import { driver } from '../lib/storage/index.js'
import { generarKey, keyDesdeUrl, contentTypeDesdeKey } from '../lib/storage/helpers.js'
```

(Verifica que `storage/index.js` exporta `driver`; si exporta diferente, ajustar al nombre real — ver `lib/storage/index.js`.)

- [ ] **Step 2: Agregar handlers al final del archivo**

Justo antes de `export async function desactivar` (línea 49 aprox), insertar al final:

```js
// ── Auto-servicio (dueño) ─────────────────────────────────────
export async function obtenerMe(req, res, next) {
  try {
    const usuario = await svc.obtenerUsuario(req.user.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(usuario)
  } catch (e) { next(e) }
}

export async function actualizarMe(req, res, next) {
  try {
    // Whitelist explícita: SOLO distintivo y descripcionPuesto.
    const { distintivo, descripcionPuesto } = req.body
    const usuario = await svc.actualizarUsuario(req.user.id, { distintivo, descripcionPuesto })
    res.json(usuario)
  } catch (e) {
    if (e.code === 'VALIDATION') return res.status(400).json({ error: e.message })
    if (e.code === 'P2002')      return res.status(409).json({ error: 'Distintivo en uso' })
    if (e.code === 'P2025')      return res.status(404).json({ error: 'Usuario no encontrado' })
    next(e)
  }
}

// ── Foto (dueño o gerente — gateado en la ruta) ──────────────
export async function subirFoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'foto requerida' })

    const actual = await svc.obtenerUsuario(req.params.id)
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' })

    // Subir nueva foto al storage.
    const key = `usuarios/${req.params.id}/foto-${generarKey(req.file.originalname)}`
    await driver.put(key, req.file.buffer, contentTypeDesdeKey(key))
    const fotoUrl = `/uploads/${key}`

    // Persistir en DB.
    const usuario = await svc.actualizarUsuario(req.params.id, { fotoUrl })

    // Best-effort: borrar la key anterior si había foto previa.
    if (actual.fotoUrl) {
      const keyAntigua = keyDesdeUrl(actual.fotoUrl)
      if (keyAntigua && keyAntigua !== key) {
        driver.delete(keyAntigua).catch(() => {})
      }
    }

    res.json(usuario)
  } catch (e) {
    if (e.message === 'TIPO_FOTO_INVALIDO') return res.status(400).json({ error: 'Tipo de imagen no permitido (JPG/PNG/WebP)' })
    if (e.code === 'LIMIT_FILE_SIZE')       return res.status(400).json({ error: 'Foto excede 2MB' })
    next(e)
  }
}

export async function eliminarFoto(req, res, next) {
  try {
    const actual = await svc.obtenerUsuario(req.params.id)
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' })

    if (actual.fotoUrl) {
      const keyAntigua = keyDesdeUrl(actual.fotoUrl)
      if (keyAntigua) await driver.delete(keyAntigua).catch(() => {})
    }
    const usuario = await svc.actualizarUsuario(req.params.id, { fotoUrl: null })
    res.json(usuario)
  } catch (e) { next(e) }
}
```

> **Verificación de imports:** abrir `aeromx/backend/src/lib/storage/index.js` y confirmar el nombre exacto de la export (`driver`, `default`, `storage`, etc.). Ajustar el `import` del Step 1 al nombre real. Si la API expone `put(key, buffer, contentType)` y `delete(key)`, listo; si tiene otra firma, usar la equivalente (ver cómo `fotosController` sube fotos de inspección).

- [ ] **Step 3: Manejar Multer error central (si no existe)**

Verificar en `aeromx/backend/src/app.js` (o donde se monte el error handler de Express) que un error tipo `multer.MulterError` con `code === 'LIMIT_FILE_SIZE'` o un error con `status: 400` devuelva 400 JSON. Si no lo hace, agregar antes del handler genérico:

```js
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Archivo excede el límite' })
  if (err && err.status === 400) return res.status(400).json({ error: err.message })
  next(err)
})
```

(Si ya existe un patrón similar en el handler central, NO duplicar. Inspeccionar primero.)

- [ ] **Step 4: Verificar arranque limpio**

```bash
cd aeromx/backend && npm run dev
# Esperar arranque "API escuchando en :3001", Ctrl-C
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/controllers/usuariosController.js aeromx/backend/src/app.js
# Si app.js no se tocó, sacarlo del git add.
git commit -m "feat(perfil): controllers obtenerMe/actualizarMe/subirFoto/eliminarFoto"
```

---

### Task 6: Smoke API (curl)

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar backend**

```bash
cd aeromx/backend && npm run dev
# Mantener corriendo
```

- [ ] **Step 2: Obtener tokens de prueba**

En otra terminal, login dos usuarios distintos (gerente + técnico). El email/password de seed están en CLAUDE.md.

```bash
TOKEN_GERENTE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@aeromx.com","password":"aeromx123"}' | jq -r .token)
TOKEN_TECNICO=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tecnico@aeromx.com","password":"aeromx123"}' | jq -r .token)
echo "GERENTE=${TOKEN_GERENTE:0:20}... TECNICO=${TOKEN_TECNICO:0:20}..."
```

Expected: ambos imprimen los primeros 20 chars del JWT.

- [ ] **Step 3: GET /me y PATCH /me con gerente**

```bash
curl -s http://localhost:3001/api/usuarios/me -H "Authorization: Bearer $TOKEN_GERENTE" | jq '.distintivo, .fotoUrl, .descripcionPuesto'
# Expected: null null null (campos existen)

curl -s -X PATCH http://localhost:3001/api/usuarios/me \
  -H "Authorization: Bearer $TOKEN_GERENTE" -H 'Content-Type: application/json' \
  -d '{"distintivo":"halcon-01","descripcionPuesto":"Lead backend"}' | jq '.distintivo, .descripcionPuesto'
# Expected: "HALCON-01" "Lead backend"
```

- [ ] **Step 4: PATCH /me con distintivo en uso (técnico copia el del gerente)**

```bash
curl -s -X PATCH http://localhost:3001/api/usuarios/me \
  -H "Authorization: Bearer $TOKEN_TECNICO" -H 'Content-Type: application/json' \
  -d '{"distintivo":"HALCON-01"}' -o /dev/null -w '%{http_code}\n'
# Expected: 409
```

- [ ] **Step 5: PATCH /me con distintivo de 20 chars (validation)**

```bash
curl -s -X PATCH http://localhost:3001/api/usuarios/me \
  -H "Authorization: Bearer $TOKEN_TECNICO" -H 'Content-Type: application/json' \
  -d '{"distintivo":"AAAAAAAAAAAAAAAAAAAA"}' -o /dev/null -w '%{http_code}\n'
# Expected: 400
```

- [ ] **Step 6: Subir foto al propio**

Necesitas un JPG ≤ 2MB local. Si no tienes, crea uno:

```bash
# Si no hay imagen a mano, genera placeholder de prueba (cualquier JPG ≤ 2MB)
echo "Usa cualquier foto JPG/PNG/WebP ≤ 2MB local en /tmp/foto-test.jpg"
```

Obtener id propio del gerente:

```bash
MI_ID=$(curl -s http://localhost:3001/api/usuarios/me -H "Authorization: Bearer $TOKEN_GERENTE" | jq -r .id)

curl -s -X POST http://localhost:3001/api/usuarios/$MI_ID/foto \
  -H "Authorization: Bearer $TOKEN_GERENTE" \
  -F "foto=@/tmp/foto-test.jpg" | jq '.fotoUrl'
# Expected: "/uploads/usuarios/<MI_ID>/foto-<timestamp>.jpg"
```

- [ ] **Step 7: Subir PDF (rechazo por tipo)**

```bash
curl -s -X POST http://localhost:3001/api/usuarios/$MI_ID/foto \
  -H "Authorization: Bearer $TOKEN_GERENTE" \
  -F "foto=@/tmp/cualquier.pdf" -o /dev/null -w '%{http_code}\n'
# Expected: 400
```

- [ ] **Step 8: Subir foto ajena con técnico (403)**

```bash
OTRO_ID=$(curl -s http://localhost:3001/api/usuarios/me -H "Authorization: Bearer $TOKEN_GERENTE" | jq -r .id)
curl -s -X POST http://localhost:3001/api/usuarios/$OTRO_ID/foto \
  -H "Authorization: Bearer $TOKEN_TECNICO" \
  -F "foto=@/tmp/foto-test.jpg" -o /dev/null -w '%{http_code}\n'
# Expected: 403
```

- [ ] **Step 9: DELETE foto**

```bash
curl -s -X DELETE http://localhost:3001/api/usuarios/$MI_ID/foto \
  -H "Authorization: Bearer $TOKEN_GERENTE" | jq '.fotoUrl'
# Expected: null
```

- [ ] **Step 10: Limpiar y commit (no hay cambios — sin commit)**

Solo dejar el `distintivo` del gerente seteado a "HALCON-01" para fases siguientes. Detener backend.

---

## Phase 2 — Frontend Mi Perfil (Tasks 7–10)

### Task 7: API service frontend

**Files:**
- Modify: `aeromx/frontend/src/api/usuariosService.js`

- [ ] **Step 1: Reemplazar el archivo**

```js
import client from './client'

export const usuariosService = {
  listar: (params) =>
    client.get('/usuarios', { params }),

  obtener: (id) =>
    client.get(`/usuarios/${id}`),

  crear: (data) =>
    client.post('/usuarios', data),

  actualizar: (id, data) =>
    client.put(`/usuarios/${id}`, data),

  desactivar: (id) =>
    client.delete(`/usuarios/${id}`),

  obtenerMe: () =>
    client.get('/usuarios/me'),

  actualizarMe: (data) =>
    client.patch('/usuarios/me', data),

  subirFoto: (id, file) => {
    const fd = new FormData()
    fd.append('foto', file)
    return client.post(`/usuarios/${id}/foto`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  eliminarFoto: (id) =>
    client.delete(`/usuarios/${id}/foto`),
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/api/usuariosService.js
git commit -m "feat(perfil): usuariosService con obtenerMe/actualizarMe/subirFoto/eliminarFoto"
```

---

### Task 8: Componente `<Avatar />`

**Files:**
- Modify: `aeromx/frontend/src/components/ui.jsx`

- [ ] **Step 1: Agregar el componente al final del archivo**

Al final de `ui.jsx` (tras la última `export function`), agregar:

```jsx
// ── Avatar — foto o iniciales del usuario, con callsign opcional ──
export function Avatar({ usuario, size = 38, showCallsign = false }) {
  const url = usuario?.fotoUrl
  const initials = (usuario?.nombre || usuario?.email || '?')
    .split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div
        title={usuario?.distintivo || undefined}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: T.cD, border: `1px solid ${T.cyan}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.cyan, fontSize: Math.round(size * 0.34), fontWeight: 700,
          fontFamily: T.font, overflow: 'hidden', flexShrink: 0,
        }}
      >
        {url
          ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>
      {showCallsign && usuario?.distintivo && (
        <span style={{
          fontFamily: T.mono, fontSize: 11, color: T.cyan,
          letterSpacing: '0.05em',
        }}>{usuario.distintivo}</span>
      )}
    </div>
  )
}
```

(`T` ya está importado al tope del archivo — si no, agregar `import { T } from '../tokens/design'`.)

- [ ] **Step 2: Verificar build**

```bash
cd aeromx/frontend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/components/ui.jsx
git commit -m "feat(perfil): componente <Avatar /> en components/ui.jsx"
```

---

### Task 9: `MiPerfilPage` + ruta

**Files:**
- Create: `aeromx/frontend/src/pages/MiPerfilPage.jsx`
- Modify: `aeromx/frontend/src/App.jsx`

- [ ] **Step 1: Crear `MiPerfilPage.jsx`**

Contenido completo:

```jsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useAuthStore } from '../store/authStore'
import { usuariosService } from '../api/usuariosService'
import { T, ROL_LABELS } from '../tokens/design'
import { Avatar, Btn, BtnSm, Card, ErrorBanner, Field, Hdr, Spinner } from '../components/ui'

const MAX_FOTO_BYTES = 2 * 1024 * 1024
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp']
const MAX_DISTINTIVO = 16
const MAX_DESCRIPCION = 200

export default function MiPerfilPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser) // si no existe, ver Step 2

  const [perfil, setPerfil] = useState(null)
  const [distintivo, setDistintivo] = useState('')
  const [descripcionPuesto, setDescripcion] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await usuariosService.obtenerMe()
      setPerfil(data)
      setDistintivo(data.distintivo || '')
      setDescripcion(data.descripcionPuesto || '')
      setError('')
    } catch (e) {
      setError('Error cargando perfil')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await usuariosService.actualizarMe({
        distintivo: distintivo.trim() || null,
        descripcionPuesto: descripcionPuesto.trim() || null,
      })
      setPerfil(data)
      if (setUser) setUser(data) // refresca avatar del Header
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando perfil')
    } finally {
      setSaving(false)
    }
  }

  const onPickFile = () => fileRef.current?.click()

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reseleccionar el mismo archivo
    if (!file) return
    if (!TIPOS_OK.includes(file.type)) {
      setError('Tipo de imagen no permitido (JPG, PNG o WebP)')
      return
    }
    if (file.size > MAX_FOTO_BYTES) {
      setError('La foto excede 2MB')
      return
    }
    setUploading(true)
    try {
      const { data } = await usuariosService.subirFoto(perfil.id, file)
      setPerfil(data)
      if (setUser) setUser(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error subiendo foto')
    } finally {
      setUploading(false)
    }
  }

  const eliminarFoto = async () => {
    if (!confirm('¿Eliminar tu foto de perfil?')) return
    setUploading(true)
    try {
      const { data } = await usuariosService.eliminarFoto(perfil.id)
      setPerfil(data)
      if (setUser) setUser(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando foto')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        <Spinner />
      </main>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr title="Mi perfil" sub="Foto, distintivo y descripción" back={() => navigate('/dashboard')} />
        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* Foto */}
        <Card padding={20} style={{ marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center' }}>
          <Avatar usuario={perfil} size={120} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }} onChange={onFileSelected} />
            <BtnSm label={uploading ? 'Subiendo…' : 'Cambiar foto'} onClick={onPickFile} disabled={uploading} />
            {perfil?.fotoUrl && (
              <BtnSm label="Eliminar" onClick={eliminarFoto} disabled={uploading} />
            )}
            <div style={{ fontSize: 11, color: T.sub }}>JPG / PNG / WebP · ≤ 2MB</div>
          </div>
        </Card>

        {/* Datos públicos */}
        <Card padding={20} style={{ marginBottom: 16 }}>
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label={`Distintivo (callsign, ≤ ${MAX_DISTINTIVO})`}>
              <input
                value={distintivo}
                onChange={(e) => setDistintivo(e.target.value)}
                maxLength={MAX_DISTINTIVO}
                placeholder="HALCON-01"
                style={inputStyle()}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase() }}
              />
            </Field>
            <Field label={`Descripción del puesto (≤ ${MAX_DESCRIPCION})`}>
              <textarea
                value={descripcionPuesto}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={MAX_DESCRIPCION}
                rows={3}
                style={{ ...inputStyle(), resize: 'vertical', fontFamily: T.font }}
              />
            </Field>
            <Btn label={saving ? 'Guardando…' : 'Guardar'} type="submit" disabled={saving} />
          </form>
        </Card>

        {/* Identidad (read-only) */}
        <Card padding={20}>
          <div style={{ fontSize: 11, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Identidad
          </div>
          <RowReadonly label="Nombre"   value={perfil?.nombre} />
          <RowReadonly label="Email"    value={perfil?.email} />
          <RowReadonly label="Rol"      value={ROL_LABELS[perfil?.rol] || perfil?.rol} />
          <RowReadonly label="Licencia" value={perfil?.licenciaNum || '—'} />
          <div style={{ fontSize: 11, color: T.sub, marginTop: 12 }}>
            Solo el gerente puede modificar estos campos.
          </div>
        </Card>
      </main>
    </div>
  )
}

function RowReadonly({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.sub }}>{label}</span>
      <span style={{ fontSize: 13, color: T.text }}>{value || '—'}</span>
    </div>
  )
}

function inputStyle() {
  return {
    width: '100%',
    background: T.s0, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '10px 12px',
    color: T.text, fontSize: 14, fontFamily: T.font,
    outline: 'none',
  }
}
```

> **`setUser` del store:** revisar `aeromx/frontend/src/store/authStore.js`. Si no existe `setUser`, agregar uno que actualice `state.user` y persista a localStorage como ya hace `login`. La página tolera su ausencia (`if (setUser) setUser(data)`), pero sin él el avatar del Header NO se refrescará hasta el próximo login. Recomendado agregar el setter para UX correcta.

- [ ] **Step 2: Agregar `setUser` al `authStore` (si falta)**

Abrir `aeromx/frontend/src/store/authStore.js`. Si la store usa Zustand y ya tiene `set`, agregar dentro del `create(...)`:

```js
setUser: (user) => set((state) => {
  // Persistir como hace login(): localStorage si el patrón actual usa localStorage para `user`.
  try { localStorage.setItem('aeromx_user', JSON.stringify(user)) } catch {}
  return { user }
}),
```

(Ajustar el key de localStorage al que usa el `login` existente — leer el archivo para confirmar.)

- [ ] **Step 3: Registrar la ruta en `App.jsx`**

Agregar import después de `import PanelControlPage from './pages/PanelControlPage'`:

```jsx
import MiPerfilPage from './pages/MiPerfilPage'
```

Y antes del catch-all `/`, agregar:

```jsx
<Route
  path="/mi-perfil"
  element={
    <ProtectedRoute>
      <MiPerfilPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 4: Build**

```bash
cd aeromx/frontend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/pages/MiPerfilPage.jsx aeromx/frontend/src/App.jsx aeromx/frontend/src/store/authStore.js
git commit -m "feat(perfil): pagina /mi-perfil con foto, distintivo y descripcion"
```

---

### Task 10: Header — avatar con `<Avatar />` + click → `/mi-perfil`

**Files:**
- Modify: `aeromx/frontend/src/components/Header.jsx`

- [ ] **Step 1: Agregar import**

Agregar al tope (junto a los otros imports de `tokens/design`):

```jsx
import { Avatar } from './ui'
```

- [ ] **Step 2: Reemplazar el bloque de iniciales en desktop**

Localizar el bloque (Header.jsx:176-182 aprox):

```jsx
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: T.cD, border: `1px solid ${T.cyan}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.cyan, fontSize: 13, fontWeight: 700,
              fontFamily: T.font, flexShrink: 0,
            }}>{initials}</div>
```

…y reemplazar por:

```jsx
            <div
              onClick={() => navigate('/mi-perfil')}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              title="Mi perfil"
            >
              <Avatar usuario={user} size={38} />
            </div>
```

- [ ] **Step 3: Reemplazar el bloque de iniciales en el drawer mobile**

Localizar el bloque (Header.jsx:250-256 aprox):

```jsx
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: T.cD, border: `1px solid ${T.cyan}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.cyan, fontSize: 13, fontWeight: 700,
                flexShrink: 0,
              }}>{initials}</div>
```

…y reemplazar por:

```jsx
              <div
                onClick={() => navigate('/mi-perfil')}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Avatar usuario={user} size={40} />
              </div>
```

- [ ] **Step 4: Eliminar `initials` si queda muerto**

Si tras los reemplazos `initials` ya no se usa, borrar la constante (Header.jsx:62-63).

- [ ] **Step 5: Build**

```bash
cd aeromx/frontend && npm run build
```

Expected: PASS, sin warnings de variables no usadas.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/components/Header.jsx
git commit -m "feat(perfil): Header usa <Avatar /> + click navega a /mi-perfil"
```

---

## Phase 3 — Multi-surface (Tasks 11–13)

### Task 11: `UsuariosPage` — modal de alta/edición con foto + distintivo + descripción

**Files:**
- Modify: `aeromx/frontend/src/pages/UsuariosPage.jsx`

- [ ] **Step 1: Localizar el componente `FormUsuario` (o equivalente)**

`UsuariosPage.jsx` tiene un sub-componente que renderiza el form de alta/edición (alrededor de las líneas 250-400; busca el bloque con `useState(inicial?.…)`). Si está embebido dentro de la página, identificarlo por los `useState` de `nombre`, `email`, `password`, `rol`, `superusuario`.

- [ ] **Step 2: Agregar estados nuevos al form**

Junto a los otros `useState`, agregar:

```jsx
const [distintivo,        setDistintivo]        = useState(inicial?.distintivo || '')
const [descripcionPuesto, setDescripcionPuesto] = useState(inicial?.descripcionPuesto || '')
const [foto,              setFoto]              = useState(null) // File local pendiente de subir
```

- [ ] **Step 3: Agregar campos al JSX del form**

Después de los campos existentes (licencia, teléfono) y antes del bloque de superusuario, agregar:

```jsx
<Field label="Distintivo (callsign, ≤ 16)">
  <input
    value={distintivo}
    onChange={(e) => setDistintivo(e.target.value.toUpperCase())}
    maxLength={16}
    style={inputStyle()}
  />
</Field>
<Field label="Descripción del puesto (≤ 200)">
  <textarea
    value={descripcionPuesto}
    onChange={(e) => setDescripcionPuesto(e.target.value)}
    maxLength={200}
    rows={2}
    style={{ ...inputStyle(), resize: 'vertical', fontFamily: T.font }}
  />
</Field>
<Field label="Foto (opcional, JPG/PNG/WebP ≤ 2MB)">
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) => setFoto(e.target.files?.[0] || null)}
    style={{ fontSize: 12, color: T.sub }}
  />
</Field>
```

> Si `inputStyle()` no existe en el archivo, copiarlo del que está en `MiPerfilPage.jsx`. Si `Field` viene de `components/ui.jsx`, ya está disponible.

- [ ] **Step 4: Extender el `onSubmit`/`guardar` del form**

Localizar el handler que arma el `datos` para `usuariosService.crear`/`actualizar`. Agregar `distintivo` y `descripcionPuesto` al objeto:

```jsx
const datos = {
  nombre: nombre.trim(),
  email: email.trim().toLowerCase(),
  rol,
  superusuario,
  licenciaNum: licenciaNum.trim() || null,
  telefono:    telefono.trim() || null,
  distintivo:  distintivo.trim() || null,
  descripcionPuesto: descripcionPuesto.trim() || null,
}
```

Y, después del `await usuariosService.crear/actualizar(...)` exitoso, si hay `foto` en estado, hacer:

```jsx
if (foto) {
  await usuariosService.subirFoto(usuarioGuardado.id, foto)
}
```

(`usuarioGuardado` = lo que devuelve `crear` o `actualizar`; ajustar al nombre de variable del código existente.)

- [ ] **Step 5: Build**

```bash
cd aeromx/frontend && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/pages/UsuariosPage.jsx
git commit -m "feat(perfil): UsuariosPage admin con foto, distintivo y descripcion"
```

---

### Task 12: Cards de personal en O/T — `<Avatar />`

**Files:**
- Modify: `aeromx/frontend/src/pages/CrearOTPage.jsx`
- Modify: `aeromx/frontend/src/pages/CierreOTPage.jsx`
- Modify: `aeromx/frontend/src/pages/InspeccionPage.jsx`
- Modify: `aeromx/frontend/src/pages/FallaDetallePage.jsx`

> **Estrategia:** en cada página, identificar dónde se renderiza un usuario asignado (cards de soporte/mecánico/piloto/operador, panel lateral, listas de firmantes). Reemplazar el círculo de iniciales actual por `<Avatar usuario={u} size={32} />`. Mostrar `distintivo` debajo del nombre en mono cyan si existe.

- [ ] **Step 1: `CrearOTPage.jsx` — cards de selección de personal**

Importar:

```jsx
import { Avatar } from '../components/ui'
```

Localizar el componente que renderiza cada opción de usuario en los selectores de Soporte/Mecánico/Piloto/Operador (buscar `u.nombre` en la página). Para cada bloque de opción, reemplazar el avatar/iniciales si existe (o agregar antes del nombre):

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
  <Avatar usuario={u} size={32} />
  <div>
    <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{u.nombre}</div>
    {u.distintivo && (
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan }}>{u.distintivo}</div>
    )}
  </div>
</div>
```

Aplicar a CADA card o renglón donde aparece el nombre del usuario asignado.

- [ ] **Step 2: `CierreOTPage.jsx` — cards de personal asignado**

Mismo patrón que Step 1, aplicado a los renglones que listan `orden.soporte`, `orden.gerente`, `orden.mecanico`, `orden.piloto`, `orden.operador`, `orden.ingenieroAuxiliar`.

- [ ] **Step 3: `InspeccionPage.jsx`**

Mismo patrón. Localizar referencias a `orden.soporte`/`orden.mecanico` en el render lateral (si existen). Si no hay cards de personal en esta página, saltar.

- [ ] **Step 4: `FallaDetallePage.jsx`**

Localizar el renglón del reportante/responsable de la falla. Reemplazar.

- [ ] **Step 5: Build**

```bash
cd aeromx/frontend && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/pages/CrearOTPage.jsx \
        aeromx/frontend/src/pages/CierreOTPage.jsx \
        aeromx/frontend/src/pages/InspeccionPage.jsx \
        aeromx/frontend/src/pages/FallaDetallePage.jsx
git commit -m "feat(perfil): <Avatar /> + callsign en cards de personal de O/T y fallas"
```

---

### Task 13: Firmas UI en `CierreOTPage`

**Files:**
- Modify: `aeromx/frontend/src/pages/CierreOTPage.jsx`

- [ ] **Step 1: Localizar el bloque de firmas**

Buscar el bloque que renderiza las 4 firmas (Soporte/Gerente/Piloto/Operador) cuando `cierre` existe. Cada firma tiene nombre + rol + timestamp.

- [ ] **Step 2: Insertar `<Avatar />` con `showCallsign`**

Para cada firma, agregar al lado izquierdo del nombre:

```jsx
<Avatar usuario={firmanteUsuario} size={48} showCallsign />
```

Donde `firmanteUsuario` = el usuario que firmó (`cierre.firmaSoporte`, `cierre.firmaGerente`, etc. — confirmar el shape exacto en `obtener` de orden; si solo hay `id`/`nombre`/`rol`, agregar `fotoUrl` y `distintivo` al `select` del backend en `ordenes.controllers` para que vengan en el payload).

> **Si el payload de la orden no incluye `fotoUrl`/`distintivo` del firmante:** abrir `aeromx/backend/src/services/ordenes/cierreService.js` (o donde se hace el `findUnique` de la orden con `include`/`select` de los firmantes) y agregar `fotoUrl: true, distintivo: true` a los `select` de cada firma. Mismo patrón si los cards de personal de Task 12 no muestran foto: agregar `fotoUrl: true, distintivo: true` a los selects de `soporte`, `gerente`, `mecanico`, `piloto`, `operador` en el include.

- [ ] **Step 3: Backend — extender selects de la orden (si hace falta)**

Abrir el servicio que arma el payload de la orden detallada. Localizar el `include`/`select` de cada relación `soporte`, `gerente`, `mecanico`, `piloto`, `operador`, `ingenieroAuxiliar`, y para CADA firmante del cierre. Asegurar que en el `select` aparezcan:

```js
{ id: true, nombre: true, rol: true, fotoUrl: true, distintivo: true }
```

(licenciaNum opcional si la UI lo usa.)

- [ ] **Step 4: Build + reiniciar backend**

```bash
cd aeromx/backend && npm run dev   # arranque limpio
cd aeromx/frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/frontend/src/pages/CierreOTPage.jsx \
        aeromx/backend/src/services/ordenes
git commit -m "feat(perfil): firmas UI con <Avatar /> + callsign; backend incluye fotoUrl/distintivo de firmantes"
```

---

## Phase 4 — PDF firmas (Tasks 14–15)

### Task 14: `signatureCard` acepta `fotoUrl` y `distintivo` (con buffer)

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js`

- [ ] **Step 1: Extender la firma de `signatureCard`**

Localizar `signatureCard` (`pdf/ui.js:370`). Cambiar la firma a:

```js
// caja: { categoria, nombre, rol, licencia, fecha, fotoUrl?, distintivo? }
// buffers: Map<urlArchivo, Buffer|null> opcional (foto de perfil del firmante).
export function signatureCard(doc, x, y, w, h, caja, fmtFechaHoraFn, buffers) {
```

- [ ] **Step 2: Renderizar foto circular del firmante**

Dentro del cuerpo de `signatureCard`, antes del bloque `// línea de firma…` (línea 387), insertar:

```js
  // ── Foto circular del firmante (40px) en la esquina superior derecha ──
  const fotoR = 18
  const fotoCx = x + w - 14 - fotoR
  const fotoCy = y + 22 + fotoR
  const buf = (caja.fotoUrl && buffers) ? (buffers.get(caja.fotoUrl) || null) : null
  doc.save()
  doc.lineWidth(0.8).strokeColor(COLOR.line).circle(fotoCx, fotoCy, fotoR).stroke()
  if (buf) {
    try {
      doc.save().circle(fotoCx, fotoCy, fotoR - 0.5).clip()
      doc.image(buf, fotoCx - fotoR, fotoCy - fotoR, { fit: [fotoR * 2, fotoR * 2], align: 'center', valign: 'center' })
    } catch {
      /* swallow: imagen ilegible — sin foto */
    } finally {
      doc.restore()
    }
  } else if (caja.nombre) {
    // Fallback: iniciales centradas
    const ini = caja.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    font(doc, FONT.sansSemi).fontSize(12).fillColor(COLOR.muted)
      .text(ini, fotoCx - fotoR, fotoCy - 7, { width: fotoR * 2, align: 'center', lineBreak: false })
  }
  doc.restore()
```

- [ ] **Step 3: Renderizar callsign debajo del nombre**

Después del bloque que escribe `caja.rol` (línea 402 aprox), insertar:

```js
  if (caja.distintivo) {
    font(doc, FONT.mono).fontSize(8).fillColor(COLOR.ok)
      .text(caja.distintivo, x + 14, lineY + 33, { width: w - 28 - fotoR * 2 - 6, lineBreak: false, ellipsis: true })
  }
```

- [ ] **Step 4: Build sin errores de sintaxis**

```bash
cd aeromx/backend && node -e "import('./src/pdf/ui.js').then(()=>console.log('ok'))"
# Expected: ok
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/pdf/ui.js
git commit -m "feat(perfil): signatureCard renderiza foto circular y callsign del firmante"
```

---

### Task 15: PDF controllers — pasar `fotoUrl`/`distintivo` + buffers de firmantes

**Files:**
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`
- Modify: `aeromx/backend/src/controllers/fallas/` (el archivo del PDF de falla — confirmar nombre exacto, probablemente `fallaPdfController.js` o similar)

- [ ] **Step 1: Localizar dónde se llama `signatureCard` en el PDF de O/T**

Abrir `pdfController.js`. Buscar `signatureCard(`. Es la función que dibuja firmas; recibe `caja` = `{categoria, nombre, rol, licencia, fecha}`.

- [ ] **Step 2: Extender `caja` con `fotoUrl` y `distintivo`**

Donde se arma `caja` para cada firmante, agregar:

```js
const caja = {
  categoria: 'SOPORTE',
  nombre:    firmaSoporte?.nombre || '—',
  rol:       firmaSoporte?.rol,
  licencia:  firmaSoporte?.licenciaNum,
  fecha:     cierre?.firmaSoporteAt,
  fotoUrl:   firmaSoporte?.fotoUrl    || null,
  distintivo: firmaSoporte?.distintivo || null,
}
```

(Repetir para gerente/piloto/operador.) Si los firmantes vienen de prisma con un `select` que no incluye `fotoUrl`/`distintivo`, ampliar el select del query inicial.

- [ ] **Step 3: Cargar buffers de fotos antes de pintar firmas**

Si el código ya tiene una utilidad para cargar buffers de fotos de inspección (es lo que hace `evidenceGallery`), reusarla. Patrón típico:

```js
import { driver } from '../../lib/storage/index.js'
import { keyDesdeUrl } from '../../lib/storage/helpers.js'

async function cargarBuffers(urls) {
  const out = new Map()
  for (const u of urls) {
    if (!u) continue
    const key = keyDesdeUrl(u)
    try {
      const buf = await driver.get(key)
      out.set(u, buf)
    } catch {
      out.set(u, null)
    }
  }
  return out
}

// Antes de llamar signatureCard:
const buffersFirmas = await cargarBuffers([
  firmaSoporte?.fotoUrl, firmaGerente?.fotoUrl,
  firmaPiloto?.fotoUrl,  firmaOperador?.fotoUrl,
])
```

Y al llamar:

```js
signatureCard(doc, x, y, w, h, caja, fmtFechaHora, buffersFirmas)
```

- [ ] **Step 4: Repetir para PDF de falla**

Mismo cambio en el controller que genera el PDF de reporte de falla (busca `signatureCard` en `aeromx/backend/src/controllers/fallas/` o `aeromx/backend/src/pdf/falla*`).

- [ ] **Step 5: Smoke PDF**

Levantar backend. Generar un PDF de una O/T cerrada cuyo soporte tenga foto subida (la del Task 6 — el gerente con HALCON-01 y foto):

```bash
curl -s http://localhost:3001/api/ordenes/<ID_OT_CERRADA>/pdf \
  -H "Authorization: Bearer $TOKEN_GERENTE" \
  -o /tmp/ot-test.pdf
file /tmp/ot-test.pdf
# Expected: PDF document
```

Abrir el PDF manualmente y confirmar que el bloque de firma del gerente muestra foto circular + `HALCON-01` en monospace cyan.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/controllers
git commit -m "feat(perfil): PDF de O/T y falla embeben foto + callsign en firmas"
```

---

## Phase 5 — Cierre (Task 16)

### Task 16: Verificación E2E + actualizar PENDIENTES y CLAUDE

**Files:**
- Modify: `docs/PENDIENTES.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Smoke UI completo**

Levantar backend + frontend.

1. Login `dev@aeromx.com` → ir a `/mi-perfil`.
2. Subir foto JPG ≤ 2MB → confirmar avatar grande se actualiza.
3. Escribir distintivo `RAYO-99` y descripción `Testing perfil`. Guardar.
4. Click avatar del Header → vuelve a `/mi-perfil` y muestra cambios.
5. Ir a Dashboard → abrir una O/T cerrada → confirmar foto + callsign en cards y firmas.
6. Generar PDF de esa O/T → confirmar foto + callsign en bloque de firma del gerente.
7. Logout / login `tecnico@aeromx.com` → ir a `/mi-perfil` → subir foto propia. Intentar visitar URL `/usuarios` directo → redirect (técnico no es admin).
8. Login `dev@` → UsuariosPage → editar al técnico → cambiar su distintivo → guardar. Verificar persistencia.

Documentar cualquier fallo. Si todo OK, continuar.

- [ ] **Step 2: Marcar #2 en `docs/PENDIENTES.md`**

Cambiar la cabecera (línea 38 aprox):

```markdown
## 2. Configuraciones de usuario (perfil)
```

por:

```markdown
## 2. Configuraciones de usuario (perfil) ✅ COMPLETADO 2026-05-29
```

Al final de la sección (antes del separador `---`), agregar:

```markdown
**Implementado:** 3 campos en `Usuario` (`fotoUrl`, `distintivo` único, `descripcionPuesto`), página `/mi-perfil` para auto-edición, 4 endpoints (`GET/PATCH /api/usuarios/me`, `POST/DELETE /api/usuarios/:id/foto`), componente `<Avatar />` en uso en Header, cards O/T (4 páginas), firmas UI y PDF de O/T + falla. Spec `docs/superpowers/specs/2026-05-29-perfil-usuario-design.md`, plan `docs/superpowers/plans/2026-05-29-perfil-usuario.md`.
```

- [ ] **Step 3: Agregar entrada en `CLAUDE.md` (sección "Completado y verificado")**

Después del bullet "Panel de control (Sesión 26)" agregar:

```markdown
- **Perfil de usuario** (Sesión 27): `fotoUrl`, `distintivo` (callsign único, ≤ 16 chars upper) y `descripcionPuesto` en `Usuario`. Página `/mi-perfil` auto-edición. 4 endpoints (`GET/PATCH /api/usuarios/me`, `POST/DELETE /api/usuarios/:id/foto`) con multer 2MB JPG/PNG/WebP + middleware `requireDueñoOGerente`. Componente `<Avatar />` reusa avatar + iniciales fallback; presente en Header, cards de personal en O/T (CrearOT/Cierre/Inspeccion/FallaDetalle), firmas UI cierre y bloque de firmas del PDF HYDRA (foto circular + callsign mono cyan). Verificado: smoke API curl + smoke UI por rol + `npm run build` + PDF inspección manual.
```

- [ ] **Step 4: Build final + commit**

```bash
cd aeromx/frontend && npm run build  # PASS
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add docs/PENDIENTES.md CLAUDE.md
git commit -m "docs(perfil): marcar #2 PENDIENTES como completado + nota Sesion 27"
```

---

## Notas para el ejecutor

- **Backup obligatorio antes de migrar:** Task 1 Step 1 hace `pg_dump`. NO saltarse.
- **`prisma/migrations/` está en `.gitignore`:** la migración del Task 1 NO se commitea. Es convención del repo (Frente 1 podría cambiarla más tarde).
- **`prisma generate` con backend detenido:** EPERM Windows.
- **Verificar nombre de export del storage driver:** Task 5 Step 1 importa `driver` desde `lib/storage/index.js`. Leer el archivo y ajustar al nombre real (`driver`, `default`, etc.) antes de seguir.
- **`setUser` en authStore:** Task 9 Step 2 lo agrega si falta. Sin él el avatar del Header no se refresca hasta logout/login.
- **Foto pública:** `GET /uploads/:key` sigue sin auth (Frente 1 pendiente). Es decisión del spec: NO se endurece en este alcance.
- **Sin tests automatizados:** frontend no tiene framework de tests; backend tampoco. Verificación = `npm run build` + smoke curl + smoke UI + PDF manual.
- **Phases independientes:** se puede pausar entre fases sin romper nada. Phase 1 deja API funcional (sin UI). Phase 2 deja `/mi-perfil` funcional (sin propagación). Phase 3 propaga a UI. Phase 4 propaga a PDF. Phase 5 cierra docs.
- **`signatureCard` cambia firma:** el séptimo parámetro `buffers` es opcional. Los call-sites que NO lo pasen siguen funcionando (sin foto, fallback a iniciales). Esto permite que Phase 4 sea incremental.
- **No agregar avatar a entidades que no son usuarios** (productos, modelos, formatos). Solo a usuarios reales.
