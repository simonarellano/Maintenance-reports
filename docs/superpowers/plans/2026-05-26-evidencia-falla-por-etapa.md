# Evidencia fotográfica de falla por etapa — Implementation Plan

> ✅ **FINALIZADO (Sesión 24).** Implementado y verificado: evidencia por etapa (reporte/resolución) en modelo, backend, `FallaDetallePage` y PDF.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar la evidencia fotográfica de una falla en dos etapas — **al reportar** y **al resolver** — en el modelo, el backend, `FallaDetallePage` y el PDF.

**Architecture:** Una columna discriminadora `etapa` (enum `EtapaFotoFalla { reporte | resolucion }`, default `reporte`) en `fotos_falla`. El endpoint de subir acepta `etapa`; las fotos heredadas de un punto de mantenimiento quedan en `reporte`. El frontend muestra dos galerías filtradas por etapa con permisos por estado; el PDF dibuja dos bloques. Migración aditiva, sin tocar datos existentes (todos quedan `reporte`).

**Tech Stack:** Node + Express + Prisma + PostgreSQL (backend), React + Vite (frontend), pdfkit (PDF). Sin runner de pruebas automatizadas: verificación = smoke por API real (`:3001`) + `npm run build` + revisión visual.

**Spec:** [`docs/superpowers/specs/2026-05-26-evidencia-falla-por-etapa-design.md`](../specs/2026-05-26-evidencia-falla-por-etapa-design.md)

**Precauciones del proyecto:**
- Comunicación, commits y comentarios en español.
- BD de dev con datos reales: `pg_dump` previo, SQL a mano, `migrate deploy`. **Nunca** `migrate reset` / `db:seed`.
- **Detener el backend antes de `prisma generate`** (EPERM con la DLL bloqueada en Windows). Hay un backend corriendo en `:3001`.
- `prisma/migrations/` está en `.gitignore` (la migración no se versiona, igual que las anteriores).

---

## File Structure

- **Modificar** `aeromx/backend/prisma/schema.prisma` — enum `EtapaFotoFalla` + campo `etapa` en `FotoFalla`.
- **Crear** `aeromx/backend/prisma/migrations/20260526130000_foto_falla_etapa/migration.sql` — enum + columna.
- **Modificar** `aeromx/backend/src/controllers/fallas/fotosController.js` — `subir` lee/valida/persiste `etapa`.
- **Modificar** `aeromx/backend/src/services/fallasService.js` — copia de fotos del punto con `etapa: 'reporte'`.
- **Modificar** `aeromx/backend/src/controllers/fallas/pdfController.js` — `renderEvidencia` separa por etapa.
- **Modificar** `aeromx/frontend/src/api/fallasService.js` — `subirFoto(id, file, etapa)`.
- **Modificar** `aeromx/frontend/src/pages/FallaDetallePage.jsx` — dos galerías + flag de permiso + componente `GaleriaEvidencia`.

---

## Task 1: Schema + migración (enum + columna `etapa`)

**Files:**
- Modify: `aeromx/backend/prisma/schema.prisma` (enums ~línea 71; modelo `FotoFalla` ~línea 543)
- Create: `aeromx/backend/prisma/migrations/20260526130000_foto_falla_etapa/migration.sql`

- [ ] **Step 1: Respaldo de la BD**

Run (desde `aeromx/backend`):
```bash
mkdir -p backups
docker exec aeromx-postgres pg_dump -U aeromx -d aeromx > "backups/aeromx_backup_$(date +%Y%m%d_%H%M%S).sql"
```
Esperado: archivo `.sql` creado en `backups/` con tamaño > 0.

- [ ] **Step 2: Agregar el enum en `schema.prisma`**

Tras el enum `OrigenFalla` (que termina en la línea con `}` ~línea 71), agregar:

```prisma

enum EtapaFotoFalla {
  reporte
  resolucion
}
```

- [ ] **Step 3: Agregar el campo `etapa` a `FotoFalla`**

En el modelo `FotoFalla`, después de la línea `createdAt      DateTime  @default(now()) @map("created_at")` y antes de la línea en blanco que precede a `reporte ReporteFalla …`, agregar:

