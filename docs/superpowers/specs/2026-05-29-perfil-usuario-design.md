# Spec — Perfil de usuario (foto, distintivo, descripción)

**Fecha:** 2026-05-29
**Origen:** `docs/PENDIENTES.md` #2
**Tipo:** Feature con migración aditiva + endpoints nuevos + UI multi-surface
**Riesgo:** Medio (migración Postgres + subida de archivos + 6 puntos de UI tocados)

## 1. Propósito

Que cada usuario tenga un perfil con **foto**, **distintivo** (callsign corto) y **descripción de puesto**. El perfil es editable por el propio dueño o por el gerente de soporte. La foto y el callsign se muestran en el avatar del Header, en las cards de personal de las O/T, en el bloque de firmas de cierre y en el PDF generado (firmas).

## 2. Decisiones lockeadas (brainstorming Sesión B)

| Decisión | Valor |
|---|---|
| Qué es "distintivo" | **Callsign / indicativo corto** (string ≤ 16 chars, ej. `HALCÓN-01`) |
| Quién edita perfil ajeno | Dueño + gerente_soporte (+ superusuario por bypass) |
| Surfaces que muestran foto/callsign | Header, cards O/T, firmas UI, PDF firmas |
| Restricciones foto | JPG/PNG/WebP, ≤ 2MB, **sin resize** backend (CSS dimensiona) |
| Ruta de perfil | `/mi-perfil` (página dedicada, no modal) |
| Distintivo único | Sí — `@unique` en schema |

## 3. Schema — `Usuario`

Agregar tres campos opcionales a `model Usuario` en `aeromx/backend/prisma/schema.prisma`:

```prisma
fotoUrl            String?  @map("foto_url")           // "/uploads/<key>" o null
distintivo         String?  @unique                    // callsign único, persistido upper-case, ≤ 16 chars
descripcionPuesto  String?  @map("descripcion_puesto") // texto libre, ≤ 200 chars
```

**Notas:**
- `distintivo` `@unique` global. En Postgres `UNIQUE` ignora NULLs → varios usuarios sin distintivo coexisten.
- Migración **aditiva**, columnas `NULL`-ables, sin default no-null → no requiere backfill.

## 4. Migración

Flujo manual (gotcha CLAUDE.md: `prisma migrate dev` no funciona sin TTY).

1. **Backup:** `pg_dump` a `aeromx/backend/backups/<ts>-pre-perfil.sql` (gitignored).
2. **Generar SQL diff:**
   ```bash
   cd aeromx/backend
   npx prisma migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/<ts>_perfil_usuario/migration.sql
   ```
3. **Revisar el SQL** generado (debe ser solo `ALTER TABLE usuarios ADD COLUMN …` × 3 + `CREATE UNIQUE INDEX` sobre `distintivo`).
4. **Detener backend** (EPERM Windows).
5. **Aplicar:** `npx prisma migrate deploy`.
6. **Regenerar cliente:** `npx prisma generate`.
7. **Reiniciar backend.**

## 5. Backend

### 5.1 Capa storage (sin cambios estructurales)

Reuso de `backend/src/lib/storage/` (driver `local`/`minio`/`s3`). Key de foto de perfil:

```
usuarios/<userId>/foto-<timestamp>.<ext>
```

`urlArchivo` se persiste como `/uploads/<key>` (mismo patrón que `FotoInspeccion`).

### 5.2 Middleware

Agregar a `backend/src/middleware/auth.js`:

```js
// Permite si el id de la ruta es el del propio usuario, o si es gerente/super.
export function requireDueñoOGerente(req, res, next) {
  const u = req.user
  if (!u) return res.status(401).json({ error: 'No autenticado' })
  const esDueño  = u.id === req.params.id
  const esGerente = u.rol === 'gerente_soporte' || u.superusuario === true
  if (esDueño || esGerente) return next()
  return res.status(403).json({ error: 'No autorizado' })
}
```

### 5.3 Rutas — `backend/src/routes/usuarios.js`

