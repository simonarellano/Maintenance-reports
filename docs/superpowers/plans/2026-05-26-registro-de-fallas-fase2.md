# Registro de Fallas — Fase 2: Disparo automático desde mantenimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde un punto de mantenimiento con defecto (`requiere_atencion` / `correcto_con_danos`), crear un `ReporteFalla` pre-llenado en un modal, copiando las fotos del punto y dejando un badge de falla(s) asociada(s) en el punto.

**Architecture:** El modelo de datos (Fase 1) ya soporta `origen = mantenimiento` con `ordenOrigenId`/`resultadoOrigenId`, y `crearFalla` ya auto-llena `refDocCorrectivo` del cierre. Esta fase agrega: (1) copia de fotos del punto a `fotos_falla` (comparten key de storage, no se duplica el binario), (2) inclusión de `reportesFalla` en `obtenerOrden` para el badge, y (3) la UI en `InspeccionPage` (botón + modal pre-llenado + badge). **Sin migración** — el schema ya tiene todas las relaciones.

**Tech Stack:** Node + Express + Prisma (backend), React + Vite (frontend). Sin runner de pruebas automatizadas: verificación = smoke por API real (`:3001`) + `npm run build` + revisión visual, igual que sesiones previas.

**Reglas / precauciones del proyecto:**
- Comunicación, commits y código-comentarios en español.
- BD de dev tiene datos reales: **nunca** `migrate reset` / `db:seed`. Esta fase no migra.
- Backend suele correr vía nodemon; revisar `GET /api/health` antes de `npm run dev`.

---

## File Structure

- **Modificar** `aeromx/backend/src/services/fallasService.js` — `crearFalla`: copiar fotos del punto de origen dentro de la transacción.
- **Modificar** `aeromx/backend/src/services/ordenesService.js` — `obtenerOrden`: incluir `reportesFalla` en el include de `resultados`.
- **Modificar** `aeromx/frontend/src/pages/InspeccionPage.jsx` — estado + carga de formatos-falla/categorías, botón "Crear reporte de falla" + badge en `FilaPunto`, nuevo componente `CrearFallaDesdePunto`.

No se crean archivos nuevos. `fallasService.js` (frontend) ya expone `crear`; `formatosService.listar({ tipoProducto, tipoFormato })` y `categoriasFallaService.listar()` ya existen.

---

## Task 1: Backend — copiar fotos del punto al crear falla desde mantenimiento

**Files:**
- Modify: `aeromx/backend/src/services/fallasService.js` (dentro de `crearFalla`, transacción, ~líneas 92-123)

- [ ] **Step 1: Agregar la copia de fotos dentro de la transacción**

En `crearFalla`, dentro del `prisma.$transaction(async (tx) => { ... })`, justo **después** de crear `falla` y **antes** del bloque `if (ordenOrigenId) { ... }`, insertar:

```js
    // Copiar fotos del punto de origen (origen = mantenimiento).
    // Comparten la misma key de storage que la FotoInspeccion — no se duplica el binario.
    if (resultadoOrigenId) {
      const fotosPunto = await tx.fotoInspeccion.findMany({ where: { resultadoId: resultadoOrigenId } })
      if (fotosPunto.length > 0) {
        await tx.fotoFalla.createMany({
          data: fotosPunto.map((f) => ({
            reporteFallaId: falla.id,
            urlArchivo:     f.urlArchivo,
            nombreArchivo:  f.nombreArchivo,
            tamanoBytes:    f.tamanoBytes,
            subidaPor:      usuarioActual.sub,
            fechaCaptura:   f.fechaCaptura,
          })),
        })
      }
    }
```

- [ ] **Step 2: Verificar que el backend levanta sin errores de Prisma**

Detener nodemon si hace falta; `npm run dev` en `aeromx/backend`. Esperado: arranca en `:3001` sin error de schema. (Verificación funcional completa en Task 5.)

- [ ] **Step 3: Commit**

```bash
git add aeromx/backend/src/services/fallasService.js
git commit -m "feat(fallas): copiar fotos del punto al crear falla desde mantenimiento"
```

