# Plan de implementación — Rediseño visual del PDF de Orden de Trabajo (estilo HYDRA)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restilizar la salida PDF de las órdenes de trabajo para que adopte el lenguaje visual del prototipo HYDRA (papel claro, tipografía Geist, status pills, timeline, KV grids redondeados, person cards, galería de evidencia por renglón, dictamen con barra de progreso, signature cards), sin tocar datos, endpoints ni almacenamiento.

**Architecture:** Se conserva el endpoint `generar()` de `pdfController.js` (mismo `obtenerOrden`, `precargarFotos`, `resolverSecuencia`, `BUILTIN_RENDERERS`, paginación). Se extrae un **sistema de diseño** a dos módulos nuevos: `pdf/theme.js` (colores, fuentes con fallback, formateadores) y `pdf/ui.js` (primitivas de dibujo: pills, grids, cards, timeline, progress, paneles). El controller pasa a orquestar y delegar el dibujo a esas primitivas.

**Tech Stack:** Node 24 (ESM), pdfkit 0.15, fuentes Geist/Geist Mono (TTF embebidas con fallback a Helvetica/Courier), pngjs (one-off para teñir el logo). Sin nuevas dependencias de runtime.

---

## Spec de referencia

`docs/superpowers/specs/2026-05-22-rediseno-pdf-orden-trabajo-design.md`

## Nota sobre verificación (leer antes de empezar)

Este codebase **no tiene runner de pruebas automatizadas**. El método de verificación
establecido es **generar el PDF y revisarlo** (igual que los smoke tests previos). Por eso:

- La lógica pura barata (mapeos de color/estado, formateo de duración) se verifica con
  `node -e` (asserts inline).
- Las primitivas de dibujo y los renderers se verifican **generando un PDF real** y
  abriéndolo para comparar contra el prototipo `PDF/design_handoff_orden_trabajo/Orden de Trabajo.html`.
- Cada tarea deja el PDF **generándose sin romper** (los renderers están desacoplados vía
  `BUILTIN_RENDERERS`, así que se restiliza uno a la vez).

### Setup previo (una sola vez)

```bash
cd aeromx && docker compose up -d            # Postgres :5433 + MinIO
cd backend && npm install
npx prisma migrate deploy
npm run db:seed                              # 6 usuarios + 4 productos + 4 formatos
npm run dev                                  # API :3001 (dejar corriendo en otra terminal)
```

### Asegurar datos de prueba (una O/T cerrada por tipo)

El script de verificación necesita al menos una O/T por tipo. Si `/api/ordenes` viene vacío,
crear y cerrar una orden por tipo desde la UI (`npm run dev` en `frontend`, login
`dev@aeromx.com / aeromx123`, "+ Nueva Orden") **o** correr el smoke histórico
(`tmp-smoke/` si existe). Para revisar el rediseño basta con **una orden de aeronave con
fotos** y una de cada otro tipo.

### Script de verificación reutilizable

Se crea en la **Tarea 1** (`tmp-pdf-check/gen.mjs`) y se reutiliza en todas las tareas:
descarga el PDF de una orden de cada tipo a `tmp-pdf-check/out/`. La carpeta `tmp-pdf-check/`
es scratch (no se commitea).

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `aeromx/backend/src/pdf/theme.js` | **Crear** | Paleta `COLOR`, tokens `FONT`, `registerFonts(doc)` con fallback, `font(doc, token)`, formateadores (`fmtFecha`, `fmtHora`, `fmtFechaHora`, `fmtDuracion`). |
| `aeromx/backend/src/pdf/ui.js` | **Crear** | Primitivas: `ensureSpace`, `roundedPanel`, `sectionHead`, `statusPill`, `conditionPill`, `rolePill`, `kvGrid`, `timeline`, `personCard`, `worksTable`/`groupHead`/`workRow`, `evidenceGallery`, `progressBar`, `signatureCard`. |
| `aeromx/backend/src/pdf/fonts/*.ttf` | **Crear** | Geist + Geist Mono (TTF embebidas). |
| `aeromx/backend/public/hydra-logo.png` | **Crear** | Logo HYDRA en tinta (negro). |
| `aeromx/backend/src/controllers/ordenes/pdfController.js` | **Modificar** | Orquestación + renderers restilizados que delegan a `theme`/`ui`. Se eliminan los helpers viejos. |
| `tmp-pdf-check/gen.mjs` | **Crear (scratch)** | Generador de PDFs de verificación. No se commitea. |

---

## Tarea 1: Assets (fuentes + logo) y `theme.js`

**Files:**
- Create: `aeromx/backend/src/pdf/fonts/` (TTFs)
- Create: `aeromx/backend/public/hydra-logo.png`
- Create: `aeromx/backend/src/pdf/theme.js`
- Create: `tmp-pdf-check/gen.mjs`

- [ ] **Step 1: Obtener las fuentes Geist (TTF estáticas)**

Las fuentes son OFL (libres). pdfkit necesita **TTF/OTF estáticos** (no woff2). Desde la raíz del repo:

```bash
cd aeromx/backend
mkdir -p src/pdf/fonts
# Opción A — desde el repo oficial (TTF estáticos):
BASE="https://raw.githubusercontent.com/vercel/geist-font/main/packages/next/src/fonts"
curl -fsSL "$BASE/geist-sans/Geist-Regular.ttf"   -o src/pdf/fonts/Geist-Regular.ttf
curl -fsSL "$BASE/geist-sans/Geist-Medium.ttf"    -o src/pdf/fonts/Geist-Medium.ttf
curl -fsSL "$BASE/geist-sans/Geist-SemiBold.ttf"  -o src/pdf/fonts/Geist-SemiBold.ttf
curl -fsSL "$BASE/geist-sans/Geist-Bold.ttf"      -o src/pdf/fonts/Geist-Bold.ttf
curl -fsSL "$BASE/geist-mono/GeistMono-Regular.ttf" -o src/pdf/fonts/GeistMono-Regular.ttf
curl -fsSL "$BASE/geist-mono/GeistMono-Medium.ttf"  -o src/pdf/fonts/GeistMono-Medium.ttf
```

Verificar que son TTF reales (no HTML de error 404):

```bash
file src/pdf/fonts/*.ttf
```

Expected: cada archivo reportado como `TrueType Font` (o `data` con tamaño > 50 KB). Si alguno
salió como HTML/`ASCII text` (404), **no es bloqueante**: `theme.js` cae a Helvetica/Courier
(Step 4). En ese caso, borrar el archivo inválido y continuar; se pueden añadir TTFs después.

```bash
# borrar cualquier descarga inválida (< 5 KB suele ser un 404)
find src/pdf/fonts -name '*.ttf' -size -5k -delete
```

- [ ] **Step 2: Generar el logo HYDRA en tinta (one-off, sin dependencia de runtime)**

`hydra-logo.png` del handoff es gris con transparencia. Lo tiñe a negro conservando alpha,
usando `pngjs` (JS puro, estable en Windows) instalado como dependencia **temporal**:

```bash
cd aeromx/backend
npm i -D pngjs
```

Crear `tmp-tint-logo.mjs` en `aeromx/backend/`:

```js
import { PNG } from 'pngjs'
import fs from 'fs'
import path from 'path'

const SRC = path.resolve('../../PDF/design_handoff_orden_trabajo/hydra-logo.png')
const DEST = path.resolve('public/hydra-logo.png')

const png = PNG.sync.read(fs.readFileSync(SRC))
for (let i = 0; i < png.data.length; i += 4) {
  // Pone RGB en 0 (negro), conserva el canal alfa (i+3)
  png.data[i] = 0
  png.data[i + 1] = 0
  png.data[i + 2] = 0
}
fs.mkdirSync(path.dirname(DEST), { recursive: true })
fs.writeFileSync(DEST, PNG.sync.write(png))
console.log('Logo en tinta escrito en', DEST)
```

Ejecutar, verificar y limpiar la dependencia y el script temporal:

```bash
node tmp-tint-logo.mjs
file public/hydra-logo.png          # Expected: PNG image data
rm tmp-tint-logo.mjs
npm un pngjs
```

Expected: `public/hydra-logo.png` existe y es un PNG válido. Abrirlo: silueta del logo en negro
sobre fondo transparente.

- [ ] **Step 3: Crear `theme.js`**

Create `aeromx/backend/src/pdf/theme.js`:

