import prisma from '../../lib/prisma.js'
import { INCLUDE_FALLA } from '../../services/fallasService.js'
import { storage, keyDesdeUrl } from '../../lib/storage/index.js'
import { COLOR, FONT, font, registerFonts, fmtFecha, fmtFechaHora } from '../../pdf/theme.js'
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

const TIPO_LABELS = {
  aeronave: 'Aeronave', gcs: 'GCS', planta: 'Planta de energía', sensor_inteligencia: 'Sensor de inteligencia',
}

const SEVERIDAD_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
const ESTADO_LABEL = { detectada: 'Detectada', en_proceso: 'En proceso', resuelta: 'Resuelta' }
const ORIGEN_LABEL = { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }

// El status pill de ui.js mapea estados de O/T; para la falla reusamos pill() vía
// statusPill no aplica (sus llaves son otras). Dibujamos un pill con conditionPill no encaja
// tampoco. En su lugar usamos un mapa de colores del theme y dibujamos con la misma estética.
const ESTADO_PILL = {
  detectada:  { fg: COLOR.accent,   bg: COLOR.accentSoft },
  en_proceso: { fg: COLOR.warn,     bg: COLOR.warnSoft },
  resuelta:   { fg: COLOR.ok,       bg: COLOR.okSoft },
}

// ─── Endpoint principal ─────────────────────────────────────────────────────

export async function generar(req, res, next) {
  try {
    const falla = await prisma.reporteFalla.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_FALLA,
    })
    if (!falla) return res.status(404).json({ error: 'Falla no encontrada' })

    const fotosBuffers = await precargarFotos(falla)

    const { default: PDFDocument } = await import('pdfkit')
    const doc = new PDFDocument({
      margin: 40,
      size: 'LETTER',
      bufferPages: true,
      info: {
        Title:    `Reporte de Falla ${falla.numeroFalla}`,
        Author:   COMPANY.nombre,
        Subject:  `Falla ${falla.producto?.identificador ?? ''}`,
        Keywords: 'falla, aeromx',
      },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${falla.numeroFalla}.pdf"`)
    doc.pipe(res)

    const M = 40
    const W = doc.page.width - M * 2
    let nextSectionNum = 1
    const num = () => nextSectionNum++

    registerFonts(doc)
    drawHeader(doc, falla, M, W)
    drawTitleRow(doc, falla, M, W)

    renderDatosProducto(doc, falla, M, W, num)
    renderClasificacion(doc, falla, M, W, num)
    renderDescripcion(doc, falla, M, W, num)
    renderPersonas(doc, falla, M, W, num)
    renderResolucion(doc, falla, M, W, num)
    renderEvidencia(doc, falla, fotosBuffers, M, W, num)
    renderFirma(doc, falla, M, W, num)

    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.page.margins.bottom = 0
      drawFooter(doc, falla, i + 1, pages.count, M, W)
    }

    doc.end()
  } catch (e) { next(e) }
}

// ─── Secciones ──────────────────────────────────────────────────────────────

function renderDatosProducto(doc, falla, M, W, num) {
  const p = falla.producto
  const tipo = p?.tipoProducto
  const tituloMap = {
    aeronave: 'Datos de la aeronave', gcs: 'Datos de la GCS',
    planta: 'Datos de la planta', sensor_inteligencia: 'Datos del sensor de inteligencia',
  }
  ui.sectionHead(doc, num(), tituloMap[tipo] || 'Datos del producto', M, W)
  ui.kvGrid(doc, [
    ['Tipo de producto', TIPO_LABELS[tipo] || '—'],
    ['Identificador',    p?.identificador || '—', { mono: true, lg: true }],
    ['Modelo',           p?.modelo?.nombre || '—'],
    ['Fabricante',       p?.modelo?.fabricante || '—'],
    ['N.º de serie',     p?.numeroSerie || '—', { mono: true }],
    ['Formato',          falla.formato ? `${falla.formato.nombre} v${falla.formato.version}` : '—'],
  ], 3, M, W)
}

function renderClasificacion(doc, falla, M, W, num) {
  ui.sectionHead(doc, num(), 'Clasificación', M, W)
  const sevColor = { baja: COLOR.ok, media: COLOR.warn, alta: COLOR.critical, critica: COLOR.critical }[falla.severidad] || COLOR.ink
  ui.kvGrid(doc, [
    ['Categoría',  falla.categoria?.nombre || '—'],
    ['Severidad',  SEVERIDAD_LABEL[falla.severidad] || falla.severidad || '—', { color: sevColor }],
    ['Origen',     ORIGEN_LABEL[falla.origen] || falla.origen || '—'],
    ['Componente', falla.componente || '—'],
  ], 4, M, W)
}

