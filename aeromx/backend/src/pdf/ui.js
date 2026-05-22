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
