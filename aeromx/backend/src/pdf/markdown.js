// Renderer Markdown → pdfkit. Convierte un string markdown a primitivas de
// dibujo de pdfkit. Soporta el subconjunto que tiene sentido en un reporte:
// headings, listas (numeradas y con viñeta), negrita, cursiva, citas y
// párrafos. Ignora silenciosamente links, imágenes, tablas y código.
//
// Uso:
//   import { renderMarkdown } from '../pdf/markdown.js'
//   renderMarkdown(doc, '## Hola\n\nEsto es **negrita**.', { M: 40, W: 515 })

import { marked } from 'marked'

const DEFAULTS = {
  fontBody:    'Helvetica',
  fontBold:    'Helvetica-Bold',
  fontItalic:  'Helvetica-Oblique',
  fontMono:    'Courier',
  sizeBody:    9.5,
  sizeH2:      12.5,
  sizeH3:      11,
  sizeH4:      10,
  colorText:   '#0f172a',
  colorAccent: '#04525e',  // primaryDk del PDF
  colorMuted:  '#64748b',
  colorRule:   '#cbd5e1',
}

export function renderMarkdown(doc, source, opts = {}) {
  if (!source || !String(source).trim()) return
  const cfg = { ...DEFAULTS, ...opts }
  const tokens = marked.lexer(String(source))
  for (const token of tokens) {
    renderBlockToken(doc, token, cfg)
  }
  // Reset al estado base por si quedó negrita/cursiva colgada
  doc.font(cfg.fontBody).fontSize(cfg.sizeBody).fillColor(cfg.colorText)
}

// ── Bloques ────────────────────────────────────────────────────────────────

function renderBlockToken(doc, token, cfg) {
  ensureSpace(doc, 24)
  switch (token.type) {
    case 'heading':    return renderHeading(doc, token, cfg)
    case 'paragraph':  return renderParagraph(doc, token, cfg)
    case 'list':       return renderList(doc, token, cfg)
    case 'blockquote': return renderBlockquote(doc, token, cfg)
    case 'space':      doc.moveDown(0.25); return
    case 'hr':         return renderRule(doc, cfg)
    case 'text':       return renderParagraph(doc, { tokens: [{ type: 'text', text: token.text }] }, cfg)
    default:
      // Fallback: imprimir el texto crudo si lo hay (links, html, etc.)
      if (token.text) {
        doc.font(cfg.fontBody).fontSize(cfg.sizeBody).fillColor(cfg.colorText)
          .text(String(token.text), cfg.M, doc.y, { width: cfg.W, align: 'justify' })
        doc.moveDown(0.3)
      }
  }
}

function renderHeading(doc, token, cfg) {
  doc.moveDown(0.4)
  const sizes = { 1: cfg.sizeH2 + 1, 2: cfg.sizeH2, 3: cfg.sizeH3, 4: cfg.sizeH4 }
  const size = sizes[token.depth] || cfg.sizeH4
  const text = flattenInline(token.tokens)
  ensureSpace(doc, size + 12)
  doc.font(cfg.fontBold).fontSize(size).fillColor(cfg.colorAccent)
    .text(text, cfg.M, doc.y, { width: cfg.W, lineBreak: true })
  doc.fillColor(cfg.colorText).moveDown(0.2)
}

function renderParagraph(doc, token, cfg) {
  doc.font(cfg.fontBody).fontSize(cfg.sizeBody).fillColor(cfg.colorText)
  const startX = cfg.M
  doc.x = startX
  renderInlineTokens(doc, token.tokens || [], cfg, { width: cfg.W, align: 'justify' })
  doc.moveDown(0.35)
}