```prisma
  etapa          EtapaFotoFalla @default(reporte) @map("etapa")
```

El bloque de campos escalares queda:
```prisma
  fechaCaptura   DateTime? @map("fecha_captura")
  createdAt      DateTime  @default(now()) @map("created_at")
  etapa          EtapaFotoFalla @default(reporte) @map("etapa")
```

- [ ] **Step 4: Escribir la migración SQL a mano**

Crear `aeromx/backend/prisma/migrations/20260526130000_foto_falla_etapa/migration.sql` con:

```sql
-- Etapa de la evidencia fotográfica de una falla: reporte (detección) | resolucion (corrección)
CREATE TYPE "EtapaFotoFalla" AS ENUM ('reporte', 'resolucion');

ALTER TABLE "fotos_falla"
  ADD COLUMN "etapa" "EtapaFotoFalla" NOT NULL DEFAULT 'reporte';
```

- [ ] **Step 5: Detener el backend antes de migrar/generar**

Hay un backend nodemon corriendo en `:3001`. Detenerlo para evitar EPERM en `prisma generate`.
```bash
# Windows: liberar el puerto 3001 (mata el node que lo escucha)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }"
```
Esperado: el comando termina; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health` ya no responde 200.

- [ ] **Step 6: Aplicar la migración y regenerar el cliente**

Run (desde `aeromx/backend`):
```bash
npx prisma migrate deploy
npx prisma generate
```
Esperado: `migrate deploy` reporta la migración `20260526130000_foto_falla_etapa` aplicada; `generate` termina sin EPERM.

- [ ] **Step 7: Verificar la columna en la BD**

```bash
docker exec aeromx-postgres psql -U aeromx -d aeromx -c "\d fotos_falla" | grep etapa
docker exec aeromx-postgres psql -U aeromx -d aeromx -t -c "SELECT etapa, count(*) FROM fotos_falla GROUP BY etapa;"
```
Esperado: la columna `etapa` existe (tipo `EtapaFotoFalla`, default `reporte`); todas las filas existentes salen como `reporte`.

- [ ] **Step 8: Reiniciar el backend**

Run (desde `aeromx/backend`, en background):
```bash
npm run dev
```
Esperado: "AeroMX API corriendo en http://localhost:3001"; `GET /api/health` → 200.

- [ ] **Step 9: Commit**

```bash
git add aeromx/backend/prisma/schema.prisma
git commit -m "feat(fallas): etapa (reporte/resolucion) en FotoFalla

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
> Nota: `prisma/migrations/` está en `.gitignore`; el archivo de migración no entra al commit (esperado).

---

## Task 2: Backend — `subir` acepta `etapa` + copia de fotos con `etapa: 'reporte'`

**Files:**
- Modify: `aeromx/backend/src/controllers/fallas/fotosController.js` (`subir`, ~líneas 4-30)
- Modify: `aeromx/backend/src/services/fallasService.js` (`crearFalla`, `createMany` de fotos, ~líneas 115-124)

- [ ] **Step 1: `fotosController.subir` lee, valida y persiste `etapa`**

En `subir`, después de la guarda `if (!falla) return res.status(404)...` y antes de `const { key } = await storage.put(...)`, agregar la validación de etapa:

```js
    const etapa = req.body?.etapa || 'reporte'
    if (etapa !== 'reporte' && etapa !== 'resolucion') {
      return res.status(400).json({ error: 'etapa inválida (reporte | resolucion)' })
    }
```

Y en el `prisma.fotoFalla.create({ data: { ... } })`, agregar `etapa,` al objeto `data` (p. ej. tras `fechaCaptura: new Date(),`):

```js
    const foto = await prisma.fotoFalla.create({
      data: {
        reporte: { connect: { id } },
        urlArchivo: `/uploads/${key}`,
        nombreArchivo: req.file.originalname,
        tamanoBytes: req.file.size,
        usuario: { connect: { id: req.user.sub } },
        fechaCaptura: new Date(),
        etapa,
      },
    })
```