Estado deseado del router (orden importa — `me` antes de `:id`):

```js
const router = Router()
router.use(verifyToken)

// Auto-servicio
router.get('/me',        ctrl.obtenerMe)
router.patch('/me',      ctrl.actualizarMe)

// Lectura — cualquier autenticado
router.get('/',    ctrl.listar)
router.get('/:id', ctrl.obtener)

// Foto — dueño o gerente
router.post('/:id/foto',   requireDueñoOGerente, upload.single('foto'), ctrl.subirFoto)
router.delete('/:id/foto', requireDueñoOGerente, ctrl.eliminarFoto)

// Escritura — solo gerente
router.post('/',      requireRole(SOLO_GERENTE), ctrl.crear)
router.put('/:id',    requireRole(SOLO_GERENTE), ctrl.actualizar)
router.delete('/:id', requireRole(SOLO_GERENTE), ctrl.desactivar)
```

**Multer (definido al tope del archivo, igual que `routes/ordenes.js`):**

```js
import multer from 'multer'
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },           // 2MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('TIPO_FOTO_INVALIDO'), ok)
  },
})
```

Mapeo de error → 400: si `err.message === 'TIPO_FOTO_INVALIDO'` o `err.code === 'LIMIT_FILE_SIZE'`, devolver 400 con mensaje específico (manejar en el handler de error central o try/catch del controller).

### 5.4 Controllers — `backend/src/controllers/usuariosController.js`

Cuatro handlers nuevos:

- **`obtenerMe(req, res)`** — devuelve el usuario actual completo (con `fotoUrl`, `distintivo`, `descripcionPuesto`).
- **`actualizarMe(req, res)`** — acepta SOLO `{ distintivo?, descripcionPuesto? }`. Llama `svc.actualizarUsuario(req.user.id, body)` con whitelist. NO permite tocar `rol`, `email`, `password`, `activo`, `licenciaNum`, `superusuario`, `fotoUrl` (foto va por endpoint dedicado).
- **`subirFoto(req, res)`** — lee `req.file.buffer`, genera key, sube vía driver, persiste `fotoUrl = '/uploads/<key>'`. Si el usuario ya tenía foto previa: borrar la key antigua (best-effort, ignorar error de borrado).
- **`eliminarFoto(req, res)`** — borra key del storage, setea `fotoUrl = null`. Si no había foto → 204 sin error.

### 5.5 Service — `backend/src/services/usuariosService.js`

Extender `actualizarUsuario`:
- Whitelist explícita de campos: solo aplicar las claves recibidas. Cuando vengan `distintivo`/`descripcionPuesto`/`fotoUrl`, normalizar:
  - `distintivo`: `.trim().toUpperCase()`. Si queda vacío → `null`. Si `> 16` chars → throw `{ code: 'VALIDATION', message: 'Distintivo > 16 chars' }`.
  - `descripcionPuesto`: `.trim()`. Si vacío → `null`. Si `> 200` chars → throw VALIDATION.
- Si `prisma` lanza `P2002` sobre `distintivo` → propagar (controller ya mapea a 409 con mensaje "Distintivo en uso").

### 5.6 PDF — `backend/src/pdf/`

En `pdf/ui.js`, en el bloque de firma (función actual que dibuja firma + nombre + rol):
- Si `usuario.fotoUrl` existe → cargar buffer vía driver de storage (NO HTTP, mismo patrón que fotos de inspección actuales), insertar con `doc.image(buffer, x, y, { fit: [40, 40] })` recortada en círculo (mask con `doc.circle().clip()`).
- Si no → círculo con iniciales (replicar look del Header avatar).
- Debajo del nombre, si `usuario.distintivo`, escribir línea `mono` color cyan: `${distintivo}`.

Esta es la única edición de PDF (firmas en O/T y firmas en reporte de falla — usan la misma primitiva).

## 6. Frontend

### 6.1 Componente `<Avatar />` — nuevo en `components/ui.jsx`

