import prisma from '../lib/prisma.js'

// ─── Generador de número de O/T ─────────────────────────────────────────────
// Formato: OT-YYYYMMDD-XXXX (secuencial por día)
async function generarNumeroOT() {
  const hoy = new Date()
  const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
  const prefix = `OT-${fecha}-`
  const count = await prisma.ordenTrabajo.count({ where: { numeroOt: { startsWith: prefix } } })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

// ─── Órdenes de Trabajo ─────────────────────────────────────────────────────

export function listarOrdenes(filtros = {}) {
  const where = {}
  if (filtros.estado) where.estado = filtros.estado
  if (filtros.aeronaveId) where.aeronaveId = filtros.aeronaveId
  if (filtros.tecnicoId) where.tecnicoId = filtros.tecnicoId

  return prisma.ordenTrabajo.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      formato: { select: { id: true, nombre: true, version: true } },
      aeronave: {
        select: { id: true, matricula: true, modelo: { select: { nombre: true } } },
      },
      tecnico: { select: { id: true, nombre: true, rol: true } },
      supervisor: { select: { id: true, nombre: true, rol: true } },
      _count: { select: { resultados: true } },
    },
  })
}

export function obtenerOrden(id) {
  return prisma.ordenTrabajo.findUnique({
    where: { id },
    include: {
      formato: {
        include: {
          secciones: {
            orderBy: { orden: 'asc' },
            include: { puntos: { orderBy: { orden: 'asc' } } },
          },
        },
      },
      aeronave: { include: { modelo: true } },
      tecnico: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
      supervisor: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
      resultados: {
        include: {
          punto: true,
          firmante: { select: { id: true, nombre: true } },
          fotos: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      cierre: {
        include: {
          tecnico: { select: { id: true, nombre: true } },
          supervisor: { select: { id: true, nombre: true } },
        },
      },
    },
  })
}

export async function crearOrden(data) {
  const {
    formatoId, aeronaveId, tecnicoId, supervisorId,
    cliente, ordenServicio, horasAlMomento, horasMotorDer, horasMotorIzq,
  } = data

  // Obtener modelo de la aeronave para filtrar puntos excluidos
  const aeronave = await prisma.aeronave.findUnique({ where: { id: aeronaveId } })
  if (!aeronave) throw Object.assign(new Error('Aeronave no encontrada'), { code: 'NOT_FOUND' })

  const formato = await prisma.formato.findUnique({
    where: { id: formatoId },
    include: {
      secciones: {
        include: {
          puntos: {
            where: {
              puntosExcluidos: { none: { modeloId: aeronave.modeloId } },
            },
          },
        },
      },
    },
  })
  if (!formato) throw Object.assign(new Error('Formato no encontrado'), { code: 'NOT_FOUND' })

  const numeroOt = await generarNumeroOT()
  const puntos = formato.secciones.flatMap(s => s.puntos)

  return prisma.ordenTrabajo.create({
    data: {
      numeroOt,
      formato:   { connect: { id: formatoId } },
      aeronave:  { connect: { id: aeronaveId } },
      tecnico:   { connect: { id: tecnicoId } },
      ...(supervisorId ? { supervisor: { connect: { id: supervisorId } } } : {}),
      cliente,
      ordenServicio,
      horasAlMomento: horasAlMomento ?? 0,
      horasMotorDer:  horasMotorDer  ?? 0,
      horasMotorIzq:  horasMotorIzq  ?? 0,
      estado: 'borrador',
      resultados: {
        create: puntos.map(p => ({
          punto:          { connect: { id: p.id } },
          estadoResultado: 'bueno',
          completado:      false,
        })),
      },
    },
    include: {
      formato: { select: { id: true, nombre: true, version: true } },
      aeronave: { select: { id: true, matricula: true } },
      _count: { select: { resultados: true } },
    },
  })
}

export function actualizarEstadoOrden(id, estado) {
  const data = { estado }
  if (estado === 'en_proceso') data.fechaInicio = new Date()
  if (estado === 'cerrada') data.fechaCierre = new Date()
  return prisma.ordenTrabajo.update({ where: { id }, data })
}

// ─── Resultados de Puntos ───────────────────────────────────────────────────

export function obtenerResultado(ordenId, resultadoId) {
  return prisma.resultadoPunto.findFirst({
    where: { id: resultadoId, ordenId },
    include: {
      punto: true,
      firmante: { select: { id: true, nombre: true } },
      fotos: true,
    },
  })
}

export function actualizarResultado(id, data) {
  const updateData = {}
  if (data.estadoResultado !== undefined) updateData.estadoResultado = data.estadoResultado
  if (data.observacion !== undefined) updateData.observacion = data.observacion
  if (data.completado !== undefined) updateData.completado = data.completado

  return prisma.resultadoPunto.update({
    where: { id },
    data: updateData,
    include: { punto: true, fotos: true },
  })
}

export function firmarResultado(id, usuarioId) {
  return prisma.resultadoPunto.update({
    where: { id },
    data: { firmadoPor: usuarioId, fechaFirma: new Date() },
    include: { punto: true, firmante: { select: { id: true, nombre: true } } },
  })
}

// ─── Fotos ──────────────────────────────────────────────────────────────────

export function agregarFoto(resultadoId, { urlArchivo, nombreArchivo, tamanoBytes, subidaPor, fechaCaptura }) {
  return prisma.fotoInspeccion.create({
    data: { resultadoId, urlArchivo, nombreArchivo, tamanoBytes, subidaPor, fechaCaptura },
  })
}

export function obtenerFoto(id) {
  return prisma.fotoInspeccion.findUnique({ where: { id } })
}

export function eliminarFoto(id) {
  return prisma.fotoInspeccion.delete({ where: { id } })
}

// ─── Cierre ─────────────────────────────────────────────────────────────────

export function crearOActualizarCierre(ordenId, data) {
  const { seEncontroDefecto, refDocCorrectivo, observacionesGenerales } = data
  return prisma.cierreOT.upsert({
    where: { ordenId },
    create: { ordenId, seEncontroDefecto, refDocCorrectivo, observacionesGenerales },
    update: { seEncontroDefecto, refDocCorrectivo, observacionesGenerales },
    include: {
      tecnico: { select: { id: true, nombre: true } },
      supervisor: { select: { id: true, nombre: true } },
    },
  })
}

export async function firmarCierre(ordenId, usuarioId, rol) {
  const data = {}
  if (rol === 'tecnico' || rol === 'ingeniero') {
    data.firmaTecnicoId = usuarioId
    data.fechaFirmaTecnico = new Date()
  } else if (rol === 'supervisor') {
    data.firmaSupervisorId = usuarioId
    data.fechaFirmaSupervisor = new Date()
  }

  const cierre = await prisma.cierreOT.update({
    where: { ordenId },
    data,
    include: {
      tecnico: { select: { id: true, nombre: true } },
      supervisor: { select: { id: true, nombre: true } },
    },
  })

  // Cerrar la O/T automáticamente cuando ambas firmas están presentes
  if (cierre.firmaTecnicoId && cierre.firmaSupervisorId) {
    await prisma.ordenTrabajo.update({
      where: { id: ordenId },
      data: { estado: 'cerrada', fechaCierre: new Date() },
    })
  }

  return cierre
}

// ─── Validaciones ───────────────────────────────────────────────────────────

export async function verificarPuntosCompletos(ordenId) {
  const [total, completados] = await Promise.all([
    prisma.resultadoPunto.count({ where: { ordenId } }),
    prisma.resultadoPunto.count({ where: { ordenId, completado: true } }),
  ])
  return { total, completados, completo: total > 0 && total === completados }
}
