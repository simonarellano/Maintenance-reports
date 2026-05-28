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
