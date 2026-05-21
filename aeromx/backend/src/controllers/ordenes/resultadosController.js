import * as svc from '../../services/ordenesService.js'
import { verificarPermisoEdicion } from './workflowController.js'

const ESTADOS_OBS_OBLIGATORIA = ['correcto_con_danos', 'requiere_atencion']

export async function actualizar(req, res, next) {
  try {
    const { estadoResultado, observacion, completado } = req.body
    const { id: ordenId, resultadoId } = req.params

    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })
    if (!perm.orden.estado || perm.orden.estado === 'borrador') {
      return res.status(400).json({
        error: 'Debes iniciar el mantenimiento antes de capturar resultados',
      })
    }

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })

    // Observación obligatoria solo al marcar como completado con estado de riesgo
    if (completado === true) {
      const estadoFinal = estadoResultado ?? resultado.estadoResultado
      if (ESTADOS_OBS_OBLIGATORIA.includes(estadoFinal)) {
        const obsFinal = observacion ?? resultado.observacion
        if (!obsFinal?.trim()) {
          return res.status(400).json({
            error: 'La observación es obligatoria para marcar como completado con daños o requiere atención',
          })
        }
      }
    }

    const actualizado = await svc.actualizarResultado(resultadoId, { estadoResultado, observacion, completado })
    res.json(actualizado)
  } catch (e) { next(e) }
}

export async function firmar(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params

    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    if (!resultado.punto.esCritico) {
      return res.status(400).json({ error: 'Solo los puntos críticos requieren firma individual' })
    }
    if (!resultado.completado) {
      return res.status(400).json({ error: 'El punto debe estar completado antes de firmar' })
    }

    const firmado = await svc.firmarResultado(resultadoId, req.user.sub)
    res.json(firmado)
  } catch (e) { next(e) }
}