function renderDescripcion(doc, falla, M, W, num) {
  ui.sectionHead(doc, num(), 'Descripción de la falla', M, W)

  // Título de la falla destacado
  ui.ensureSpace(doc, 24)
  font(doc, FONT.sansSemi).fontSize(13).fillColor(COLOR.ink)
    .text(falla.titulo || '—', M, doc.y, { width: W })
  doc.moveDown(0.3)

  // Bloque de descripción (mismo look que las observaciones de la O/T)
  const txt = falla.descripcion || 'Sin descripción registrada.'
  font(doc, FONT.sans).fontSize(10)
  const txtH = doc.heightOfString(txt, { width: W - 28 })
  const boxH = Math.max(48, txtH + 30)
  ui.ensureSpace(doc, boxH + 6)
  const y = doc.y
  ui.roundedPanel(doc, M, y, W, boxH, { fill: '#FCFBF6', stroke: COLOR.line })
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text('DESCRIPCIÓN', M + 14, y + 11, { characterSpacing: 0.6, lineBreak: false })
  font(doc, FONT.sans).fontSize(10).fillColor(COLOR.ink2)
    .text(txt, M + 14, y + 24, { width: W - 28 })
  doc.fillColor(COLOR.ink)
  doc.y = y + boxH + 6
  doc.x = M
}