---

## Task 2: Backend — incluir reportesFalla en obtenerOrden

**Files:**
- Modify: `aeromx/backend/src/services/ordenesService.js` (`obtenerOrden`, include de `resultados`, ~líneas 201-213)

- [ ] **Step 1: Agregar el include de reportesFalla**

En `obtenerOrden`, dentro de `resultados.include`, agregar tras la línea `fotos: true,`:

```js
          reportesFalla: { select: { id: true, numeroFalla: true, estado: true, severidad: true } },
```

El bloque resultante queda:

```js
      resultados: {
        include: {
          punto: { include: { seccion: true } },
          firmante: { select: { id: true, nombre: true } },
          asignado:      { select: { id: true, nombre: true, rol: true } },
          firmaTareaPor: { select: { id: true, nombre: true } },
          fotos: true,
          reportesFalla: { select: { id: true, numeroFalla: true, estado: true, severidad: true } },
          revisiones: {
            orderBy: { createdAt: 'desc' },
            include: { solicitante: { select: { id: true, nombre: true, rol: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
```

- [ ] **Step 2: Verificar respuesta**

Con el backend corriendo y un token de `dev@aeromx.com`, `GET /api/ordenes/:id` de una orden debe devolver cada `resultado` con un array `reportesFalla` (vacío si no tiene). Verificación detallada en Task 5.

- [ ] **Step 3: Commit**

```bash
git add aeromx/backend/src/services/ordenesService.js
git commit -m "feat(fallas): incluir reportesFalla en obtenerOrden (badge por punto)"
```

---

## Task 3: Frontend — botón "Crear reporte de falla" + badge en FilaPunto + wiring

**Files:**
- Modify: `aeromx/frontend/src/pages/InspeccionPage.jsx`

- [ ] **Step 1: Importar servicios de fallas, formatos y categorías**

En la cabecera de imports (junto a `usuariosService` en línea 5) agregar:

```js
import { fallasService } from '../api/fallasService'
import { formatosService } from '../api/formatosService'
import { categoriasFallaService } from '../api/categoriasFallaService'
import { SEVERIDAD, ESTADO_FALLA } from '../tokens/design'
```

(El import de `../tokens/design` de la línea 7 ya trae otros tokens; agrega `SEVERIDAD, ESTADO_FALLA` a **esa** lista en vez de duplicar el import si prefieres — ambas formas compilan. Si lo agregas a la línea 7, no añadas la 4ª línea de arriba.)

- [ ] **Step 2: Estado y handlers para el modal de falla en el componente `InspeccionPage`**

Tras la línea `const [soloMisTareas, setSoloMisTareas] = useState(false)` (línea 48) agregar:

```js
  const [fallaPara, setFallaPara] = useState(null)      // resultado para el que se crea la falla
  const [catalogoFalla, setCatalogoFalla] = useState({ formatos: [], categorias: [] })

  const abrirCrearFalla = async (resultado) => {
    setFallaPara(resultado)
    try {
      const tipo = orden?.producto?.tipoProducto
      const [fmt, cats] = await Promise.all([
        formatosService.listar({ tipoProducto: tipo, tipoFormato: 'falla' }),
        categoriasFallaService.listar(),
      ])
      setCatalogoFalla({ formatos: fmt.data || [], categorias: cats.data || [] })
    } catch (e) {
      console.error(e)
      setCatalogoFalla({ formatos: [], categorias: [] })
    }
  }

  const crearFallaDesdePunto = async (payload) => {
    await fallasService.crear(payload)
    setFallaPara(null)
    await cargarOrden()   // refresca para mostrar el badge en el punto
  }
```

- [ ] **Step 3: Pasar las props nuevas a `FilaPunto`**

Localizar el render de `<FilaPunto ... />` (buscar `resultado={` en el JSX que mapea los resultados de cada sección) y agregar dos props:

```jsx
              onCrearFalla={abrirCrearFalla}
              puedeCrearFalla={!inspeccionBloqueada}
```

