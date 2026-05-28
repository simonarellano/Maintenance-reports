# Registro de Fallas — Fase 3 (Histórico, Analítica y Exportación) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Agregar al registro de fallas un dashboard de analítica con filtros, KPIs y gráficas (recharts), exportación a Excel (`.xlsx`) y un PDF resumen con gráficas estética HYDRA, más un histórico de fallas por producto/modelo en la Flota.

**Architecture:** Backend expone un endpoint de agregación (`GET /api/fallas/estadisticas`) que reusa los filtros de `listarFallas`, hace un `findMany` filtrado y agrupa en JS (dataset pequeño, decenas-cientos de filas) devolviendo todos los datasets que consume el dashboard; dos endpoints de export (`export.xlsx` con `exceljs`, `reporte.pdf` con `pdfkit` + primitivas nuevas de gráfica en `pdf/ui.js`). Frontend agrega una página `FallasDashboardPage` con `recharts` y enlaza el histórico desde `FlotaPage`. Sin framework de tests en el repo: la verificación es por **API (curl/PowerShell)** y **`npm run build`**, igual que las Fases 1–2.

**Tech Stack:** Node + Express (ESM) · Prisma · pdfkit · **exceljs (nuevo, backend)** · React + Vite · **recharts (nuevo, frontend)**.

---

## Notas críticas (leer antes de empezar)

- **Orden de rutas en `routes/fallas.js`:** las rutas estáticas nuevas (`/estadisticas`, `/export.xlsx`, `/reporte.pdf`) **deben** registrarse **ANTES** de `router.get('/:id', ...)`. Express evalúa en orden; si van después, `/:id` captura `"estadisticas"` como un id y rompe el endpoint. Esto se valida explícitamente en la Tarea 4.
- **No tocar la BD:** Fase 3 **no** cambia el schema (el modelo de datos completo se creó en Fase 1). No hay migración, no se corre `prisma generate`, `db:seed` ni `migrate`.
- **Gotcha Windows (instalar deps):** detener el backend antes de `npm install` solo si Prisma regenera; aquí no aplica porque no se toca Prisma. Aun así, si `npm install exceljs` falla por EPERM, detener `npm run dev` del backend, instalar, y relanzar.
- **Idioma:** todo en español (comentarios, commits, UI).
- **Verificación:** el backend de dev suele estar corriendo en `:3001` y el frontend en `:5173`. Para curl autenticado se necesita un JWT: ver el **Apéndice A** (login dev) al final.
- **Commits:** frecuentes, uno por tarea. Formato `feat(fallas): ...`. Terminar el mensaje con la línea `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

---

## Estructura de archivos

**Backend (crear):**
- `aeromx/backend/src/services/fallasEstadisticasService.js` — agregación de datasets para dashboard/export.
- `aeromx/backend/src/controllers/fallas/estadisticasController.js` — endpoint JSON `GET /estadisticas`.
- `aeromx/backend/src/controllers/fallas/excelController.js` — endpoint `GET /export.xlsx` (exceljs).
- `aeromx/backend/src/controllers/fallas/resumenPdfController.js` — endpoint `GET /reporte.pdf` (pdfkit + gráficas).

**Backend (modificar):**
- `aeromx/backend/src/routes/fallas.js` — montar las 3 rutas nuevas **antes** de `/:id`.
- `aeromx/backend/src/pdf/ui.js` — agregar primitivas `hbarChart` y `pieChart` (sin mover y al final).
- `aeromx/backend/package.json` — dep `exceljs`.

**Frontend (crear):**
- `aeromx/frontend/src/pages/FallasDashboardPage.jsx` — dashboard con KPIs + gráficas recharts + tabla.
- `aeromx/frontend/src/components/fallas/FallasGraficas.jsx` — los charts recharts (aísla recharts del page).

**Frontend (modificar):**
- `aeromx/frontend/src/api/fallasService.js` — métodos `estadisticas`, `descargarExcel`, `descargarResumenPDF`.
- `aeromx/frontend/src/App.jsx` — ruta `/fallas/dashboard`.
- `aeromx/frontend/src/components/Header.jsx` — enlace "Analítica" (o botón en `FallasPage`).
- `aeromx/frontend/src/pages/FallasPage.jsx` — botón "📊 Analítica" → `/fallas/dashboard`.
- `aeromx/frontend/src/pages/FlotaPage.jsx` — sección/enlace de histórico de fallas por producto.
- `aeromx/frontend/package.json` — dep `recharts`.

---

## Tarea 1: Servicio de estadísticas (agregación)

**Files:**
- Create: `aeromx/backend/src/services/fallasEstadisticasService.js`

Construye una función que reusa el mismo filtro que `listarFallas`, trae las fallas con `INCLUDE_FALLA` y agrupa en JS. Devuelve un objeto con KPIs + todos los datasets de las gráficas + `detalle` (lista plana liviana usada por la tabla y el export). El dataset es pequeño; agrupar en JS evita N queries `groupBy`.

- [ ] **Step 1: Escribir el servicio completo**

```js
// aeromx/backend/src/services/fallasEstadisticasService.js
import prisma from '../lib/prisma.js'
import { INCLUDE_FALLA } from './fallasService.js'

// Construye el `where` de Prisma a partir de los filtros del query string.
// Espeja exactamente los filtros de listarFallas + tipoProducto.
function construirWhere(filtros = {}) {
  const { productoId, modeloId, tipoProducto, categoriaId, severidad, estado, origen, desde, hasta } = filtros
  return {
    ...(productoId    ? { productoId }                          : {}),
    ...(modeloId      ? { producto: { modeloId } }              : {}),
    ...(tipoProducto  ? { producto: { tipoProducto } }          : {}),
    ...(categoriaId   ? { categoriaId }                         : {}),
    ...(severidad     ? { severidad }                           : {}),
    ...(estado        ? { estado }                              : {}),
    ...(origen        ? { origen }                              : {}),
    ...(desde || hasta
      ? { fechaDeteccion: {
            ...(desde ? { gte: new Date(desde) } : {}),
            ...(hasta ? { lte: new Date(hasta) } : {}),
          } }
      : {}),
  }
}

