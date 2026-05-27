// aeromx/backend/src/services/fallasEstadisticasService.js
import prisma from '../lib/prisma.js'
import { INCLUDE_FALLA } from './fallasService.js'

// Construye el `where` de Prisma a partir de los filtros del query string.
// Espeja exactamente los filtros de listarFallas + tipoProducto.
function construirWhere(filtros = {}) {
  const { productoId, modeloId, tipoProducto, categoriaId, severidad, estado, origen, desde, hasta } = filtros
  return {
    ...(productoId    ? { productoId }                          : {}),
    ...(modeloId      ? { producto: { modeloId } }              : {}),
    ...(tipoProducto  ? { producto: { tipoProducto } }          : {}),
    ...(categoriaId   ? { categoriaId }                         : {}),
    ...(severidad     ? { severidad }                           : {}),
    ...(estado        ? { estado }                              : {}),
    ...(origen        ? { origen }                              : {}),
    ...(desde || hasta
      ? { fechaDeteccion: {
            ...(desde ? { gte: new Date(desde) } : {}),
            ...(hasta ? { lte: new Date(hasta) } : {}),
          } }
      : {}),
  }
}

// Suma agrupada genérica: recibe lista + función de clave → Map<clave, count>.
function contarPor(lista, keyFn) {
  const m = new Map()
  for (const f of lista) {
    const k = keyFn(f)
    if (k == null || k === '') continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  return m
}

// MTTR (días) promedio sobre fallas resueltas: fechaResolucion - fechaDeteccion.
function mttrDias(resueltas) {
  if (resueltas.length === 0) return null
  const totalMs = resueltas.reduce((acc, f) => {
    const ini = new Date(f.fechaDeteccion).getTime()
    const fin = new Date(f.fechaResolucion).getTime()
    return acc + Math.max(0, fin - ini)
  }, 0)
  return +(totalMs / resueltas.length / 86_400_000).toFixed(1)
}

export async function calcularEstadisticas(filtros = {}) {
  const fallas = await prisma.reporteFalla.findMany({
    where: construirWhere(filtros),
    include: INCLUDE_FALLA,
    orderBy: { fechaDeteccion: 'desc' },
  })

  const total       = fallas.length
  const resueltas   = fallas.filter((f) => f.estado === 'resuelta')
  const abiertas    = fallas.filter((f) => f.estado !== 'resuelta')
  const criticasAbiertas = abiertas.filter((f) => f.severidad === 'critica').length

  // --- KPIs ---
  const kpis = {
    total,
    abiertas: abiertas.length,
    resueltas: resueltas.length,
    criticasAbiertas,
    mttrDias: mttrDias(resueltas),
    pctResueltas: total ? Math.round((resueltas.length / total) * 100) : 0,
  }

  // --- Datasets de gráficas ---
  const porCategoria = [...contarPor(fallas, (f) => f.categoria?.nombre).entries()]
    .map(([nombre, count]) => {
      const cat = fallas.find((f) => f.categoria?.nombre === nombre)?.categoria
      return { nombre, count, color: cat?.color || null }
    })
    .sort((a, b) => b.count - a.count)

  const SEV_ORDER = ['critica', 'alta', 'media', 'baja']
  const porSeveridad = SEV_ORDER
    .map((sev) => ({ severidad: sev, count: fallas.filter((f) => f.severidad === sev).length }))
    .filter((d) => d.count > 0)

  const ORIGENES = ['mantenimiento', 'prevuelo', 'operacion']
  const porOrigen = ORIGENES
    .map((o) => ({ origen: o, count: fallas.filter((f) => f.origen === o).length }))
    .filter((d) => d.count > 0)

  const topComponentes = [...contarPor(fallas, (f) => f.componente).entries()]
    .map(([componente, count]) => ({ componente, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const porModelo = [...contarPor(fallas, (f) => f.producto?.modelo?.nombre).entries()]
    .map(([modelo, count]) => ({ modelo, count }))
    .sort((a, b) => b.count - a.count)

  const porProducto = [...contarPor(fallas, (f) => f.producto?.identificador).entries()]
    .map(([identificador, count]) => ({ identificador, count }))
    .sort((a, b) => b.count - a.count)

  // Tendencia mensual (YYYY-MM) ordenada ascendente.
  const tendenciaMap = contarPor(fallas, (f) => {
    const d = new Date(f.fechaDeteccion)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const tendencia = [...tendenciaMap.entries()]
    .map(([periodo, count]) => ({ periodo, count }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))

  // MTTR por severidad y por categoría (solo sobre resueltas).
  const mttrPorSeveridad = SEV_ORDER
    .map((sev) => ({ severidad: sev, mttrDias: mttrDias(resueltas.filter((f) => f.severidad === sev)) }))
    .filter((d) => d.mttrDias != null)
  const mttrPorCategoria = porCategoria
    .map((c) => ({ nombre: c.nombre, mttrDias: mttrDias(resueltas.filter((f) => f.categoria?.nombre === c.nombre)) }))
    .filter((d) => d.mttrDias != null)

  const embudoEstados = {
    detectada:  fallas.filter((f) => f.estado === 'detectada').length,
    en_proceso: fallas.filter((f) => f.estado === 'en_proceso').length,
    resuelta:   resueltas.length,
  }

  // Detalle plano para tabla + export (sin objetos anidados pesados).
  const detalle = fallas.map((f) => ({
    numeroFalla: f.numeroFalla,
    titulo: f.titulo,
    producto: f.producto?.identificador || '',
    modelo: f.producto?.modelo?.nombre || '',
    tipoProducto: f.producto?.tipoProducto || '',
    categoria: f.categoria?.nombre || '',
    severidad: f.severidad,
    origen: f.origen,
    estado: f.estado,
    componente: f.componente || '',
    reportadoPor: f.reportadoPor?.nombre || '',
    responsable: f.responsable?.nombre || '',
    resueltoPor: f.resueltoPor?.nombre || '',
    fechaDeteccion: f.fechaDeteccion,
    fechaResolucion: f.fechaResolucion,
  }))

  return {
    kpis,
    porCategoria, porSeveridad, porOrigen, topComponentes,
    porModelo, porProducto, tendencia,
    mttrPorSeveridad, mttrPorCategoria, embudoEstados,
    detalle,
  }
}
