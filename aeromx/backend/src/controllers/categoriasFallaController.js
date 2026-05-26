import * as service from '../services/categoriasFallaService.js'

export async function listar(req, res, next) {
  try {
    const soloActivas = req.query.activo === 'true'
    res.json(await service.listar({ soloActivas }))
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    res.status(201).json(await service.crear(req.body))
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  try {
    res.json(await service.actualizar(req.params.id, req.body))
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    await service.eliminar(req.params.id)
    res.status(204).end()
  } catch (e) { next(e) }
}