Nota: `inspeccionBloqueada` ya se usa en el archivo para `soloLectura`; reutilízalo. Si la variable de bloqueo tiene otro nombre en el scope del map, usa la misma que alimenta `soloLectura` de esa `FilaPunto`.

- [ ] **Step 4: Recibir las props nuevas en la firma de `FilaPunto`**

En la línea 1185, agregar `onCrearFalla, puedeCrearFalla` a los parámetros destructurados:

```js
function FilaPunto({ index, resultado, soloLectura, onCambiar, onFirmar, onSubirFoto, onEliminarFoto, puedeRevisar, onPedirRevision, onResolverRevision, puedeAsignar, involucrados, currentUserId, onAsignar, onFirmarTarea, onCrearFalla, puedeCrearFalla }) {
```

- [ ] **Step 5: Calcular flags de falla dentro de `FilaPunto`**

Tras `const estadoMeta = PUNTO_STATUS[resultado.estadoResultado] || null` (línea 1260) agregar:

```js
  const esDefecto = REQUIERE_OBSERVACION.includes(resultado.estadoResultado)
  const fallas = resultado.reportesFalla || []
```

- [ ] **Step 6: Badge de falla(s) asociada(s) en la celda Componente**

En la celda "Componente", dentro del `<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>` (línea 1275, junto a los badges Crítico / Foto obligatoria), agregar al final del div:

```jsx
          {fallas.map((f) => (
            <span
              key={f.id}
              onClick={() => window.open(`/fallas/${f.id}`, '_blank')}
              title={`Ver ${f.numeroFalla}`}
              style={{
                cursor: 'pointer',
                fontSize: 9, fontWeight: 700,
                color: (SEVERIDAD[f.severidad]?.color) || T.amber,
                background: `${(SEVERIDAD[f.severidad]?.color) || T.amber}1A`,
                padding: '2px 7px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              ⚠ {f.numeroFalla}
            </span>
          ))}
```

- [ ] **Step 7: Botón "Crear reporte de falla"**

En la celda Componente, después del bloque de revisiones (tras el `.map` de `resultado.revisiones` que cierra ~línea 1330+), agregar el botón condicionado a defecto:

```jsx
        {esDefecto && puedeCrearFalla && (
          <button
            type="button"
            onClick={() => onCrearFalla(resultado)}
            style={{
              marginTop: 6,
              fontSize: 10, fontWeight: 700,
              color: T.amber, background: 'transparent',
              border: `1px solid ${T.amber}66`, borderRadius: 6,
              padding: '4px 8px', cursor: 'pointer',
            }}
          >
            ⚠ Crear reporte de falla
          </button>
        )}
```

- [ ] **Step 8: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build verde (sin errores de imports/sintaxis). El modal se agrega en Task 4 — `fallaPara` aún no se renderiza, pero el código compila.

- [ ] **Step 9: Commit**

```bash
git add aeromx/frontend/src/pages/InspeccionPage.jsx
git commit -m "feat(fallas): badge y botón de crear falla por punto en InspeccionPage"
```

---

## Task 4: Frontend — modal `CrearFallaDesdePunto`

**Files:**
- Modify: `aeromx/frontend/src/pages/InspeccionPage.jsx`

- [ ] **Step 1: Renderizar el modal en `InspeccionPage`**

Junto a los otros `<Modal ... />` del JSX de `InspeccionPage` (p. ej. cerca del modal de asignación / revisión, al final del return principal), agregar:

```jsx
      {fallaPara && (
        <CrearFallaDesdePunto
          open={!!fallaPara}
          onClose={() => setFallaPara(null)}
          resultado={fallaPara}
          orden={orden}
          formatos={catalogoFalla.formatos}
          categorias={catalogoFalla.categorias}
          onCrear={crearFallaDesdePunto}
        />
      )}
```

- [ ] **Step 2: Implementar el componente `CrearFallaDesdePunto`**

Al final del archivo (junto a los otros componentes auxiliares como `ModalAsignacionContent`, `TareaBloque`, etc.) agregar:

