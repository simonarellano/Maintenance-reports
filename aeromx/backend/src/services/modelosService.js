import prisma from '../lib/prisma.js'

const TIPOS_VALIDOS = ['aeronave', 'gcs', 'planta', 'sensor_inteligencia']

export function listarModelos({ tipoProducto } = {}) {
  const where = {}
  if (tipoProducto) where.tipoProducto = tipoProducto

  return prisma.modelo.findMany({
    where,
    orderBy: [{ tipoProducto: 'asc' }, { nombre: 'asc' }],
    include: { _count: { select: { productos: true } } },
  })
}

export function obtenerModelo(id) {
  return prisma.modelo.findUnique({
    where: { id },
    include: {
      productos: { where: { activo: true }, select: { id: true, identificador: true, tipoProducto: true } },
    },
  })
}

export function crearModelo({ tipoProducto, nombre, fabricante, descripcion }) {
  if (!TIPOS_VALIDOS.includes(tipoProducto)) {
    throw Object.assign(
      new Error(`tipoProducto inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`),
      { code: 'BAD_INPUT' },
    )
  }
  return prisma.modelo.create({ data: { tipoProducto, nombre, fabricante, descripcion } })
}

// No se permite cambiar tipoProducto en update.
export function actualizarModelo(id, { nombre, fabricante, descripcion }) {
  const data = {}
  if (nombre      !== undefined) data.nombre      = nombre
  if (fabricante  !== undefined) data.fabricante  = fabricante
  if (descripcion !== undefined) data.descripcion = descripcion
  return prisma.modelo.update({ where: { id }, data })
}

export async function eliminarModelo(id) {
  const count = await prisma.producto.count({ where: { modeloId: id } })
  if (count > 0) {
    throw Object.assign(
      new Error(`No se puede eliminar: el modelo tiene ${count} producto(s) asociado(s)`),
      { code: 'CONFLICT' },
    )
  }
  return prisma.modelo.delete({ where: { id } })
}
