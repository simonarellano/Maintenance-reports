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

const TIPO_LABELS = {
  aeronave: 'Aeronave', gcs: 'GCS', planta: 'Planta de energía', sensor_inteligencia: 'Sensor de inteligencia',
}


// ─── Datos del producto según tipo ──────────────────────────────────────────

// Genera la lista de pares [etiqueta, valor] para el bloque "Datos del producto"
// del PDF, eligiendo qué mostrar según tipoProducto.
function filasDatosProducto(orden) {
  const p = orden.producto
  if (!p) return []
  const modeloNombre     = p.modelo?.nombre || '—'
  const modeloFabricante = p.modelo?.fabricante || '—'

  if (p.tipoProducto === 'aeronave') {
    const d = p.aeronave || {}
    return [
      ['Matrícula',       p.identificador],
      ['Modelo',          modeloNombre],
      ['Fabricante',      modeloFabricante],
      ['N.º de serie',    p.numeroSerie || '—'],
      ['Horas totales',   orden.horasTotales  != null ? `${orden.horasTotales} h`  : `${d.horasTotales ?? '—'} h (actual)`],
      ['Horas motor der', orden.horasMotorDer != null ? `${orden.horasMotorDer} h` : `${d.horasMotorDer ?? '—'} h (actual)`],
      ['Horas motor izq', orden.horasMotorIzq != null ? `${orden.horasMotorIzq} h` : `${d.horasMotorIzq ?? '—'} h (actual)`],
    ]
  }
  if (p.tipoProducto === 'gcs') {
    const d = p.gcs || {}
    return [
      ['Placas',       d.placas || p.identificador],
      ['Modelo',       modeloNombre],
      ['Fabricante',   modeloFabricante],
      ['VIN',          d.vin || '—'],
      ['N.º de serie', p.numeroSerie || '—'],
      ['Odómetro',     orden.odometro != null ? `${orden.odometro} km` : `${d.odometro ?? '—'} km (actual)`],
    ]
  }
  if (p.tipoProducto === 'planta') {
    const d = p.planta || {}
    return [
      ['N.º de serie', p.identificador],
      ['Modelo',       modeloNombre],
      ['Fabricante',   modeloFabricante],
      ['N.º interno',  p.numeroSerie || '—'],
      ['Horímetro',    orden.horimetro != null ? `${orden.horimetro} h` : `${d.horimetro ?? '—'} h (actual)`],
    ]
  }
  if (p.tipoProducto === 'sensor_inteligencia') {
    const d = p.sensor_inteligencia || {}
    return [
      ['N.º de serie',     p.identificador],
      ['Modelo',           modeloNombre],
      ['Fabricante',       d.fabricante || modeloFabricante],
      ['Firmware',         d.versionFirmware || '—'],
      ['Calibración',      d.fechaCalibracion ? fmtFecha(d.fechaCalibracion) : '—'],
      ['N.º interno',      p.numeroSerie || '—'],
    ]
  }
  return []
}

// ─── Endpoint principal ─────────────────────────────────────────────────────

