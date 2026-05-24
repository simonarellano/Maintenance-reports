import * as svc from '../../services/ordenesService.js'
import prisma from '../../lib/prisma.js'

// Verifica que el usuario sea soporte/auxiliar/gerente/mecánico asignado a la orden,
// o superusuario. Devuelve { ok, status, error, orden }.
async function verificarPermisoEdicion(ordenId, user) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id: ordenId },
    select: {
      estado: true,
      soporteId: true, ingenieroAuxiliarId: true,
      mecanicoId: true, gerenteId: true, pilotoId: true, operadorId: true,
    },
  })
  if (!orden) return { ok: false, status: 404, error: 'Orden no encontrada' }
  if (orden.estado === 'cerrada') {
    return { ok: false, status: 400, error: 'La orden está cerrada y no se puede modificar' }
  }
  if (user?.superusuario === true) return { ok: true, orden }

  const uid = user?.sub
  const asignado = (
    orden.soporteId === uid
    || orden.ingenieroAuxiliarId === uid
    || orden.mecanicoId === uid
    || orden.gerenteId === uid
    || orden.operadorId === uid
  )
  if (!asignado) {
    return {
      ok: false, status: 403,
      error: 'Solo el personal asignado puede modificar esta orden (modo solo lectura)',
    }
  }
  return { ok: true, orden }
}

export { verificarPermisoEdicion }

export async function recepcionar(req, res, next) {
  try {
    const { identificadorConfirmado } = req.body
    if (!identificadorConfirmado?.trim()) {
      return res.status(400).json({ error: 'Debes confirmar el identificador del producto' })
    }
    const orden = await svc.registrarRecepcion(req.params.id, { identificadorConfirmado })
    res.json(orden)
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'CONFLICT')  return res.status(409).json({ error: e.message })
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function iniciarMantenimiento(req, res, next) {
  try {
    const perm = await verificarPermisoEdicion(req.params.id, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

    const { horasTotales, horasMotorDer, horasMotorIzq, odometro, horimetro } = req.body || {}
    const orden = await svc.iniciarMantenimiento(req.params.id, {
      horasTotales, horasMotorDer, horasMotorIzq, odometro, horimetro,
    })
    res.json(orden)
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'CONFLICT')  return res.status(409).json({ error: e.message })
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function asignar(req, res, next) {
  try {
    const { soporteId, ingenieroAuxiliarId, mecanicoId, gerenteId, pilotoId, operadorId } = req.body
    if ([soporteId, ingenieroAuxiliarId, mecanicoId, gerenteId, pilotoId, operadorId].every((v) => v === undefined)) {
      return res.status(400).json({ error: 'Debes especificar al menos una asignación' })
    }
    const orden = await svc.asignarOrden(req.params.id, {
      soporteId, ingenieroAuxiliarId, mecanicoId, gerenteId, pilotoId, operadorId,
    })
    res.json(orden)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'P2025')     return res.status(404).json({ error: 'Orden o usuario asignado no encontrado' })
    if (e.code === 'P2003')     return res.status(400).json({ error: 'Una o más referencias no existen' })
    next(e)
  }
}

export async function archivar(req, res, next) {
  try {
    const { archivada = true } = req.body
    const orden = await svc.archivarOrden(req.params.id, Boolean(archivada))
    res.json(orden)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Orden no encontrada' })
    next(e)
  }
}

export async function eliminar(req, res, next) {
  try {
    await svc.eliminarOrden(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function reabrir(req, res, next) {
  try {
    const { motivo } = req.body || {}
    const orden = await svc.reabrirOrden(req.params.id, { motivo, usuarioId: req.user.sub })
    res.json(orden)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    next(e)
  }
}