```jsx
export function Avatar({ usuario, size = 38, showCallsign = false }) {
  const url = usuario?.fotoUrl
  const initials = (usuario?.nombre || usuario?.email || '?')
    .split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        title={usuario?.distintivo || undefined}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: T.cD, border: `1px solid ${T.cyan}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.cyan, fontSize: Math.round(size * 0.34), fontWeight: 700,
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {url
          ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>
      {showCallsign && usuario?.distintivo && (
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: '0.05em' }}>
          {usuario.distintivo}
        </span>
      )}
    </div>
  )
}
```

Usado en: Header (size 38), cards de personal en O/T (size 32), firmas UI cierre (size 48 + `showCallsign`), MiPerfilPage (size 120).

### 6.2 `MiPerfilPage.jsx` — nueva en `pages/`

Ruta: `/mi-perfil`. Acceso: cualquier autenticado (ver su propio perfil).

Secciones verticales:

1. **Foto** — `<Avatar size={120} />` + botones "Cambiar foto" (input file oculto, mime accept) y "Eliminar". Validación cliente: tipo y tamaño antes de subir.
2. **Datos públicos** — form con dos campos:
   - `distintivo`: `<input type="text" maxLength={16} style={{ textTransform: 'uppercase' }} />`.
   - `descripcionPuesto`: `<textarea maxLength={200} rows={3} />`.
   Botón "Guardar" → `PATCH /api/usuarios/me`.
3. **Identidad (read-only)** — bloque con `nombre`, `email`, `rol`, `licenciaNum` y nota: "Solo el gerente puede modificar estos campos."

Estado: errores inline por sección (banner local). Loading durante upload.

### 6.3 Header — `components/Header.jsx`

- Reemplazar el bloque actual de iniciales (líneas ~176-182) por `<Avatar usuario={user} size={38} />` (desktop y mobile).
- Hacer el avatar clickeable: `onClick={() => navigate('/mi-perfil')}`. Cursor pointer.
- Mantener el bloque `nombre + rol` a la izquierda del avatar como hoy (desktop).

### 6.4 `UsuariosPage.jsx` (gerente) — modal alta/edición extendido

Agregar al form interno (componente local):
- Input `distintivo` (mismo formato que en MiPerfilPage).
- Textarea `descripcionPuesto`.
- Input file `foto` (opcional). Si seleccionado al alta o edición → tras guardar, hacer `POST /:id/foto`.

El handler `guardar` queda secuencial: primero `crear/actualizar` (JSON), luego, si hay file en estado, `subirFoto(id, file)`.

### 6.5 Cards de personal en O/T — `CrearOTPage`, `CierreOTPage`, `InspeccionPage`, `FallaDetallePage`

Cualquier card que hoy renderiza nombre + rol de un usuario asignado, sustituir el bloque inicial-iniciales-circular por `<Avatar usuario={…} size={32} />` y, si hay `distintivo`, mostrarlo en monospace cyan debajo del nombre.

No agregar avatar a entidades que no son usuario (productos, modelos, etc.).

### 6.6 Firmas UI en `CierreOTPage`

Bloque de firmas (Soporte / Gerente / Piloto u Operador):
- `<Avatar usuario={firmante} size={48} showCallsign />` al lado izquierdo.
- A la derecha: nombre + rol + fecha de firma (texto actual).

### 6.7 API service — `frontend/src/api/usuariosService.js`

Agregar:

```js
export const usuariosService = {
  // …existentes…
  obtenerMe:       ()             => api.get('/usuarios/me'),
  actualizarMe:    (body)         => api.patch('/usuarios/me', body),
  subirFoto:       (id, file)     => {
    const fd = new FormData(); fd.append('foto', file)
    return api.post(`/usuarios/${id}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' }})
  },
  eliminarFoto:    (id)           => api.delete(`/usuarios/${id}/foto`),
}
```

### 6.8 `App.jsx`

Agregar antes del catch-all `/`:

```jsx
<Route path="/mi-perfil" element={<ProtectedRoute><MiPerfilPage /></ProtectedRoute>} />
```

## 7. Permisos (resumen tabular)

| Acción | Dueño | Gerente / super | Ingeniero | Otros roles |
|---|:-:|:-:|:-:|:-:|
| Ver `/mi-perfil` propio | ✓ | ✓ | ✓ | ✓ |
| `PATCH /me` (distintivo, descripción) | ✓ | ✓ | ✓ | ✓ |
| `POST /:id/foto` con `:id === self` | ✓ | ✓ | ✓ | ✓ |
| `POST /:id/foto` con `:id` ajeno | — | ✓ | — | — |
| `PUT /:id` (campos completos) | — | ✓ (hoy) | — | — |

## 8. Verificación

1. **Migración:** `pg_dump` → diff SQL inspeccionado → `migrate deploy` → `prisma generate` → smoke `SELECT foto_url, distintivo, descripcion_puesto FROM usuarios LIMIT 1;` → columnas presentes, todas NULL.
2. **API (curl con token gerente):**
   - `GET /api/usuarios/me` → 200, campos nuevos presentes.
   - `PATCH /api/usuarios/me` `{"distintivo":"halcon-01"}` → 200, valor persistido `HALCON-01`.
   - `PATCH` con `distintivo` duplicado → 409.
   - `PATCH` con `distintivo` de 20 chars → 400 VALIDATION.
   - `POST /api/usuarios/<otro>/foto` como dueño-no-gerente → 403.
   - `POST /api/usuarios/<self>/foto` archivo PDF → 400.
   - `POST` archivo JPG 3MB → 400.
   - `POST` archivo JPG 0.5MB → 200, `fotoUrl` poblado, archivo en MinIO/local.
   - `DELETE /api/usuarios/<self>/foto` → 200, `fotoUrl` null.
3. **Frontend:** `cd aeromx/frontend && npm run build` limpio.
4. **Smoke UI:** login `dev@`, ir a `/mi-perfil`, subir foto, escribir distintivo. Refrescar → foto en Header + cards O/T existentes + firmas UI. Editar O/T existente, ver Avatar en cards de personal.
5. **PDF:** generar PDF de O/T cerrada con firmantes que tengan foto+distintivo → ambos visibles en bloques de firma.
6. **Permisos UI:** login `tecnico@`, intentar editar perfil de otro desde el UsuariosPage → no debería tener acceso a UsuariosPage (sin cambios). Visitar `/mi-perfil` propio → funciona.

## 9. Fuera de alcance

- Auth en `GET /uploads/:key` (Frente 1 hardening, separado).
- Crop/resize de foto al subir (CSS la dimensiona).
- Histórico de cambios del perfil.
- Notificaciones cuando un perfil cambia.
- Catálogo de íconos o equipos (Callsign suficiente).
- Avatar tipo iniciales con color hash por rol (queda con look cyan/gris actual).
- Mostrar distintivo en lugares que NO sean Header/cards O/T/firmas UI/PDF (ej. Dashboard tabla, FallasPage listado).
- Endurecimiento de permisos backend más allá de `requireDueñoOGerente` para foto.

## 10. Archivos tocados

**Backend (7):**
- `prisma/schema.prisma`
- `prisma/migrations/<ts>_perfil_usuario/migration.sql` (nuevo)
- `src/routes/usuarios.js`
- `src/controllers/usuariosController.js`
- `src/services/usuariosService.js`
- `src/middleware/auth.js` (`requireDueñoOGerente` nuevo)
- `src/pdf/ui.js` (bloque firma)

**Frontend (10):**
- `src/pages/MiPerfilPage.jsx` (nuevo)
- `src/App.jsx`
- `src/components/Header.jsx`
- `src/components/ui.jsx` (`<Avatar />` nuevo)
- `src/pages/UsuariosPage.jsx`
- `src/pages/CrearOTPage.jsx`
- `src/pages/CierreOTPage.jsx`
- `src/pages/InspeccionPage.jsx`
- `src/pages/FallaDetallePage.jsx`
- `src/api/usuariosService.js`