export async function generar(req, res, next) {
  try {
    const orden = await svc.obtenerOrden(req.params.id)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    // Por defecto el PDF incluye las fotos; con ?fotos=false se genera sin ellas.
    const incluirFotos = req.query.fotos !== 'false'

    const { default: PDFDocument } = await import('pdfkit')
    const doc = new PDFDocument({
      margin: 40,
      size: 'LETTER',
      bufferPages: true,
      info: {
        Title:    `Orden de Mantenimiento ${orden.numeroOt}`,
        Author:   COMPANY.nombre,
        Subject:  `Mantenimiento ${orden.producto?.identificador ?? ''}`,
        Keywords: 'mantenimiento, aeromx',
      },
    })

    const sufijo = incluirFotos ? '' : '-sin-fotos'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="OT-${orden.numeroOt}${sufijo}.pdf"`)
    doc.pipe(res)

    const PAGE_W = doc.page.width
    const M = 40
    const CONTENT_W = PAGE_W - M * 2

    registerFonts(doc)
    drawHeader(doc, orden, M, CONTENT_W)
    drawTitleRow(doc, orden, M, CONTENT_W)
    drawTimeline(doc, orden, M, CONTENT_W)

    const totales = calcularTotales(orden)
    const secuencia = resolverSecuencia(orden.formato)
    let nextSectionNum = 1
    // Pre-cargar los buffers de fotos (async) antes del render síncrono del PDF.
    // Si el PDF se pidió sin fotos, no se descarga nada y la galería no se dibuja.
    const fotosBuffers = incluirFotos ? await precargarFotos(orden) : new Map()
    const ctx = { M, W: CONTENT_W, nextSectionNum: () => nextSectionNum++, totales, fotosBuffers, incluirFotos }
    const bloquesPorId = Object.fromEntries((orden.formato.bloquesTexto || []).map((b) => [b.id, b]))

    for (const item of secuencia) {
      if (item.tipo === 'bloque') {
        const bloque = bloquesPorId[item.id]
        if (bloque) drawMarkdownBlock(doc, bloque.titulo, bloque.contenido, M, CONTENT_W)
        continue
      }
      const renderer = BUILTIN_RENDERERS[item.tipo]
      if (renderer) renderer(doc, orden, ctx)
    }

    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      drawFooter(doc, orden, i + 1, pages.count, M, CONTENT_W)
    }

    doc.end()
  } catch (e) { next(e) }
}

// ─── Renderers de built-ins ─────────────────────────────────────────────────

function calcularTotales(orden) {
  let totalPuntos = 0
  let completados = 0
  for (const r of orden.resultados || []) {
    totalPuntos++
    if (r.completado) completados++
  }
  return { totalPuntos, completados }
}

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

// Mantiene compatibilidad con formatos viejos que usan "datos_aeronave"
function renderDatosProducto(doc, orden, ctx) {
  const tipo = orden.producto?.tipoProducto || 'producto'
  const tituloMap = {
    aeronave: 'Datos de la aeronave', gcs: 'Datos de la GCS',
    planta: 'Datos de la planta', sensor_inteligencia: 'Datos del sensor de inteligencia',
  }
  ui.sectionHead(doc, ctx.nextSectionNum(), tituloMap[tipo] || 'Datos del producto', ctx.M, ctx.W)
  // filasDatosProducto devuelve [label, value]; marcamos mono/lg para los prominentes
  const filas = filasDatosProducto(orden).map(([label, value], idx) => {
    const esSerieOIdent = /serie|placas|matrícula|interno|vin|firmware/i.test(label)
    return [label, value, { lg: idx < 3, mono: esSerieOIdent }]
  })
  ui.kvGrid(doc, filas, 3, ctx.M, ctx.W)
}

function renderPersonal(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Personal responsable', ctx.M, ctx.W)

  const mk = (categoria, rolTag, persona) => ({
    categoria, rolTag, nombre: persona?.nombre || 'No asignado',
    rol: (persona?.rol || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || '—',
    licencia: persona?.licenciaNum || '—',
  })

  const cards = [mk('Soporte', 'Técnico', orden.soporte)]
  if (orden.ingenieroAuxiliar) cards.push(mk('Soporte', 'Ing. aux.', orden.ingenieroAuxiliar))
  if (orden.mecanico) cards.push(mk('Mantenimiento', 'Mecánico', orden.mecanico))
  if (orden.operador) cards.push(mk('Operación', 'Operador', orden.operador))
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

function renderTrabajos(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Trabajos realizados', ctx.M, ctx.W)
  const resultadosPorPunto = Object.fromEntries(orden.resultados.map((r) => [r.puntoId, r]))
  const cols = ui.worksColumns(ctx.W)

  ui.worksTableHeader(doc, cols, ctx.M)

  for (const seccion of orden.formato.secciones || []) {
    const puntos = (seccion.puntos || []).filter((p) => resultadosPorPunto[p.id])
    if (puntos.length === 0) continue
    const hechos = puntos.filter((p) => resultadosPorPunto[p.id]?.completado).length
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
      if (ctx.incluirFotos && r.fotos && r.fotos.length > 0) {
        ui.evidenceGallery(doc, r.fotos, ctx.fotosBuffers, ctx.M, ctx.W, fmtFecha)
      }
    }
  }

  // Leyenda al final de la sección
  ui.ensureSpace(doc, 24)
  doc.moveDown(0.3)
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text('✦ Punto crítico — requiere firma individual.   Condición: BUENO · CON DAÑOS · REQUIERE ATENCIÓN · N/A',
      ctx.M, doc.y, { width: ctx.W, lineBreak: false, ellipsis: true })
  doc.fillColor(COLOR.ink)
  doc.moveDown(0.4)
}

// La evidencia ahora se dibuja por renglón dentro de renderTrabajos.
// Se deja como no-op para no romper secuencias guardadas que incluyan "fotos".
function renderFotos() { /* no-op */ }

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
  // fuente idéntica en ambos casos; el estado vacío se distingue por color + oblique
  font(doc, FONT.sans).fontSize(10).fillColor(obs ? COLOR.ink2 : COLOR.muted)
    .text(txt, ctx.M + 14, y + 24, { width: ctx.W - 28, oblique: !obs })
  doc.fillColor(COLOR.ink)
  doc.y = y + boxH + 6
  doc.x = ctx.M
}

function renderFirmas(doc, orden, ctx) {
  ui.sectionHead(doc, ctx.nextSectionNum(), 'Firmas de conformidad', ctx.M, ctx.W)
  const c = orden.cierre
  const tipo = orden.producto?.tipoProducto

  const cajas = [
    { categoria: 'Soporte', persona: c?.soporte || orden.soporte, fecha: c?.fechaFirmaSoporte },
    { categoria: 'Aprobación', persona: c?.gerente || orden.gerente, fecha: c?.fechaFirmaGerente },
  ]
  if (tipo === 'aeronave') {
    cajas.push({ categoria: 'Operación', persona: c?.piloto || orden.piloto, fecha: c?.fechaFirmaPiloto })
  } else if (tipo === 'gcs') {
    cajas.push({ categoria: 'Operación', persona: c?.operador || orden.operador, fecha: c?.fechaFirmaOperador })
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

const BUILTIN_RENDERERS = {
  datos_generales: renderDatosGenerales,
  datos_aeronave:  renderDatosProducto,  // alias para formatos viejos
  datos_producto:  renderDatosProducto,
  personal:        renderPersonal,
  trabajos:        renderTrabajos,
  fotos:           renderFotos,
  dictamen:        renderDictamen,
  firmas:          renderFirmas,
}

// ─── Helpers de dibujo ──────────────────────────────────────────────────────

function drawHeader(doc, orden, M, W) {
  const topY = 40
  // Logo HYDRA en tinta (o texto si falta el archivo)
  const logoPath = path.join(process.cwd(), 'public/hydra-logo.png')
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, M, topY, { height: 30 })
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

function drawTimeline(doc, orden, M, W) {
  const tipo = orden.producto?.tipoProducto
  const labelRecepcion = { aeronave: 'Recepción aeronave', gcs: 'Recepción GCS',
    planta: 'Recepción planta', sensor_inteligencia: 'Recepción sensor de inteligencia' }[tipo] || 'Recepción'
  ui.timeline(doc, [
    { num: 1, label: 'Creación de orden', value: orden.createdAt ? fmtFecha(orden.createdAt) : 'Pendiente' },
    { num: 2, label: labelRecepcion,      value: orden.fechaRecepcion ? fmtFecha(orden.fechaRecepcion) : 'Pendiente' },
    { num: 3, label: 'Inicio mantenim.',  value: orden.fechaInicio ? fmtFecha(orden.fechaInicio) : 'Pendiente' },
    { num: 4, label: 'Cierre / firma',    value: orden.fechaCierre ? fmtFecha(orden.fechaCierre) : 'Pendiente' },
  ], M, W)
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
}

function drawFooter(doc, orden, pageNum, totalPages, M, W) {
  const y = doc.page.height - 30
  doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(M, y).lineTo(M + W, y).stroke()
  font(doc, FONT.mono).fontSize(7.5).fillColor(COLOR.muted)
    .text(`${COMPANY.nombre} · O/T ${orden.numeroOt} · Generado ${fmtFechaHora(new Date())}`,
      M, y + 5, { width: W, align: 'left', lineBreak: false })
    .text(`Página ${pageNum} de ${totalPages}`, M, y + 5, { width: W, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.ink)
}

// ─── Evidencia fotográfica ──────────────────────────────────────────────────

// pdfkit solo embebe PNG y JPEG.
const EXT_IMG_VALIDAS = new Set(['.png', '.jpg', '.jpeg'])

function esImagenEmbebible(urlArchivo) {
  const ext = path.extname(urlArchivo || '').toLowerCase()
  return EXT_IMG_VALIDAS.has(ext)
}

// Descarga (async) los buffers de todas las fotos de la orden desde la capa de
// almacenamiento, para poder embeberlos en el render síncrono del PDF.
// Devuelve un Map<urlArchivo, Buffer|null> (null = no disponible o formato no soportado).
async function precargarFotos(orden) {
  const map = new Map()
  const urls = []
  for (const r of orden.resultados || []) {
    for (const f of r.fotos || []) {
      if (f.urlArchivo && !map.has(f.urlArchivo)) {
        map.set(f.urlArchivo, null)
        urls.push(f.urlArchivo)
      }
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
