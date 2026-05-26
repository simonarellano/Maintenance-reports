import * as service from '../../services/fallasService.js'
import prisma from '../../lib/prisma.js'

export async function asignarResponsable(req, res, next) {
  try {
    res.json(await service.asignarResponsable(req.params.id, req.body.responsableId))
  } catch (e) { next(e) }
}

export async function resolver(req, res, next) {
  try {
    const falla = await prisma.reporteFalla.findUnique({ where: { id: req.params.id } })
    if (!falla) { return res.status(404).json({ error: 'Falla no encontrada' }) }
    const u = req.user
    const permitido =
      u.superusuario ||
      u.rol === 'gerente_soporte' ||
      ['tecnico_soporte', 'ingeniero_soporte'].includes(u.rol) ||
      u.sub === falla.responsableId
    if (!permitido) {
      return res.status(403).json({ error: 'No autorizado para resolver esta falla' })
    }
    res.json(await service.resolverFalla(req.params.id, req.body, u))
  } catch (e) { next(e) }
}