```jsx
function CrearFallaDesdePunto({ open, onClose, resultado, orden, formatos, categorias, onCrear }) {
  const punto = resultado?.punto
  const [formatoId, setFormatoId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [severidad, setSeveridad] = useState('media')
  const [componente, setComponente] = useState(punto?.nombreComponente || '')
  const [titulo, setTitulo] = useState(
    punto?.nombreComponente ? `Falla en ${punto.nombreComponente}` : ''
  )
  const [descripcion, setDescripcion] = useState(resultado?.observacion || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Al elegir formato, heredar su categoría por defecto si el usuario no eligió otra
  const onFormato = (id) => {
    setFormatoId(id)
    const fmt = formatos.find((f) => f.id === id)
    if (fmt?.categoriaFallaId && !categoriaId) setCategoriaId(fmt.categoriaFallaId)
  }

  const guardar = async () => {
    setError('')
    if (!formatoId) { setError('Selecciona un formato de falla'); return }
    if (!titulo.trim()) { setError('El título es obligatorio'); return }
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return }
    setGuardando(true)
    try {
      await onCrear({
        productoId: orden.producto.id,
        formatoId,
        categoriaId: categoriaId || undefined,
        severidad,
        origen: 'mantenimiento',
        componente: componente.trim() || undefined,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        ordenOrigenId: orden.id,
        resultadoOrigenId: resultado.id,
      })
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al crear la falla')
      setGuardando(false)
    }
  }

  const nFotos = (resultado?.fotos || []).length

  return (
    <Modal open={open} onClose={onClose} title="⚠ Crear reporte de falla" maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <ErrorBanner message={error} />}

        <FieldSelect
          label="Formato de falla *"
          value={formatoId}
          onChange={onFormato}
          placeholder="Selecciona un formato"
          options={formatos.map((f) => ({ value: f.id, label: f.nombre }))}
        />

        <FieldSelect
          label="Categoría"
          value={categoriaId}
          onChange={setCategoriaId}
          placeholder="(hereda del formato)"
          options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
        />

        <FieldSelect
          label="Severidad *"
          value={severidad}
          onChange={setSeveridad}
          options={SEVERIDADES.map((s) => ({ value: s.value, label: s.label }))}
        />

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>Componente</label>
          <input
            value={componente}
            onChange={(e) => setComponente(e.target.value)}
            style={inputStyleFalla}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>Título *</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={inputStyleFalla}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>Descripción *</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            style={{ ...inputStyleFalla, resize: 'vertical' }}
          />
        </div>

        <div style={{ fontSize: 11, color: T.sub }}>
          Origen: <strong style={{ color: T.text }}>Mantenimiento</strong> · O/T {orden?.numeroOt}
          {nFotos > 0 && <> · se copiarán <strong style={{ color: T.text }}>{nFotos}</strong> foto(s) del punto</>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn label="Cancelar" variant="ghost" onClick={onClose} disabled={guardando} />
          <Btn label={guardando ? 'Creando…' : 'Crear falla'} onClick={guardar} disabled={guardando} />
        </div>
      </div>
    </Modal>
  )
}

const inputStyleFalla = {
  width: '100%', marginTop: 4,
  background: T.s2, color: T.text,
  border: `1px solid ${T.border}`, borderRadius: 8,
  padding: '8px 10px', fontSize: 13,
}
```

> `SEVERIDADES` se importa de `../tokens/design`. Agrégalo al import de la línea 7 si no está ya. `SEVERIDAD` (objeto) lo usa el badge de Task 3; `SEVERIDADES` (array) lo usa el select aquí.

- [ ] **Step 3: Asegurar imports de tokens**

Confirmar que el import de `../tokens/design` (línea 7) incluye `SEVERIDAD` y `SEVERIDADES`. Debe quedar algo como:

```js
import { T, STATUS, PUNTO_STATUS, TIPO_PRODUCTO, ROL_LABELS, SEVERIDAD, SEVERIDADES } from '../tokens/design'
```

(Elimina el import duplicado de Task 3 Step 1 si lo agregaste por separado.)

- [ ] **Step 4: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build verde (sin errores). 126 módulos aprox.

- [ ] **Step 5: Commit**