- [ ] **Step 2: `fallasService.crearFalla` etiqueta las fotos copiadas como `reporte`**

En el `createMany` que copia las fotos del punto (dentro de `if (resultadoOrigenId) { ... }`), agregar `etapa: 'reporte'` a cada fila:

```js
        await tx.fotoFalla.createMany({
          data: fotosPunto.map((f) => ({
            reporteFallaId: falla.id,
            urlArchivo:     f.urlArchivo,
            nombreArchivo:  f.nombreArchivo,
            tamanoBytes:    f.tamanoBytes,
            subidaPor:      usuarioActual.sub,
            fechaCaptura:   f.fechaCaptura,
            etapa:          'reporte',
          })),
        })
```

- [ ] **Step 3: Verificar sintaxis**

Run (desde la raíz del repo):
```bash
node --check aeromx/backend/src/controllers/fallas/fotosController.js
node --check aeromx/backend/src/services/fallasService.js
```
Esperado: sin salida (sintaxis OK). nodemon reinicia solo al guardar.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/fotosController.js aeromx/backend/src/services/fallasService.js
git commit -m "feat(fallas): subir foto con etapa; fotos heredadas del punto = reporte

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Frontend — `subirFoto(etapa)` + dos galerías en `FallaDetallePage`

**Files:**
- Modify: `aeromx/frontend/src/api/fallasService.js` (`subirFoto`, ~líneas 19-25)
- Modify: `aeromx/frontend/src/pages/FallaDetallePage.jsx`

- [ ] **Step 1: `fallasService.subirFoto` envía `etapa`**

Reemplazar el método `subirFoto`:

```js
  subirFoto: (id, file, etapa = 'reporte') => {
    const fd = new FormData()
    fd.append('foto', file)
    fd.append('etapa', etapa)
    return client.post(`/fallas/${id}/fotos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
```

- [ ] **Step 2: Simplificar el handler de subida en `FallaDetallePage`**

Reemplazar el estado de fotos a nivel página y el handler. Quitar las líneas:
```js
  // Fotos
  const fotoInputRef = useRef(null)
  const [fotoLoading, setFotoLoading] = useState(false)
```
y reemplazar `handleSubirFoto` (el bloque actual completo, ~líneas 137-151) por:

```js
  // ── Fotos ─────────────────────────────────────────────────────
  const handleSubirFoto = async (file, etapa) => {
    try {
      await fallasService.subirFoto(id, file, etapa)
      await cargarFalla()
    } catch (e) {
      setError(e.response?.data?.error || 'Error subiendo la foto')
    }
  }
```
(`handleEliminarFoto` queda igual.)

- [ ] **Step 3: Agregar el flag de permiso de evidencia de resolución**

En el bloque de permisos (tras `const puedeResolver = ...` / `const estaResuelta = ...`, ~línea 67), agregar:

```js
  // Evidencia de resolución: quien puede resolver, incluso después de resuelta
  const puedeEvidenciaResolucion = esSuper || esSoporte || esResponsable
```

- [ ] **Step 4: Reemplazar la sección "Evidencia fotográfica" por dos galerías**

Reemplazar todo el `<Card>` de "Evidencia fotográfica" (el bloque que empieza en `{/* ── Evidencia fotográfica ── */}` y termina en su `</Card>`, ~líneas 480-537) por:

```jsx
        {/* ── Evidencia fotográfica por etapa ── */}
        <GaleriaEvidencia
          titulo="Evidencia al reportar"
          icon="📸"
          fotos={(falla.fotos || []).filter((f) => (f.etapa || 'reporte') === 'reporte')}
          puedeEditar={!estaResuelta}
          onSubir={(file) => handleSubirFoto(file, 'reporte')}
          onEliminar={handleEliminarFoto}
        />
        <GaleriaEvidencia
          titulo="Evidencia al resolver"
          icon="🔧"
          fotos={(falla.fotos || []).filter((f) => f.etapa === 'resolucion')}
          puedeEditar={puedeEvidenciaResolucion}
          onSubir={(file) => handleSubirFoto(file, 'resolucion')}
          onEliminar={handleEliminarFoto}
        />