```js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts')

// ─── Paleta (oklch del prototipo → hex) ──────────────────────────────────────
export const COLOR = {
  paper: '#FFFFFF', ink: '#111110', ink2: '#3A3A36', muted: '#76746B',
  line: '#E7E5DD', line2: '#F0EEE7',
  accent: '#2F5FA6', accentSoft: '#EDF1F8',
  ok: '#3F8F5F', okSoft: '#EAF4EE',
  warn: '#C08A2E', warnSoft: '#FBF3E3',
  critical: '#C0492F', criticalSoft: '#F8EAE6',
  headBg: '#F6F4ED', evidenceBg: '#FDFCF7', groupBg: '#FBFAF4',
}

// ─── Fuentes ──────────────────────────────────────────────────────────────────
// Tokens lógicos usados por todo el dibujo. registerFonts() los resuelve a Geist
// si los TTF existen, o a las built-in de pdfkit si no.
export const FONT = {
  sans: 'Geist', sansMed: 'Geist-Med', sansSemi: 'Geist-Semi', sansBold: 'Geist-Bold',
  mono: 'GeistMono', monoMed: 'GeistMono-Med',
}

const FONT_FILES = {
  Geist: 'Geist-Regular.ttf', 'Geist-Med': 'Geist-Medium.ttf',
  'Geist-Semi': 'Geist-SemiBold.ttf', 'Geist-Bold': 'Geist-Bold.ttf',
  GeistMono: 'GeistMono-Regular.ttf', 'GeistMono-Med': 'GeistMono-Medium.ttf',
}

const FALLBACK = {
  Geist: 'Helvetica', 'Geist-Med': 'Helvetica', 'Geist-Semi': 'Helvetica-Bold',
  'Geist-Bold': 'Helvetica-Bold', GeistMono: 'Courier', 'GeistMono-Med': 'Courier-Bold',
}

let RESOLVED = {}

// Registra las fuentes en el doc. Idempotente por documento.
export function registerFonts(doc) {
  RESOLVED = {}
  for (const [name, file] of Object.entries(FONT_FILES)) {
    const p = path.join(FONTS_DIR, file)
    try {
      if (fs.existsSync(p)) {
        doc.registerFont(name, p)
        RESOLVED[name] = name
        continue
      }
    } catch { /* cae a fallback */ }
    RESOLVED[name] = FALLBACK[name]
  }
}

// Aplica un token de fuente lógico al doc (con fallback). Devuelve doc para encadenar.
export function font(doc, token) {
  return doc.font(RESOLVED[token] || FALLBACK[token] || 'Helvetica')
}

// ─── Formateadores ──────────────────────────────────────────────────────────
export const fmtFecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' }) : '—'
export const fmtHora = (d) =>
  d ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
export const fmtFechaHora = (d) => (d ? `${fmtFecha(d)} · ${fmtHora(d)}` : '—')

// Duración legible entre dos fechas (p. ej. "1 h 12 min", "3 d", "—").
export function fmtDuracion(desde, hasta) {
  if (!desde || !hasta) return '—'
  const ms = new Date(hasta) - new Date(desde)
  if (ms < 0) return '—'
  const min = Math.round(ms / 60000)
  if (min < 1) return '< 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rm = min % 60
  if (h < 24) return rm ? `${h} h ${rm} min` : `${h} h`
  const d = Math.floor(h / 24)
  return `${d} d ${h % 24} h`
}
```

- [ ] **Step 4: Verificar `theme.js` (lógica pura + carga de fuentes)**

```bash
cd aeromx/backend
node -e "
import('./src/pdf/theme.js').then(async (t) => {
  const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1) } }
  assert(t.COLOR.ok === '#3F8F5F', 'color ok')
  assert(t.fmtDuracion(0, 60000) === '1 min', 'dur 1 min: ' + t.fmtDuracion(0, 60000))
  assert(t.fmtDuracion(0, 3600000) === '1 h', 'dur 1 h: ' + t.fmtDuracion(0, 3600000))
  assert(t.fmtDuracion(0, 4500000) === '1 h 15 min', 'dur 1h15: ' + t.fmtDuracion(0, 4500000))
  assert(t.fmtDuracion(null, 1) === '—', 'dur nulo')
  const { default: PDFDocument } = await import('pdfkit')
  const doc = new PDFDocument()
  t.registerFonts(doc)
  t.font(doc, t.FONT.mono)        // no debe lanzar (Geist o Courier)
  t.font(doc, t.FONT.sansBold)
  console.log('OK theme')
})
"
```

Expected: `OK theme` (sin FAIL ni excepción), tanto si los TTF están como si cae a fallback.

- [ ] **Step 5: Crear el script de verificación reutilizable**

Create `tmp-pdf-check/gen.mjs` (en la raíz del repo):

```js
// Descarga el PDF de una O/T de cada tipo a tmp-pdf-check/out/.
// Uso: node tmp-pdf-check/gen.mjs   (backend debe correr en :3001)
import fs from 'fs'
import path from 'path'

const API = 'http://localhost:3001/api'
const OUT = path.resolve('tmp-pdf-check/out')
fs.mkdirSync(OUT, { recursive: true })

const login = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'dev@aeromx.com', password: 'aeromx123' }),
})
const { token } = await login.json()
const H = { Authorization: `Bearer ${token}` }

const ordenes = await (await fetch(`${API}/ordenes?archivada=todas`, { headers: H })).json()
const porTipo = {}
for (const o of ordenes) {
  const t = o.producto?.tipoProducto || 'desconocido'
  // prioriza órdenes cerradas (tienen firmas/dictamen)
  if (!porTipo[t] || (o.estado === 'cerrada' && porTipo[t].estado !== 'cerrada')) porTipo[t] = o
}

for (const [tipo, o] of Object.entries(porTipo)) {
  const r = await fetch(`${API}/ordenes/${o.id}/pdf`, { headers: H })
  const buf = Buffer.from(await r.arrayBuffer())
  const file = path.join(OUT, `${tipo}-${o.numeroOt}.pdf`)
  fs.writeFileSync(file, buf)
  const ok = buf.subarray(0, 5).toString() === '%PDF-'
  console.log(`${ok ? 'OK ' : 'BAD'} ${tipo.padEnd(9)} ${o.numeroOt} (${o.estado}) → ${file} [${buf.length} B]`)
}
```

- [ ] **Step 6: Verificar que el PDF aún se genera (baseline)**

Con el backend corriendo:

```bash
node tmp-pdf-check/gen.mjs
```

Expected: una línea `OK` por cada tipo que tenga órdenes, cada PDF > 10 KB y empieza con `%PDF-`.
Abrir uno: debe verse el PDF **actual** (todavía sin rediseño). Esto confirma el baseline.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/sarellano/Documents/HT/Maintenance-reports"
git add aeromx/backend/src/pdf/fonts aeromx/backend/public/hydra-logo.png aeromx/backend/src/pdf/theme.js
git commit -m "feat(pdf): assets HYDRA (fuentes Geist + logo en tinta) y theme.js

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

> `tmp-pdf-check/` NO se commitea (es scratch). Verificar que está ignorado o no agregarlo.

---

## Tarea 2: Primitivas base de `ui.js` (paneles, secciones, pills)

**Files:**
- Create: `aeromx/backend/src/pdf/ui.js`

- [ ] **Step 1: Crear `ui.js` con las primitivas base**

Create `aeromx/backend/src/pdf/ui.js`:

```js
import { COLOR, FONT, font } from './theme.js'

// Salto de página si no caben `needed` px antes del margen inferior.
export function ensureSpace(doc, needed) {
  const bottom = doc.page.height - 50
  if (doc.y + needed > bottom) doc.addPage()
}

// Panel con borde redondeado opcionalmente relleno. No mueve doc.y.
export function roundedPanel(doc, x, y, w, h, { fill, stroke = COLOR.line, lw = 0.7, r = 8 } = {}) {
  doc.save()
  if (fill) doc.roundedRect(x, y, w, h, r).fill(fill)
  doc.lineWidth(lw).strokeColor(stroke).roundedRect(x, y, w, h, r).stroke()
  doc.restore()
}

// Encabezado de sección: "§ NN  Título  ─────────". Mueve doc.y debajo.
export function sectionHead(doc, num, titulo, M, W) {
  ensureSpace(doc, 38)
  doc.moveDown(0.4)
  const y = doc.y
  const tag = `§ ${String(num).padStart(2, '0')}`
  font(doc, FONT.monoMed).fontSize(9).fillColor(COLOR.muted)
    .text(tag, M, y + 2, { lineBreak: false })
  const tagW = doc.widthOfString(tag) + 10
  font(doc, FONT.sansSemi).fontSize(13).fillColor(COLOR.ink)
    .text(titulo, M + tagW, y, { lineBreak: false })
  const titleW = doc.widthOfString(titulo)
  const ruleX = M + tagW + titleW + 10
  const ruleY = y + 8
  if (ruleX < M + W) {
    doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(ruleX, ruleY).lineTo(M + W, ruleY).stroke()
  }
  doc.fillColor(COLOR.ink)
  doc.y = y + 22
  doc.x = M
}

// ─── Pills ────────────────────────────────────────────────────────────────────
// Cápsula con punto de color + label. Devuelve el ancho dibujado.
function pill(doc, x, y, label, { fg, bg, border, dot = true }) {
  font(doc, FONT.monoMed).fontSize(8.5)
  const padX = 9
  const dotW = dot ? 12 : 0
  const textW = doc.widthOfString(label.toUpperCase())
  const w = padX * 2 + dotW + textW
  const h = 17
  doc.save()
  doc.roundedRect(x, y, w, h, h / 2).fill(bg)
  if (border) { doc.lineWidth(0.8).strokeColor(border).roundedRect(x, y, w, h, h / 2).stroke() }
  if (dot) doc.circle(x + padX + 3.5, y + h / 2, 3.5).fill(fg)
  font(doc, FONT.monoMed).fontSize(8.5).fillColor(fg)
    .text(label.toUpperCase(), x + padX + dotW, y + 4.5, { lineBreak: false })
  doc.restore()
  doc.fillColor(COLOR.ink)
  return w
}

const ESTADO_PILL = {
  cerrada:          { fg: COLOR.ok,       bg: COLOR.okSoft,       label: 'Cerrada' },
  pendiente_firma:  { fg: COLOR.warn,     bg: COLOR.warnSoft,     label: 'Pendiente firma' },
  en_proceso:       { fg: COLOR.warn,     bg: COLOR.warnSoft,     label: 'En proceso' },
  borrador:         { fg: COLOR.muted,    bg: COLOR.line2,        label: 'Borrador' },
}

// Status pill alineado a la derecha de [x..x+w]. Devuelve alto consumido (0; no mueve y).
export function statusPill(doc, xRight, y, estado) {
  const cfg = ESTADO_PILL[estado] || { fg: COLOR.muted, bg: COLOR.line2, label: estado }
  font(doc, FONT.monoMed).fontSize(8.5)
  const w = 9 * 2 + 12 + doc.widthOfString(cfg.label.toUpperCase())
  pill(doc, xRight - w, y, cfg.label, { fg: cfg.fg, bg: cfg.bg, border: cfg.fg })
  return w
}

const COND_PILL = {
  bueno:              { fg: COLOR.ok,       bg: COLOR.okSoft,       label: 'Bueno' },
  correcto_con_danos: { fg: COLOR.warn,     bg: COLOR.warnSoft,     label: 'Con daños' },
  requiere_atencion:  { fg: COLOR.critical, bg: COLOR.criticalSoft, label: 'Requiere atención' },
  no_aplica:          { fg: COLOR.muted,    bg: COLOR.line2,        label: 'N/A' },
}

export function conditionPill(doc, x, y, estado) {
  const cfg = COND_PILL[estado] || { fg: COLOR.muted, bg: COLOR.line2, label: estado || '—' }
  return pill(doc, x, y, cfg.label, { fg: cfg.fg, bg: cfg.bg })
}

// Pill de rol (azul acento), sin punto.
export function rolePill(doc, x, y, label) {
  return pill(doc, x, y, label, { fg: COLOR.accent, bg: COLOR.accentSoft, dot: false })
}
```

- [ ] **Step 2: Verificar que dibuja sin lanzar**

```bash
cd aeromx/backend
node -e "
Promise.all([import('pdfkit'), import('./src/pdf/theme.js'), import('./src/pdf/ui.js')]).then(([{default:PDF},th,ui])=>{
  const fs=require('fs')
  const doc=new PDF({size:'LETTER',margin:40}); th.registerFonts(doc)
  const out=fs.createWriteStream('/tmp/ui-base.pdf'); doc.pipe(out)
  ui.sectionHead(doc,1,'Prueba de primitivas',40,532)
  ui.roundedPanel(doc,40,doc.y,532,40,{fill:th.COLOR.okSoft}); doc.y+=50
  ui.statusPill(doc,572,doc.y,'cerrada')
  ui.conditionPill(doc,40,doc.y+24,'requiere_atencion')
  ui.rolePill(doc,200,doc.y+24,'Técnico')
  doc.end(); out.on('finish',()=>console.log('OK ui-base.pdf'))
})
"
```

Expected: `OK ui-base.pdf`. Abrir `/tmp/ui-base.pdf` (o `%TEMP%` en Windows: usar
`./tmp/ui-base.pdf` si `/tmp` no existe): se ven el header de sección, un panel verde redondeado
y los tres pills con su color.

> Si `/tmp` no existe en tu shell, cambia la ruta a `'./ui-base.pdf'` y bórralo después.

- [ ] **Step 3: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js
git commit -m "feat(pdf): primitivas base de ui (paneles, sectionHead, pills)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 3: Header, título y status pill

**Files:**
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Reemplazar imports y constantes de marca/color**

En `pdfController.js`, sustituir el bloque de imports y las constantes `COMPANY`/`COLOR`
(líneas ~1–45) por:

```js
import * as svc from '../../services/ordenesService.js'
import { resolverSecuencia } from '../../services/formatosService.js'
import { renderMarkdown } from '../../pdf/markdown.js'
import { storage, keyDesdeUrl } from '../../lib/storage/index.js'
import { COLOR, FONT, font, registerFonts, fmtFecha, fmtFechaHora, fmtDuracion } from '../../pdf/theme.js'
import * as ui from '../../pdf/ui.js'
import fs from 'fs'
import path from 'path'

const COMPANY = {
  nombre: 'HYDRA',
  lema: 'Gestión de mantenimiento',
  direccion: 'Planta 20 City · México',
  telefono: '+52 (55) 0000-0000',
  email: 'soporte@hydra.mx',
}

const ESTADO_LABELS_PDF = {
  bueno: 'BUENO', correcto_con_danos: 'CON DAÑOS',
  requiere_atencion: 'REQUIERE ATENCIÓN', no_aplica: 'N/A',
}

const TIPO_LABELS = {
  aeronave: 'Aeronave', camion: 'Camión', planta: 'Planta de energía', sensor: 'Sensor',
}
```

> Se eliminan las constantes `COLOR` locales y los `fmt*` locales (ahora vienen de `theme.js`).
> Se conservan por ahora `filasDatosProducto`, `etiquetaRecepcion`, `calcularTotales`,
> `precargarFotos`, `esImagenEmbebible` (se ajustan en tareas posteriores).

- [ ] **Step 2: Registrar fuentes y dibujar la nueva cabecera en `generar()`**

En `generar()`, después de crear `doc` y antes de `drawHeader`, registrar fuentes:

```js
    registerFonts(doc)
```

Reemplazar `drawHeader(doc, orden, M, CONTENT_W)` por dos llamadas:

```js
    drawHeader(doc, orden, M, CONTENT_W)
    drawTitleRow(doc, orden, M, CONTENT_W)
```

- [ ] **Step 3: Reescribir `drawHeader` y agregar `drawTitleRow`**

Reemplazar la función `drawHeader` completa por:

```js
function drawHeader(doc, orden, M, W) {
  const topY = 40
  // Logo HYDRA en tinta (o texto si falta el archivo)
  const logoPath = path.join(process.cwd(), 'public/hydra-logo.png')
  let logoBottom = topY
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, M, topY, { height: 30 })
      logoBottom = topY
    }
  } catch { /* ignora; cae a texto abajo */ }

  // Marca (texto al lado del logo). Si no hubo logo, queda como marca textual.
  const brandX = fs.existsSync(logoPath) ? M + 86 : M
  font(doc, FONT.sansSemi).fontSize(11).fillColor(COLOR.ink)
    .text(`${COMPANY.nombre} · ${COMPANY.lema}`, brandX, topY + 2, { lineBreak: false })
  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text(`${COMPANY.direccion} · ${COMPANY.telefono} · ${COMPANY.email}`,
      brandX, topY + 17, { lineBreak: false })

  // Meta a la derecha (mono)
  font(doc, FONT.mono).fontSize(8.5).fillColor(COLOR.muted)
  const metaLines = [
    `Documento  O/T`,
    `Generado  ${fmtFechaHora(new Date())}`,
    `Formato  v${orden.formato.version} · ${orden.formato.nombre}`,
  ]
  let my = topY
  for (const line of metaLines) {
    doc.fillColor(COLOR.muted).text(line, M, my, { width: W, align: 'right', lineBreak: false })
    my += 12
  }

  // Separador sólido en tinta
  const sepY = topY + 40
  doc.lineWidth(1).strokeColor(COLOR.ink).moveTo(M, sepY).lineTo(M + W, sepY).stroke()
  doc.fillColor(COLOR.ink)
  doc.y = sepY + 16
  doc.x = M
}

function drawTitleRow(doc, orden, M, W) {
  const y = doc.y
  // Reservar espacio del status pill a la derecha
  const pillReserve = 130
  const leftW = W - pillReserve

  font(doc, FONT.mono).fontSize(9).fillColor(COLOR.muted)
    .text('ORDEN DE TRABAJO DE MANTENIMIENTO', M, y, {
      width: leftW, characterSpacing: 1.2, lineBreak: false,
    })
  font(doc, FONT.sansMed).fontSize(26).fillColor(COLOR.ink)
    .text(orden.formato.nombre, M, y + 14, { width: leftW })
  const folioY = doc.y + 2
  font(doc, FONT.mono).fontSize(12).fillColor(COLOR.ink2)
    .text(`N.º  ${orden.numeroOt}`, M, folioY, { width: leftW, lineBreak: false })

  // Status pill alineado al tope del título
  ui.statusPill(doc, M + W, y + 16, orden.estado)

  doc.fillColor(COLOR.ink)
  doc.y = folioY + 22
  doc.x = M
}
```

- [ ] **Step 4: Generar y verificar el header**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: PDFs `OK`. Abrir el de aeronave: cabecera sobre **papel blanco** (sin banda azul),
logo HYDRA en negro a la izquierda + nombre/contacto, meta mono a la derecha, línea sólida,
título grande con el nombre del formato, folio mono y **status pill verde "CERRADA"** a la derecha.

- [ ] **Step 5: Commit**

```bash
git add aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): cabecera y título estilo HYDRA (papel claro + status pill)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 4: Timeline de 4 hitos

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `timeline`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Agregar `timeline` a `ui.js`**

Añadir al final de `ui.js`:

```js
// Strip horizontal de N pasos con borde sup/inf y separadores verticales.
// steps: [{ num, label, value, mono }]
export function timeline(doc, steps, M, W) {
  ensureSpace(doc, 64)
  const y = doc.y
  const h = 52
  const colW = W / steps.length

  // bordes superior e inferior
  doc.lineWidth(0.8).strokeColor(COLOR.line)
  doc.moveTo(M, y).lineTo(M + W, y).stroke()
  doc.moveTo(M, y + h).lineTo(M + W, y + h).stroke()

  steps.forEach((s, i) => {
    const cx = M + i * colW
    const pad = i === 0 ? 0 : 14
    const inner = cx + pad
    if (i > 0) {
      doc.lineWidth(0.7).strokeColor(COLOR.line2).moveTo(cx, y + 10).lineTo(cx, y + h - 10).stroke()
    }
    // círculo numerado
    const r = 9
    doc.save()
    doc.circle(inner + r, y + 14, r).fill(COLOR.ink)
    font(doc, FONT.monoMed).fontSize(9).fillColor(COLOR.paper)
      .text(String(s.num), inner, y + 10, { width: r * 2, align: 'center', lineBreak: false })
    doc.restore()
    // label
    font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
      .text(s.label.toUpperCase(), inner, y + 27, {
        width: colW - pad - 6, characterSpacing: 0.6, lineBreak: false, ellipsis: true,
      })
    // valor
    font(doc, FONT.sansMed).fontSize(9.5).fillColor(COLOR.ink)
      .text(s.value, inner, y + 38, { width: colW - pad - 6, lineBreak: false, ellipsis: true })
  })
  doc.fillColor(COLOR.ink)
  doc.y = y + h + 16
  doc.x = M
}
```

- [ ] **Step 2: Llamar al timeline en `generar()` después del título**

En `generar()`, justo después de `drawTitleRow(...)`, agregar:

```js
    drawTimeline(doc, orden, M, CONTENT_W)
