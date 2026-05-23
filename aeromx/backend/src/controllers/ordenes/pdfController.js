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

// ─── Shim temporal de compatibilidad ────────────────────────────────────────
// Los renderers §01–§06 aún referencian la paleta vieja. Este objeto los mantiene
// funcionando hasta que cada renderer sea migrado en tareas posteriores.
// TODO: eliminar llave a llave conforme avancen las tareas 4–11.
const _COMPAT = {
  primary:   COLOR.accent,        // azul acento (#2F5FA6)
  primaryDk: COLOR.ink,           // tinta oscura
  bandBg:    COLOR.ink,           // fondo de banda oscuro
  bandText:  COLOR.paper,         // texto sobre banda oscura
  border:    COLOR.line,          // borde claro
  gray:      COLOR.muted,         // texto secundario
  dark:      COLOR.ink,           // tinta principal
  light:     COLOR.accentSoft,    // fondo suave
  rowAten:   COLOR.criticalSoft,  // fila "requiere atención"
  rowDanos:  COLOR.warnSoft,      // fila "con daños"
  rowOk:     COLOR.okSoft,        // fila completada OK
  green:     COLOR.ok,            // verde de firma confirmada
  obsColor:  COLOR.critical,      // rojo de observaciones (era #ff4545) — renombrado de 'accent' para no sobreescribir COLOR.accent del tema
}
// Mezclamos el shim sobre COLOR para que las referencias COLOR.border, etc. resuelvan.
Object.assign(COLOR, _COMPAT)

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
  if (p.tipoProducto === 'camion') {
    const d = p.camion || {}
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
  if (p.tipoProducto === 'sensor') {
    const d = p.sensor || {}
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

// Etiqueta de hito 2 según tipo (recepción)
function etiquetaRecepcion(tipo) {
  if (tipo === 'aeronave') return '2. Recepción aeronave'
  if (tipo === 'camion')   return '2. Recepción camión'
  if (tipo === 'planta')   return '2. Recepción planta'
  if (tipo === 'sensor')   return '2. Recepción sensor'
  return '2. Recepción'
}

// ─── Endpoint principal ─────────────────────────────────────────────────────

export async function generar(req, res, next) {
  try {
    const orden = await svc.obtenerOrden(req.params.id)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

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

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="OT-${orden.numeroOt}.pdf"`)
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
    const fotosBuffers = await precargarFotos(orden)
    const ctx = { M, W: CONTENT_W, nextSectionNum: () => nextSectionNum++, totales, fotosBuffers }
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

function renderPersonal(doc, orden, ctx) {
  sectionTitle(doc, `${ctx.nextSectionNum()}. PERSONAL RESPONSABLE`, ctx.M, ctx.W)

  // Cards de personal — 2 columnas, hasta 5 cards (soporte, auxiliar?, mecánico, gerente, piloto?)
  const cards = []
  cards.push({ titulo: 'SOPORTE',          persona: orden.soporte })
  if (orden.ingenieroAuxiliar) {
    cards.push({ titulo: 'INGENIERO AUXILIAR', persona: orden.ingenieroAuxiliar })
  }
  cards.push({ titulo: 'MECÁNICO',         persona: orden.mecanico })
  cards.push({ titulo: 'GERENTE',          persona: orden.gerente })
  if (orden.producto?.tipoProducto === 'aeronave') {
    cards.push({ titulo: 'PILOTO', persona: orden.piloto })
  }

  const gap = 14
  const cardW = (ctx.W - gap) / 2
  const cardH = 96

  let i = 0
  while (i < cards.length) {
    ensureSpace(doc, cardH + 14)
    const startY = doc.y + 4
    const c1 = cards[i]
    const c2 = cards[i + 1]
    drawPersonaCard(doc, ctx.M,               startY, cardW, cardH, c1.titulo, c1.persona, 'No asignado')
    if (c2) drawPersonaCard(doc, ctx.M + cardW + gap, startY, cardW, cardH, c2.titulo, c2.persona, 'No asignado')
    doc.y = startY + cardH + 8
    doc.x = ctx.M
    i += 2
  }
}

function drawPersonaCard(doc, x, y, w, h, titulo, persona, fallbackNombre) {
  doc.lineWidth(0.5).strokeColor(COLOR.border)
  doc.rect(x, y, w, h).stroke()

  doc.save()
  doc.rect(x, y, w, 18).fill(COLOR.bandBg)
  doc.rect(x, y, 3, 18).fill(COLOR.primary)
  doc.restore()
  doc.fillColor(COLOR.primary).font('Helvetica-Bold').fontSize(9)
    .text(titulo, x + 10, y + 5, { width: w - 16, lineBreak: false, ellipsis: true })

  const items = [
    ['Nombre',   persona?.nombre || fallbackNombre],
    ['Rol',      (persona?.rol || '').replace(/_/g, ' ').toUpperCase() || '—'],
    ['Licencia', persona?.licenciaNum || '—'],
  ]
  let curY = y + 24
  const rowH = (h - 26) / items.length
  for (const [k, v] of items) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.gray)
      .text(k.toUpperCase(), x + 10, curY, {
        width: w - 20, lineBreak: false, ellipsis: true, characterSpacing: 0.4,
      })
    doc.font('Helvetica').fontSize(10).fillColor(COLOR.dark)
      .text(String(v ?? '—'), x + 10, curY + 9, {
        width: w - 20, lineBreak: false, ellipsis: true,
      })
    curY += rowH
  }
  doc.fillColor(COLOR.dark)
}

function renderTrabajos(doc, orden, ctx) {
  sectionTitle(doc, `${ctx.nextSectionNum()}. TRABAJOS REALIZADOS`, ctx.M, ctx.W)

  const resultadosPorPunto = Object.fromEntries(orden.resultados.map((r) => [r.puntoId, r]))

  for (const seccion of orden.formato.secciones || []) {
    doc.moveDown(0.2)
    ensureSpace(doc, 60)
    const secY = doc.y
    doc.save()
    doc.rect(ctx.M, secY, ctx.W, 18).fill(COLOR.bandBg)
    doc.rect(ctx.M, secY, 3, 18).fill(COLOR.primary)
    doc.restore()
    doc.fillColor(COLOR.primary).font('Helvetica-Bold').fontSize(10)
      .text(seccion.nombre.toUpperCase(), ctx.M + 10, secY + 5, {
        width: ctx.W - 16, lineBreak: false, ellipsis: true,
      })
    doc.fillColor(COLOR.dark)
    doc.y = secY + 22

    const cols = [
      { w: 24,  label: '#'           },
      { w: 130, label: 'COMPONENTE'  },
      { w: 175, label: 'DESCRIPCIÓN' },
      { w: 85,  label: 'CONDICIÓN'   },
      { w: 80,  label: 'FIRMA'       },
      { w: 41,  label: 'FOTOS'       },
    ]
    drawTableHeader(doc, cols, ctx.M)

    let idx = 1
    for (const punto of seccion.puntos || []) {
      const r = resultadosPorPunto[punto.id]
      if (!r) continue
      drawTableRow(doc, cols, ctx.M, [
        String(idx++),
        `${punto.nombreComponente}${punto.esCritico ? ' ★' : ''}`,
        punto.descripcion || '—',
        ESTADO_LABELS_PDF[r.estadoResultado] || r.estadoResultado,
        r.firmadoPor ? (r.firmante?.nombre || 'Firmado') : '—',
        String(r.fotos?.length || 0),
      ], r)
    }
  }

  doc.moveDown(0.3)
  ensureSpace(doc, 40)
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLOR.gray)
    .text('★ = Punto crítico — requiere firma individual.', ctx.M, doc.y)
  doc.fillColor(COLOR.dark)
}

function renderFotos(doc, orden, ctx) {
  const hayFotos = (orden.resultados || []).some((r) => (r.fotos || []).length > 0)
  if (!hayFotos) return
  drawEvidenciaFotografica(doc, orden, ctx.M, ctx.W, `${ctx.nextSectionNum()}. EVIDENCIA FOTOGRÁFICA`, ctx.fotosBuffers)
}

function renderDictamen(doc, orden, ctx) {
  if (!orden.cierre) return
  sectionTitle(doc, `${ctx.nextSectionNum()}. DICTAMEN Y OBSERVACIONES GENERALES`, ctx.M, ctx.W)
  const c = orden.cierre
  drawKVGrid(doc, [
    ['Puntos ejecutados',     `${ctx.totales.completados} de ${ctx.totales.totalPuntos}`],
    ['¿Se encontró defecto?', c.seEncontroDefecto ? 'SÍ' : 'NO'],
    ['Doc. correctivo',       c.refDocCorrectivo || '—'],
  ], ctx.M, ctx.W)

  if (c.observacionesGenerales) {
    ensureSpace(doc, 60)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.dark)
      .text('Observaciones:', ctx.M, doc.y + 4)
    doc.font('Helvetica').fontSize(9)
      .text(c.observacionesGenerales, ctx.M, doc.y + 2, { width: ctx.W, align: 'justify' })
  }
}

function renderFirmas(doc, orden, ctx) {
  sectionTitle(doc, `${ctx.nextSectionNum()}. FIRMAS DE CONFORMIDAD`, ctx.M, ctx.W)
  drawFirmas(doc, orden, ctx.M, ctx.W)
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
  const labelRecepcion = { aeronave: 'Recepción aeronave', camion: 'Recepción camión',
    planta: 'Recepción planta', sensor: 'Recepción sensor' }[tipo] || 'Recepción'
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

function sectionTitle(doc, txt, M, W) {
  ensureSpace(doc, 40)
  doc.moveDown(0.4)
  const titleY = doc.y
  doc.rect(M, titleY, W, 20).fill(COLOR.light)
  doc.rect(M, titleY, 3, 20).fill(COLOR.primary)
  doc.fillColor(COLOR.primaryDk).font('Helvetica-Bold').fontSize(11)
    .text(txt, M + 10, titleY + 5, { width: W - 16, lineBreak: false })
  doc.fillColor(COLOR.dark)
  doc.y = titleY + 24
}

function drawMarkdownBlock(doc, label, body, M, W) {
  ensureSpace(doc, 30)
  doc.moveDown(0.3)
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.dark)
    .text(label, M, doc.y, { width: W, lineBreak: true })

  const underlineY = doc.y + 2
  doc.lineWidth(0.5).strokeColor(COLOR.border).moveTo(M, underlineY).lineTo(M + W, underlineY).stroke()
  doc.y = underlineY + 6
  doc.x = M

  renderMarkdown(doc, body, {
    M, W,
    colorText:   COLOR.dark,
    colorAccent: COLOR.primaryDk,
    colorMuted:  COLOR.gray,
    colorRule:   COLOR.border,
  })

  doc.fillColor(COLOR.dark).font('Helvetica')
  doc.moveDown(0.4)
  doc.x = M
}

function drawKVGrid(doc, pairs, M, W) {
  const colW = W / 2
  const rowH = 20
  const rows = Math.ceil(pairs.length / 2)
  ensureSpace(doc, rows * rowH + 12)
  const gridY = doc.y

  for (let i = 0; i < pairs.length; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M + col * colW
    const y = gridY + row * rowH

    doc.lineWidth(0.5).strokeColor(COLOR.border)
    doc.rect(x, y, colW, rowH).stroke()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.gray)
      .text(String(pairs[i][0]).toUpperCase(), x + 6, y + 3, {
        width: colW - 12, lineBreak: false, ellipsis: true,
      })
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.dark)
      .text(String(pairs[i][1] ?? ''), x + 6, y + 10, {
        width: colW - 12, height: rowH - 11, ellipsis: true, lineBreak: false,
      })
  }
  doc.y = gridY + rows * rowH + 6
}

const TABLE_PAD_X = 4
const TABLE_PAD_Y = 4
const TABLE_FONT_SIZE = 7.5
const TABLE_HEADER_FONT_SIZE = 7.5
const TABLE_OBS_FONT_SIZE = 7
const TABLE_MIN_ROW_H = 18

function drawTableHeader(doc, cols, M) {
  ensureSpace(doc, 40)
  const headerY = doc.y
  const totalW = cols.reduce((a, c) => a + c.w, 0)
  doc.save()
  doc.rect(M, headerY, totalW, 16).fill(COLOR.bandBg)
  doc.restore()

  let x = M
  doc.fillColor(COLOR.bandText).font('Helvetica-Bold').fontSize(TABLE_HEADER_FONT_SIZE)
  for (const c of cols) {
    doc.text(c.label, x + TABLE_PAD_X, headerY + TABLE_PAD_Y, {
      width: c.w - TABLE_PAD_X * 2, lineBreak: false, ellipsis: true,
    })
    x += c.w
  }
  doc.fillColor(COLOR.dark)
  doc.y = headerY + 18
}

function drawTableRow(doc, cols, M, values, r) {
  const totalW = cols.reduce((a, c) => a + c.w, 0)

  doc.font('Helvetica').fontSize(TABLE_FONT_SIZE)
  const heights = values.map((v, i) =>
    doc.heightOfString(String(v ?? ''), { width: cols[i].w - TABLE_PAD_X * 2, align: 'left' }),
  )
  const baseH = Math.max(TABLE_MIN_ROW_H, Math.max(...heights) + TABLE_PAD_Y * 2)

  doc.font('Helvetica-Oblique').fontSize(TABLE_OBS_FONT_SIZE)
  const obsH = r?.observacion
    ? doc.heightOfString(`Obs: ${r.observacion}`, { width: totalW - TABLE_PAD_X * 2 }) + 6
    : 0
  const rowH = baseH + obsH

  ensureSpace(doc, rowH + 10)
  const rowY = doc.y

  const bg = r?.estadoResultado === 'requiere_atencion' ? COLOR.rowAten
    : r?.estadoResultado === 'correcto_con_danos' ? COLOR.rowDanos
    : r?.completado ? COLOR.rowOk
    : null
  if (bg) {
    doc.save()
    doc.rect(M, rowY, totalW, rowH).fill(bg)
    doc.restore()
  }

  let x = M
  doc.lineWidth(0.5).strokeColor(COLOR.border)
  for (const c of cols) {
    doc.rect(x, rowY, c.w, rowH).stroke()
    x += c.w
  }

  x = M
  doc.fillColor(COLOR.dark).font('Helvetica').fontSize(TABLE_FONT_SIZE)
  for (let i = 0; i < cols.length; i++) {
    doc.text(String(values[i] ?? ''), x + TABLE_PAD_X, rowY + TABLE_PAD_Y, {
      width: cols[i].w - TABLE_PAD_X * 2,
      height: baseH - TABLE_PAD_Y * 2,
      ellipsis: true, lineBreak: true,
    })
    x += cols[i].w
  }

  if (r?.observacion) {
    doc.font('Helvetica-Oblique').fontSize(TABLE_OBS_FONT_SIZE).fillColor(COLOR.obsColor)
      .text(`Obs: ${r.observacion}`, M + TABLE_PAD_X, rowY + baseH + 1, {
        width: totalW - TABLE_PAD_X * 2,
      })
    doc.fillColor(COLOR.dark)
  }

  doc.y = rowY + rowH
}

// Firmas: 3 cajas para aeronave (soporte/gerente/piloto), 2 para el resto.
function drawFirmas(doc, orden, M, W) {
  const c = orden.cierre
  const esAeronave = orden.producto?.tipoProducto === 'aeronave'

  const cajas = [
    {
      titulo:   'SOPORTE',
      persona:  c?.soporte || orden.soporte,
      fecha:    c?.fechaFirmaSoporte,
      firmadoId: c?.firmaSoporteId,
    },
    {
      titulo:   'GERENTE',
      persona:  c?.gerente || orden.gerente,
      fecha:    c?.fechaFirmaGerente,
      firmadoId: c?.firmaGerenteId,
    },
  ]
  if (esAeronave) {
    cajas.push({
      titulo:   'PILOTO',
      persona:  c?.piloto || orden.piloto,
      fecha:    c?.fechaFirmaPiloto,
      firmadoId: c?.firmaPilotoId,
    })
  }

  ensureSpace(doc, 140)
  const startY = doc.y + 6
  const gap = 14
  const boxW = (W - gap * (cajas.length - 1)) / cajas.length
  const boxH = 100

  for (let i = 0; i < cajas.length; i++) {
    drawFirmaBox(doc, M + i * (boxW + gap), startY, boxW, boxH, cajas[i])
  }
  doc.y = startY + boxH + 10
}

function drawFirmaBox(doc, x, y, w, h, { titulo, persona, fecha, firmadoId }) {
  doc.rect(x, y, w, h).stroke(COLOR.border)
  doc.rect(x, y, 3, h).fill(COLOR.primary)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.primaryDk)
    .text(titulo, x + 8, y + 6, { width: w - 14, lineBreak: false })

  doc.moveTo(x + 10, y + 60).lineTo(x + w - 10, y + 60).stroke(COLOR.dark)
  doc.font('Helvetica').fontSize(9).fillColor(COLOR.dark)
    .text(persona?.nombre || '____________________________', x + 6, y + 65, { width: w - 12, align: 'center' })
  doc.fontSize(8).fillColor(COLOR.gray)
    .text((persona?.rol || '').replace(/_/g, ' ').toUpperCase() || '', x + 6, y + 78, { width: w - 12, align: 'center', lineBreak: false })
    .text(persona?.licenciaNum ? `Lic. ${persona.licenciaNum}` : '', x + 6, y + 88, { width: w - 12, align: 'center', lineBreak: false })

  if (fecha) {
    doc.fontSize(7).fillColor(COLOR.gray)
      .text(`Firmado: ${fmtFechaHora(fecha)}`, x + 6, y + 42, { width: w - 12, align: 'center', lineBreak: false })
  }
  if (firmadoId) {
    doc.fontSize(14).fillColor(COLOR.green).font('Helvetica-Oblique')
      .text('✓ Firmado', x + 6, y + 22, { width: w - 12, align: 'center', lineBreak: false })
    doc.fillColor(COLOR.dark)
  }
}

function drawFooter(doc, orden, pageNum, totalPages, M, W) {
  const y = doc.page.height - 30
  doc.moveTo(M, y).lineTo(M + W, y).stroke(COLOR.border)
  doc.font('Helvetica').fontSize(7).fillColor(COLOR.gray)
    .text(`${COMPANY.nombre} · O/T ${orden.numeroOt} · Generado ${fmtFechaHora(new Date())}`,
      M, y + 4, { width: W, align: 'left', lineBreak: false })
    .text(`Página ${pageNum} de ${totalPages}`,
      M, y + 4, { width: W, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.dark)
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - 50
  if (doc.y + needed > bottom) doc.addPage()
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

function drawEvidenciaFotografica(doc, orden, M, W, titulo = 'EVIDENCIA FOTOGRÁFICA', fotosBuffers = new Map()) {
  const resultadosPorPunto = Object.fromEntries(orden.resultados.map((r) => [r.puntoId, r]))
  const grupos = []
  for (const seccion of orden.formato.secciones) {
    for (const punto of seccion.puntos) {
      const r = resultadosPorPunto[punto.id]
      if (!r || !r.fotos || r.fotos.length === 0) continue
      grupos.push({ seccion, punto, resultado: r })
    }
  }
  if (grupos.length === 0) return

  sectionTitle(doc, titulo, M, W)

  const COLS = 3
  const GAP = 8
  const CELL_W = (W - GAP * (COLS - 1)) / COLS
  const IMG_H = 110
  const CAPTION_H = 22
  const CELL_H = IMG_H + CAPTION_H

  for (const g of grupos) {
    ensureSpace(doc, 28)
    const titY = doc.y + 2
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.dark)
      .text(`${g.seccion.nombre} · ${g.punto.nombreComponente}${g.punto.esCritico ? ' ★' : ''}`,
        M, titY, { width: W, lineBreak: false, ellipsis: true })
    doc.y = titY + 14

    let col = 0
    let rowY = doc.y
    for (let i = 0; i < g.resultado.fotos.length; i++) {
      const foto = g.resultado.fotos[i]
      const buffer = fotosBuffers.get(foto.urlArchivo) || null

      if (col === 0) {
        ensureSpace(doc, CELL_H + 6)
        rowY = doc.y
      }
      const x = M + col * (CELL_W + GAP)

      doc.lineWidth(0.5).strokeColor(COLOR.border).rect(x, rowY, CELL_W, IMG_H).stroke()

      if (buffer) {
        try {
          doc.image(buffer, x + 2, rowY + 2, {
            fit: [CELL_W - 4, IMG_H - 4],
            align: 'center', valign: 'center',
          })
        } catch {
          dibujarPlaceholderFoto(doc, x, rowY, CELL_W, IMG_H, 'Imagen ilegible')
        }
      } else {
        dibujarPlaceholderFoto(doc, x, rowY, CELL_W, IMG_H, 'Archivo no disponible')
      }

      const fecha = foto.fechaCaptura ? fmtFecha(foto.fechaCaptura) : ''
      const captionY = rowY + IMG_H + 3
      doc.font('Helvetica').fontSize(7).fillColor(COLOR.gray)
        .text(`${i + 1}. ${foto.nombreArchivo || 'foto'}${fecha ? ` · ${fecha}` : ''}`,
          x + 2, captionY, { width: CELL_W - 4, lineBreak: false, ellipsis: true })
      doc.fillColor(COLOR.dark)

      col++
      if (col >= COLS) {
        col = 0
        doc.y = rowY + CELL_H + 6
      }
    }
    if (col !== 0) doc.y = rowY + CELL_H + 6
    doc.moveDown(0.2)
  }
}

function dibujarPlaceholderFoto(doc, x, y, w, h, label) {
  doc.save()
  doc.rect(x + 1, y + 1, w - 2, h - 2).fill(COLOR.light)
  doc.restore()
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLOR.gray)
    .text(label, x, y + h / 2 - 6, { width: w, align: 'center', lineBreak: false })
  doc.fillColor(COLOR.dark)
}
