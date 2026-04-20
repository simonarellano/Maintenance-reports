import prisma from '../lib/prisma.js'

// ─── Formatos ───────────────────────────────────────────────────────────────

export function listarFormatos(soloActivos = true) {
  return prisma.formato.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: { nombre: 'asc' },
    select: {
      id: true, nombre: true, version: true, fechaVersion: true,
      objetivo: true, activo: true, createdAt: true, updatedAt: true,
      _count: { select: { secciones: true, ordenes: true } },
    },
  })
}

export function obtenerFormato(id) {
  return prisma.formato.findUnique({
    where: { id },
    include: {
      secciones: {
        orderBy: { orden: 'asc' },
        include: {
          puntos: { orderBy: { orden: 'asc' } },
        },
      },
    },
  })
}

export function crearFormato(data) {
  return prisma.formato.create({ data })
}

export function actualizarFormato(id, data) {
  return prisma.formato.update({ where: { id }, data })
}

export function desactivarFormato(id) {
  return prisma.formato.update({ where: { id }, data: { activo: false } })
}

// ─── Secciones ──────────────────────────────────────────────────────────────

export function crearSeccion(formatoId, data) {
  return prisma.seccionFormato.create({
    data: { ...data, formatoId },
    include: { puntos: true },
  })
}

export function actualizarSeccion(id, data) {
  return prisma.seccionFormato.update({ where: { id }, data })
}

export function eliminarSeccion(id) {
  return prisma.seccionFormato.delete({ where: { id } })
}

// ─── Puntos de Inspección ───────────────────────────────────────────────────

export function crearPunto(seccionId, data) {
  return prisma.puntoInspeccion.create({ data: { ...data, seccionId } })
}

export function actualizarPunto(id, data) {
  return prisma.puntoInspeccion.update({ where: { id }, data })
}

export function eliminarPunto(id) {
  return prisma.puntoInspeccion.delete({ where: { id } })
}