```

Y agregar la función helper en `pdfController.js`:

```js
function drawTimeline(doc, orden, M, W) {
  const tipo = orden.producto?.tipoProducto
  const labelRecepcion = { aeronave: 'Recepción aeronave', camion: 'Recepción camión',
    planta: 'Recepción planta', sensor: 'Recepción sensor' }[tipo] || 'Recepción'
  ui.timeline(doc, [
    { num: 1, label: 'Creación de orden', value: orden.createdAt ? fmtFecha(orden.createdAt) : 'Pendiente' },
    { num: 2, label: labelRecepcion,      value: orden.fechaRecepcion ? fmtFecha(orden.fechaRecepcion) : 'Pendiente' },
    { num: 3, label: 'Inicio mantenim.',  value: orden.fechaInicio ? fmtFecha(orden.fechaInicio) : 'Pendiente' },
    { num: 4, label: 'Cierre / firma',    value: orden.fechaCierre ? fmtFecha(orden.fechaCierre) : 'Pendiente' },
  ], M, W)
}
```

- [ ] **Step 3: Generar y verificar**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: bajo el título aparece el strip de 4 hitos con círculos negros numerados, labels mono
y fechas. Hitos sin fecha muestran "Pendiente".

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): timeline de 4 hitos

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 5: KV grid redondeado (datos generales + datos producto)

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `kvGrid`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Agregar `kvGrid` a `ui.js`**

Añadir al final de `ui.js`:

```js
// Grid clave-valor con panel redondeado y hairlines internos.
// pairs: [[label, value, opts?]]  opts: { mono, lg, color }
export function kvGrid(doc, pairs, cols, M, W) {
  const rowH = 34
  const colW = W / cols
  const rows = Math.ceil(pairs.length / cols)
  const totalH = rows * rowH
  ensureSpace(doc, totalH + 8)
  const y0 = doc.y

  // panel exterior
  roundedPanel(doc, M, y0, W, totalH, { stroke: COLOR.line })

  // hairlines internos (sin tocar el borde redondeado)
  doc.save().lineWidth(0.6).strokeColor(COLOR.line2)
  for (let c = 1; c < cols; c++) {
    const x = M + c * colW
    doc.moveTo(x, y0 + 4).lineTo(x, y0 + totalH - 4).stroke()
  }
  for (let rr = 1; rr < rows; rr++) {
    const yy = y0 + rr * rowH
    doc.moveTo(M + 4, yy).lineTo(M + W - 4, yy).stroke()
  }
  doc.restore()

  pairs.forEach((p, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = M + c * colW
    const y = y0 + r * rowH
    const [label, value, opts = {}] = p
    font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
      .text(String(label).toUpperCase(), x + 11, y + 7, {
        width: colW - 18, characterSpacing: 0.5, lineBreak: false, ellipsis: true,
      })
    const valFont = opts.mono ? FONT.monoMed : FONT.sansMed
    const valSize = opts.lg ? 13 : opts.mono ? 10.5 : 11.5
    font(doc, valFont).fontSize(valSize).fillColor(opts.color || COLOR.ink)
      .text(String(value ?? '—'), x + 11, y + 18, {
        width: colW - 18, height: rowH - 20, lineBreak: false, ellipsis: true,
      })
  })
  doc.fillColor(COLOR.ink)
  doc.y = y0 + totalH + 6
  doc.x = M
}
```

- [ ] **Step 2: Reescribir `renderDatosGenerales` y `renderDatosProducto`**

Reemplazar `renderDatosGenerales` por (hitos eliminados → ya están en el timeline; se agrega "Duración total"):

```js
function renderDatosGenerales(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Datos generales del servicio', ctx.M, ctx.W)
  const tipo = orden.producto?.tipoProducto
  const estadoLabel = orden.estado.replace(/_/g, ' ').toUpperCase()
  const estadoColor = orden.estado === 'cerrada' ? COLOR.ok
    : orden.estado === 'borrador' ? COLOR.muted : COLOR.warn
  ui.kvGrid(doc, [
    ['N.º Orden',              orden.numeroOt, { mono: true }],
    ['Tipo de producto',       TIPO_LABELS[tipo] || '—'],
    ['Formato',                `${orden.formato.nombre} v${orden.formato.version}`],
    ['Cliente',                orden.cliente || '—', { mono: true }],
    ['Orden de servicio',      orden.ordenServicio || '—', { mono: true }],
    ['Lugar de mantenimiento', orden.lugarMantenimiento || '—'],
    ['Duración total',         fmtDuracion(orden.createdAt, orden.fechaCierre)],
    ['Estado actual',          estadoLabel, { color: estadoColor }],
  ], 4, ctx.M, ctx.W)
}
```

Reemplazar `renderDatosProducto` por (conserva `filasDatosProducto`, valores `lg`):

```js
function renderDatosProducto(doc, orden, ctx) {
  const tipo = orden.producto?.tipoProducto || 'producto'
  const tituloMap = {
    aeronave: 'Datos de la aeronave', camion: 'Datos del camión',
    planta: 'Datos de la planta', sensor: 'Datos del sensor',
  }
  ui.sectionHead(doc, ctx.nextSectionNum(), tituloMap[tipo] || 'Datos del producto', ctx.M, ctx.W)
  // filasDatosProducto devuelve [label, value]; marcamos mono/lg para los prominentes
  const filas = filasDatosProducto(orden).map(([label, value], idx) => {
    const esSerieOIdent = /serie|placas|matrícula|interno|vin|firmware/i.test(label)
    return [label, value, { lg: idx < 3, mono: esSerieOIdent }]
  })
  ui.kvGrid(doc, filas, 3, ctx.M, ctx.W)
}
```

- [ ] **Step 3: Generar y verificar**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: §01 y §02 como grids con **borde redondeado y hairlines internos tenues**; labels mono
en gris, valores en Geist; "Estado actual" coloreado; §02 con 3 columnas y valores grandes en serie/modelo/fabricante.
Probar los 4 tipos (campos cambian por tipo).

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): KV grids redondeados para datos generales y de producto

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 6: Person cards

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `personCard`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Agregar `personCard` a `ui.js`**

Añadir al final de `ui.js`:

```js
// Card de persona. card: { categoria, rolTag, nombre, rol, licencia }
export function personCard(doc, x, y, w, h, card) {
  roundedPanel(doc, x, y, w, h, { stroke: COLOR.line })
  // header: categoría + pill de rol
  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text((card.categoria || '').toUpperCase(), x + 12, y + 11, {
      width: w - 90, characterSpacing: 0.8, lineBreak: false, ellipsis: true,
    })
  if (card.rolTag) {
    font(doc, FONT.monoMed).fontSize(8.5)
    const pw = 9 * 2 + doc.widthOfString(card.rolTag.toUpperCase())
    rolePill(doc, x + w - 12 - pw, y + 8, card.rolTag)
  }
  // nombre
  font(doc, FONT.sansSemi).fontSize(13).fillColor(COLOR.ink)
    .text(card.nombre || 'No asignado', x + 12, y + 30, {
      width: w - 24, lineBreak: false, ellipsis: true,
    })
  // pie punteado: Rol / Licencia
  const footY = y + h - 26
  doc.save().lineWidth(0.7).strokeColor(COLOR.line).dash(2, { space: 2 })
    .moveTo(x + 12, footY).lineTo(x + w - 12, footY).stroke().undash().restore()
  font(doc, FONT.mono).fontSize(7).fillColor(COLOR.muted)
    .text('ROL', x + 12, footY + 6, { lineBreak: false })
    .text('LICENCIA', x + w / 2, footY + 6, { lineBreak: false })
  font(doc, FONT.sansMed).fontSize(9).fillColor(COLOR.ink2)
    .text(card.rol || '—', x + 12, footY + 14, { width: w / 2 - 16, lineBreak: false, ellipsis: true })
  font(doc, FONT.monoMed).fontSize(9).fillColor(COLOR.ink)
    .text(card.licencia || '—', x + w / 2, footY + 14, { width: w / 2 - 16, lineBreak: false, ellipsis: true })
  doc.fillColor(COLOR.ink)
}
```

- [ ] **Step 2: Reescribir `renderPersonal` (grid 3-col que envuelve, 2–5 cards)**

Reemplazar `renderPersonal` y eliminar `drawPersonaCard`:

```js
function renderPersonal(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Personal responsable', ctx.M, ctx.W)

  const mk = (categoria, rolTag, persona) => ({
    categoria, rolTag, nombre: persona?.nombre || 'No asignado',
    rol: (persona?.rol || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || '—',
    licencia: persona?.licenciaNum || '—',
  })

  const cards = [mk('Soporte', 'Técnico', orden.soporte)]
  if (orden.ingenieroAuxiliar) cards.push(mk('Soporte', 'Ing. aux.', orden.ingenieroAuxiliar))
  cards.push(mk('Mantenimiento', 'Mecánico', orden.mecanico))
  cards.push(mk('Aprobación', 'Gerente', orden.gerente))
  if (orden.producto?.tipoProducto === 'aeronave') cards.push(mk('Operación', 'Piloto', orden.piloto))

  const cols = 3
  const gap = 10
  const cardW = (ctx.W - gap * (cols - 1)) / cols
  const cardH = 92

  for (let i = 0; i < cards.length; i += cols) {
    ui.ensureSpace(doc, cardH + 12)
    const y = doc.y
    for (let c = 0; c < cols && i + c < cards.length; c++) {
      const x = ctx.M + c * (cardW + gap)
      ui.personCard(doc, x, y, cardW, cardH, cards[i + c])
    }
    doc.y = y + cardH + gap
    doc.x = ctx.M
  }
}
```

- [ ] **Step 3: Generar y verificar (4 tipos)**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: §03 con cards redondeadas. Aeronave: hasta 5 cards (incluye Piloto y, si aplica,
Ing. aux.) en filas de 3. Otros tipos: 3 cards (Soporte/Mantenimiento/Aprobación). Cada card con
pill de rol azul, nombre, y pie punteado Rol/Licencia.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): person cards (2-5 segun tipo) con pill de rol

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 7: Tabla de trabajos (group head + work row + condition pill)

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `worksTableHeader`, `groupHead`, `workRow`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

> En esta tarea se restiliza la **tabla**; la galería de fotos por renglón se agrega en la Tarea 8.

- [ ] **Step 1: Agregar primitivas de tabla a `ui.js`**

Añadir al final de `ui.js`:

```js
// Columnas de la tabla de trabajos. Anchos relativos al W disponible.
export function worksColumns(W) {
  // #, Componente, Descripción, Condición, Firma, Fotos
  const fixed = 28 + 110 + 70 + 48        // #, condición, firma, fotos
  const rest = W - fixed
  return [
    { key: 'idx',  w: 28,  label: '#' },
    { key: 'comp', w: Math.round(rest * 0.42), label: 'Componente' },
    { key: 'desc', w: rest - Math.round(rest * 0.42), label: 'Descripción' },
    { key: 'cond', w: 110, label: 'Condición' },
    { key: 'firma', w: 70, label: 'Firma' },
    { key: 'fotos', w: 48, label: 'Fotos' },
  ]
}

export function worksTableHeader(doc, cols, M) {
  const totalW = cols.reduce((a, c) => a + c.w, 0)
  const y = doc.y
  doc.save().rect(M, y, totalW, 18).fill(COLOR.headBg).restore()
  let x = M
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
  for (const c of cols) {
    doc.text(c.label.toUpperCase(), x + 6, y + 5.5, {
      width: c.w - 10, characterSpacing: 0.5, lineBreak: false, ellipsis: true,
    })
    x += c.w
  }
  doc.fillColor(COLOR.ink)
  doc.y = y + 18
}

export function groupHead(doc, nombre, hechos, total, M, W) {
  ensureSpace(doc, 22)
  const y = doc.y
  doc.save().rect(M, y, W, 18).fill(COLOR.groupBg).restore()
  font(doc, FONT.monoMed).fontSize(8).fillColor(COLOR.ink)
    .text(`GRUPO · ${nombre.toUpperCase()}`, M + 8, y + 5.5, {
      width: W - 120, characterSpacing: 0.6, lineBreak: false, ellipsis: true,
    })
  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text(`${hechos} de ${total} ejecutados`, M, y + 5.5, { width: W - 8, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.ink)
  doc.y = y + 18
}

// Dibuja una fila de trabajo (sin la galería de fotos, que va aparte).
// row: { idx, componente, critico, descripcion, estado, firma, fotosN, fotosM }
export function workRow(doc, cols, M, row) {
  const W = cols.reduce((a, c) => a + c.w, 0)
  const descCol = cols.find((c) => c.key === 'desc')
  const compCol = cols.find((c) => c.key === 'comp')

  font(doc, FONT.sans).fontSize(8.5)
  const descH = doc.heightOfString(row.descripcion || '—', { width: descCol.w - 12 })
  const compH = doc.heightOfString(row.componente || '—', { width: compCol.w - 12 })
  const rowH = Math.max(30, descH + 14, compH + 14)
  ensureSpace(doc, rowH + 4)
  const y = doc.y

  // separador superior
  doc.lineWidth(0.6).strokeColor(COLOR.line2).moveTo(M, y).lineTo(M + W, y).stroke()

  let x = M
  for (const c of cols) {
    const cx = x + 6
    if (c.key === 'idx') {
      font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
        .text(row.idx, cx, y + 8, { width: c.w - 8, lineBreak: false })
    } else if (c.key === 'comp') {
      font(doc, FONT.sansSemi).fontSize(9).fillColor(COLOR.ink)
        .text(row.componente, cx, y + 8, { width: c.w - 12 })
      if (row.critico) {
        font(doc, FONT.sansSemi).fontSize(9).fillColor(COLOR.critical)
          .text(' ✦', cx + doc.widthOfString(row.componente), y + 8, { lineBreak: false })
      }
    } else if (c.key === 'desc') {
      font(doc, FONT.sans).fontSize(8.5).fillColor(COLOR.ink2)
        .text(row.descripcion || '—', cx, y + 8, { width: c.w - 12 })
    } else if (c.key === 'cond') {
      conditionPill(doc, cx, y + 6, row.estado)
    } else if (c.key === 'firma') {
      font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
        .text(row.firma, cx, y + 8, { width: c.w - 10, lineBreak: false, ellipsis: true })
    } else if (c.key === 'fotos') {
      font(doc, FONT.mono).fontSize(8.5).fillColor(row.fotosN > 0 ? COLOR.ink : COLOR.muted)
        .text(`${row.fotosN}/${row.fotosM}`, cx, y + 8, { width: c.w - 10, lineBreak: false })
    }
    x += c.w
  }
  doc.fillColor(COLOR.ink)
  doc.y = y + rowH
  return { rowStartY: y, rowH }
}
```

- [ ] **Step 2: Reescribir `renderTrabajos` (sin galería todavía)**

Reemplazar `renderTrabajos` por:

```js
function renderTrabajos(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Trabajos realizados', ctx.M, ctx.W)
  const resultadosPorPunto = Object.fromEntries(orden.resultados.map((r) => [r.puntoId, r]))
  const cols = ui.worksColumns(ctx.W)

  ui.worksTableHeader(doc, cols, ctx.M)

  for (const seccion of orden.formato.secciones || []) {
    const puntos = (seccion.puntos || []).filter((p) => resultadosPorPunto[p.id])
    if (puntos.length === 0) continue
    const hechos = puntos.filter((p) => resultadosPorPunto[p.id]?.completado).length
    // re-dibujar header de tabla si el group head salta de página
    ui.groupHead(doc, seccion.nombre, hechos, puntos.length, ctx.M, ctx.W)

    let idx = 1
    for (const punto of puntos) {
      const r = resultadosPorPunto[punto.id]
      ui.workRow(doc, cols, ctx.M, {
        idx: String(idx++).padStart(2, '0'),
        componente: punto.nombreComponente,
        critico: punto.esCritico,
        descripcion: punto.descripcion || '—',
        estado: r.estadoResultado,
        firma: r.firmadoPor ? (r.firmante?.nombre || 'Firmado') : (punto.esCritico ? 'Pendiente' : '— No req.'),
        fotosN: r.fotos?.length || 0,
        fotosM: r.fotos?.length || 0,
      })
      // (galería de fotos → Tarea 8)
    }
  }

  // borde redondeado envolvente se omite aquí por simplicidad de paginación;
  // la jerarquía la dan header/group heads. Leyenda al final:
  ui.ensureSpace(doc, 24)
  doc.moveDown(0.3)
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text('✦ Punto crítico — requiere firma individual.   Condición: BUENO · CON DAÑOS · REQUIERE ATENCIÓN · N/A',
      ctx.M, doc.y, { width: ctx.W, lineBreak: false, ellipsis: true })
  doc.fillColor(COLOR.ink)
  doc.moveDown(0.4)
}
```

> Nota: `fotosM` (denominador) se deja igual a `fotosN` porque el sistema no define un número
> fijo de slots requeridos por punto (las fotos son variables). Si en el futuro hay un mínimo por
> punto, se ajusta el denominador.

- [ ] **Step 3: Generar y verificar**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: §04 con header `#/Componente/Descripción/Condición/Firma/Fotos` sobre `#F6F4ED`,
group heads por sección con contador "N de M ejecutados", filas con **condition pill** coloreado,
componente en negrita (✦ rojo si crítico), descripción gris, contador de fotos. Probar aeronave
(muchas secciones → varias páginas; el group head se redibuja al saltar).

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): tabla de trabajos restilizada (group heads + condition pills)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 8: Galería de evidencia por renglón

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `evidenceGallery`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Agregar `evidenceGallery` a `ui.js`**

Añadir al final de `ui.js`:

```js
// Galería de fotos bajo un renglón de trabajo. fotos: [{ urlArchivo, nombreArchivo, fechaCaptura }]
// buffers: Map<urlArchivo, Buffer|null>. fmtFechaFn: (date)=>string.
export function evidenceGallery(doc, fotos, buffers, M, W, fmtFechaFn) {
  if (!fotos || fotos.length === 0) return
  const cols = 3
  const gap = 8
  const padL = 24
  const innerW = W - padL
  const cellW = (innerW - gap * (cols - 1)) / cols
  const imgH = 92
  const capH = 16
  const cellH = imgH + capH

  // banda de evidencia (fondo + borde punteado superior)
  const rows = Math.ceil(fotos.length / cols)
  const blockH = 22 + rows * cellH + (rows - 1) * gap + 8
  ensureSpace(doc, blockH)
  const y0 = doc.y

  doc.save().rect(M, y0, W, blockH).fill(COLOR.evidenceBg).restore()
  doc.save().lineWidth(0.7).strokeColor(COLOR.line).dash(2, { space: 2 })
    .moveTo(M, y0).lineTo(M + W, y0).stroke().undash().restore()

  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text('EVIDENCIA FOTOGRÁFICA', M + padL, y0 + 8, { characterSpacing: 0.8, lineBreak: false })

  let cy = y0 + 22
  fotos.forEach((foto, i) => {
    const c = i % cols
    const x = M + padL + c * (cellW + gap)
    const buf = buffers.get(foto.urlArchivo) || null
    doc.lineWidth(0.6).strokeColor(COLOR.line).roundedRect(x, cy, cellW, imgH, 4).stroke()
    if (buf) {
      try {
        doc.save().roundedRect(x, cy, cellW, imgH, 4).clip()
        doc.image(buf, x + 2, cy + 2, { fit: [cellW - 4, imgH - 4], align: 'center', valign: 'center' })
        doc.restore()
      } catch {
        font(doc, FONT.sans).fontSize(7.5).fillColor(COLOR.muted)
          .text('Imagen ilegible', x, cy + imgH / 2 - 4, { width: cellW, align: 'center', lineBreak: false })
      }
    } else {
      font(doc, FONT.sans).fontSize(7.5).fillColor(COLOR.muted)
        .text('Archivo no disponible', x, cy + imgH / 2 - 4, { width: cellW, align: 'center', lineBreak: false })
    }
    const fecha = foto.fechaCaptura ? ` · ${fmtFechaFn(foto.fechaCaptura)}` : ''
    font(doc, FONT.mono).fontSize(7).fillColor(COLOR.muted)
      .text(`Foto ${String(i + 1).padStart(2, '0')}${fecha}`, x, cy + imgH + 3, {
        width: cellW, lineBreak: false, ellipsis: true,
      })
    if (c === cols - 1) cy += cellH + gap
  })
  doc.fillColor(COLOR.ink)
  doc.y = y0 + blockH
  doc.x = M
}
```

- [ ] **Step 2: Llamar a la galería tras cada `workRow` y desactivar el renderer `fotos`**

En `renderTrabajos` (Tarea 7), justo después de la llamada a `ui.workRow(...)`, agregar:

```js
      const r2 = r // mismo resultado
      if (r2.fotos && r2.fotos.length > 0) {
        ui.evidenceGallery(doc, r2.fotos, ctx.fotosBuffers, ctx.M, ctx.W, fmtFecha)
      }
```

Reemplazar `renderFotos` por un no-op (la evidencia ya va por renglón):

```js
// La evidencia ahora se dibuja por renglón dentro de renderTrabajos.
// Se deja como no-op para no romper secuencias guardadas que incluyan "fotos".
function renderFotos() { /* no-op */ }
```

Eliminar las funciones `drawEvidenciaFotografica` y `dibujarPlaceholderFoto` (ya no se usan).
Conservar `precargarFotos` y `esImagenEmbebible` (siguen alimentando `ctx.fotosBuffers`).

- [ ] **Step 3: Generar y verificar (orden de aeronave con fotos)**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: bajo los renglones que tienen fotos aparece una banda `#FDFCF7` con borde punteado
superior, título "EVIDENCIA FOTOGRÁFICA" y grid de 3 columnas con las imágenes embebidas
(esquinas redondeadas) y caption "Foto NN · fecha". Renglones sin fotos: sin banda. Verificar que
**no** existe ya una sección de "Evidencia fotográfica" separada al final.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): galeria de evidencia por renglon; seccion de fotos separada eliminada

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 9: Dictamen y observaciones (con barra de progreso)

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `progressBar` y `dictumBlock`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Agregar `progressBar` y `dictumBlock` a `ui.js`**

