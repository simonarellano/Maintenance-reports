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
