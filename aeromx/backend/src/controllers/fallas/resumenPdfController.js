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