Añadir al final de `ui.js`:

```js
export function progressBar(doc, x, y, w, ratio) {
  const h = 4
  doc.save()
  doc.roundedRect(x, y, w, h, 2).fill(COLOR.line2)
  if (ratio > 0) doc.roundedRect(x, y, Math.max(2, w * Math.min(1, ratio)), h, 2).fill(COLOR.ok)
  doc.restore()
}

// Bloque de dictamen de 3 celdas. cells: [{ label, value, color, sub, progress }]
export function dictumBlock(doc, cells, M, W) {
  const h = 76
  const colW = W / cells.length
  ensureSpace(doc, h + 8)
  const y = doc.y
  roundedPanel(doc, M, y, W, h, { stroke: COLOR.line })
  doc.save().lineWidth(0.6).strokeColor(COLOR.line2)
  for (let c = 1; c < cells.length; c++) {
    const x = M + c * colW
    doc.moveTo(x, y + 4).lineTo(x, y + h - 4).stroke()
  }
  doc.restore()

  cells.forEach((cell, i) => {
    const x = M + i * colW
    font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
      .text(cell.label.toUpperCase(), x + 14, y + 12, { width: colW - 24, characterSpacing: 0.5, lineBreak: false })
    font(doc, FONT.sansMed).fontSize(20).fillColor(cell.color || COLOR.ink)
      .text(cell.value, x + 14, y + 26, { width: colW - 24, lineBreak: false, ellipsis: true })
    if (cell.progress != null) progressBar(doc, x + 14, y + 54, colW - 28, cell.progress)
    if (cell.sub) {
      font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
        .text(cell.sub, x + 14, y + 54, { width: colW - 24, lineBreak: false, ellipsis: true })
    }
  })
  doc.fillColor(COLOR.ink)
  doc.y = y + h + 6
  doc.x = M
}
```