function renderPersonas(doc, falla, M, W, num) {
  ui.sectionHead(doc, num(), 'Personas involucradas', M, W)

  const mk = (categoria, rolTag, persona) => ({
    categoria, rolTag,
    nombre: persona?.nombre || 'No asignado',
    rol: (persona?.rol || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || '—',
    licencia: persona?.licenciaNum || '—',
  })

  const cards = [mk('Reporte', 'Reportó', falla.reportadoPor)]
  if (falla.responsable) cards.push(mk('Atención', 'Responsable', falla.responsable))
  if (falla.resueltoPor) cards.push(mk('Resolución', 'Resolvió', falla.resueltoPor))

  const cols = 3
  const gap = 10
  const cardW = (W - gap * (cols - 1)) / cols
  const cardH = 92

  for (let i = 0; i < cards.length; i += cols) {
    ui.ensureSpace(doc, cardH + 12)
    const y = doc.y
    for (let c = 0; c < cols && i + c < cards.length; c++) {
      const x = M + c * (cardW + gap)
      ui.personCard(doc, x, y, cardW, cardH, cards[i + c])
    }
    doc.y = y + cardH + gap
    doc.x = M
  }
}

function renderResolucion(doc, falla, M, W, num) {
  ui.sectionHead(doc, num(), 'Resolución', M, W)
  const resuelta = falla.estado === 'resuelta'

  ui.kvGrid(doc, [
    ['Estado',             ESTADO_LABEL[falla.estado] || falla.estado || '—', { color: (ESTADO_PILL[falla.estado]?.fg) || COLOR.ink }],
    ['Fecha de resolución', resuelta && falla.fechaResolucion ? fmtFecha(falla.fechaResolucion) : 'Pendiente'],
    ['O/T correctiva',     falla.ordenCorrectiva?.numeroOt || '—', { mono: true }],
  ], 3, M, W)

  // Bloque de acción correctiva
  const txt = resuelta
    ? (falla.accionCorrectiva || 'Sin detalle de acción correctiva.')
    : 'Pendiente de resolución.'
  font(doc, FONT.sans).fontSize(10)
  const txtH = doc.heightOfString(txt, { width: W - 28 })
  const boxH = Math.max(48, txtH + 30)
  ui.ensureSpace(doc, boxH + 6)
  const y = doc.y
  ui.roundedPanel(doc, M, y, W, boxH, { fill: '#FCFBF6', stroke: COLOR.line })
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text('ACCIÓN CORRECTIVA', M + 14, y + 11, { characterSpacing: 0.6, lineBreak: false })
  font(doc, FONT.sans).fontSize(10).fillColor(resuelta ? COLOR.ink2 : COLOR.muted)
    .text(txt, M + 14, y + 24, { width: W - 28, oblique: !resuelta })
  doc.fillColor(COLOR.ink)
  doc.y = y + boxH + 6
  doc.x = M
}

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

function renderFirma(doc, falla, M, W, num) {
  if (falla.estado !== 'resuelta' || !falla.resueltoPor) return
  ui.sectionHead(doc, num(), 'Firma de resolución', M, W)

  const persona = falla.resueltoPor
  const boxW = Math.min(W, (W - 14) / 2 < 200 ? W : (W - 14) / 2)
  const boxH = 104
  ui.ensureSpace(doc, boxH + 10)
  const y = doc.y + 4
  ui.signatureCard(doc, M, y, boxW, boxH, {
    categoria: 'Resolución',
    nombre: persona?.nombre,
    rol: (persona?.rol || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
    licencia: persona?.licenciaNum,
    fecha: falla.fechaResolucion,
  }, fmtFechaHora)
  doc.y = y + boxH + 10
  doc.x = M
}

// ─── Helpers de dibujo ──────────────────────────────────────────────────────

function drawHeader(doc, falla, M, W) {
  const topY = 40
  const logoPath = path.join(process.cwd(), 'public/hydra-logo.png')
  try {
    if (fs.existsSync(logoPath)) doc.image(logoPath, M, topY, { height: 30 })
  } catch { /* cae a texto */ }

  const brandX = fs.existsSync(logoPath) ? M + 86 : M
  font(doc, FONT.sansSemi).fontSize(11).fillColor(COLOR.ink)
    .text(`${COMPANY.nombre} · ${COMPANY.lema}`, brandX, topY + 2, { lineBreak: false })
  font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
    .text(`${COMPANY.direccion} · ${COMPANY.telefono} · ${COMPANY.email}`,
      brandX, topY + 17, { lineBreak: false })

  font(doc, FONT.mono).fontSize(8.5).fillColor(COLOR.muted)
  const metaLines = [
    `Documento  Reporte de falla`,
    `Generado  ${fmtFechaHora(new Date())}`,
    `Detectada  ${fmtFecha(falla.fechaDeteccion)}`,
  ]
  let my = topY
  for (const line of metaLines) {
    doc.fillColor(COLOR.muted).text(line, M, my, { width: W, align: 'right', lineBreak: false })
    my += 12
  }

  const sepY = topY + 40
  doc.lineWidth(1).strokeColor(COLOR.ink).moveTo(M, sepY).lineTo(M + W, sepY).stroke()
  doc.fillColor(COLOR.ink)
  doc.y = sepY + 16
  doc.x = M
}

function drawTitleRow(doc, falla, M, W) {
  const y = doc.y
  const pillReserve = 130
  const leftW = W - pillReserve

  font(doc, FONT.mono).fontSize(9).fillColor(COLOR.muted)
    .text('REPORTE DE FALLA', M, y, { width: leftW, characterSpacing: 1.2, lineBreak: false })
  font(doc, FONT.sansMed).fontSize(26).fillColor(COLOR.ink)
    .text(falla.titulo || 'Reporte de falla', M, y + 14, { width: leftW })
  const folioY = doc.y + 2
  font(doc, FONT.mono).fontSize(12).fillColor(COLOR.ink2)
    .text(`N.º  ${falla.numeroFalla}`, M, folioY, { width: leftW, lineBreak: false })

  drawEstadoPill(doc, M + W, y + 16, falla.estado)

  doc.fillColor(COLOR.ink)
  doc.y = folioY + 22
  doc.x = M
}

// Pill de estado de falla alineado a la derecha (mismo estilo que ui.statusPill).
function drawEstadoPill(doc, xRight, y, estado) {
  const cfg = ESTADO_PILL[estado] || { fg: COLOR.muted, bg: COLOR.line2 }
  const label = (ESTADO_LABEL[estado] || estado || '—')
  font(doc, FONT.monoMed).fontSize(8.5)
  const padX = 9, dotW = 12
  const textW = doc.widthOfString(label.toUpperCase())
  const w = padX * 2 + dotW + textW
  const h = 17
  const x = xRight - w
  const cy = y + h / 2
  doc.save()
  doc.roundedRect(x, y, w, h, h / 2).fill(cfg.bg)
  doc.lineWidth(0.8).strokeColor(cfg.fg).roundedRect(x, y, w, h, h / 2).stroke()
  doc.circle(x + padX + 3.5, cy, 3.5).fill(cfg.fg)
  font(doc, FONT.monoMed).fontSize(8.5).fillColor(cfg.fg)
  const txtH = doc.currentLineHeight()
  doc.text(label.toUpperCase(), x + padX + dotW, cy - txtH / 2, { lineBreak: false })
  doc.restore()
  doc.fillColor(COLOR.ink)
}

function drawFooter(doc, falla, pageNum, totalPages, M, W) {
  const y = doc.page.height - 30
  doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(M, y).lineTo(M + W, y).stroke()
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text(`${COMPANY.nombre} · Falla ${falla.numeroFalla} · Generado ${fmtFechaHora(new Date())}`,
      M, y + 5, { width: W, align: 'left', lineBreak: false })
    .text(`Página ${pageNum} de ${totalPages}`, M, y + 5, { width: W, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.ink)
}

// ─── Evidencia fotográfica (preload) ──────────────────────────────────────────

const EXT_IMG_VALIDAS = new Set(['.png', '.jpg', '.jpeg'])
function esImagenEmbebible(urlArchivo) {
  return EXT_IMG_VALIDAS.has(path.extname(urlArchivo || '').toLowerCase())
}

// Descarga (async) los buffers de las fotos antes del render síncrono del PDF.
async function precargarFotos(falla) {
  const map = new Map()
  const urls = []
  for (const f of falla.fotos || []) {
    if (f.urlArchivo && !map.has(f.urlArchivo)) {
      map.set(f.urlArchivo, null)
      urls.push(f.urlArchivo)
    }
  }
  await Promise.all(
    urls.map(async (url) => {
      if (!esImagenEmbebible(url)) return
      try {
        const key = keyDesdeUrl(url)
        const buf = key ? await storage.getBuffer(key) : null
        if (buf) map.set(url, buf)
      } catch { /* deja null → placeholder */ }
    }),
  )
  return map
}
