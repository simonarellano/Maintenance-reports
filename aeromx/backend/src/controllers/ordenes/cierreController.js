import * as svc from '../../services/ordenesService.js'

export async function gestionar(req, res, next) {
  try {
    const { id: ordenId } = req.params
    const { seEncontroDefecto, refDocCorrectivo, observacionesGenerales } = req.body

    const orden = await svc.obtenerOrden(ordenId)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    if (orden.estado === 'cerrada') return res.status(400).json({ error: 'La orden ya está cerrada' })

    const { completo, total, completados } = await svc.verificarPuntosCompletos(ordenId)
    if (!completo) {
      return res.status(400).json({
        error: `No se puede cerrar: ${completados}/${total} puntos completados`,
      })
    }

    const criticos = await svc.verificarCriticosFirmados(ordenId)
    if (!criticos.completo) {
      return res.status(400).json({
        error: `No se puede cerrar: faltan ${criticos.faltan} de ${criticos.total} firmas en puntos críticos`,
      })
    }

    const revisiones = await svc.verificarRevisionesResueltas(ordenId)
    if (!revisiones.completo) {
      return res.status(400).json({
        error: `No se puede cerrar: hay ${revisiones.abiertas} punto(s) en revisión pendientes`,
      })
    }

    if (seEncontroDefecto && !refDocCorrectivo?.trim()) {
      return res.status(400).json({ error: 'refDocCorrectivo es requerido cuando se encontró defecto' })
    }

    if (orden.estado === 'en_proceso') {
      await svc.actualizarEstadoOrden(ordenId, 'pendiente_firma')
    }

    const cierre = await svc.crearOActualizarCierre(ordenId, {
      seEncontroDefecto: seEncontroDefecto ?? false,
      refDocCorrectivo,
      observacionesGenerales,
    })
    res.json(cierre)
  } catch (e) { next(e) }
}

export async function firmar(req, res, next) {
  try {
    const { id: ordenId } = req.params
    const cierre = await svc.firmarCierre(ordenId, req.user.sub)
    res.json(cierre)
  } catch (e) {
    if (e.code === 'NOT_FOUND')  return res.status(404).json({ error: e.message })
    if (e.code === 'BAD_STATE')  return res.status(400).json({ error: e.message })
    if (e.code === 'FORBIDDEN')  return res.status(403).json({ error: e.message })
    next(e)
  }
}