- [ ] **Step 2: Reescribir `renderDictamen`**

Reemplazar `renderDictamen` por:

```js
function renderDictamen(doc, orden, ctx) {
  if (!orden.cierre) return
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Dictamen y observaciones generales', ctx.M, ctx.W)
  const c = orden.cierre
  const { completados, totalPuntos } = ctx.totales
  const ratio = totalPuntos > 0 ? completados / totalPuntos : 0

  ui.dictumBlock(doc, [
    { label: 'Puntos ejecutados', value: `${completados} / ${totalPuntos}`, progress: ratio },
    {
      label: '¿Se encontró defecto?',
      value: c.seEncontroDefecto ? 'Sí' : 'No',
      color: c.seEncontroDefecto ? COLOR.critical : COLOR.ok,
      sub: c.seEncontroDefecto ? 'Ver documento correctivo' : 'Equipo apto para servicio',
    },
    {
      label: 'Documento correctivo',
      value: c.refDocCorrectivo || '—',
      color: c.refDocCorrectivo ? COLOR.ink : COLOR.muted,
      sub: c.refDocCorrectivo ? '' : 'No aplica',
    },
  ], ctx.M, ctx.W)

  // bloque de observaciones
  const obs = c.observacionesGenerales
  ui.ensureSpace(doc, 60)
  const y = doc.y
  font(doc, FONT.sans).fontSize(10)
  const txt = obs || 'Sin observaciones adicionales registradas por el técnico responsable.'
  const txtH = doc.heightOfString(txt, { width: ctx.W - 28 })
  const boxH = Math.max(48, txtH + 30)
  ui.roundedPanel(doc, ctx.M, y, ctx.W, boxH, { fill: '#FCFBF6', stroke: COLOR.line })
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text('OBSERVACIONES GENERALES', ctx.M + 14, y + 11, { characterSpacing: 0.6, lineBreak: false })
  font(doc, obs ? FONT.sans : FONT.sans).fontSize(10).fillColor(obs ? COLOR.ink2 : COLOR.muted)
    .text(txt, ctx.M + 14, y + 24, { width: ctx.W - 28, oblique: !obs })
  doc.fillColor(COLOR.ink)
  doc.y = y + boxH + 6
  doc.x = ctx.M
}
```

- [ ] **Step 3: Generar y verificar**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: §05 con 3 celdas (Puntos ejecutados + barra verde, ¿Defecto? Sí/No coloreado,
Doc. correctivo) en panel redondeado, y debajo el bloque de observaciones (texto real o estado
vacío en gris/cursiva).

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): dictamen con barra de progreso y bloque de observaciones

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 10: Signature cards

**Files:**
- Modify: `aeromx/backend/src/pdf/ui.js` (agregar `signatureCard`)
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Agregar `signatureCard` a `ui.js`**

Añadir al final de `ui.js`:

```js
// Card de firma. caja: { categoria, nombre, rol, licencia, fecha }  (fecha truthy = firmada)
export function signatureCard(doc, x, y, w, h, caja, fmtFechaHoraFn) {
  const firmada = !!caja.fecha
  roundedPanel(doc, x, y, w, h, { fill: firmada ? '#FBFCFA' : COLOR.paper, stroke: COLOR.line })

  // header: categoría + estado firmado
  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text((caja.categoria || '').toUpperCase(), x + 14, y + 12, { characterSpacing: 0.8, lineBreak: false })
  if (firmada) {
    const label = 'FIRMADO'
    font(doc, FONT.monoMed).fontSize(8)
    const lw = doc.widthOfString(label)
    font(doc, FONT.monoMed).fontSize(8).fillColor(COLOR.ok)
      .text(label, x + w - 14 - lw, y + 12, { lineBreak: false })
    doc.save().lineWidth(1.4).strokeColor(COLOR.ok)
      .moveTo(x + w - 14 - lw - 11, y + 16).lineTo(x + w - 14 - lw - 8, y + 19)
      .lineTo(x + w - 14 - lw - 3, y + 13).stroke().restore()
  }

  // línea de firma con rúbrica (nombre en mono italic)
  const lineY = y + h - 40
  if (firmada && caja.nombre) {
    doc.font('Courier-Oblique').fontSize(18).fillColor(COLOR.ink)
      .text(caja.nombre, x + 14, lineY - 24, { width: w - 28, lineBreak: false, ellipsis: true })
  }
  doc.lineWidth(1.2).strokeColor(COLOR.ink).moveTo(x + 14, lineY).lineTo(x + w - 14, lineY).stroke()

  // nombre + rol + licencia
  font(doc, FONT.sansSemi).fontSize(11).fillColor(COLOR.ink)
    .text(caja.nombre || '—', x + 14, lineY + 5, { width: w - 28, lineBreak: false, ellipsis: true })
  font(doc, FONT.sans).fontSize(8.5).fillColor(COLOR.muted)
    .text(`${caja.rol || ''}${caja.licencia ? ` · Lic. ${caja.licencia}` : ''}`,
      x + 14, lineY + 19, { width: w - 28, lineBreak: false, ellipsis: true })

  // pie punteado con timestamp
  const footY = y + h - 4
  doc.save().lineWidth(0.7).strokeColor(COLOR.line).dash(2, { space: 2 })
    .moveTo(x + 14, footY - 12).lineTo(x + w - 14, footY - 12).stroke().undash().restore()
  font(doc, FONT.mono).fontSize(7).fillColor(COLOR.muted)
    .text('Firmado', x + 14, footY - 9, { lineBreak: false })
    .text(firmada ? fmtFechaHoraFn(caja.fecha) : '—', x + 14, footY - 9, { width: w - 28, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.ink)
}
```

