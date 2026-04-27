import prisma from '../lib/prisma.js'

export function listarModelos() {
  return prisma.modeloAeronave.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { aeronaves: true } } },
  })
}

export function obtenerModelo(id) {
  return prisma.modeloAeronave.findUnique({
    where: { id },
    include: { aeronaves: { where: { activa: true }, select: { id: true, matricula: true } } },
  })
}

export function crearModelo(data) {
  return prisma.modeloAeronave.create({ data })
}

export function actualizarModelo(id, data) {
  return prisma.modeloAeronave.update({ where: { id }, data })
}

export async function eliminarModelo(id) {
  // Evitar eliminar si tiene aeronaves asociadas
  const count = await prisma.aeronave.count({ where: { modeloId: id } })
  if (count > 0) {
    throw Object.assign(
      new Error(`No se puede eliminar: el modelo tiene ${count} aeronave(s) asociada(s)`),
      { code: 'CONFLICT' },
    )
  }
  return prisma.modeloAeronave.delete({ where: { id } })
}
