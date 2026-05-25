# Plan de implementación — Correcciones PDF + revisión/rechazo + asignación de tareas

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usa `superpowers:executing-plans` (ejecución por lotes con checkpoints) o `superpowers:subagent-driven-development` para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`) para seguimiento.

**Meta:** Resolver 7 mejoras de uso real del sistema AeroMX/HYDRA, agrupadas en 5 sesiones independientes: correcciones del PDF (alineación, texto, paginación), descarga de PDF en órdenes cerradas, flujo de rechazo/revisión, y asignación de tareas por punto con firma.

**Arquitectura:** Backend Node.js + Express + Prisma (PostgreSQL); frontend React + Vite. El PDF se genera con pdfkit en `aeromx/backend/src/pdf/` + `controllers/ordenes/pdfController.js`. No hay runner de pruebas automatizadas: **la verificación es generar el PDF / llamar la API real / `npm run build`** y revisar el resultado.

**Tech Stack:** pdfkit, Prisma, Express, React, Vite, axios.

**Spec de referencia:** `docs/superpowers/specs/2026-05-24-pdf-fixes-revision-y-asignacion-design.md`

---

## Notas de proceso (LEER ANTES DE EMPEZAR CUALQUIER SESIÓN)

- **Idioma:** todo en español (commits, comentarios, copy de UI).
- **Setup:** `cd aeromx && docker compose up -d` (Postgres :5433 + MinIO). Backend: `cd backend && npm run dev` (API :3001; revisar `GET /api/health` antes — suele estar arriba). Frontend: `cd frontend && npm run dev` (:5173). Login superusuario: `dev@aeromx.com / aeromx123`.
- **Migraciones (Sesiones 4 y 5):** NUNCA `prisma migrate reset` ni `npm run db:seed` — la BD de dev tiene formatos reales (5 formatos / 25 secciones / 181 puntos). Respaldar con `pg_dump` antes. Escribir el SQL de migración a mano (aditivo) y aplicar con `npx prisma migrate deploy`. **Detener el backend antes de `npx prisma generate`** (EPERM si corre, DLL bloqueada en Windows).
- **Commits:** solo cuando el usuario lo decida. El plan incluye pasos de commit como sugerencia; confirmar con el usuario antes de ejecutarlos.
- **Verificación de PDF:** generar la O/T en PDF de los 4 tipos (aeronave, gcs, planta, sensor_inteligencia) vía `GET /api/ordenes/:id/pdf` y revisar visualmente. Hay órdenes de prueba ya creadas; si no, crear una por tipo con el flujo normal.

---

# SESIÓN 1 — PDF: alineación de círculos/pills + autoajuste de texto (puntos 1 y 2) ✅ COMPLETADA

> **✅ Completada el 2026-05-24** — commit `b9fc008` (`fix(pdf): centrado vertical en círculos/pills y autoajuste de texto largo`). Solo cambió `aeromx/backend/src/pdf/ui.js` (+29/−9). Verificado visualmente por el usuario. **La próxima sesión empieza en la Sesión 2.**

**Archivos:**
- Modificar: `aeromx/backend/src/pdf/ui.js`
- Verificar visualmente: PDF de los 4 tipos

**Contexto:** El centrado vertical usa offsets fijos en vez del centro geométrico real. pdfkit dibuja texto desde la esquina superior izquierda; para centrar verticalmente en una caja de alto `h` cuyo tope está en `y`, la `y` del texto debe ser `y + (h - alturaTexto) / 2`, donde `alturaTexto ≈ doc.currentLineHeight()` con la fuente/tamaño ya aplicados.

### Tarea 1.1: Centrar el número dentro del círculo del timeline

- [ ] **Paso 1: Localizar el bloque del círculo numerado en `ui.js → timeline()`** (líneas ~116-121). Hoy:

```js
const r = 9
doc.save()
doc.circle(inner + r, y + 14, r).fill(COLOR.ink)
font(doc, FONT.monoMed).fontSize(9).fillColor(COLOR.paper)
  .text(String(s.num), inner, y + 10, { width: r * 2, align: 'center', lineBreak: false })
