import prisma from '../lib/prisma.js'

export function listarAeronaves(soloActivas = true) {
  return prisma.aeronave.findMany({
    where: soloActivas ? { activa: true } : {},
    orderBy: { matricula: 'asc' },
    include: { modelo: { select: { id: true, nombre: true, fabricante: true } } },
  })
}

export function obtenerAeronave(id) {
  return prisma.aeronave.findUnique({
    where: { id },
    include: { modelo: true },
  })
}

export function crearAeronave(data) {
  return prisma.aeronave.create({
    data,
    include: { modelo: { select: { id: true, nombre: true } } },
  })
}

export function actualizarAeronave(id, data) {
  return prisma.aeronave.update({
    where: { id },
    data,
    include: { modelo: { select: { id: true, nombre: true } } },
  })
}

// Baja lógica — no elimina el registro para preservar historial de O/T
export function desactivarAeronave(id) {
  return prisma.aeronave.update({
    where: { id },
    data: { activa: false },
  })
}
