import * as service from '../../services/fallasService.js'

export async function listar(req, res, next) {
  try { res.json(await service.listarFallas(req.query)) } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try { res.json(await service.obtenerFalla(req.params.id)) } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try { res.status(201).json(await service.crearFalla(req.body, req.user)) } catch (e) { next(e) }
}