```bash
git add aeromx/frontend/src/pages/InspeccionPage.jsx
git commit -m "feat(fallas): modal de crear falla desde punto de mantenimiento"
```

---

## Task 5: Verificación e2e por API + cierre

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Smoke por API real (`:3001`)**

Con backend (`:3001`) y datos de dev. Login como `dev@aeromx.com / aeromx123` para obtener JWT. Sobre una O/T **en proceso** con al menos un punto que tenga fotos:

1. Marcar un punto en `requiere_atencion` (o usar uno ya con fotos): `PATCH /api/ordenes/:id/puntos/:resultadoId` `{ estadoResultado: 'requiere_atencion' }`.
2. Crear falla desde mantenimiento: `POST /api/fallas` con body:
   ```json
   {
     "productoId": "<id producto de la orden>",
     "formatoId": "<id de un formato tipoFormato=falla del mismo tipo>",
     "severidad": "media",
     "origen": "mantenimiento",
     "componente": "...",
     "titulo": "Falla de prueba",
     "descripcion": "Detectada en mantenimiento",
     "ordenOrigenId": "<id orden>",
     "resultadoOrigenId": "<id resultado del punto>"
   }
   ```
   Esperado: 201 con `numeroFalla`.
3. `GET /api/fallas/:id` → la falla incluye las **fotos copiadas** del punto (mismo `urlArchivo` que las `FotoInspeccion` del punto).
4. `GET /api/ordenes/:id` → el `resultado` de origen ahora tiene `reportesFalla: [{ numeroFalla, ... }]`.
5. `GET /api/ordenes/:id` → el `cierre` (si existe) o el creado tiene `refDocCorrectivo` con el `numeroFalla` y `seEncontroDefecto = true`.

Esperado: todos PASS.

- [ ] **Step 2: Verificación visual rápida (opcional, navegador)**

`npm run dev` en frontend, abrir una O/T en proceso, marcar un punto con daños → aparece "⚠ Crear reporte de falla" → modal pre-llenado (componente/título/descripción) → crear → badge `⚠ RF-…` en el punto que abre `/fallas/:id`.

- [ ] **Step 3: Limpiar datos scratch**

Si el smoke creó una falla de prueba que no se quiere conservar, borrarla por BD (no hay endpoint DELETE de fallas). Revertir el punto a su estado previo si se cambió solo para probar.

- [ ] **Step 4: Actualizar CLAUDE.md**

Agregar una sección "Cambios en Sesión 23 — Registro de Fallas Fase 2" con el resumen (backend: copia de fotos + reportesFalla en obtenerOrden; frontend: botón/modal/badge en InspeccionPage; verificación) y marcar la Fase 2 como completa en la tabla del feature. Commit aparte.

```bash
git add CLAUDE.md
git commit -m "docs(fallas): Sesión 23 — Fase 2 (disparo automático) completa"
```

---

## Self-Review

- **Cobertura de spec (§5 Fase 2):**
  - Botón "Crear reporte de falla" en punto con defecto → Task 3 Step 7. ✓
  - Modal pre-llenado (componente, observación→descripción, origen=mantenimiento, ordenOrigenId/resultadoOrigenId) → Task 4. ✓
  - Usuario elige formato-falla + categoría + severidad → Task 4. ✓
  - Backend copia fotos del punto a `fotos_falla` → Task 1. ✓
  - Auto-llenado `refDocCorrectivo` → ya existía (Fase 1); se verifica en Task 5 Step 1.5. ✓
  - Indicador (badge + número) en el punto → Task 3 Steps 5-6 + Task 2 (include). ✓
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `reportesFalla` (select `id/numeroFalla/estado/severidad`) en Task 2 = lo que consume el badge en Task 3 Step 6. `crearFallaDesdePunto` (payload) en Task 3 Step 2 = lo que arma el modal en Task 4 Step 2. `SEVERIDAD`/`SEVERIDADES` importados en Task 3/4 Step 1/3. ✓
- **Sin migración:** confirmado — `ResultadoPunto.reportesFalla`, `ReporteFalla.resultadoOrigen` y `FotoFalla` ya existen en el schema (Fase 1).