```

- [ ] **Step 5: Implementar el componente `GaleriaEvidencia`**

Al final del archivo (junto a `OrdenLink` y `FotoCard`), agregar:

```jsx
// ── Componente: galería de evidencia de una etapa ─────────────
function GaleriaEvidencia({ titulo, icon, fotos, puedeEditar, onSubir, onEliminar }) {
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      await onSubir(file)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Card padding={16} style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{
          fontSize: 11, color: T.sub, letterSpacing: '0.07em',
          textTransform: 'uppercase', fontWeight: 600,
        }}>
          {icon} {titulo}
          {fotos.length > 0 && (
            <span style={{ color: T.cyan, marginLeft: 6 }}>({fotos.length})</span>
          )}
        </div>
        {puedeEditar && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleChange}
            />
            <BtnSm
              variant="surface"
              label={loading ? 'Subiendo…' : '+ Foto'}
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            />
          </>
        )}
      </div>

      {fotos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '20px 0',
          color: T.sub, fontSize: 13,
        }}>
          Sin fotografías.{puedeEditar && ' Agrega evidencia con el botón "+ Foto".'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
        }}>
          {fotos.map((foto) => (
            <FotoCard
              key={foto.id}
              foto={foto}
              puedeEliminar={puedeEditar}
              onEliminar={() => onEliminar(foto.id)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 6: Verificar build**

Run (desde `aeromx/frontend`):
```bash
npm run build
```
Esperado: build verde (≈126 módulos), sin errores. `useRef`/`useState`/`Card`/`BtnSm`/`FotoCard` ya están importados/definidos en el archivo.

- [ ] **Step 7: Commit**

```bash
git add aeromx/frontend/src/api/fallasService.js aeromx/frontend/src/pages/FallaDetallePage.jsx
git commit -m "feat(fallas): dos galerias de evidencia (al reportar / al resolver)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: PDF — separar la galería por etapa

**Files:**
- Modify: `aeromx/backend/src/controllers/fallas/pdfController.js` (`renderEvidencia`, ~líneas 208-213)

- [ ] **Step 1: Reescribir `renderEvidencia` para dos bloques**

Reemplazar la función `renderEvidencia` completa por:

```js
function renderEvidencia(doc, falla, fotosBuffers, M, W, num) {
  const fotos = falla.fotos || []
  if (fotos.length === 0) return
  const reporte    = fotos.filter((f) => (f.etapa || 'reporte') === 'reporte')
  const resolucion = fotos.filter((f) => f.etapa === 'resolucion')

  if (reporte.length > 0) {
    ui.sectionHead(doc, num(), 'Evidencia al reportar', M, W)
    ui.evidenceGallery(doc, reporte, fotosBuffers, M, W, fmtFecha)
  }
  if (resolucion.length > 0) {
    ui.sectionHead(doc, num(), 'Evidencia al resolver', M, W)
    ui.evidenceGallery(doc, resolucion, fotosBuffers, M, W, fmtFecha)
  }
}
```

`num`, `ui.sectionHead`, `ui.evidenceGallery`, `fmtFecha` y `fotosBuffers` ya están en el scope/imports del archivo (uso idéntico al actual). `precargarFotos` ya recorre `falla.fotos` completo, así que los buffers de ambas etapas ya están precargados.

- [ ] **Step 2: Verificar sintaxis**

Run (desde la raíz del repo):
```bash
node --check aeromx/backend/src/controllers/fallas/pdfController.js
```
Esperado: sin salida.

- [ ] **Step 3: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/pdfController.js
git commit -m "feat(fallas): PDF separa evidencia por etapa (reportar / resolver)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Verificación e2e por API + cierre

**Files:** ninguno (solo verificación + docs)

- [ ] **Step 1: Smoke por API real (`:3001`)**

Con backend en `:3001`. Login `dev@aeromx.com / aeromx123` → JWT. Sobre una falla existente (p. ej. `GET /api/fallas` → tomar un `id`):

1. Subir foto de **resolución**: `POST /api/fallas/:id/fotos` (multipart) con campo `foto` = una imagen y campo `etapa` = `resolucion`. Esperado: 201, la respuesta incluye `"etapa":"resolucion"`.
   ```bash
   # ejemplo con curl (imagen de prueba cualquiera)
   curl -s -X POST "http://localhost:3001/api/fallas/<ID>/fotos" \
     -H "Authorization: Bearer <TOKEN>" \
     -F "foto=@<ruta-imagen>" -F "etapa=resolucion" | python -c "import sys,json;d=json.load(sys.stdin);print('etapa:',d.get('etapa'))"
   ```
2. Subir foto sin `etapa` → debe quedar `reporte` (default).
3. `etapa` inválida (`-F "etapa=otra"`) → **400** `"etapa inválida (reporte | resolucion)"`.
4. `GET /api/fallas/:id` → las fotos traen `etapa`; hay al menos una `reporte` y una `resolucion`.
5. `GET /api/fallas/:id/pdf` → `Content-Type: application/pdf`, empieza con `%PDF`.

Esperado: todos PASS.

- [ ] **Step 2: Limpiar fotos de prueba**

Eliminar las fotos creadas en el smoke vía la API (`DELETE /api/fallas/:id/fotos/:fotoId`) o por BD, dejando la falla como estaba. Verificar `GET /api/fallas/:id` sin las fotos de prueba.

- [ ] **Step 3: (Opcional) Verificación visual en navegador**

Frontend en `:5173`. Abrir una falla: deben verse dos galerías "📸 Evidencia al reportar" y "🔧 Evidencia al resolver", cada una con su "+ Foto" según permisos (reporte bloqueado si resuelta; resolución disponible para soporte/gerente/responsable, incluso resuelta).

- [ ] **Step 4: Actualizar CLAUDE.md**

Agregar bajo el feature de fallas una nota de "Cambios en Sesión 24 — Evidencia de falla por etapa" (resumen: enum+columna `etapa`, subir con etapa, fotos heredadas=reporte, dos galerías en `FallaDetallePage`, PDF separado; verificación). Commit aparte:

```bash
git add CLAUDE.md
git commit -m "docs(fallas): Sesion 24 — evidencia por etapa (reporte/resolucion)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

- **Cobertura de spec:**
  - §3 enum + columna `etapa` → Task 1. ✓
  - §3.3 migración aditiva (pg_dump, deploy, no reset) → Task 1 Steps 1,4-7. ✓
  - §4.1 `subir` acepta/valida/persiste `etapa` → Task 2 Step 1. ✓
  - §4.2 fotos copiadas = `reporte` → Task 2 Step 2. ✓
  - §4.3 `obtenerFalla` sin cambios (ya trae `etapa`) → no requiere tarea (verificado en Task 5 Step 1.4). ✓
  - §5.1 `subirFoto(etapa)` → Task 3 Step 1. ✓
  - §5.2 dos galerías + flag `puedeEvidenciaResolucion` + permisos por estado → Task 3 Steps 3-5. ✓
  - §6 PDF dos bloques, omite vacíos → Task 4. ✓
  - §8 `etapa` ausente tratada como `reporte` → filtros en Task 3 Step 4 (`(f.etapa || 'reporte')`) y Task 4 Step 1. ✓
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos/nombres:** `etapa` valores `'reporte'`/`'resolucion'` idénticos en schema (Task 1), backend (Task 2), frontend filtros + `subirFoto` (Task 3) y PDF (Task 4). `puedeEvidenciaResolucion` definido (Task 3 Step 3) y usado (Step 4). `GaleriaEvidencia` props (`titulo, icon, fotos, puedeEditar, onSubir, onEliminar`) coinciden entre el render (Step 4) y la definición (Step 5). `handleSubirFoto(file, etapa)` firma nueva (Step 2) usada en los `onSubir` (Step 4).
- **Nota de decisión §2 (la spec lo marca opcional):** el mapa `ETAPA_FOTO` en `tokens/design.js` se omite — las etiquetas viven inline en la página (Task 3) y el PDF (Task 4), evitando tocar el archivo de tokens. Cubre el requisito sin el opcional.
