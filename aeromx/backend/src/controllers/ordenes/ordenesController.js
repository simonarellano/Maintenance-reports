import * as svc from '../../services/ordenesService.js'

const ESTADOS_VALIDOS = ['borrador', 'en_proceso', 'pendiente_firma', 'cerrada']

export async function listar(req, res, next) {
  try {
    const { estado, productoId, soporteId, tipoProducto, archivada } = req.query
    let archivadaFiltro = false
    if (archivada === 'true') archivadaFiltro = true
    else if (archivada === 'todas') archivadaFiltro = undefined

    const ordenes = await svc.listarOrdenes({
      estado, productoId, soporteId, tipoProducto,
      ...(archivadaFiltro !== undefined ? { archivada: archivadaFiltro } : {}),
    })
    res.json(ordenes)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const orden = await svc.obtenerOrden(req.params.id)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(orden)
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const orden = await svc.crearOrden(req.body)
    res.status(201).json(orden)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'P2003')     return res.status(400).json({ error: 'Una o más referencias no existen' })
    next(e)
  }
}

export async function actualizarEstado(req, res, next) {
  const { estado } = req.body
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` })
  }
  try {
    const orden = await svc.actualizarEstadoOrden(req.params.id, estado)
    res.json(orden)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Orden no encontrada' })
    next(e)
  }
}