// Suma agrupada genérica: recibe lista + función de clave → Map<clave, count>.
function contarPor(lista, keyFn) {
  const m = new Map()
  for (const f of lista) {
    const k = keyFn(f)
    if (k == null || k === '') continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  return m
}

// MTTR (días) promedio sobre fallas resueltas: fechaResolucion - fechaDeteccion.
function mttrDias(resueltas) {
  if (resueltas.length === 0) return null
  const totalMs = resueltas.reduce((acc, f) => {
    const ini = new Date(f.fechaDeteccion).getTime()
    const fin = new Date(f.fechaResolucion).getTime()
    return acc + Math.max(0, fin - ini)
  }, 0)
  return +(totalMs / resueltas.length / 86_400_000).toFixed(1)
}

export async function calcularEstadisticas(filtros = {}) {
  const fallas = await prisma.reporteFalla.findMany({
    where: construirWhere(filtros),
    include: INCLUDE_FALLA,
    orderBy: { fechaDeteccion: 'desc' },
  })

  const total       = fallas.length
  const resueltas   = fallas.filter((f) => f.estado === 'resuelta')
  const abiertas    = fallas.filter((f) => f.estado !== 'resuelta')
  const criticasAbiertas = abiertas.filter((f) => f.severidad === 'critica').length

  // --- KPIs ---
  const kpis = {
    total,
    abiertas: abiertas.length,
    resueltas: resueltas.length,
    criticasAbiertas,
    mttrDias: mttrDias(resueltas),
    pctResueltas: total ? Math.round((resueltas.length / total) * 100) : 0,
  }

  // --- Datasets de gráficas ---
  const porCategoria = [...contarPor(fallas, (f) => f.categoria?.nombre).entries()]
    .map(([nombre, count]) => {
      const cat = fallas.find((f) => f.categoria?.nombre === nombre)?.categoria
      return { nombre, count, color: cat?.color || null }
    })
    .sort((a, b) => b.count - a.count)

  const SEV_ORDER = ['critica', 'alta', 'media', 'baja']
  const porSeveridad = SEV_ORDER
    .map((sev) => ({ severidad: sev, count: fallas.filter((f) => f.severidad === sev).length }))
    .filter((d) => d.count > 0)

  const ORIGENES = ['mantenimiento', 'prevuelo', 'operacion']
  const porOrigen = ORIGENES
    .map((o) => ({ origen: o, count: fallas.filter((f) => f.origen === o).length }))
    .filter((d) => d.count > 0)

  const topComponentes = [...contarPor(fallas, (f) => f.componente).entries()]
    .map(([componente, count]) => ({ componente, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const porModelo = [...contarPor(fallas, (f) => f.producto?.modelo?.nombre).entries()]
    .map(([modelo, count]) => ({ modelo, count }))
    .sort((a, b) => b.count - a.count)

  const porProducto = [...contarPor(fallas, (f) => f.producto?.identificador).entries()]
    .map(([identificador, count]) => ({ identificador, count }))
    .sort((a, b) => b.count - a.count)

  // Tendencia mensual (YYYY-MM) ordenada ascendente.
  const tendenciaMap = contarPor(fallas, (f) => {
    const d = new Date(f.fechaDeteccion)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const tendencia = [...tendenciaMap.entries()]
    .map(([periodo, count]) => ({ periodo, count }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))

  // MTTR por severidad y por categoría (solo sobre resueltas).
  const mttrPorSeveridad = SEV_ORDER
    .map((sev) => ({ severidad: sev, mttrDias: mttrDias(resueltas.filter((f) => f.severidad === sev)) }))
    .filter((d) => d.mttrDias != null)
  const mttrPorCategoria = porCategoria
    .map((c) => ({ nombre: c.nombre, mttrDias: mttrDias(resueltas.filter((f) => f.categoria?.nombre === c.nombre)) }))
    .filter((d) => d.mttrDias != null)

  const embudoEstados = {
    detectada:  fallas.filter((f) => f.estado === 'detectada').length,
    en_proceso: fallas.filter((f) => f.estado === 'en_proceso').length,
    resuelta:   resueltas.length,
  }

  // Detalle plano para tabla + export (sin objetos anidados pesados).
  const detalle = fallas.map((f) => ({
    numeroFalla: f.numeroFalla,
    titulo: f.titulo,
    producto: f.producto?.identificador || '',
    modelo: f.producto?.modelo?.nombre || '',
    tipoProducto: f.producto?.tipoProducto || '',
    categoria: f.categoria?.nombre || '',
    severidad: f.severidad,
    origen: f.origen,
    estado: f.estado,
    componente: f.componente || '',
    reportadoPor: f.reportadoPor?.nombre || '',
    responsable: f.responsable?.nombre || '',
    resueltoPor: f.resueltoPor?.nombre || '',
    fechaDeteccion: f.fechaDeteccion,
    fechaResolucion: f.fechaResolucion,
  }))

  return {
    kpis,
    porCategoria, porSeveridad, porOrigen, topComponentes,
    porModelo, porProducto, tendencia,
    mttrPorSeveridad, mttrPorCategoria, embudoEstados,
    detalle,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add aeromx/backend/src/services/fallasEstadisticasService.js
git commit -m "feat(fallas): servicio de agregacion de estadisticas (Fase 3)"
```

---

## Tarea 2: Endpoint `GET /api/fallas/estadisticas`

**Files:**
- Create: `aeromx/backend/src/controllers/fallas/estadisticasController.js`
- Modify: `aeromx/backend/src/routes/fallas.js`

- [ ] **Step 1: Escribir el controller**

```js
// aeromx/backend/src/controllers/fallas/estadisticasController.js
import { calcularEstadisticas } from '../../services/fallasEstadisticasService.js'

export async function obtener(req, res, next) {
  try {
    const data = await calcularEstadisticas(req.query)
    res.json({ data })
  } catch (e) { next(e) }
}
```

- [ ] **Step 2: Montar la ruta ANTES de `/:id` en `routes/fallas.js`**

Abrir `aeromx/backend/src/routes/fallas.js`. Agregar el import y la ruta. **Clave:** la ruta `/estadisticas` va **arriba** de `router.get('/:id', ...)`. El archivo queda así:

```js
import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import * as fallas from '../controllers/fallas/fallasController.js'
import * as workflow from '../controllers/fallas/workflowController.js'
import * as fotos from '../controllers/fallas/fotosController.js'
import * as pdf from '../controllers/fallas/pdfController.js'
import * as estadisticas from '../controllers/fallas/estadisticasController.js'

const router = Router()
router.use(verifyToken)

// Rutas estáticas ANTES de '/:id' (si no, '/:id' captura "estadisticas", etc.)
router.get('/estadisticas', estadisticas.obtener)

router.get('/', fallas.listar)
router.get('/:id', fallas.obtener)
router.post('/', fallas.crear)
router.patch('/:id/responsable', requireRole(['gerente_soporte']), workflow.asignarResponsable)
router.post('/:id/resolver', workflow.resolver)
router.post('/:id/fotos', upload.single('foto'), fotos.subir)
router.delete('/:id/fotos/:fotoId', fotos.eliminar)
router.get('/:id/pdf', pdf.generar)

export default router
```

- [ ] **Step 3: Verificar el endpoint (curl autenticado)**

Obtener token (ver Apéndice A) y guardarlo en `$TOKEN`. Luego:

```powershell
curl.exe -s -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/estadisticas" | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object -ExpandProperty kpis
```

Esperado: un objeto con `total`, `abiertas`, `resueltas`, `criticasAbiertas`, `mttrDias`, `pctResueltas`. **No** debe devolver "Falla no encontrada" (eso significaría que `/:id` capturó la ruta → revisar orden).

- [ ] **Step 4: Verificar que los filtros funcionan**

```powershell
curl.exe -s -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/estadisticas?estado=resuelta" | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object -ExpandProperty kpis
```

Esperado: `abiertas` = 0 (solo resueltas pasan el filtro).

- [ ] **Step 5: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/estadisticasController.js aeromx/backend/src/routes/fallas.js
git commit -m "feat(fallas): endpoint GET /estadisticas con filtros (Fase 3)"
```

---

## Tarea 3: Primitivas de gráfica en el PDF (`pdf/ui.js`)

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar al final, antes de cerrar el archivo)

Dos helpers nuevos que dibujan con primitivas de pdfkit, sin librería de charting. Siguen la convención del módulo: reciben `doc`, dibujan, dejan `doc.y` debajo del bloque.

- [ ] **Step 1: Agregar `hbarChart` y `pieChart` al final de `ui.js`**

```js
// ─── Gráficas (PDF resumen, Fase 3) ────────────────────────────────────────────

// Paleta cíclica para series sin color propio.
const CHART_PALETTE = [
  COLOR.accent, COLOR.ok, COLOR.warn, COLOR.critical,
  '#6B7DB3', '#8C6BB1', '#3E8E8E', '#B08A3E',
]

// Barras horizontales. data: [{ label, value, color? }]. Dibuja título + barras + valores.
export function hbarChart(doc, titulo, data, M, W) {
  const rowH = 22
  const headH = 22
  const items = data.slice(0, 10)
  const blockH = headH + items.length * rowH + 10
  ensureSpace(doc, blockH + 8)
  const y0 = doc.y

  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text(titulo.toUpperCase(), M, y0, { characterSpacing: 0.6, lineBreak: false })

  if (items.length === 0) {
    font(doc, FONT.sans).fontSize(9).fillColor(COLOR.muted)
      .text('Sin datos.', M, y0 + headH, { lineBreak: false })
    doc.y = y0 + headH + 16
    doc.x = M
    return
  }

  const max = Math.max(...items.map((d) => d.value), 1)
  const labelW = 130
  const valW = 36
  const trackX = M + labelW
  const trackW = W - labelW - valW

  items.forEach((d, i) => {
    const y = y0 + headH + i * rowH
    const barW = Math.max(2, (d.value / max) * trackW)
    const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length]
    font(doc, FONT.sans).fontSize(8.5).fillColor(COLOR.ink2)
      .text(d.label || '—', M, y + 3, { width: labelW - 8, lineBreak: false, ellipsis: true })
    doc.save()
    doc.roundedRect(trackX, y + 2, trackW, 12, 3).fill(COLOR.line2)
    doc.roundedRect(trackX, y + 2, barW, 12, 3).fill(color)
    doc.restore()
    font(doc, FONT.monoMed).fontSize(8.5).fillColor(COLOR.ink)
      .text(String(d.value), trackX + trackW + 6, y + 3, { width: valW - 6, lineBreak: false })
  })
  doc.fillColor(COLOR.ink)
  doc.y = y0 + blockH
  doc.x = M
}

// Dona/pie con leyenda a la derecha. data: [{ label, value, color? }]. cx,cy = centro; r = radio.
// Aproxima los sectores con un abanico de polígonos (robusto, sin depender de arcos SVG).
export function pieChart(doc, titulo, data, M, W, { r = 56, donut = true } = {}) {
  const items = data.filter((d) => d.value > 0)
  const blockH = Math.max(r * 2 + 34, 22 + items.length * 16 + 16)
  ensureSpace(doc, blockH + 8)
  const y0 = doc.y

  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text(titulo.toUpperCase(), M, y0, { characterSpacing: 0.6, lineBreak: false })

  const cx = M + r + 6
  const cy = y0 + 22 + r
  const total = items.reduce((a, d) => a + d.value, 0)

  if (total === 0) {
    font(doc, FONT.sans).fontSize(9).fillColor(COLOR.muted)
      .text('Sin datos.', M, y0 + 22, { lineBreak: false })
    doc.y = y0 + 40
    doc.x = M
    return
  }

  // Sectores
  let ang = -Math.PI / 2 // arranca arriba
  items.forEach((d, i) => {
    const frac = d.value / total
    const end = ang + frac * Math.PI * 2
    const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length]
    doc.save().fillColor(color)
    doc.moveTo(cx, cy)
    const steps = Math.max(2, Math.ceil(frac * 48))
    for (let s = 0; s <= steps; s++) {
      const a = ang + (end - ang) * (s / steps)
      doc.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    doc.closePath().fill()
    doc.restore()
    ang = end
  })

  // Agujero de la dona
  if (donut) {
    doc.save().fillColor(COLOR.paper).circle(cx, cy, r * 0.55).fill().restore()
    font(doc, FONT.sansSemi).fontSize(15).fillColor(COLOR.ink)
    const th = doc.currentLineHeight()
    doc.text(String(total), cx - r, cy - th / 2, { width: r * 2, align: 'center', lineBreak: false })
  }

  // Leyenda a la derecha
  const legX = cx + r + 24
  const legW = M + W - legX
  items.forEach((d, i) => {
    const ly = y0 + 22 + i * 16
    const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length]
    doc.save().roundedRect(legX, ly + 2, 9, 9, 2).fill(color).restore()
    const pct = Math.round((d.value / total) * 100)
    font(doc, FONT.sans).fontSize(8.5).fillColor(COLOR.ink2)
      .text(`${d.label}  ·  ${d.value} (${pct}%)`, legX + 15, ly + 2, { width: legW - 15, lineBreak: false, ellipsis: true })
  })

  doc.fillColor(COLOR.ink)
  doc.y = y0 + blockH
  doc.x = M
}
```

- [ ] **Step 2: Verificar que el módulo sigue cargando (sin romper imports)**

```powershell
cd aeromx/backend; node -e "import('./src/pdf/ui.js').then(m => console.log('ok', typeof m.hbarChart, typeof m.pieChart))"
```

Esperado: `ok function function`.

- [ ] **Step 3: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js
git commit -m "feat(pdf): primitivas hbarChart y pieChart para graficas (Fase 3)"
```

---

## Tarea 4: Endpoint `GET /api/fallas/reporte.pdf` (PDF resumen con gráficas)

**Files:**
- Create: `aeromx/backend/src/controllers/fallas/resumenPdfController.js`
- Modify: `aeromx/backend/src/routes/fallas.js` (montar antes de `/:id`)

Reusa header/footer estética HYDRA (mismo patrón que `pdfController.js`), KPIs con `ui.dictumBlock`, y las gráficas 1–4 (categoría [hbar], severidad [dona], top componentes [hbar], origen [dona]) con las primitivas nuevas.

- [ ] **Step 1: Escribir el controller**

```js
// aeromx/backend/src/controllers/fallas/resumenPdfController.js
import { calcularEstadisticas } from '../../services/fallasEstadisticasService.js'
import { COLOR, FONT, font, registerFonts, fmtFecha, fmtFechaHora } from '../../pdf/theme.js'
import * as ui from '../../pdf/ui.js'
import fs from 'fs'
import path from 'path'

const COMPANY = {
  nombre: 'HYDRA', lema: 'Gestión de mantenimiento',
  direccion: 'Planta 20 City · México', telefono: '+52 (55) 0000-0000', email: 'soporte@hydra.mx',
}

const SEV_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
const SEV_COLOR = { baja: COLOR.ok, media: COLOR.warn, alta: '#D97A2B', critica: COLOR.critical }
const ORIGEN_LABEL = { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }

export async function generar(req, res, next) {
  try {
    const stats = await calcularEstadisticas(req.query)

    const { default: PDFDocument } = await import('pdfkit')
    const doc = new PDFDocument({
      margin: 40, size: 'LETTER', bufferPages: true,
      info: { Title: 'Resumen de Fallas', Author: COMPANY.nombre, Subject: 'Analítica de fallas', Keywords: 'fallas, analitica, aeromx' },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="resumen-fallas.pdf"')
    doc.pipe(res)

    const M = 40
    const W = doc.page.width - M * 2
    let n = 1
    const num = () => n++

    registerFonts(doc)
    drawHeader(doc, M, W)
    drawTitleRow(doc, stats, M, W)

    // KPIs
    ui.sectionHead(doc, num(), 'Indicadores', M, W)
    ui.dictumBlock(doc, [
      { label: 'Total fallas',      value: String(stats.kpis.total),            color: COLOR.ink },
      { label: 'Abiertas',          value: String(stats.kpis.abiertas),         color: COLOR.warn },
      { label: 'Resueltas',         value: String(stats.kpis.resueltas),        color: COLOR.ok, progress: stats.kpis.total ? stats.kpis.resueltas / stats.kpis.total : 0 },
      { label: 'Críticas abiertas', value: String(stats.kpis.criticasAbiertas), color: COLOR.critical },
      { label: 'MTTR (días)',       value: stats.kpis.mttrDias != null ? String(stats.kpis.mttrDias) : '—', color: COLOR.accent },
    ], M, W)

    // Gráfica 1: por categoría (barras)
    ui.sectionHead(doc, num(), 'Fallas por categoría', M, W)
    ui.hbarChart(doc, 'Categoría', stats.porCategoria.map((c) => ({ label: c.nombre, value: c.count, color: c.color })), M, W)

    // Gráfica 2: por severidad (dona)
    ui.sectionHead(doc, num(), 'Distribución por severidad', M, W)
    ui.pieChart(doc, 'Severidad', stats.porSeveridad.map((s) => ({ label: SEV_LABEL[s.severidad] || s.severidad, value: s.count, color: SEV_COLOR[s.severidad] })), M, W)

    // Gráfica 3: top componentes (barras)
    ui.sectionHead(doc, num(), 'Top componentes afectados', M, W)
    ui.hbarChart(doc, 'Componente', stats.topComponentes.map((c) => ({ label: c.componente, value: c.count })), M, W)

    // Gráfica 4: por origen (dona)
    ui.sectionHead(doc, num(), 'Distribución por origen', M, W)
    ui.pieChart(doc, 'Origen', stats.porOrigen.map((o) => ({ label: ORIGEN_LABEL[o.origen] || o.origen, value: o.count })), M, W)

    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.page.margins.bottom = 0
      drawFooter(doc, i + 1, pages.count, M, W)
    }
    doc.end()
  } catch (e) { next(e) }
}

function drawHeader(doc, M, W) {
  const topY = 40
  const logoPath = path.join(process.cwd(), 'public/hydra-logo.png')
  try { if (fs.existsSync(logoPath)) doc.image(logoPath, M, topY, { height: 30 }) } catch { /* texto */ }
  const brandX = fs.existsSync(logoPath) ? M + 86 : M
  font(doc, FONT.sansSemi).fontSize(11).fillColor(COLOR.ink)
    .text(`${COMPANY.nombre} · ${COMPANY.lema}`, brandX, topY + 2, { lineBreak: false })
  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text(`${COMPANY.direccion} · ${COMPANY.telefono} · ${COMPANY.email}`, brandX, topY + 17, { lineBreak: false })
  font(doc, FONT.mono).fontSize(8.5).fillColor(COLOR.muted)
    .text(`Documento  Resumen de fallas`, M, topY, { width: W, align: 'right', lineBreak: false })
    .text(`Generado  ${fmtFechaHora(new Date())}`, M, topY + 12, { width: W, align: 'right', lineBreak: false })
  const sepY = topY + 40
  doc.lineWidth(1).strokeColor(COLOR.ink).moveTo(M, sepY).lineTo(M + W, sepY).stroke()
  doc.fillColor(COLOR.ink); doc.y = sepY + 16; doc.x = M
}

function drawTitleRow(doc, stats, M, W) {
  const y = doc.y
  font(doc, FONT.mono).fontSize(9).fillColor(COLOR.muted)
    .text('ANALÍTICA DE FALLAS', M, y, { characterSpacing: 1.2, lineBreak: false })
  font(doc, FONT.sansMed).fontSize(26).fillColor(COLOR.ink)
    .text('Resumen de fallas', M, y + 14, { width: W })
  doc.fillColor(COLOR.ink); doc.y = doc.y + 6; doc.x = M
}

function drawFooter(doc, pageNum, totalPages, M, W) {
  const y = doc.page.height - 30
  doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(M, y).lineTo(M + W, y).stroke()
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text(`${COMPANY.nombre} · Resumen de fallas · Generado ${fmtFechaHora(new Date())}`, M, y + 5, { width: W, align: 'left', lineBreak: false })
    .text(`Página ${pageNum} de ${totalPages}`, M, y + 5, { width: W, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.ink)
}
```

- [ ] **Step 2: Montar la ruta antes de `/:id`**

En `aeromx/backend/src/routes/fallas.js`, agregar el import y la ruta junto a la de estadísticas (zona de rutas estáticas, arriba de `/:id`):

```js
import * as resumenPdf from '../controllers/fallas/resumenPdfController.js'
// ...
router.get('/estadisticas', estadisticas.obtener)
router.get('/reporte.pdf', resumenPdf.generar)
```

- [ ] **Step 3: Verificar que genera un PDF**

```powershell
curl.exe -s -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/reporte.pdf" -o "$env:TEMP\resumen-fallas.pdf"; (Get-Item "$env:TEMP\resumen-fallas.pdf").Length
```

Esperado: tamaño > 5000 bytes. Abrir el archivo y confirmar: header HYDRA, bloque de KPIs, 4 gráficas (2 barras, 2 donas), footer paginado. Confirmar que las donas muestran el total en el centro y la leyenda con porcentajes.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/resumenPdfController.js aeromx/backend/src/routes/fallas.js
git commit -m "feat(fallas): PDF resumen con graficas estetica HYDRA (Fase 3)"
```

---

## Tarea 5: Endpoint `GET /api/fallas/export.xlsx` (Excel)

**Files:**
- Modify: `aeromx/backend/package.json` (dep `exceljs`)
- Create: `aeromx/backend/src/controllers/fallas/excelController.js`
- Modify: `aeromx/backend/src/routes/fallas.js` (montar antes de `/:id`)

- [ ] **Step 1: Instalar exceljs**

```powershell
cd aeromx/backend; npm install exceljs
```

Esperado: `exceljs` aparece en `dependencies` de `package.json`. Si falla por EPERM, detener el backend (`npm run dev`), reintentar, relanzar.

- [ ] **Step 2: Escribir el controller**

```js
// aeromx/backend/src/controllers/fallas/excelController.js
import ExcelJS from 'exceljs'
import { calcularEstadisticas } from '../../services/fallasEstadisticasService.js'

const SEV_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
const ESTADO_LABEL = { detectada: 'Detectada', en_proceso: 'En proceso', resuelta: 'Resuelta' }
const ORIGEN_LABEL = { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }
const fmt = (d) => (d ? new Date(d).toLocaleDateString('es-MX') : '')

export async function generar(req, res, next) {
  try {
    const stats = await calcularEstadisticas(req.query)
    const wb = new ExcelJS.Workbook()
    wb.creator = 'HYDRA · AeroMX'
    wb.created = new Date()

    // --- Pestaña Resumen ---
    const resumen = wb.addWorksheet('Resumen')
    resumen.columns = [{ width: 28 }, { width: 16 }]
    resumen.addRow(['Indicador', 'Valor']).font = { bold: true }
    resumen.addRow(['Total de fallas', stats.kpis.total])
    resumen.addRow(['Abiertas', stats.kpis.abiertas])
    resumen.addRow(['Resueltas', stats.kpis.resueltas])
    resumen.addRow(['Críticas abiertas', stats.kpis.criticasAbiertas])
    resumen.addRow(['MTTR (días)', stats.kpis.mttrDias ?? '—'])
    resumen.addRow(['% resueltas', `${stats.kpis.pctResueltas}%`])
    resumen.addRow([])
    resumen.addRow(['Por categoría', 'Conteo']).font = { bold: true }
    stats.porCategoria.forEach((c) => resumen.addRow([c.nombre, c.count]))
    resumen.addRow([])
    resumen.addRow(['Por severidad', 'Conteo']).font = { bold: true }
    stats.porSeveridad.forEach((s) => resumen.addRow([SEV_LABEL[s.severidad] || s.severidad, s.count]))

    // --- Pestaña Detalle ---
    const detalle = wb.addWorksheet('Detalle')
    detalle.columns = [
      { header: 'N.º Falla',      key: 'numeroFalla',     width: 18 },
      { header: 'Título',         key: 'titulo',          width: 30 },
      { header: 'Producto',       key: 'producto',        width: 16 },
      { header: 'Modelo',         key: 'modelo',          width: 18 },
      { header: 'Categoría',      key: 'categoria',       width: 18 },
      { header: 'Severidad',      key: 'severidad',       width: 12 },
      { header: 'Origen',         key: 'origen',          width: 14 },
      { header: 'Estado',         key: 'estado',          width: 12 },
      { header: 'Componente',     key: 'componente',      width: 20 },
      { header: 'Reportó',        key: 'reportadoPor',    width: 20 },
      { header: 'Responsable',    key: 'responsable',     width: 20 },
      { header: 'Resolvió',       key: 'resueltoPor',     width: 20 },
      { header: 'Detección',      key: 'fechaDeteccion',  width: 14 },
      { header: 'Resolución',     key: 'fechaResolucion', width: 14 },
    ]
    detalle.getRow(1).font = { bold: true }
    stats.detalle.forEach((d) => detalle.addRow({
      ...d,
      severidad: SEV_LABEL[d.severidad] || d.severidad,
      estado: ESTADO_LABEL[d.estado] || d.estado,
      origen: ORIGEN_LABEL[d.origen] || d.origen,
      fechaDeteccion: fmt(d.fechaDeteccion),
      fechaResolucion: fmt(d.fechaResolucion),
    }))
    detalle.autoFilter = { from: 'A1', to: 'N1' }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="fallas.xlsx"')
    await wb.xlsx.write(res)
    res.end()
  } catch (e) { next(e) }
}
```

- [ ] **Step 3: Montar la ruta antes de `/:id`**

En `routes/fallas.js`, junto a las otras rutas estáticas:

```js
import * as excel from '../controllers/fallas/excelController.js'
// ...
router.get('/estadisticas', estadisticas.obtener)
router.get('/reporte.pdf', resumenPdf.generar)
router.get('/export.xlsx', excel.generar)
```

- [ ] **Step 4: Verificar que genera un xlsx válido**

```powershell
curl.exe -s -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/export.xlsx" -o "$env:TEMP\fallas.xlsx"; (Get-Item "$env:TEMP\fallas.xlsx").Length
```

Esperado: tamaño > 5000 bytes. Abrir en Excel/LibreOffice → 2 pestañas ("Resumen", "Detalle"), encabezados en negrita, autofiltro en Detalle.

- [ ] **Step 5: Commit**

```bash
git add aeromx/backend/package.json aeromx/backend/package-lock.json aeromx/backend/src/controllers/fallas/excelController.js aeromx/backend/src/routes/fallas.js
git commit -m "feat(fallas): export Excel (.xlsx) resumen + detalle (Fase 3)"
```

---

## Tarea 6: Métodos del servicio frontend + dependencia recharts

**Files:**
- Modify: `aeromx/frontend/src/api/fallasService.js`
- Modify: `aeromx/frontend/package.json` (dep `recharts`)

- [ ] **Step 1: Instalar recharts**

```powershell
cd aeromx/frontend; npm install recharts
```

Esperado: `recharts` en `dependencies`.

- [ ] **Step 2: Agregar métodos al `fallasService`**

Agregar dentro del objeto `fallasService` en `aeromx/frontend/src/api/fallasService.js` (después de `descargarPDF`):

```js
  estadisticas: (params) =>
    client.get('/fallas/estadisticas', { params }),

  descargarExcel: (params) =>
    client.get('/fallas/export.xlsx', { params, responseType: 'blob' }),

  descargarResumenPDF: (params) =>
    client.get('/fallas/reporte.pdf', { params, responseType: 'blob' }),
```

- [ ] **Step 3: Verificar build**

```powershell
cd aeromx/frontend; npm run build
```

Esperado: build OK sin errores (recharts resuelve, sintaxis del service válida).

- [ ] **Step 4: Commit**

```bash
git add aeromx/frontend/package.json aeromx/frontend/package-lock.json aeromx/frontend/src/api/fallasService.js
git commit -m "feat(fallas): recharts + metodos de estadisticas/export en service (Fase 3)"
```

---

## Tarea 7: Componente de gráficas (recharts)

**Files:**
- Create: `aeromx/frontend/src/components/fallas/FallasGraficas.jsx`

Aísla recharts en un componente que recibe el objeto `stats` y dibuja las gráficas. Usa los tokens `T`, `SEVERIDAD`, `ESTADO_FALLA`. Estilo oscuro (fondo `T.s1`, texto `T.text`).

- [ ] **Step 1: Escribir el componente**

```jsx
// aeromx/frontend/src/components/fallas/FallasGraficas.jsx
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { T, SEVERIDAD, ESTADO_FALLA, ORIGEN_FALLA } from '../../tokens/design'

const PALETTE = [T.cyan, T.green, T.amber, T.red, T.purple, '#7dd3fc', '#f0abfc', '#fcd34d']
const SEV_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
const ORIGEN_LABEL = { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }

const tooltipStyle = {
  background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8,
  color: T.text, fontSize: 12, fontFamily: T.font,
}

function Panel({ titulo, children, height = 240 }) {
  return (
    <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: T.sub, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
        {titulo}
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function FallasGraficas({ stats }) {
  if (!stats) return null

  const dataCategoria = stats.porCategoria.map((c) => ({ name: c.nombre, value: c.count, color: c.color }))
  const dataSeveridad = stats.porSeveridad.map((s) => ({ name: SEV_LABEL[s.severidad] || s.severidad, value: s.count, color: SEVERIDAD[s.severidad]?.color }))
  const dataComponentes = stats.topComponentes.map((c) => ({ name: c.componente, value: c.count }))
  const dataOrigen = stats.porOrigen.map((o) => ({ name: ORIGEN_LABEL[o.origen] || o.origen, value: o.count }))
  const dataModelo = stats.porModelo.map((m) => ({ name: m.modelo, value: m.count }))
  const dataTendencia = stats.tendencia.map((t) => ({ name: t.periodo, value: t.count }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
      <Panel titulo="Fallas por categoría">
        <BarChart data={dataCategoria}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {dataCategoria.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </Panel>

      <Panel titulo="Distribución por severidad">
        <PieChart>
          <Pie data={dataSeveridad} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {dataSeveridad.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: T.sub }} />
        </PieChart>
      </Panel>

      <Panel titulo="Top componentes afectados">
        <BarChart data={dataComponentes} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis type="number" tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} width={120} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={T.cyan} radius={[0, 4, 4, 0]} />
        </BarChart>
      </Panel>

      <Panel titulo="Distribución por origen">
        <PieChart>
          <Pie data={dataOrigen} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {dataOrigen.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: T.sub }} />
        </PieChart>
      </Panel>

      <Panel titulo="Tendencia temporal (mensual)">
        <LineChart data={dataTendencia}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke={T.cyan} strokeWidth={2} dot={{ fill: T.cyan, r: 3 }} />
        </LineChart>
      </Panel>

      <Panel titulo="Fallas por modelo">
        <BarChart data={dataModelo}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={T.purple} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```powershell
cd aeromx/frontend; npm run build
```

Esperado: build OK (recharts importa, JSX válido).

- [ ] **Step 3: Commit**

```bash
git add aeromx/frontend/src/components/fallas/FallasGraficas.jsx
git commit -m "feat(fallas): componente de graficas recharts (Fase 3)"
```

---

## Tarea 8: Página de dashboard `FallasDashboardPage`

**Files:**
- Create: `aeromx/frontend/src/pages/FallasDashboardPage.jsx`
- Modify: `aeromx/frontend/src/App.jsx` (ruta `/fallas/dashboard`)

Página con filtros (rango fechas, tipo producto, categoría, severidad, estado, origen), KPIs en chips, el componente de gráficas, tabla de detalle, y botones de export (Excel / PDF). Los filtros se mandan como query params al backend; las gráficas y la tabla reaccionan al recargar `stats`. Reusa el patrón visual de `FallasPage` (Header, StatChip, selectStyle, Card).

- [ ] **Step 1: Escribir la página**

```jsx
// aeromx/frontend/src/pages/FallasDashboardPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { fallasService } from '../api/fallasService'
import { categoriasFallaService } from '../api/categoriasFallaService'
import FallasGraficas from '../components/fallas/FallasGraficas'
import { T, SEVERIDADES, ESTADO_FALLA, ORIGENES_FALLA, TIPO_PRODUCTO, SEVERIDAD } from '../tokens/design'
import { Btn, Card, ErrorBanner, Spinner } from '../components/ui'

const selectStyle = {
  background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10,
  padding: '7px 12px', color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none', cursor: 'pointer',
}

function StatChip({ label, value, c, bg }) {
  return (
    <div style={{ background: bg, border: `1px solid ${c}25`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, color: c, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: c, fontFamily: T.mono, marginTop: 2, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

// Dispara la descarga de un blob recibido del backend.
function descargarBlob(blob, nombre) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default function FallasDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState('')

  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', tipoProducto: '', categoriaId: '', severidad: '', estado: '', origen: '',
  })

  const set = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }))

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // Solo manda filtros con valor.
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      const [resStats, resCats] = await Promise.all([
        fallasService.estadisticas(params),
        categorias.length ? Promise.resolve({ data: categorias }) : categoriasFallaService.listar({ activo: true }),
      ])
      setStats(resStats.data?.data || null)
      if (!categorias.length) setCategorias(resCats.data || [])
      setError('')
    } catch (err) {
      setError('Error cargando estadísticas')
      console.error(err)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const exportar = async (tipo) => {
    setExportando(tipo)
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      if (tipo === 'excel') {
        const res = await fallasService.descargarExcel(params)
        descargarBlob(res.data, 'fallas.xlsx')
      } else {
        const res = await fallasService.descargarResumenPDF(params)
        descargarBlob(res.data, 'resumen-fallas.pdf')
      }
    } catch (err) {
      setError('Error al exportar')
      console.error(err)
    } finally {
      setExportando('')
    }
  }

  const limpiar = () => setFiltros({ desde: '', hasta: '', tipoProducto: '', categoriaId: '', severidad: '', estado: '', origen: '' })

  const k = stats?.kpis

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: T.sub, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: T.mono, marginBottom: 4 }}>Registro de fallas</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>Analítica de Fallas</h2>
            <p style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>KPIs, tendencias y distribución de fallas. Los filtros afectan gráficas, tabla y exportación.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn variant="ghost" label="← Reportes" onClick={() => navigate('/fallas')} />
            <Btn variant="ghost" label={exportando === 'excel' ? 'Exportando…' : '⬇ Excel'} onClick={() => exportar('excel')} />
            <Btn label={exportando === 'pdf' ? 'Generando…' : '⬇ PDF resumen'} onClick={() => exportar('pdf')} />
          </div>
        </div>

        {/* Filtros */}
        <Card padding={14} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: T.sub }}>Desde
              <input type="date" value={filtros.desde} onChange={set('desde')} style={{ ...selectStyle, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: T.sub }}>Hasta
              <input type="date" value={filtros.hasta} onChange={set('hasta')} style={{ ...selectStyle, marginLeft: 6 }} />
            </label>
            <select value={filtros.tipoProducto} onChange={set('tipoProducto')} style={selectStyle}>
              <option value="">Tipo: todos</option>
              {Object.entries(TIPO_PRODUCTO).map(([key, v]) => <option key={key} value={key}>{v.icon} {v.label}</option>)}
            </select>
            <select value={filtros.categoriaId} onChange={set('categoriaId')} style={selectStyle}>
              <option value="">Categoría: todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={filtros.severidad} onChange={set('severidad')} style={selectStyle}>
              <option value="">Severidad: todas</option>
              {SEVERIDADES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filtros.estado} onChange={set('estado')} style={selectStyle}>
              <option value="">Estado: todos</option>
              {Object.entries(ESTADO_FALLA).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
            </select>
            <select value={filtros.origen} onChange={set('origen')} style={selectStyle}>
              <option value="">Origen: todos</option>
              {ORIGENES_FALLA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={limpiar} style={{ ...selectStyle, color: T.red, borderColor: `${T.red}30`, background: T.rD }}>× Limpiar</button>
          </div>
        </Card>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {loading ? (
          <Spinner label="Cargando analítica…" />
        ) : !stats || stats.kpis.total === 0 ? (
          <Card padding={40} style={{ textAlign: 'center', color: T.sub }}>Sin fallas para los filtros aplicados.</Card>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
              <StatChip label="Total"            value={k.total}            c={T.sub}   bg="rgba(96,112,160,0.12)" />
              <StatChip label="Abiertas"         value={k.abiertas}         c={T.amber} bg={T.aD} />
              <StatChip label="Resueltas"        value={k.resueltas}        c={T.green} bg={T.gD} />
              <StatChip label="Críticas abiertas" value={k.criticasAbiertas} c={T.red}   bg={T.rD} />
              <StatChip label="MTTR (días)"      value={k.mttrDias ?? '—'}  c={T.cyan}  bg={T.cD} />
              <StatChip label="% resueltas"      value={`${k.pctResueltas}%`} c={T.purple} bg={T.pD} />
            </div>

            {/* Gráficas */}
            <div style={{ marginBottom: 18 }}>
              <FallasGraficas stats={stats} />
            </div>

            {/* Tabla de detalle */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.s2, color: T.sub, textAlign: 'left' }}>
                      {['N.º', 'Título', 'Producto', 'Categoría', 'Severidad', 'Estado', 'Detección'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.detalle.map((d) => (
                      <tr key={d.numeroFalla} style={{ borderTop: `1px solid ${T.border}`, color: T.text }}>
                        <td style={{ padding: '9px 12px', fontFamily: T.mono, color: T.sub, whiteSpace: 'nowrap' }}>{d.numeroFalla}</td>
                        <td style={{ padding: '9px 12px' }}>{d.titulo}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{d.producto}</td>
                        <td style={{ padding: '9px 12px' }}>{d.categoria}</td>
                        <td style={{ padding: '9px 12px', color: SEVERIDAD[d.severidad]?.color || T.text }}>{SEVERIDAD[d.severidad]?.label || d.severidad}</td>
                        <td style={{ padding: '9px 12px', color: ESTADO_FALLA[d.estado]?.color || T.text }}>{ESTADO_FALLA[d.estado]?.label || d.estado}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{d.fechaDeteccion ? new Date(d.fechaDeteccion).toLocaleDateString('es-MX') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Registrar la ruta en `App.jsx`**

Importar la página (junto a los otros imports de pages):

```jsx
import FallasDashboardPage from './pages/FallasDashboardPage'
```

Agregar la ruta **antes** de `/fallas/:id` (si va después, `:id` captura `"dashboard"`):

```jsx
        <Route
          path="/fallas/dashboard"
          element={
            <ProtectedRoute>
              <FallasDashboardPage />
            </ProtectedRoute>
          }
        />
```

> El bloque de rutas de fallas debe quedar en este orden: `/fallas/nueva`, `/fallas/dashboard`, `/fallas`, `/fallas/:id`.

- [ ] **Step 3: Verificar build**

```powershell
cd aeromx/frontend; npm run build
```

Esperado: build OK.

- [ ] **Step 4: Verificar en navegador**

Con frontend en `:5173`, login `dev@aeromx.com / aeromx123`, navegar a `/fallas/dashboard`. Confirmar: KPIs, 6 gráficas, tabla. Cambiar un filtro (p. ej. estado=resuelta) → KPIs/gráficas/tabla se actualizan. Click "⬇ Excel" descarga `fallas.xlsx`; "⬇ PDF resumen" descarga `resumen-fallas.pdf`.

- [ ] **Step 5: Commit**

```bash
git add aeromx/frontend/src/pages/FallasDashboardPage.jsx aeromx/frontend/src/App.jsx
git commit -m "feat(fallas): pagina de analitica con filtros, KPIs, graficas y export (Fase 3)"
```

---

## Tarea 9: Enlace al dashboard desde `FallasPage`

**Files:**
- Modify: `aeromx/frontend/src/pages/FallasPage.jsx`

- [ ] **Step 1: Agregar botón "📊 Analítica" en el encabezado de FallasPage**

En el bloque de botones del encabezado (donde están "⚙ Categorías" y "+ Nueva falla"), agregar antes de "+ Nueva falla":

```jsx
            <Btn
              variant="ghost"
              label="📊 Analítica"
              onClick={() => navigate('/fallas/dashboard')}
            />
```

- [ ] **Step 2: Verificar build**

```powershell
cd aeromx/frontend; npm run build
```

Esperado: build OK.

- [ ] **Step 3: Commit**

```bash
git add aeromx/frontend/src/pages/FallasPage.jsx
git commit -m "feat(fallas): enlace a analitica desde la lista de fallas (Fase 3)"
```

---

## Tarea 10: Histórico de fallas por producto en `FlotaPage`

**Files:**
- Read primero: `aeromx/frontend/src/pages/FlotaPage.jsx` (entender su estructura actual de detalle/lista de productos)
- Modify: `aeromx/frontend/src/pages/FlotaPage.jsx`

El histórico se resuelve sin endpoint nuevo: el dashboard ya filtra por `productoId`/`modeloId`. La integración mínima y coherente es un acceso directo desde cada producto de la Flota a sus fallas filtradas.

- [ ] **Step 1: Leer `FlotaPage.jsx`**

Identificar dónde se renderiza cada producto (tarjeta/fila) y si hay vista de detalle. Localizar el `productoId` y `modeloId` disponibles en ese punto.

- [ ] **Step 2: Agregar enlace "Ver fallas" por producto**

En la tarjeta/detalle de cada producto, agregar un botón/enlace que navegue a la lista de fallas filtrada por ese producto. Como `FallasPage` filtra client-side, navegar al dashboard con el filtro por query es lo más directo; si se prefiere la lista, navegar a `/fallas` (el usuario filtra ahí). Usar el dashboard con productoId:

```jsx
// dentro del map de productos de FlotaPage, en las acciones de la tarjeta:
<Btn
  variant="ghost"
  label="⚠ Fallas"
  onClick={(e) => { e.stopPropagation(); navigate(`/fallas/dashboard?productoId=${producto.id}`) }}
/>
```

> **Nota:** el dashboard inicializa sus filtros en estado local vacío y no lee la URL. Para que el filtro por producto se aplique al entrar, hay dos opciones: (a) leer `useSearchParams()` en `FallasDashboardPage` e inicializar `filtros.productoId` desde el query; (b) dejar el enlace apuntando a `/fallas` y que el usuario filtre. Implementar (a): ver Step 3.

- [ ] **Step 3: Hacer que el dashboard lea `productoId`/`modeloId` de la URL**

En `FallasDashboardPage.jsx`, importar `useSearchParams` y sembrar el estado inicial de filtros desde el query. Reemplazar la inicialización de `filtros`:

```jsx
import { useNavigate, useSearchParams } from 'react-router-dom'
// ...
const [searchParams] = useSearchParams()
const [filtros, setFiltros] = useState({
  desde: '', hasta: '',
  productoId: searchParams.get('productoId') || '',
  modeloId: searchParams.get('modeloId') || '',
  tipoProducto: '', categoriaId: '', severidad: '', estado: '', origen: '',
})
```

> `productoId`/`modeloId` ya viajan al backend porque `cargar()` manda todos los filtros con valor; el backend ya los soporta (Tarea 1). No se exponen como selectores en la UI (no hay lista de productos cargada), pero el filtro aplica y se puede quitar con "× Limpiar".

- [ ] **Step 4: Verificar build + navegador**

```powershell
cd aeromx/frontend; npm run build
```

Esperado: build OK. En navegador: desde Flota, click "⚠ Fallas" en un producto → abre el dashboard ya filtrado por ese producto (KPIs/gráficas reflejan solo sus fallas).

- [ ] **Step 5: Commit**

```bash
git add aeromx/frontend/src/pages/FlotaPage.jsx aeromx/frontend/src/pages/FallasDashboardPage.jsx
git commit -m "feat(fallas): historico por producto desde Flota + filtro por URL en dashboard (Fase 3)"
```

---

## Tarea 11: Verificación integral + actualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (sección "Sesión N" + mover detalle a `docs/historial-sesiones.md` si aplica)
- Modify: `docs/PENDIENTES.md` (marcar Fallas Fase 3 como completada)

- [ ] **Step 1: Smoke test de los 3 endpoints backend**

Con `$env:TOKEN` válido:

```powershell
curl.exe -s -o NUL -w "estadisticas %{http_code}\n" -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/estadisticas"
curl.exe -s -o NUL -w "reporte.pdf %{http_code}\n"  -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/reporte.pdf"
curl.exe -s -o NUL -w "export.xlsx %{http_code}\n"  -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas/export.xlsx"
```

Esperado: las tres → `200`.

- [ ] **Step 2: Confirmar que `/fallas/:id` sigue funcionando (no lo rompió el orden de rutas)**

```powershell
# tomar un id real de la lista
curl.exe -s -H "Authorization: Bearer $env:TOKEN" "http://localhost:3001/api/fallas" | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object -First 1 -ExpandProperty id
# luego GET /fallas/<id> debe devolver la falla, no error
```

- [ ] **Step 3: Build final del frontend**

```powershell
cd aeromx/frontend; npm run build
```

Esperado: OK.

- [ ] **Step 4: Actualizar CLAUDE.md y PENDIENTES.md**

En `CLAUDE.md`, sección "Estado actual" → mover "Fallas Fase 3" de pendientes a completado con una línea de "Sesión N". En `docs/PENDIENTES.md`, marcar Fase 3 hecha.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/PENDIENTES.md
git commit -m "docs(fallas): Fase 3 completada (analitica + export)"
```

---

## Apéndice A — Obtener un JWT para curl (verificación)

El login dev es `dev@aeromx.com / aeromx123`. Obtener token y guardarlo en `$env:TOKEN`:

```powershell
$resp = curl.exe -s -X POST "http://localhost:3001/api/auth/login" -H "Content-Type: application/json" -d '{"email":"dev@aeromx.com","password":"aeromx123"}' | ConvertFrom-Json
$env:TOKEN = $resp.token
$env:TOKEN.Substring(0,20)  # confirma que hay token
```

> Si la ruta o el shape de la respuesta difiere, revisar `aeromx/backend/src/routes/auth.js` y el controller de login para el campo exacto del token.

---

## Self-Review (cobertura del spec §5 Fase 3)

- **Histórico por producto/modelo** → Tarea 10 (enlace desde Flota + filtro URL en dashboard). ✔
- **Dashboard con filtros comunes** (fechas, tipo, producto, modelo, categoría, severidad, estado, origen) → Tarea 8 (UI) + Tarea 1 (backend soporta todos). ✔
- **KPIs** (total, abiertas/resueltas, críticas abiertas, MTTR, % por origen/resueltas) → Tarea 1 (`kpis`) + Tarea 8 (chips). ✔
- **Gráficas 1–7** (categoría, severidad, top componentes, tendencia, modelo, producto, origen) → Tarea 1 (datasets) + Tarea 7 (recharts; se rinden 6 de las 7 en UI — `porProducto` está disponible en el dataset; añadir un panel extra es trivial si se desea). ✔ (cobertura de datos completa)
- **Análisis derivados** (Pareto, MTTR por categoría/severidad, embudo) → Tarea 1 expone `mttrPorSeveridad`, `mttrPorCategoria`, `embudoEstados`; `porCategoria`/`topComponentes` ya vienen ordenados desc (Pareto). El render en UI de embudo/MTTR es opcional; los datos están listos. ✔ (datos)
- **Tabla de detalle filtrable = lo que se exporta** → Tarea 1 `detalle` alimenta tabla (Tarea 8) y Excel (Tarea 5). ✔
- **Endpoint agregación** `GET /api/fallas/estadisticas` → Tarea 2. ✔
- **Excel `.xlsx`** (resumen + detalle) `GET /api/fallas/export.xlsx` → Tarea 5. ✔
- **PDF resumen con gráficas** `GET /api/fallas/reporte.pdf` → Tarea 4 (+ primitivas Tarea 3). ✔
- **Deps** `recharts` (frontend) / `exceljs` (backend) → Tareas 6 / 5. ✔

**Nota de alcance:** la UI rinde las gráficas de mayor valor (6 paneles + tabla). Los datasets de Pareto-explícito, MTTR-por-grupo y embudo se calculan y devuelven desde el backend; si se quieren como paneles visuales adicionales, son extensiones de bajo riesgo sobre `FallasGraficas.jsx` (mismo patrón). Se deja así para mantener cada tarea acotada y entregable.
```