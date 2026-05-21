import * as svc from '../services/modelosService.js'

export async function listar(req, res, next) {
  try {
    const { tipoProducto } = req.query
    const modelos = await svc.listarModelos({ tipoProducto })
    res.json(modelos)
  } catch (e) { next(e) }
}

export async function obtener(req, res) {
  const modelo = await svc.obtenerModelo(req.params.id)
  if (!modelo) return res.status(404).json({ error: 'Modelo no encontrado' })
  res.json(modelo)
}

export async function crear(req, res, next) {
  const { tipoProducto, nombre, fabricante, descripcion } = req.body
  if (!nombre)        return res.status(400).json({ error: 'El nombre es requerido' })
  if (!tipoProducto)  return res.status(400).json({ error: 'tipoProducto es requerido' })

  try {
    const modelo = await svc.crearModelo({ tipoProducto, nombre, fabricante, descripcion })
    res.status(201).json(modelo)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'P2002')     return res.status(409).json({ error: 'Ya existe un modelo con ese nombre para este tipo' })
    next(e)
  }
}

export async function actualizar(req, res, next) {
  const { nombre, fabricante, descripcion } = req.body
  try {
    const modelo = await svc.actualizarModelo(req.params.id, { nombre, fabricante, descripcion })
    res.json(modelo)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Modelo no encontrado' })
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe un modelo con ese nombre para este tipo' })
    next(e)
  }
}

export async function eliminar(req, res, next) {
  try {
    await svc.eliminarModelo(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message })
    if (e.code === 'P2025')    return res.status(404).json({ error: 'Modelo no encontrado' })
    next(e)
  }
}
