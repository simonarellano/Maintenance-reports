import * as svc from '../services/productosService.js'

export async function listar(req, res, next) {
  try {
    const { tipoProducto, activo } = req.query
    const filtros = {}
    if (tipoProducto) filtros.tipoProducto = tipoProducto
    if (activo === 'true')  filtros.activo = true
    else if (activo === 'false') filtros.activo = false
    const productos = await svc.listarProductos(filtros)
    res.json(productos)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const producto = await svc.obtenerProducto(req.params.id)
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(producto)
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { tipoProducto, modeloId, identificador, numeroSerie, detalle } = req.body
    const producto = await svc.crearProducto({ tipoProducto, modeloId, identificador, numeroSerie, detalle })
    res.status(201).json(producto)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'P2002')     return res.status(409).json({ error: 'Ya existe un producto con ese identificador para este tipo' })
    if (e.code === 'P2003')     return res.status(400).json({ error: 'Una o más referencias no existen' })
    next(e)
  }
}

export async function actualizar(req, res, next) {
  try {
    const { modeloId, identificador, numeroSerie, activo, detalle } = req.body
    const producto = await svc.actualizarProducto(req.params.id, {
      modeloId, identificador, numeroSerie, activo, detalle,
    })
    res.json(producto)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'P2025')     return res.status(404).json({ error: 'Producto no encontrado' })
    if (e.code === 'P2002')     return res.status(409).json({ error: 'Ya existe un producto con ese identificador para este tipo' })
    next(e)
  }
}

export async function desactivar(req, res, next) {
  try {
    await svc.desactivarProducto(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    next(e)
  }
}