doc.restore()
```

- [ ] **Paso 2: Reemplazar el `.text(...)` por centrado vertical real respecto al centro del círculo (`y + 14`)**:

```js
const r = 9
const cy = y + 14            // centro vertical del círculo
doc.save()
doc.circle(inner + r, cy, r).fill(COLOR.ink)
font(doc, FONT.monoMed).fontSize(9).fillColor(COLOR.paper)
const numH = doc.currentLineHeight()
doc.text(String(s.num), inner, cy - numH / 2, { width: r * 2, align: 'center', lineBreak: false })
doc.restore()
```

- [ ] **Paso 3: Generar un PDF y verificar que el número quede centrado en el círculo.** Run (con backend arriba y una orden existente; sustituir `<ID>`):

```bash
curl -s "http://localhost:3001/api/ordenes/<ID>/pdf" -H "Authorization: Bearer <TOKEN>" -o /tmp/ot.pdf && echo OK
```

Abrir `/tmp/ot.pdf` y confirmar visualmente el timeline. Esperado: dígitos centrados vertical y horizontalmente en los círculos.

### Tarea 1.2: Centrar texto y punto dentro de los pills

- [ ] **Paso 1: Localizar `ui.js → pill()`** (líneas ~43-59). Hoy el punto está en `y + h/2` y el texto en `y + 4.5` con `h = 17`.

- [ ] **Paso 2: Reemplazar el dibujo de texto del pill por centrado vertical real**:

```js
const h = 17
const cy = y + h / 2
doc.save()
doc.roundedRect(x, y, w, h, h / 2).fill(bg)
if (border) { doc.lineWidth(0.8).strokeColor(border).roundedRect(x, y, w, h, h / 2).stroke() }
if (dot) doc.circle(x + padX + 3.5, cy, 3.5).fill(fg)
font(doc, FONT.monoMed).fontSize(8.5).fillColor(fg)
const txtH = doc.currentLineHeight()
doc.text(label.toUpperCase(), x + padX + dotW, cy - txtH / 2, { lineBreak: false })
doc.restore()
```

- [ ] **Paso 3: Generar PDF y verificar `statusPill` (cabecera), `conditionPill` (tabla de trabajos) y `rolePill` (person cards).** Todas pasan por `pill()`. Esperado: texto centrado verticalmente, punto alineado con el texto.

### Tarea 1.3: Autoajustar la rúbrica de firma para que no se encime

- [ ] **Paso 1: Localizar el bloque de rúbrica en `ui.js → signatureCard()`** (líneas ~370-376):

```js
const lineY = y + h - 48
if (firmada && caja.nombre) {
  doc.save()
  doc.font('Courier-Oblique').fontSize(18).fillColor(COLOR.ink)
    .text(caja.nombre, x + 14, lineY - 24, { width: w - 28, lineBreak: false, ellipsis: true })
  doc.restore()
}
```

- [ ] **Paso 2: Añadir, antes de la función `signatureCard`, un helper que reduzca el tamaño de fuente hasta que el texto quepa en el ancho dado**:

```js
// Encuentra el mayor fontSize en [min, max] con el que `texto` cabe en `maxW`.
function ajustarFontSize(doc, texto, maxW, max, min) {
  for (let size = max; size > min; size -= 0.5) {
    doc.fontSize(size)
    if (doc.widthOfString(texto) <= maxW) return size
  }
  return min
}
```

- [ ] **Paso 3: Reemplazar el bloque de rúbrica para auto-ajustar el tamaño (máx 18, mín 9) antes de dibujar**:

```js
const lineY = y + h - 48
if (firmada && caja.nombre) {
  doc.save()
  doc.font('Courier-Oblique')
  const size = ajustarFontSize(doc, caja.nombre, w - 28, 18, 9)
  doc.fontSize(size).fillColor(COLOR.ink)
    .text(caja.nombre, x + 14, lineY - size - 6, { width: w - 28, lineBreak: false, ellipsis: true })
  doc.restore()
}
```

- [ ] **Paso 4: Generar PDF de una orden cerrada con un firmante de nombre largo y verificar que la rúbrica no toque la línea de firma.** Si no hay firmante de nombre largo, editar temporalmente el nombre de un usuario de prueba con `UPDATE usuarios SET nombre='María Guadalupe de la Concepción Hernández' WHERE email='gerente@aeromx.com';` (revertir después).

### Tarea 1.4: Evitar que el ✦ crítico saque el componente del ancho de columna

- [ ] **Paso 1: Localizar en `ui.js → workRow()`** el cálculo de alto (líneas ~269-272) y el dibujo del componente (líneas ~287-292). Hoy `compH` se mide sin el ✦ y el ✦ se añade con `continued: !!row.critico`, que puede empujar fuera del ancho.

- [ ] **Paso 2: Medir el componente incluyendo el sufijo crítico y permitir wrap real (quitar `lineBreak:false` implícito del continued).** Cambiar el cálculo de alto:

```js
font(doc, FONT.sansSemi).fontSize(9)
const compTxt = row.componente + (row.critico ? '  ✦' : '')
const compH = doc.heightOfString(compTxt, { width: compCol.w - 12 })
font(doc, FONT.sans).fontSize(8.5)
const descH = doc.heightOfString(row.descripcion || '—', { width: descCol.w - 12 })
const rowH = Math.max(30, descH + 14, compH + 14)
```

- [ ] **Paso 3: Cambiar el dibujo del componente** (rama `c.key === 'comp'`) para dibujar el nombre con el ✦ como parte del texto, permitiendo wrap (sin `continued`):

```js
} else if (c.key === 'comp') {
  font(doc, FONT.sansSemi).fontSize(9).fillColor(COLOR.ink)
    .text(row.componente, cx, y + 8, { width: c.w - 12 })
  if (row.critico) {
    // ✦ en línea aparte alineado a la derecha de la columna, sin empujar el nombre
    const markY = y + 8
    font(doc, FONT.sansSemi).fontSize(9).fillColor(COLOR.critical)
      .text('✦', cx, markY, { width: c.w - 12, align: 'right', lineBreak: false })
  }
}
```

- [ ] **Paso 4: Generar PDF con un componente de nombre largo + crítico y verificar que no se sale de la columna.** (El formato de aeronave "Mantenimiento Menor" tiene puntos críticos con nombres largos.)

### Tarea 1.5: Commit (confirmar con el usuario)

- [ ] **Paso 1: Verificar build no aplica (solo backend PDF). Revisar `git diff` de `ui.js`.**
- [ ] **Paso 2: Commit:**

```bash
git add aeromx/backend/src/pdf/ui.js
git commit -m "fix(pdf): centrado vertical en círculos/pills y autoajuste de texto largo"
```

---

# SESIÓN 2 — PDF: continuidad de página + páginas en blanco (puntos 3 y 4) ✅ COMPLETADA

> **✅ Completada el 2026-05-25** — verificada visualmente por el usuario. Ejecutada con `subagent-driven-development` (un subagente por tarea + revisión spec + revisión calidad). 4 commits en `development`:
> - `8a1c974` — `refactor(pdf): expone alturaEvidencia` (Tarea 2.1)
> - `29e08cb` — `fix(pdf): mantiene fila de trabajo y su galería de evidencia juntas al saltar de página` (Tarea 2.2)
> - `086291c` — `fix(pdf): evita encabezado de grupo huérfano reservando espacio para una fila` (Tarea 2.3)
> - `be02e02` — `fix(pdf): elimina páginas en blanco al final anulando el margen inferior al dibujar footers` (Tarea 2.4)
>
> **Causa raíz real de las páginas en blanco (distinta de la hipótesis del plan):** el enfoque especulativo del plan (quitar `moveDown` finales / podar páginas) NO era la causa. Instrumentando el render se confirmó que el contenido producía 9 páginas pero el **loop de footer** las inflaba a 27. El footer se dibuja en `y = page.height − 30`, por debajo del margen inferior (`maxY = height − 40`), y pdfkit **auto-agrega una página por cada `.text()` del footer** (2 por página → 9 + 9×2 = 27). El fix es `doc.page.margins.bottom = 0` antes de dibujar cada footer en el loop de `bufferedPageRange`. NO se tocó `renderTrabajos` ni `drawFooter`.
>
> **Verificación (programática + visual):** aeronave con fotos 27→**9 págs** (0 footer-only), aeronave sin fotos **7 págs**, GCS 57→**19 págs** (0 footer-only). "Página N de M" correcto.
>
> **Deuda técnica anotada (no bloqueante, de la revisión final):** el `− 50` del guard de continuidad en `pdfController.js` duplica el valor de `ensureSpace` en `ui.js`; los magic numbers `34`/`50` vienen del propio plan. Recomendación: extraer una constante compartida (`PAGE_BOTTOM_MARGIN`) la próxima vez que se toquen estos archivos. **La próxima sesión empieza en la Sesión 3.**

**Archivos:**
- Modificar: `aeromx/backend/src/pdf/ui.js` (medición de galería, `groupHead`)
- Modificar: `aeromx/backend/src/controllers/ordenes/pdfController.js` (`renderTrabajos`, bucle de footer)
- Verificar: PDF de aeronave con muchas fotos (es el caso multipágina)

**Contexto:** En `renderTrabajos` cada fila reserva su alto con `ensureSpace`, pero `evidenceGallery` se dibuja después por separado, así que una fila puede quedar al pie y su galería saltar a la página siguiente. Además sospechamos páginas en blanco al final por saltos forzados.

### Tarea 2.1: Exponer el cálculo de alto de la galería de evidencia

- [ ] **Paso 1: En `ui.js`, justo antes de `export function evidenceGallery`, añadir un helper que calcule el alto del bloque sin dibujar** (replica la fórmula interna de `evidenceGallery`):

```js
// Alto total que ocupará evidenceGallery para `nFotos` (mismas constantes internas).
export function alturaEvidencia(nFotos) {
  if (!nFotos || nFotos === 0) return 0
  const cols = 3, gap = 8, imgH = 92, capH = 16
  const cellH = imgH + capH
  const rows = Math.ceil(nFotos / cols)
  return 22 + rows * cellH + (rows - 1) * gap + 8
}
```

- [ ] **Paso 2: Confirmar que las constantes (`cols=3, gap=8, imgH=92, capH=16`) coinciden con las de `evidenceGallery`.** Si difieren, igualarlas (fuente única de verdad: usar `alturaEvidencia` dentro de `evidenceGallery` también para `blockH`).

- [ ] **Paso 3: Refactorizar `evidenceGallery` para usar `alturaEvidencia`** y no duplicar la fórmula:

```js
const rows = Math.ceil(fotos.length / cols)
const blockH = alturaEvidencia(fotos.length)
```

### Tarea 2.2: Mantener fila + galería juntas al saltar de página

- [ ] **Paso 1: En `pdfController.js → renderTrabajos()`, localizar el loop de puntos** (líneas ~239-254). Hoy llama `ui.workRow` y luego `ui.evidenceGallery` por separado.

- [ ] **Paso 2: Antes de `ui.workRow`, medir el alto combinado y forzar salto de página si no cabe.** Importar `alturaEvidencia` (ya viene en `import * as ui`). Reemplazar el cuerpo del loop por:

```js
for (const punto of puntos) {
  const r = resultadosPorPunto[punto.id]
  const nFotos = (ctx.incluirFotos && r.fotos) ? r.fotos.length : 0
  // Estimar alto de la fila para decidir el salto (mínimo de workRow es 30).
  const altoEvidencia = ui.alturaEvidencia(nFotos)
  const altoEstimadoFila = 34
  const bottom = doc.page.height - 50
  if (doc.y + altoEstimadoFila + altoEvidencia > bottom) doc.addPage()

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
  if (nFotos > 0) {
    ui.evidenceGallery(doc, r.fotos, ctx.fotosBuffers, ctx.M, ctx.W, fmtFecha)
  }
}
```

- [ ] **Paso 3: Generar PDF de aeronave (multipágina con fotos) y verificar que ninguna foto quede separada de su título de actividad** al cruzar de página.

### Tarea 2.3: No dejar encabezado de grupo huérfano al pie

- [ ] **Paso 1: En `ui.js → groupHead()`, aumentar el espacio reservado** para que el encabezado no quede solo (reservar el alto del head + una fila mínima). Cambiar `ensureSpace(doc, 22)` por:

```js
ensureSpace(doc, 18 + 34)  // encabezado de grupo + al menos una fila
```

- [ ] **Paso 2: Generar PDF y verificar que no haya un "GRUPO · …" solo al final de una página** sin filas debajo.

### Tarea 2.4: Eliminar páginas en blanco al final

- [ ] **Paso 1: Diagnosticar.** Generar PDF de los 4 tipos y, con backend en modo dev, agregar temporalmente un log antes de `doc.end()` en `pdfController.js → generar()`:

```js
console.log('[pdf] páginas:', doc.bufferedPageRange().count)
```

Comparar el conteo con las páginas reales con contenido al abrir el PDF.

- [ ] **Paso 2: Revisar renderers que fuerzan salto al final de sección.** Buscar `moveDown`/`ensureSpace`/`addPage` que se ejecuten cuando ya no hay más contenido (p. ej. `renderTrabajos` termina con `doc.moveDown(0.4)` tras la leyenda). Quitar los `moveDown` finales innecesarios que puedan empujar `doc.y` más allá del margen y disparar una página nueva.

- [ ] **Paso 3: Si tras el render sigue quedando una página vacía, podarla antes del bucle de footer.** En `generar()`, antes del `for` que dibuja footers, detectar la última página vacía. pdfkit no borra páginas; la estrategia preferida es **prevenir** su creación (Paso 2). Si aun así aparece, registrar el hallazgo y aplicar guarda: solo numerar/footer hasta la última página con contenido (llevar una bandera `tieneContenido` por página no es trivial en pdfkit; documentar la causa raíz encontrada y la solución elegida en el commit). Criterio de aceptación real: **los 4 PDFs terminan sin páginas en blanco.**

- [ ] **Paso 4: Quitar el `console.log` de diagnóstico.**

- [ ] **Paso 5: Generar los 4 PDFs y confirmar conteo de páginas == páginas con contenido; "Página N de M" correcto.**

### Tarea 2.5: Commit (confirmar con el usuario)

- [ ] **Paso 1: Commit:**

```bash
git add aeromx/backend/src/pdf/ui.js aeromx/backend/src/controllers/ordenes/pdfController.js
git commit -m "fix(pdf): continuidad fila+evidencia entre páginas y elimina páginas en blanco"
```

---

# SESIÓN 3 — Descarga de PDF en órdenes cerradas con/sin fotos (punto 5) ✅ COMPLETADA

> **✅ Completada el 2026-05-25** — verificada con `npm run build` (verde) + revisión spec (compliant) + revisión de calidad (aprobada). Ejecutada con `subagent-driven-development`. Solo cambió frontend: `DashboardPage.jsx` (handler `descargarPDF` con `conFotos`; `OrdenCard` con prop `onPDFSinFotos` → segundo botón "PDF sin fotos" con `BtnSm` en órdenes cerradas) e `InspeccionPage.jsx` (handler `descargarPDF` + dos botones `Btn` "Descargar PDF" / "Descargar sin fotos" solo si `estado === 'cerrada'`). `ordenesService.js` ya soportaba `descargarPDF(id, conFotos)` — no se tocó. **La próxima sesión empieza en la Sesión 4 (migración — leer las notas de proceso).**

**Archivos:**
- Modificar: `aeromx/frontend/src/pages/DashboardPage.jsx` (handler `descargarPDF` + botón en `OrdenCard`)
- Modificar: `aeromx/frontend/src/pages/InspeccionPage.jsx` (acciones de descarga cuando la orden está cerrada)
- Verificar: `npm run build` + descarga manual en navegador

**Contexto:** El backend ya soporta `descargarPDF(id, conFotos)` (`api/ordenesService.js:65`, `?fotos=false`). En `DashboardPage` ya hay un botón PDF para órdenes cerradas (`OrdenCard`, línea ~517) pero: (a) solo descarga **con** fotos, no ofrece "sin fotos"; (b) la vista por defecto "Mis órdenes" oculta las cerradas, y no hay descarga desde la vista de inspección/detalle de una orden cerrada.

### Tarea 3.1: Soportar descarga con y sin fotos en el Dashboard

- [ ] **Paso 1: En `DashboardPage.jsx`, modificar el handler `descargarPDF`** (línea ~148) para aceptar `conFotos`:

```js
const descargarPDF = async (e, id, numeroOt, conFotos = true) => {
  e.stopPropagation()
  try {
    const response = await ordenesService.descargarPDF(id, conFotos)
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `OT-${numeroOt}${conFotos ? '' : '-sin-fotos'}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error(err)
    alert('Error descargando el PDF')
  }
}
```

- [ ] **Paso 2: Actualizar la prop pasada a `OrdenCard`** (línea ~337) para exponer ambas variantes:

```jsx
onPDF={(e) => descargarPDF(e, orden.id, orden.numeroOt, true)}
onPDFSinFotos={(e) => descargarPDF(e, orden.id, orden.numeroOt, false)}
```

- [ ] **Paso 3: En `OrdenCard` (firma de función línea ~415), agregar `onPDFSinFotos` a los parámetros** y añadir un segundo botón junto al de PDF (bloque `esCerrada &&`, línea ~517):

```jsx
{esCerrada && (
  <>
    <BtnSm variant="surface" onClick={onPDF} label="📥 PDF" />
    <BtnSm variant="ghost" onClick={onPDFSinFotos} label="PDF sin fotos" />
  </>
)}
```

- [ ] **Paso 4: `npm run build` en `aeromx/frontend`.** Esperado: build verde.

```bash
cd aeromx/frontend && npm run build
```

### Tarea 3.2: Descarga desde la vista de inspección/detalle de una orden cerrada

- [ ] **Paso 1: Leer `aeromx/frontend/src/pages/InspeccionPage.jsx`** y localizar (a) cómo importa `ordenesService`, (b) el bloque de cabecera/acciones de la orden, (c) la variable de estado de la orden (`orden`).

- [ ] **Paso 2: Añadir un handler de descarga reutilizable** (mismo patrón que Dashboard) dentro del componente:

```js
const descargarPDF = async (conFotos = true) => {
  try {
    const response = await ordenesService.descargarPDF(orden.id, conFotos)
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `OT-${orden.numeroOt}${conFotos ? '' : '-sin-fotos'}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error(err)
    alert('Error descargando el PDF')
  }
}
```

- [ ] **Paso 3: Renderizar dos botones de descarga solo cuando `orden.estado === 'cerrada'`** en el bloque de acciones de cabecera, siguiendo el estilo de botones existente de la página (revisar el componente de botón que usa `InspeccionPage`):

```jsx
{orden.estado === 'cerrada' && (
  <>
    <button onClick={() => descargarPDF(true)}>📥 Descargar PDF</button>
    <button onClick={() => descargarPDF(false)}>Descargar sin fotos</button>
  </>
)}
```

(Ajustar al componente de botón y tokens reales de la página.)

- [ ] **Paso 4: `npm run build` + prueba manual:** abrir una orden cerrada en el navegador desde Dashboard ("Ver todo") y desde su vista de inspección; descargar con y sin fotos. Verificar que el archivo sin fotos pesa menos y no embebe imágenes.

### Tarea 3.3: Commit (confirmar con el usuario)

- [ ] **Paso 1: Commit:**

```bash
git add aeromx/frontend/src/pages/DashboardPage.jsx aeromx/frontend/src/pages/InspeccionPage.jsx
git commit -m "feat(frontend): descarga de PDF con/sin fotos en órdenes cerradas (dashboard e inspección)"
```

---

# SESIÓN 4 — Rechazo y revisión (punto 6)

**Archivos:**
- Modificar: `aeromx/backend/prisma/schema.prisma` (enum `EstadoRevision`, modelo `RevisionPunto`, relaciones)
- Crear: `aeromx/backend/prisma/migrations/20260524120000_revision_punto/migration.sql`
- Modificar: `aeromx/backend/src/services/ordenesService.js` (servicios de revisión + rechazo + gate de cierre)
- Modificar: `aeromx/backend/src/controllers/ordenes/workflowController.js` (rechazar, revisión)
- Modificar: `aeromx/backend/src/controllers/ordenes/cierreController.js` (gate)
- Modificar: `aeromx/backend/src/routes/ordenes.js` (rutas nuevas)
- Modificar: `aeromx/frontend/src/api/ordenesService.js` (métodos nuevos)
- Modificar: `aeromx/frontend/src/pages/InspeccionPage.jsx`, `CierreOTPage.jsx`, `DashboardPage.jsx`
- Verificar: API real (curl) + `npm run build`

**Contexto / decisiones:** "Rechazar" (gerente) devuelve toda la orden a `en_proceso`, invalida firmas, motivo obligatorio. "Mandar a revisión" (gerente) deja la orden en `pendiente_firma` y marca puntos. "Pedir revisión" (cualquier involucrado) marca un punto **y bloquea el cierre**. Modelo: tabla `RevisionPunto` con historial.

### Tarea 4.1: Respaldo de BD

- [ ] **Paso 1: Respaldar antes de migrar:**

```bash
cd aeromx/backend
pg_dump "$DATABASE_URL" > backups/aeromx_backup_$(date +%Y%m%d_%H%M%S).sql
```

(`backend/backups/` ya está en `.gitignore`.)

### Tarea 4.2: Schema — enum + modelo RevisionPunto

- [ ] **Paso 1: En `schema.prisma`, añadir el enum tras `EstadoResultado`** (línea ~42):

```prisma
enum EstadoRevision {
  abierta
  resuelta
}
```

- [ ] **Paso 2: Añadir el modelo `RevisionPunto`** (después de `FotoInspeccion`, antes de `CierreOT`):

```prisma
model RevisionPunto {
  id            String         @id @default(uuid())
  resultadoId   String         @map("resultado_id")
  solicitanteId String         @map("solicitante_id")
  comentario    String
  estado        EstadoRevision @default(abierta)
  resueltoPorId String?        @map("resuelto_por_id")
  fechaResuelto DateTime?      @map("fecha_resuelto")
  createdAt     DateTime       @default(now()) @map("created_at")

  resultado    ResultadoPunto @relation(fields: [resultadoId], references: [id], onDelete: Cascade)
  solicitante  Usuario        @relation("RevisionSolicitante", fields: [solicitanteId], references: [id])
  resueltoPor  Usuario?       @relation("RevisionResuelta", fields: [resueltoPorId], references: [id])

  @@index([resultadoId])
  @@map("revisiones_punto")
}
```

- [ ] **Paso 3: Añadir la relación inversa en `ResultadoPunto`** (después de `fotos`, línea ~334):

```prisma
  revisiones RevisionPunto[]