- [ ] **Step 2: Reescribir `renderFirmas` y `drawFirmas` (eliminar `drawFirmaBox`)**

Reemplazar `renderFirmas`, `drawFirmas` y `drawFirmaBox` por:

```js
function renderFirmas(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Firmas de conformidad', ctx.M, ctx.W)
  const c = orden.cierre
  const esAeronave = orden.producto?.tipoProducto === 'aeronave'

  const cajas = [
    { categoria: 'Soporte', persona: c?.soporte || orden.soporte, fecha: c?.fechaFirmaSoporte },
    { categoria: 'Aprobación', persona: c?.gerente || orden.gerente, fecha: c?.fechaFirmaGerente },
  ]
  if (esAeronave) {
    cajas.push({ categoria: 'Operación', persona: c?.piloto || orden.piloto, fecha: c?.fechaFirmaPiloto })
  }

  const gap = 14
  const boxW = (ctx.W - gap * (cajas.length - 1)) / cajas.length
  const boxH = 104
  ui.ensureSpace(doc, boxH + 10)
  const y = doc.y + 4
  cajas.forEach((cj, i) => {
    ui.signatureCard(doc, ctx.M + i * (boxW + gap), y, boxW, boxH, {
      categoria: cj.categoria,
      nombre: cj.persona?.nombre,
      rol: (cj.persona?.rol || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      licencia: cj.persona?.licenciaNum,
      fecha: cj.fecha,
    }, fmtFechaHora)
  })
  doc.y = y + boxH + 10
  doc.x = ctx.M
}
```

- [ ] **Step 3: Generar y verificar (2 firmas vs 3)**

```bash
node tmp-pdf-check/gen.mjs
```

Expected: §06 con cards de firma redondeadas. No-aeronave: 2 cards (Soporte + Aprobación).
Aeronave: 3 cards (Soporte + Aprobación + Operación). Cada firmada con check verde "FIRMADO",
rúbrica (nombre en mono italic) sobre la línea, nombre/rol/licencia, y timestamp en el pie punteado.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): signature cards (2-3 segun tipo) con rubrica y check

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Tarea 11: Footer, bloques markdown, limpieza y verificación final

**Files:**
- Modify: `aeromx/backend/src/controllers/ordenes/pdfController.js`

- [ ] **Step 1: Reescribir `drawFooter` y `sectionTitle`/`drawMarkdownBlock`**

Reemplazar `drawFooter` por:

```js
function drawFooter(doc, orden, pageNum, totalPages, M, W) {
  const y = doc.page.height - 30
  doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(M, y).lineTo(M + W, y).stroke()
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text(`${COMPANY.nombre} · O/T ${orden.numeroOt} · Generado ${fmtFechaHora(new Date())}`,
      M, y + 5, { width: W, align: 'left', lineBreak: false })
    .text(`Página ${pageNum} de ${totalPages}`, M, y + 5, { width: W, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.ink)
}
```

Reemplazar `sectionTitle` (si quedó algún uso) — buscar usos restantes y migrarlos a `ui.sectionHead`:

```bash
grep -n "sectionTitle\|drawKVGrid\|drawTableHeader\|drawTableRow\|TABLE_PAD\|TABLE_FONT" \
  aeromx/backend/src/controllers/ordenes/pdfController.js
```

Expected: **sin resultados**. Si aparece alguno, eliminar la función muerta o migrar el llamador
a la primitiva equivalente de `ui.js`.

Reescribir `drawMarkdownBlock` para usar la nueva paleta/fuentes:

```js
function drawMarkdownBlock(doc, label, body, M, W) {
  ui.ensureSpace(doc, 30)
  doc.moveDown(0.3)
  font(doc, FONT.sansSemi).fontSize(12).fillColor(COLOR.ink).text(label, M, doc.y, { width: W })
  const underlineY = doc.y + 2
  doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(M, underlineY).lineTo(M + W, underlineY).stroke()
  doc.y = underlineY + 6
  doc.x = M
  renderMarkdown(doc, body, {
    M, W, colorText: COLOR.ink2, colorAccent: COLOR.accent, colorMuted: COLOR.muted, colorRule: COLOR.line,
  })
  doc.fillColor(COLOR.ink)
  font(doc, FONT.sans)
  doc.moveDown(0.4)
  doc.x = M
}
```

- [ ] **Step 2: Verificar que no quedan referencias a helpers/colores viejos**

```bash
grep -n "Helvetica\|COLOR.primary\|bandBg\|drawPersonaCard\|drawFirmaBox\|drawEvidenciaFotografica\|dibujarPlaceholderFoto" \
  aeromx/backend/src/controllers/ordenes/pdfController.js
```

Expected: **sin resultados** (todo migrado a `theme`/`ui`). Si aparece `Helvetica` directo, migrarlo
a `font(doc, FONT.*)`. Eliminar cualquier función muerta listada.

- [ ] **Step 3: Verificación final — los 4 tipos**

Con backend corriendo y al menos una O/T cerrada por tipo (idealmente la de aeronave con fotos):

```bash
node tmp-pdf-check/gen.mjs
```

Expected: `OK` para los 4 tipos. Abrir cada PDF y comparar contra
`PDF/design_handoff_orden_trabajo/Orden de Trabajo.html`:

- [ ] Cabecera papel claro, logo HYDRA en tinta, meta a la derecha, separador en tinta.
- [ ] Título grande + folio mono + **status pill** correcto por estado.
- [ ] Timeline de 4 hitos (fechas o "Pendiente").
- [ ] §01 grid 4-col redondeado con "Duración total" y estado coloreado.
- [ ] §02 grid 3-col por tipo (campos correctos: aeronave=horas, camión=odómetro/VIN, planta=horímetro, sensor=firmware/calibración).
- [ ] §03 person cards (3 para no-aeronave, hasta 5 para aeronave).
- [ ] §04 tabla con group heads, condition pills, ✦ críticos, y **galería de fotos por renglón** donde haya fotos.
- [ ] §05 dictamen con barra de progreso + observaciones.
- [ ] §06 firmas (2 / 3 según tipo) con rúbrica, check y timestamp.
- [ ] Footer "Página N de M" en todas las páginas; paginación correcta en la O/T de aeronave (larga).

- [ ] **Step 4: Limpieza de scratch**

```bash
rm -rf tmp-pdf-check
```

> Confirmar que `aeromx/backend/public/logo.png` (logo viejo AEROMX) ya no se referencia. Se puede
> dejar en el repo o borrar; no afecta (el header ahora usa `hydra-logo.png`).

- [ ] **Step 5: Commit final**

```bash
git add aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "feat(pdf): footer, bloques markdown y limpieza de helpers viejos

Rediseño visual del PDF de O/T al estilo HYDRA completo (header, timeline,
KV grids, person cards, tabla con evidencia por renglón, dictamen y firmas).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-review (cobertura del spec)

- §4 Sistema visual → Tareas 1 (theme) + 2 (primitivas). ✓
- §5.1 Header → Tarea 3. ✓
- §5.2 Título + status pill → Tarea 3. ✓
- §5.3 Timeline → Tarea 4. ✓
- §5.4 §01 Datos generales (hitos movidos al timeline, + duración) → Tarea 5. ✓
- §5.5 §02 Datos producto (conserva `filasDatosProducto`) → Tarea 5. ✓
- §5.6 §03 Personal (2–5 cards) → Tarea 6. ✓
- §5.7 §04 Trabajos + galería por renglón → Tareas 7 + 8. ✓
- §5.8 §05 Dictamen + progreso → Tarea 9. ✓
- §5.9 §06 Firmas (2/3) → Tarea 10. ✓
- §5.10 Footer → Tarea 11. ✓
- §6 Primitivas → distribuidas en Tareas 2,4,5,6,7,8,9,10. ✓
- §7 Renderer `fotos` no-op → Tarea 8. ✓
- §8 Mapeos de estado/condición → Tarea 2 (`ESTADO_PILL`, `COND_PILL`). ✓
- §9 Assets (fuentes + logo en tinta) → Tarea 1. ✓
- §11 Verificación 4 tipos → Tarea 11. ✓

Sin placeholders; nombres de primitivas consistentes entre `ui.js` y los llamadores del controller.
```