function renderList(doc, token, cfg) {
  doc.moveDown(0.15)
  const indent = 16
  const ordered = token.ordered
  let counter = Number(token.start) || 1

  for (const item of token.items || []) {
    ensureSpace(doc, cfg.sizeBody + 4)
    const yStart = doc.y
    const bullet = ordered ? `${counter}.` : '•'
    counter++

    // Viñeta o número en la columna izquierda (no rompe línea)
    doc.font(cfg.fontBody).fontSize(cfg.sizeBody).fillColor(cfg.colorText)
    doc.text(bullet, cfg.M, yStart, {
      width: indent - 2,
      align: ordered ? 'right' : 'left',
      lineBreak: false,
    })

    // Contenido del item — pdfkit avanza y; nos colocamos manualmente para
    // que el texto del item vaya a la derecha de la viñeta.
    doc.y = yStart
    doc.x = cfg.M + indent
    const inline = inlineTokensOfListItem(item)
    renderInlineTokens(doc, inline, cfg, { width: cfg.W - indent, align: 'left' })

    // Si el item no avanzó y (item vacío), forzar un mínimo
    if (doc.y <= yStart) doc.y = yStart + cfg.sizeBody + 2

    // Renderizar listas anidadas dentro del mismo item, indentadas
    const nested = (item.tokens || []).filter((t) => t.type === 'list')
    for (const sub of nested) {
      const savedM = cfg.M
      cfg.M = savedM + indent
      cfg.W = cfg.W - indent
      renderList(doc, sub, cfg)
      cfg.M = savedM
      cfg.W = cfg.W + indent
    }
  }
  doc.moveDown(0.25)
}

function renderBlockquote(doc, token, cfg) {
  doc.moveDown(0.2)
  const padding = 8
  const startY = doc.y

  // Calcular altura aproximada combinando el texto crudo del blockquote
  const cueText = (token.tokens || [])
    .map((t) => flattenInline(t.tokens || [{ type: 'text', text: t.text || '' }]))
    .join('\n\n')

  doc.font(cfg.fontItalic).fontSize(cfg.sizeBody).fillColor(cfg.colorText)
  const innerW = cfg.W - padding * 2
  const h = doc.heightOfString(cueText, { width: innerW }) + padding * 2
  ensureSpace(doc, h + 4)

  const y0 = doc.y
  // Barra acento a la izquierda
  doc.save().rect(cfg.M, y0, 3, h).fill(cfg.colorAccent).restore()

  doc.font(cfg.fontItalic).fontSize(cfg.sizeBody).fillColor(cfg.colorMuted)
    .text(cueText, cfg.M + padding, y0 + padding, { width: innerW, align: 'left' })

  doc.fillColor(cfg.colorText).font(cfg.fontBody)
  doc.y = y0 + h + 4
}

function renderRule(doc, cfg) {
  doc.moveDown(0.3)
  const y = doc.y
  doc.lineWidth(0.5).strokeColor(cfg.colorRule)
    .moveTo(cfg.M, y).lineTo(cfg.M + cfg.W, y).stroke()
  doc.moveDown(0.4)
}

// ── Inline ─────────────────────────────────────────────────────────────────

// Renderiza tokens inline encadenados con `continued: true` para que negrita,
// cursiva y texto plano fluyan en la misma línea/párrafo.
function renderInlineTokens(doc, tokens, cfg, layout) {
  if (!tokens || tokens.length === 0) {
    doc.text('', { width: layout.width, align: layout.align })
    return
  }
  const last = tokens.length - 1
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const isLast = i === last
    applyInlineStyle(doc, t, cfg)
    const text = textOfInline(t)
    doc.text(text, {
      width: layout.width,
      align: layout.align,
      continued: !isLast,
    })
  }
  // Restaurar fuente base — pdfkit conserva la última usada.
  doc.font(cfg.fontBody).fillColor(cfg.colorText)
}

function applyInlineStyle(doc, token, cfg) {
  switch (token.type) {
    case 'strong':   doc.font(cfg.fontBold);   break
    case 'em':       doc.font(cfg.fontItalic); break
    case 'codespan': doc.font(cfg.fontMono);   break
    default:         doc.font(cfg.fontBody)
  }
  doc.fontSize(cfg.sizeBody).fillColor(cfg.colorText)
}

function textOfInline(token) {
  if (token.type === 'text')     return token.text || ''
  if (token.type === 'codespan') return token.text || ''
  if (token.type === 'br')       return '\n'
  if (token.tokens) return flattenInline(token.tokens)
  return token.raw || token.text || ''
}

function flattenInline(tokens) {
  return (tokens || []).map(textOfInline).join('')
}

// Para los items de lista marked v9+: item.tokens contiene tokens de bloque
// (paragraph normalmente). Usamos los inline del primer paragraph.
function inlineTokensOfListItem(item) {
  const blocks = item.tokens || []
  for (const b of blocks) {
    if (b.type === 'paragraph' || b.type === 'text') {
      return b.tokens || [{ type: 'text', text: b.text || '' }]
    }
  }
  return [{ type: 'text', text: item.text || '' }]
}

// ── Layout helper ──────────────────────────────────────────────────────────

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - 50
  if (doc.y + needed > bottom) doc.addPage()
}