```

- [ ] **Paso 4: Añadir las relaciones inversas en `Usuario`** (junto a las otras relaciones, línea ~76):

```prisma
  revisionesSolicitadas RevisionPunto[] @relation("RevisionSolicitante")
  revisionesResueltas   RevisionPunto[] @relation("RevisionResuelta")
```

### Tarea 4.3: Migración a mano + aplicar

- [ ] **Paso 1: Crear `aeromx/backend/prisma/migrations/20260524120000_revision_punto/migration.sql`** (aditiva):

```sql
-- CreateEnum
CREATE TYPE "EstadoRevision" AS ENUM ('abierta', 'resuelta');

-- CreateTable
CREATE TABLE "revisiones_punto" (
    "id" TEXT NOT NULL,
    "resultado_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "estado" "EstadoRevision" NOT NULL DEFAULT 'abierta',
    "resuelto_por_id" TEXT,
    "fecha_resuelto" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revisiones_punto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revisiones_punto_resultado_id_idx" ON "revisiones_punto"("resultado_id");

-- AddForeignKey
ALTER TABLE "revisiones_punto" ADD CONSTRAINT "revisiones_punto_resultado_id_fkey" FOREIGN KEY ("resultado_id") REFERENCES "resultados_puntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revisiones_punto" ADD CONSTRAINT "revisiones_punto_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revisiones_punto" ADD CONSTRAINT "revisiones_punto_resuelto_por_id_fkey" FOREIGN KEY ("resuelto_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Paso 2: Detener el backend** (Ctrl-C en la terminal de `npm run dev`, o matar el proceso node) para evitar EPERM en `prisma generate`.

- [ ] **Paso 3: Aplicar y regenerar:**

```bash
cd aeromx/backend
npx prisma migrate deploy
npx prisma generate
```

Esperado: "1 migration applied" + cliente regenerado sin EPERM.

- [ ] **Paso 4: Reiniciar backend** `npm run dev` y verificar `GET /api/health`.

### Tarea 4.4: Servicios — rechazo, revisión, resolver, gate

- [ ] **Paso 1: En `ordenesService.js`, añadir `rechazarOrden`** (basado en `reabrirOrden`, pero a `en_proceso`):

```js
// Rechazo del gerente — devuelve la orden a en_proceso, invalida firmas, registra audit.
export async function rechazarOrden(id, { motivo, usuarioId }) {
  if (!motivo?.trim()) {
    throw Object.assign(new Error('El motivo de rechazo es obligatorio'), { code: 'BAD_INPUT' })
  }
  const orden = await prisma.ordenTrabajo.findUnique({ where: { id }, include: { cierre: true } })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (orden.estado !== 'pendiente_firma' && orden.estado !== 'cerrada') {
    throw Object.assign(new Error('Solo se puede rechazar una orden en pendiente de firma o cerrada'), { code: 'BAD_STATE' })
  }
  return prisma.$transaction(async (tx) => {
    if (orden.cierre) {
      await tx.cierreOT.update({
        where: { ordenId: id },
        data: {
          firmaSoporteId: null,  fechaFirmaSoporte: null,
          firmaGerenteId: null,  fechaFirmaGerente: null,
          firmaPilotoId: null,   fechaFirmaPiloto: null,
          firmaOperadorId: null, fechaFirmaOperador: null,
        },
      })
    }
    await tx.historialEstadoOT.create({
      data: { ordenId: id, estadoAnterior: orden.estado, estadoNuevo: 'en_proceso', motivo: `Rechazo: ${motivo.trim()}`, usuarioId },
    })
    return tx.ordenTrabajo.update({
      where: { id },
      data: { estado: 'en_proceso', fechaCierre: null },
      include: { producto: { select: { id: true, identificador: true, tipoProducto: true } } },
    })
  })
}
```

- [ ] **Paso 2: Añadir `crearRevisionPunto`** (un punto):

```js
// Crea una solicitud de revisión sobre un resultado de punto.
export async function crearRevisionPunto(ordenId, resultadoId, { comentario, solicitanteId }) {
  if (!comentario?.trim()) {
    throw Object.assign(new Error('El comentario de revisión es obligatorio'), { code: 'BAD_INPUT' })
  }
  const resultado = await prisma.resultadoPunto.findFirst({ where: { id: resultadoId, ordenId } })
  if (!resultado) throw Object.assign(new Error('Resultado no encontrado'), { code: 'NOT_FOUND' })
  return prisma.revisionPunto.create({
    data: { resultadoId, solicitanteId, comentario: comentario.trim() },
    include: { solicitante: { select: { id: true, nombre: true, rol: true } } },
  })
}
```

- [ ] **Paso 3: Añadir `mandarARevision`** (varios puntos, gerente):

```js
// Gerente manda a revisión uno o varios puntos. La orden permanece en pendiente_firma.
export async function mandarARevision(ordenId, { resultadoIds, comentario, solicitanteId }) {
  if (!Array.isArray(resultadoIds) || resultadoIds.length === 0) {
    throw Object.assign(new Error('Debes indicar al menos un punto'), { code: 'BAD_INPUT' })
  }
  if (!comentario?.trim()) {
    throw Object.assign(new Error('El comentario es obligatorio'), { code: 'BAD_INPUT' })
  }
  const validos = await prisma.resultadoPunto.findMany({
    where: { id: { in: resultadoIds }, ordenId }, select: { id: true },
  })
  if (validos.length === 0) throw Object.assign(new Error('Ningún punto válido'), { code: 'BAD_INPUT' })
  await prisma.revisionPunto.createMany({
    data: validos.map((r) => ({ resultadoId: r.id, solicitanteId, comentario: comentario.trim() })),
  })
  return { creadas: validos.length }
}
```

- [ ] **Paso 4: Añadir `resolverRevision`:**

```js
export async function resolverRevision(revisionId, usuarioId) {
  const rev = await prisma.revisionPunto.findUnique({ where: { id: revisionId } })
  if (!rev) throw Object.assign(new Error('Revisión no encontrada'), { code: 'NOT_FOUND' })
  if (rev.estado === 'resuelta') return rev
  return prisma.revisionPunto.update({
    where: { id: revisionId },
    data: { estado: 'resuelta', resueltoPorId: usuarioId, fechaResuelto: new Date() },
  })
}
```

- [ ] **Paso 5: Añadir el verificador de gate `verificarRevisionesResueltas`** (junto a `verificarCriticosFirmados`, línea ~753):

```js
// El cierre se bloquea si hay revisiones abiertas en cualquier punto de la orden.
export async function verificarRevisionesResueltas(ordenId) {
  const abiertas = await prisma.revisionPunto.count({
    where: { estado: 'abierta', resultado: { ordenId } },
  })
  return { abiertas, completo: abiertas === 0 }
}
```

- [ ] **Paso 6: Aplicar el gate en `firmarCierre`** (defensa en profundidad): tras el chequeo de críticos (línea ~642), añadir:

```js
const revisiones = await verificarRevisionesResueltas(ordenId)
if (!revisiones.completo) {
  throw Object.assign(
    new Error(`Hay ${revisiones.abiertas} punto(s) en revisión pendientes de resolver`),
    { code: 'BAD_STATE' },
  )
}
```

- [ ] **Paso 7: Incluir las revisiones en `obtenerOrden`** — en el include de `resultados` (línea ~191-198), añadir dentro de `include`:

```js
revisiones: {
  orderBy: { createdAt: 'desc' },
  include: { solicitante: { select: { id: true, nombre: true, rol: true } } },
},
```

### Tarea 4.5: Controllers + rutas

- [ ] **Paso 1: En `workflowController.js`, añadir `rechazar`, `mandarARevision` y `pedirRevision`:**

```js
export async function rechazar(req, res, next) {
  try {
    const { motivo } = req.body || {}
    const orden = await svc.rechazarOrden(req.params.id, { motivo, usuarioId: req.user.sub })
    res.json(orden)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    next(e)
  }
}

export async function mandarARevision(req, res, next) {
  try {
    const { resultadoIds, comentario } = req.body || {}
    const out = await svc.mandarARevision(req.params.id, { resultadoIds, comentario, solicitanteId: req.user.sub })
    res.json(out)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function pedirRevision(req, res, next) {
  try {
    const perm = await verificarPermisoEdicion(req.params.id, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })
    const { comentario } = req.body || {}
    const rev = await svc.crearRevisionPunto(req.params.id, req.params.resultadoId, {
      comentario, solicitanteId: req.user.sub,
    })
    res.status(201).json(rev)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    next(e)
  }
}

export async function resolverRevision(req, res, next) {
  try {
    const perm = await verificarPermisoEdicion(req.params.id, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })
    const rev = await svc.resolverRevision(req.params.revisionId, req.user.sub)
    res.json(rev)
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    next(e)
  }
}
```

> Nota: `verificarPermisoEdicion` rechaza órdenes `cerrada`. "Pedir revisión" y "resolver" aplican a órdenes abiertas o en `pendiente_firma`; eso es correcto (una orden cerrada no se revisa, se reabre/rechaza).

- [ ] **Paso 2: En `cierreController.js → gestionar`, añadir el gate de revisiones** tras el bloque de críticos (línea ~24):

```js
const revisiones = await svc.verificarRevisionesResueltas(ordenId)
if (!revisiones.completo) {
  return res.status(400).json({
    error: `No se puede cerrar: hay ${revisiones.abiertas} punto(s) en revisión pendientes`,
  })
}
```

- [ ] **Paso 3: En `routes/ordenes.js`, registrar las rutas** (sección Workflow y Resultados):

```js
router.post('/:id/rechazar',  requireRole(SOLO_GERENTE), workflow.rechazar)
router.post('/:id/revision',  requireRole(SOLO_GERENTE), workflow.mandarARevision)
router.post('/:id/puntos/:resultadoId/revision',     workflow.pedirRevision)
router.post('/:id/revisiones/:revisionId/resolver',  workflow.resolverRevision)
```

(Las dos últimas no llevan `requireRole`: el permiso lo da `verificarPermisoEdicion` dentro del controller, que admite cualquier involucrado o superusuario.)

### Tarea 4.6: Verificar backend con curl

- [ ] **Paso 1: Login y guardar token:**

```bash
TOKEN=$(curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"dev@aeromx.com","password":"aeromx123"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
```

- [ ] **Paso 2: Sobre una orden en `pendiente_firma` con un `resultadoId` conocido, pedir revisión y verificar que bloquea el cierre:**

```bash
curl -s -X POST "localhost:3001/api/ordenes/<ID>/puntos/<RID>/revision" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"comentario":"Revisar torque"}'
# Intentar cerrar → debe responder 400 "hay 1 punto(s) en revisión pendientes"
curl -s -X POST "localhost:3001/api/ordenes/<ID>/cierre" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"seEncontroDefecto":false}'
```

- [ ] **Paso 3: Resolver la revisión y confirmar que el cierre vuelve a permitirse.** Obtener el `revisionId` desde `GET /api/ordenes/<ID>` (en `resultados[].revisiones`):

```bash
curl -s -X POST "localhost:3001/api/ordenes/<ID>/revisiones/<REVID>/resolver" -H "Authorization: Bearer $TOKEN"
```

- [ ] **Paso 4: Probar "Rechazar" sobre una orden cerrada/pendiente:** debe volver a `en_proceso`, borrar firmas, registrar historial.

```bash
curl -s -X POST "localhost:3001/api/ordenes/<ID>/rechazar" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"motivo":"Falta evidencia en motor"}'
```

### Tarea 4.7: Frontend — API service + UI

- [ ] **Paso 1: En `frontend/src/api/ordenesService.js`, añadir los métodos:**

```js
rechazar: (id, motivo) =>
  client.post(`/ordenes/${id}/rechazar`, { motivo }),
mandarARevision: (id, resultadoIds, comentario) =>
  client.post(`/ordenes/${id}/revision`, { resultadoIds, comentario }),
pedirRevisionPunto: (id, resultadoId, comentario) =>
  client.post(`/ordenes/${id}/puntos/${resultadoId}/revision`, { comentario }),
resolverRevision: (id, revisionId) =>
  client.post(`/ordenes/${id}/revisiones/${revisionId}/resolver`),
```

- [ ] **Paso 2: En `InspeccionPage.jsx`** — leer el archivo y, por cada punto/resultado, mostrar las `revisiones` abiertas (bandera "En revisión" + comentario + solicitante). Añadir:
  - Acción "Pedir revisión" (prompt de comentario) para cualquier involucrado → `ordenesService.pedirRevisionPunto`.
  - Acción "Resolver" en cada revisión abierta → `ordenesService.resolverRevision`.
  - Para gerente: botón "Mandar a revisión" con selección de puntos + comentario → `ordenesService.mandarARevision`.
  - Refrescar la orden tras cada acción.

- [ ] **Paso 3: En `CierreOTPage.jsx`** — botón de gerente "Rechazar" (modal de motivo, separado de "Reabrir") → `ordenesService.rechazar`. Mostrar el error 400 del gate de revisiones si aparece, idealmente listando los puntos en revisión (de `orden.resultados[].revisiones`).

- [ ] **Paso 4: En `DashboardPage.jsx`** — indicador visual en la tarjeta cuando la orden tiene revisiones abiertas (badge). Calcular desde `orden.resultados` si el listado las incluye; si `listarOrdenes` no trae revisiones, omitir el badge o agregarlas al include de `listarOrdenes` (decisión del implementador; preferir no recargar el dashboard con datos pesados).

- [ ] **Paso 5: `npm run build`** en frontend. Esperado: verde.

### Tarea 4.8: Commit (confirmar con el usuario)

- [ ] **Paso 1: Revisar `git status`** (¿versionar la migración? `prisma/migrations/` está en `.gitignore` por convención del repo — decidir con el usuario).
- [ ] **Paso 2: Commit:**

```bash
git add aeromx/backend/prisma/schema.prisma aeromx/backend/src/services/ordenesService.js aeromx/backend/src/controllers/ordenes/workflowController.js aeromx/backend/src/controllers/ordenes/cierreController.js aeromx/backend/src/routes/ordenes.js aeromx/frontend/src/api/ordenesService.js aeromx/frontend/src/pages/InspeccionPage.jsx aeromx/frontend/src/pages/CierreOTPage.jsx aeromx/frontend/src/pages/DashboardPage.jsx
git commit -m "feat: rechazo de orden (gerente) + revisión de puntos que bloquea el cierre"
```

---

# SESIÓN 5 — Asignación de tareas por punto + firma de tarea (punto 7)

**Archivos:**
- Modificar: `aeromx/backend/prisma/schema.prisma` (campos en `ResultadoPunto` + relaciones en `Usuario`)
- Crear: `aeromx/backend/prisma/migrations/20260525120000_asignacion_tarea_punto/migration.sql`
- Modificar: `aeromx/backend/src/services/ordenesService.js` (asignar, firmar tarea, gate)
- Modificar: `aeromx/backend/src/controllers/ordenes/resultadosController.js` (asignar, firmar tarea)
- Modificar: `aeromx/backend/src/controllers/ordenes/cierreController.js` (gate)
- Modificar: `aeromx/backend/src/routes/ordenes.js` (rutas)
- Modificar: `aeromx/frontend/src/api/ordenesService.js`, `InspeccionPage.jsx`, `CierreOTPage.jsx`, `DashboardPage.jsx`
- Verificar: API real (curl) + `npm run build`

**Contexto / decisiones:** Granularidad **por punto**. Cualquiera completa el punto; el **asignado** debe firmar su tarea (firma distinta de la firma de punto crítico). Esa firma es requisito de cierre. El asignado debe ser un usuario involucrado en la orden.

### Tarea 5.1: Respaldo de BD

- [ ] **Paso 1:** `pg_dump "$DATABASE_URL" > backups/aeromx_backup_$(date +%Y%m%d_%H%M%S).sql`

### Tarea 5.2: Schema — campos en ResultadoPunto

- [ ] **Paso 1: En `schema.prisma → model ResultadoPunto`, añadir** (después de `fechaFirma`, línea ~326):

```prisma
  asignadoId      String?   @map("asignado_id")
  firmaTareaPorId String?   @map("firma_tarea_por_id")
  fechaFirmaTarea DateTime? @map("fecha_firma_tarea")
```

- [ ] **Paso 2: Añadir relaciones en `ResultadoPunto`** (después de `firmante`, línea ~333):

```prisma
  asignado      Usuario? @relation("TareaAsignada", fields: [asignadoId], references: [id])
  firmaTareaPor Usuario? @relation("TareaFirmada", fields: [firmaTareaPorId], references: [id])
```

- [ ] **Paso 3: Añadir relaciones inversas en `Usuario`** (junto a las demás, línea ~76):

```prisma
  tareasAsignadas ResultadoPunto[] @relation("TareaAsignada")
  tareasFirmadas  ResultadoPunto[] @relation("TareaFirmada")
```

### Tarea 5.3: Migración a mano + aplicar

- [ ] **Paso 1: Crear `prisma/migrations/20260525120000_asignacion_tarea_punto/migration.sql`:**

```sql
-- AlterTable
ALTER TABLE "resultados_puntos" ADD COLUMN "asignado_id" TEXT;
ALTER TABLE "resultados_puntos" ADD COLUMN "firma_tarea_por_id" TEXT;
ALTER TABLE "resultados_puntos" ADD COLUMN "fecha_firma_tarea" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "resultados_puntos" ADD CONSTRAINT "resultados_puntos_asignado_id_fkey" FOREIGN KEY ("asignado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resultados_puntos" ADD CONSTRAINT "resultados_puntos_firma_tarea_por_id_fkey" FOREIGN KEY ("firma_tarea_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Paso 2: Detener backend, aplicar y regenerar:**

```bash
cd aeromx/backend
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Paso 3: Reiniciar backend.**

### Tarea 5.4: Servicios — asignar, firmar tarea, gate

- [ ] **Paso 1: En `ordenesService.js`, añadir `asignarPuntoAUsuario`** (valida que el asignado esté involucrado en la orden):

```js
// Asigna la responsabilidad de un punto a un usuario involucrado en la orden.
export async function asignarPuntoAUsuario(ordenId, resultadoId, asignadoId) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id: ordenId },
    select: { soporteId: true, ingenieroAuxiliarId: true, mecanicoId: true, gerenteId: true, pilotoId: true, operadorId: true },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (asignadoId) {
    const involucrados = [orden.soporteId, orden.ingenieroAuxiliarId, orden.mecanicoId, orden.gerenteId, orden.pilotoId, orden.operadorId]
    if (!involucrados.includes(asignadoId)) {
      throw Object.assign(new Error('El asignado debe ser un usuario involucrado en la orden'), { code: 'BAD_INPUT' })
    }
  }
  const resultado = await prisma.resultadoPunto.findFirst({ where: { id: resultadoId, ordenId } })
  if (!resultado) throw Object.assign(new Error('Resultado no encontrado'), { code: 'NOT_FOUND' })
  return prisma.resultadoPunto.update({
    where: { id: resultadoId },
    data: { asignadoId: asignadoId || null },
    include: { asignado: { select: { id: true, nombre: true, rol: true } } },
  })
}
```

- [ ] **Paso 2: Añadir `firmarTarea`** (solo el asignado o superusuario; punto debe estar completado):

```js
export async function firmarTarea(ordenId, resultadoId, usuario) {
  const resultado = await prisma.resultadoPunto.findFirst({ where: { id: resultadoId, ordenId } })
  if (!resultado) throw Object.assign(new Error('Resultado no encontrado'), { code: 'NOT_FOUND' })
  if (!resultado.asignadoId) {
    throw Object.assign(new Error('Este punto no tiene un responsable asignado'), { code: 'BAD_STATE' })
  }
  const esSuper = usuario.superusuario === true
  if (!esSuper && resultado.asignadoId !== usuario.sub) {
    throw Object.assign(new Error('Solo el responsable asignado puede firmar esta tarea'), { code: 'FORBIDDEN' })
  }
  if (!resultado.completado) {
    throw Object.assign(new Error('El punto debe estar completado antes de firmar la tarea'), { code: 'BAD_STATE' })
  }
  return prisma.resultadoPunto.update({
    where: { id: resultadoId },
    data: { firmaTareaPorId: usuario.sub, fechaFirmaTarea: new Date() },
    include: { firmaTareaPor: { select: { id: true, nombre: true } } },
  })
}
```

- [ ] **Paso 3: Añadir el verificador de gate `verificarTareasFirmadas`** (junto a `verificarCriticosFirmados`):

```js
// Todo punto con responsable asignado debe tener firma de tarea antes de cerrar.
export async function verificarTareasFirmadas(ordenId) {
  const [total, firmadas] = await Promise.all([
    prisma.resultadoPunto.count({ where: { ordenId, asignadoId: { not: null } } }),
    prisma.resultadoPunto.count({ where: { ordenId, asignadoId: { not: null }, firmaTareaPorId: { not: null } } }),
  ])
  return { total, firmadas, faltan: total - firmadas, completo: total === firmadas }
}
```

- [ ] **Paso 4: Aplicar el gate en `firmarCierre`** tras el gate de revisiones (Sesión 4):

```js
const tareas = await verificarTareasFirmadas(ordenId)
if (!tareas.completo) {
  throw Object.assign(
    new Error(`Faltan ${tareas.faltan} de ${tareas.total} firmas de tareas asignadas`),
    { code: 'BAD_STATE' },
  )
}
```

- [ ] **Paso 5: Incluir `asignado` y `firmaTareaPor` en `obtenerOrden`** (include de `resultados`, línea ~191-198):

```js
asignado:      { select: { id: true, nombre: true, rol: true } },
firmaTareaPor: { select: { id: true, nombre: true } },
```

### Tarea 5.5: Controllers + rutas

- [ ] **Paso 1: En `resultadosController.js`, añadir `asignar` y `firmarTarea`:**

```js
export async function asignar(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params
    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })
    // Solo gerente asignado o superusuario asignan responsables.
    if (req.user?.superusuario !== true && perm.orden.gerenteId !== req.user.sub) {
      return res.status(403).json({ error: 'Solo el gerente asignado puede asignar responsables' })
    }
    const out = await svc.asignarPuntoAUsuario(ordenId, resultadoId, req.body?.asignadoId ?? null)
    res.json(out)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    next(e)
  }
}

export async function firmarTarea(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params
    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })
    const out = await svc.firmarTarea(ordenId, resultadoId, req.user)
    res.json(out)
  } catch (e) {
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    next(e)
  }
}
```

> `perm.orden` incluye `gerenteId` (lo selecciona `verificarPermisoEdicion`). Confirmar al implementar.

- [ ] **Paso 2: En `cierreController.js → gestionar`, añadir el gate de tareas** tras el gate de revisiones:

```js
const tareas = await svc.verificarTareasFirmadas(ordenId)
if (!tareas.completo) {
  return res.status(400).json({
    error: `No se puede cerrar: faltan ${tareas.faltan} de ${tareas.total} firmas de tareas asignadas`,
  })
}
```

- [ ] **Paso 3: En `routes/ordenes.js`, registrar las rutas** (sección Resultados):

```js
router.patch('/:id/puntos/:resultadoId/asignacion',  resultados.asignar)
router.post('/:id/puntos/:resultadoId/firmar-tarea', resultados.firmarTarea)
```

### Tarea 5.6: Verificar backend con curl

- [ ] **Paso 1: Login (token como en Sesión 4).**
- [ ] **Paso 2: Asignar un punto al mecánico, completar el punto, e intentar cerrar sin firma de tarea (debe bloquear):**

```bash
# Asignar (gerente/super). <UID_MEC> = id del usuario mecanico@aeromx.com
curl -s -X PATCH "localhost:3001/api/ordenes/<ID>/puntos/<RID>/asignacion" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"asignadoId":"<UID_MEC>"}'
# Completar el punto
curl -s -X PATCH "localhost:3001/api/ordenes/<ID>/puntos/<RID>" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"completado":true,"estadoResultado":"bueno"}'
# Intentar cerrar → 400 "faltan 1 de 1 firmas de tareas asignadas"
curl -s -X POST "localhost:3001/api/ordenes/<ID>/cierre" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"seEncontroDefecto":false}'
```

- [ ] **Paso 3: Login como `mecanico@aeromx.com`, firmar la tarea, confirmar que el cierre se permite.** Verificar también que otro usuario (no asignado, no super) recibe 403 al intentar `firmar-tarea`.

### Tarea 5.7: Frontend — API service + UI

- [ ] **Paso 1: En `frontend/src/api/ordenesService.js`, añadir:**

```js
asignarPunto: (id, resultadoId, asignadoId) =>
  client.patch(`/ordenes/${id}/puntos/${resultadoId}/asignacion`, { asignadoId }),
firmarTarea: (id, resultadoId) =>
  client.post(`/ordenes/${id}/puntos/${resultadoId}/firmar-tarea`),
```

- [ ] **Paso 2: En `InspeccionPage.jsx`:**
  - Por punto: selector "Responsable" (solo gerente/super) con los usuarios involucrados de la orden (soporte, auxiliar, mecánico, gerente, piloto, operador presentes) → `ordenesService.asignarPunto`.
  - Mostrar el `asignado` del punto y su firma de tarea (`firmaTareaPor` + `fechaFirmaTarea`).
  - Botón "Firmar mi tarea" visible solo si el usuario actual es el `asignado`, el punto está `completado` y aún no tiene `firmaTareaPor` → `ordenesService.firmarTarea`.
  - Vista/filtro "Mis tareas": filtrar `orden.resultados` donde `asignado?.id === user.id`.
  - Refrescar la orden tras cada acción.

- [ ] **Paso 3: En `CierreOTPage.jsx`:** mostrar el error del gate de tareas si aparece, listando los puntos con tarea asignada sin firmar (de `orden.resultados`).

- [ ] **Paso 4: En `DashboardPage.jsx`:** (opcional) badge "Tienes N tareas" para el usuario actual, calculado si el listado trae las asignaciones; si no, omitir.

- [ ] **Paso 5: `npm run build`** en frontend. Esperado: verde.

### Tarea 5.8: Commit (confirmar con el usuario)

- [ ] **Paso 1: Commit:**

```bash
git add aeromx/backend/prisma/schema.prisma aeromx/backend/src/services/ordenesService.js aeromx/backend/src/controllers/ordenes/resultadosController.js aeromx/backend/src/controllers/ordenes/cierreController.js aeromx/backend/src/routes/ordenes.js aeromx/frontend/src/api/ordenesService.js aeromx/frontend/src/pages/InspeccionPage.jsx aeromx/frontend/src/pages/CierreOTPage.jsx aeromx/frontend/src/pages/DashboardPage.jsx
git commit -m "feat: asignación de tareas por punto con firma de tarea como gate de cierre"
```

---

## Resumen de gates de cierre (estado final tras Sesión 5)

El cierre de una O/T (`cierreController.gestionar` y `ordenesService.firmarCierre`) queda bloqueado si:
1. No todos los puntos están `completado` (existente).
2. Hay puntos críticos sin firma individual (existente).
3. **(Sesión 4)** Hay revisiones de punto en estado `abierta`.
4. **(Sesión 5)** Hay puntos con responsable asignado sin firma de tarea.

Y el cierre final (estado `cerrada`) requiere las firmas de slot por tipo (soporte+gerente, +piloto si aeronave, +operador si gcs) — existente.
