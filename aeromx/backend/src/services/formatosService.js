import prisma from '../lib/prisma.js'

// ─── Secuencia del documento ────────────────────────────────────────────────
// Tipos de elementos built-in que pueden aparecer en el PDF, en su orden
// por defecto. Todos son reorderables (incluidos los datos del servicio y de
// la aeronave). Si un formato no tiene secuencia personalizada, se usa este
// orden como base. Los bloques de texto del supervisor se intercalan.
export const BUILTINS_SECUENCIA = [
  'datos_generales',
  'datos_aeronave',
  'personal',
  'trabajos',
  'fotos',
  'dictamen',
  'firmas',
]

// Resuelve la secuencia efectiva del documento para un formato cargado.
// Es tolerante a datos viejos/incompletos: garantiza que TODOS los built-ins
// y TODOS los bloques del formato terminen en el resultado, en algún orden.
export function resolverSecuencia(formato) {
  const stored = Array.isArray(formato?.secuenciaDocumento) ? formato.secuenciaDocumento : null
  const bloques = formato?.bloquesTexto || []
  const bloqueIds = new Set(bloques.map((b) => b.id))

  // Empezamos con lo almacenado (filtrando items inválidos), o con el default.
  let items = stored && stored.length > 0
    ? stored.filter((item) => {
        if (!item || typeof item !== 'object') return false
        if (item.tipo === 'bloque') return typeof item.id === 'string' && bloqueIds.has(item.id)
        return BUILTINS_SECUENCIA.includes(item.tipo)
      }).map((item) => item.tipo === 'bloque'
        ? { tipo: 'bloque', id: item.id }
        : { tipo: item.tipo })
    : BUILTINS_SECUENCIA.map((t) => ({ tipo: t }))

  // Asegurar que cada built-in esté presente (anexar al final si falta).
  for (const tipo of BUILTINS_SECUENCIA) {
    if (!items.some((i) => i.tipo === tipo)) items.push({ tipo })
  }

  // Asegurar que cada bloque esté presente (anexar al final si falta).
  const presentes = new Set(items.filter((i) => i.tipo === 'bloque').map((i) => i.id))
  for (const b of bloques) {
    if (!presentes.has(b.id)) items.push({ tipo: 'bloque', id: b.id })
  }

  return items
}

// Actualiza la secuencia de un formato. Valida la estructura mínima y deja
// que `resolverSecuencia` complete cualquier omisión cuando se renderice.
export async function actualizarSecuencia(formatoId, secuencia) {
  if (!Array.isArray(secuencia)) {
    throw Object.assign(new Error('secuencia debe ser un array'), { code: 'BAD_INPUT' })
  }
  for (const item of secuencia) {
    if (!item || typeof item !== 'object') {
      throw Object.assign(new Error('Cada item de la secuencia debe ser un objeto'), { code: 'BAD_INPUT' })
    }
    if (item.tipo === 'bloque') {
      if (typeof item.id !== 'string') {
        throw Object.assign(new Error('Item bloque requiere id'), { code: 'BAD_INPUT' })
      }
    } else if (!BUILTINS_SECUENCIA.includes(item.tipo)) {
      throw Object.assign(new Error(`Tipo de item inválido: ${item.tipo}`), { code: 'BAD_INPUT' })
    }
  }
  return prisma.formato.update({
    where: { id: formatoId },
    data: { secuenciaDocumento: secuencia },
  })
}

// ─── Formatos ───────────────────────────────────────────────────────────────

export function listarFormatos(soloActivos = true) {
  return prisma.formato.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: { nombre: 'asc' },
    include: {
      secciones: {
        orderBy: { orden: 'asc' },
        include: { puntos: { orderBy: { orden: 'asc' } } },
      },
      bloquesTexto: { orderBy: { orden: 'asc' } },
      _count: { select: { ordenes: true } },
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
      bloquesTexto: { orderBy: { orden: 'asc' } },
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

// ─── Bloques de texto del documento ─────────────────────────────────────────

export function crearBloqueTexto(formatoId, data) {
  return prisma.bloqueTextoFormato.create({
    data: { ...data, formatoId },
  })
}

export function actualizarBloqueTexto(id, data) {
  return prisma.bloqueTextoFormato.update({ where: { id }, data })
}

export function eliminarBloqueTexto(id) {
  return prisma.bloqueTextoFormato.delete({ where: { id } })
}
