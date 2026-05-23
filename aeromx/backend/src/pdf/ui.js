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
    doc.save()
    doc.lineWidth(0.7).strokeColor(COLOR.line).moveTo(ruleX, ruleY).lineTo(M + W, ruleY).stroke()
    doc.restore()
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
  // padX*2 + dotW + textW — debe coincidir con la fórmula de ancho de pill()
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

// ─── Tabla de trabajos ────────────────────────────────────────────────────────

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
  doc.save()
  doc.lineWidth(0.6).strokeColor(COLOR.line2).moveTo(M, y).lineTo(M + W, y).stroke()
  doc.restore()

  let x = M
  for (const c of cols) {
    const cx = x + 6
    if (c.key === 'idx') {
      font(doc, FONT.mono).fontSize(8).fillColor(COLOR.muted)
        .text(row.idx, cx, y + 8, { width: c.w - 8, lineBreak: false })
    } else if (c.key === 'comp') {
      font(doc, FONT.sansSemi).fontSize(9).fillColor(COLOR.ink)
        .text(row.componente, cx, y + 8, { width: c.w - 12, continued: !!row.critico })
      if (row.critico) {
        doc.fillColor(COLOR.critical).text(' ✦', { lineBreak: false })
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
      } catch {
        font(doc, FONT.sans).fontSize(7.5).fillColor(COLOR.muted)
          .text('Imagen ilegible', x, cy + imgH / 2 - 4, { width: cellW, align: 'center', lineBreak: false })
      } finally {
        doc.restore()
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
