import prisma from '../lib/prisma.js'

// ─── Constantes de dominio ──────────────────────────────────────────────────

// Roles válidos para cada asignación de la O/T
const ROLES_SOPORTE = ['tecnico_soporte', 'ingeniero_soporte']
const ROL_INGENIERO = 'ingeniero_soporte'
const ROL_TECNICO   = 'tecnico_soporte'
const ROL_MECANICO  = 'mecanico'
const ROL_GERENTE   = 'gerente_soporte'
const ROL_PILOTO    = 'piloto'

// ─── Generador de número de O/T ─────────────────────────────────────────────
// Formato: OT-YYYYMMDD-XXXX (secuencial por día)
async function generarNumeroOT() {
  const hoy = new Date()
  const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
  const prefix = `OT-${fecha}-`
  const count = await prisma.ordenTrabajo.count({ where: { numeroOt: { startsWith: prefix } } })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

// ─── Includes reutilizables ─────────────────────────────────────────────────

const INCLUDE_PRODUCTO_COMPLETO = {
  modelo: true,
  aeronave: true,
  camion: true,
  planta: true,
  sensor: true,
}

const INCLUDE_USUARIO_BASICO = {
  select: { id: true, nombre: true, rol: true, licenciaNum: true },
}

// ─── Validación de asignaciones ─────────────────────────────────────────────

// Verifica que un usuario exista, esté activo y tenga uno de los roles permitidos.
// Devuelve el objeto Usuario para reuso (ej. saber si soporte es técnico o ingeniero).
async function verificarUsuarioConRol(usuarioId, rolesPermitidos, etiqueta) {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, rol: true, activo: true },
  })
  if (!u) {
    throw Object.assign(new Error(`${etiqueta} no encontrado`), { code: 'NOT_FOUND' })
  }
  if (!u.activo) {
    throw Object.assign(new Error(`${etiqueta} está desactivado`), { code: 'BAD_INPUT' })
  }
  if (!rolesPermitidos.includes(u.rol)) {
    throw Object.assign(
      new Error(`${etiqueta} debe tener rol ${rolesPermitidos.join(' o ')} (actual: ${u.rol})`),
      { code: 'BAD_INPUT' },
    )
  }
  return u
}

// Valida coherencia de las 4-5 asignaciones y devuelve el rol del soporte
// (para que crearOrden sepa si puede aceptar ingenieroAuxiliar).
async function validarAsignaciones({
  soporteId, ingenieroAuxiliarId, mecanicoId, gerenteId, pilotoId, tipoProducto,
}) {
  // Obligatorios
  if (!soporteId)  throw Object.assign(new Error('soporteId es obligatorio'),  { code: 'BAD_INPUT' })
  if (!mecanicoId) throw Object.assign(new Error('mecanicoId es obligatorio'), { code: 'BAD_INPUT' })
  if (!gerenteId)  throw Object.assign(new Error('gerenteId es obligatorio'),  { code: 'BAD_INPUT' })

  const soporte = await verificarUsuarioConRol(soporteId, ROLES_SOPORTE, 'Soporte')
  await verificarUsuarioConRol(mecanicoId, [ROL_MECANICO], 'Mecánico')
  await verificarUsuarioConRol(gerenteId,  [ROL_GERENTE],  'Gerente')

  // Ingeniero auxiliar — solo permitido si el soporte es técnico
  if (ingenieroAuxiliarId) {
    if (soporte.rol !== ROL_TECNICO) {
      throw Object.assign(
        new Error('Solo se puede asignar ingeniero auxiliar cuando el soporte es técnico'),
        { code: 'BAD_INPUT' },
      )
    }
    await verificarUsuarioConRol(ingenieroAuxiliarId, [ROL_INGENIERO], 'Ingeniero auxiliar')
  }

  // Piloto — obligatorio solo en aeronave, prohibido en otros
  if (tipoProducto === 'aeronave') {
    if (!pilotoId) {
      throw Object.assign(new Error('pilotoId es obligatorio para órdenes de aeronave'), { code: 'BAD_INPUT' })
    }
    await verificarUsuarioConRol(pilotoId, [ROL_PILOTO], 'Piloto')
  } else if (pilotoId) {
    throw Object.assign(
      new Error(`Solo las aeronaves admiten pilotoId (tipoProducto actual: ${tipoProducto})`),
      { code: 'BAD_INPUT' },
    )
  }
}

// ─── Listar / obtener ───────────────────────────────────────────────────────

export async function listarOrdenes(filtros = {}) {
  const where = {}
  if (filtros.estado) where.estado = filtros.estado
  if (filtros.productoId) where.productoId = filtros.productoId
  if (filtros.soporteId)  where.soporteId  = filtros.soporteId
  if (filtros.tipoProducto) where.producto = { tipoProducto: filtros.tipoProducto }

  if (filtros.archivada === true)  where.archivada = true
  else if (filtros.archivada === false) where.archivada = false

  return prisma.ordenTrabajo.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      formato: { select: { id: true, nombre: true, version: true, tipoProducto: true } },
      producto: {
        select: {
          id: true, identificador: true, tipoProducto: true,
          modelo: { select: { id: true, nombre: true } },
        },
      },
      soporte:           INCLUDE_USUARIO_BASICO,
      ingenieroAuxiliar: INCLUDE_USUARIO_BASICO,
      mecanico:          INCLUDE_USUARIO_BASICO,
      gerente:           INCLUDE_USUARIO_BASICO,
      piloto:            INCLUDE_USUARIO_BASICO,
      resultados: { select: { id: true, completado: true } },
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
          bloquesTexto: { orderBy: { orden: 'asc' } },
        },
      },
      producto:          { include: INCLUDE_PRODUCTO_COMPLETO },
      soporte:           INCLUDE_USUARIO_BASICO,
      ingenieroAuxiliar: INCLUDE_USUARIO_BASICO,
      mecanico:          INCLUDE_USUARIO_BASICO,
      gerente:           INCLUDE_USUARIO_BASICO,
      piloto:            INCLUDE_USUARIO_BASICO,
      resultados: {
        include: {
          punto: { include: { seccion: true } },
          firmante: { select: { id: true, nombre: true } },
          fotos: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      cierre: {
        include: {
          soporte: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
          gerente: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
          piloto:  { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
        },
      },
      historial: {
        orderBy: { createdAt: 'desc' },
        include: { usuario: { select: { id: true, nombre: true, rol: true } } },
      },
    },
  })
}

// ─── Crear ──────────────────────────────────────────────────────────────────

export async function crearOrden(data) {
  const {
    formatoId, productoId,
    soporteId, ingenieroAuxiliarId, mecanicoId, gerenteId, pilotoId,
    cliente, ordenServicio, lugarMantenimiento,
  } = data

  if (!formatoId)  throw Object.assign(new Error('formatoId es obligatorio'),  { code: 'BAD_INPUT' })
  if (!productoId) throw Object.assign(new Error('productoId es obligatorio'), { code: 'BAD_INPUT' })

  // Cargar producto + formato para validar coherencia de tipo
  const producto = await prisma.producto.findUnique({ where: { id: productoId } })
  if (!producto) throw Object.assign(new Error('Producto no encontrado'), { code: 'NOT_FOUND' })

  const formato = await prisma.formato.findUnique({
    where: { id: formatoId },
    include: {
      secciones: {
        include: {
          puntos: {
            where: { puntosExcluidos: { none: { modeloId: producto.modeloId } } },
          },
        },
      },
    },
  })
  if (!formato) throw Object.assign(new Error('Formato no encontrado'), { code: 'NOT_FOUND' })

  if (formato.tipoProducto !== producto.tipoProducto) {
    throw Object.assign(
      new Error(`El formato es de tipo ${formato.tipoProducto} pero el producto es ${producto.tipoProducto}`),
      { code: 'BAD_INPUT' },
    )
  }

  // Validar las 4-5 asignaciones
  await validarAsignaciones({
    soporteId, ingenieroAuxiliarId, mecanicoId, gerenteId, pilotoId,
    tipoProducto: producto.tipoProducto,
  })

  const numeroOt = await generarNumeroOT()
  const puntos = formato.secciones.flatMap((s) => s.puntos)

  return prisma.ordenTrabajo.create({
    data: {
      numeroOt,
      formato:  { connect: { id: formatoId } },
      producto: { connect: { id: productoId } },
      soporte:  { connect: { id: soporteId } },
      ...(ingenieroAuxiliarId ? { ingenieroAuxiliar: { connect: { id: ingenieroAuxiliarId } } } : {}),
      mecanico: { connect: { id: mecanicoId } },
      gerente:  { connect: { id: gerenteId } },
      ...(pilotoId ? { piloto: { connect: { id: pilotoId } } } : {}),
      cliente,
      ordenServicio,
      lugarMantenimiento,
      estado: 'borrador',
      resultados: {
        create: puntos.map((p) => ({
          punto: { connect: { id: p.id } },
          estadoResultado: 'bueno',
          completado: false,
        })),
      },
    },
    include: {
      formato:  { select: { id: true, nombre: true, version: true, tipoProducto: true } },
      producto: { select: { id: true, identificador: true, tipoProducto: true } },
      _count:   { select: { resultados: true } },
    },
  })
}

// ─── Estado / workflow ──────────────────────────────────────────────────────

export function actualizarEstadoOrden(id, estado) {
  const data = { estado }
  if (estado === 'en_proceso') data.fechaInicio = new Date()
  if (estado === 'cerrada')    data.fechaCierre = new Date()
  return prisma.ordenTrabajo.update({ where: { id }, data })
}

// Hito 2: registra la recepción validando el identificador del producto.
export async function registrarRecepcion(id, { identificadorConfirmado }) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id },
    include: { producto: true },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (orden.fechaRecepcion) {
    throw Object.assign(new Error('El producto ya fue recepcionado'), { code: 'CONFLICT' })
  }
  const ingresada = (identificadorConfirmado || '').trim().toUpperCase()
  const esperada  = (orden.producto.identificador || '').trim().toUpperCase()
  if (!ingresada) {
    throw Object.assign(new Error('Debes confirmar el identificador del producto'), { code: 'BAD_INPUT' })
  }
  if (ingresada !== esperada) {
    throw Object.assign(
      new Error('El identificador ingresado no coincide con el del producto'),
      { code: 'BAD_INPUT' },
    )
  }
  return prisma.ordenTrabajo.update({
    where: { id },
    data: { fechaRecepcion: new Date(), identificadorRecepcion: esperada },
  })
}

// Hito 3: inicia el mantenimiento. Captura las lecturas del medidor según tipo.
export async function iniciarMantenimiento(id, lecturas = {}) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id },
    include: { producto: { select: { tipoProducto: true } } },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (!orden.fechaRecepcion) {
    throw Object.assign(
      new Error('Debe registrar la recepción antes de iniciar el mantenimiento'),
      { code: 'BAD_STATE' },
    )
  }
  if (orden.fechaInicio) {
    throw Object.assign(new Error('El mantenimiento ya fue iniciado'), { code: 'CONFLICT' })
  }

  const data = { estado: 'en_proceso', fechaInicio: new Date() }
  const tipo = orden.producto.tipoProducto

  // Solo aceptar lecturas del tipo correspondiente al producto.
  if (tipo === 'aeronave') {
    if (lecturas.horasTotales === undefined || lecturas.horasTotales === null) {
      throw Object.assign(new Error('horasTotales es obligatorio para aeronave'), { code: 'BAD_INPUT' })
    }
    data.horasTotales  = Number(lecturas.horasTotales)
    if (lecturas.horasMotorDer !== undefined) data.horasMotorDer = Number(lecturas.horasMotorDer)
    if (lecturas.horasMotorIzq !== undefined) data.horasMotorIzq = Number(lecturas.horasMotorIzq)
  } else if (tipo === 'camion') {
    if (lecturas.odometro === undefined || lecturas.odometro === null) {
      throw Object.assign(new Error('odometro es obligatorio para camión'), { code: 'BAD_INPUT' })
    }
    data.odometro = Number(lecturas.odometro)
  } else if (tipo === 'planta') {
    if (lecturas.horimetro === undefined || lecturas.horimetro === null) {
      throw Object.assign(new Error('horimetro es obligatorio para planta'), { code: 'BAD_INPUT' })
    }
    data.horimetro = Number(lecturas.horimetro)
  }
  // sensor: sin lecturas

  return prisma.ordenTrabajo.update({ where: { id }, data })
}

// Archivar / desarchivar.
export function archivarOrden(id, archivada = true) {
  return prisma.ordenTrabajo.update({ where: { id }, data: { archivada } })
}

// Eliminación definitiva — solo borrador o archivada.
export async function eliminarOrden(id) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id },
    include: { _count: { select: { resultados: true } } },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (orden.estado !== 'borrador' && !orden.archivada) {
    throw Object.assign(
      new Error('Solo se pueden eliminar órdenes en borrador o archivadas'),
      { code: 'BAD_STATE' },
    )
  }

  await prisma.$transaction(async (tx) => {
    const resultados = await tx.resultadoPunto.findMany({
      where: { ordenId: id }, select: { id: true },
    })
    const ids = resultados.map((r) => r.id)
    if (ids.length > 0) {
      await tx.fotoInspeccion.deleteMany({ where: { resultadoId: { in: ids } } })
      await tx.resultadoPunto.deleteMany({ where: { ordenId: id } })
    }
    await tx.cierreOT.deleteMany({ where: { ordenId: id } })
    await tx.historialEstadoOT.deleteMany({ where: { ordenId: id } })
    await tx.ordenTrabajo.delete({ where: { id } })
  })
}

// Reasignar cualquiera de los 4-5 responsables.
export async function asignarOrden(id, asignacionesParciales) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id },
    include: { producto: { select: { tipoProducto: true } } },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })

  // Fusionar lo que viene con lo actual para revalidar coherencia
  const merged = {
    soporteId:           asignacionesParciales.soporteId           ?? orden.soporteId,
    ingenieroAuxiliarId: asignacionesParciales.ingenieroAuxiliarId !== undefined
      ? asignacionesParciales.ingenieroAuxiliarId : orden.ingenieroAuxiliarId,
    mecanicoId:          asignacionesParciales.mecanicoId          ?? orden.mecanicoId,
    gerenteId:           asignacionesParciales.gerenteId           ?? orden.gerenteId,
    pilotoId:            asignacionesParciales.pilotoId !== undefined
      ? asignacionesParciales.pilotoId : orden.pilotoId,
  }
  await validarAsignaciones({ ...merged, tipoProducto: orden.producto.tipoProducto })

  // Aplicar solo los cambios explícitos
  const data = {}
  if (asignacionesParciales.soporteId  !== undefined) data.soporte  = { connect: { id: asignacionesParciales.soporteId  } }
  if (asignacionesParciales.mecanicoId !== undefined) data.mecanico = { connect: { id: asignacionesParciales.mecanicoId } }
  if (asignacionesParciales.gerenteId  !== undefined) data.gerente  = { connect: { id: asignacionesParciales.gerenteId  } }
  if (asignacionesParciales.ingenieroAuxiliarId !== undefined) {
    data.ingenieroAuxiliar = asignacionesParciales.ingenieroAuxiliarId
      ? { connect: { id: asignacionesParciales.ingenieroAuxiliarId } }
      : { disconnect: true }
  }
  if (asignacionesParciales.pilotoId !== undefined) {
    data.piloto = asignacionesParciales.pilotoId
      ? { connect: { id: asignacionesParciales.pilotoId } }
      : { disconnect: true }
  }

  return prisma.ordenTrabajo.update({
    where: { id }, data,
    include: {
      soporte:           INCLUDE_USUARIO_BASICO,
      ingenieroAuxiliar: INCLUDE_USUARIO_BASICO,
      mecanico:          INCLUDE_USUARIO_BASICO,
      gerente:           INCLUDE_USUARIO_BASICO,
      piloto:            INCLUDE_USUARIO_BASICO,
    },
  })
}

// Reabrir una O/T cerrada — vuelve a pendiente_firma, borra firmas, registra audit.
export async function reabrirOrden(id, { motivo, usuarioId }) {
  if (!motivo?.trim()) {
    throw Object.assign(new Error('El motivo de reapertura es obligatorio'), { code: 'BAD_INPUT' })
  }

  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id },
    include: { cierre: true },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (orden.estado !== 'cerrada') {
    throw Object.assign(
      new Error('Solo se pueden reabrir órdenes en estado cerrada'),
      { code: 'BAD_STATE' },
    )
  }

  return prisma.$transaction(async (tx) => {
    // Borrar firmas del cierre
    if (orden.cierre) {
      await tx.cierreOT.update({
        where: { ordenId: id },
        data: {
          firmaSoporteId: null,    fechaFirmaSoporte: null,
          firmaGerenteId: null,    fechaFirmaGerente: null,
          firmaPilotoId:  null,    fechaFirmaPiloto:  null,
        },
      })
    }

    // Audit trail
    await tx.historialEstadoOT.create({
      data: {
        ordenId: id,
        estadoAnterior: 'cerrada',
        estadoNuevo: 'pendiente_firma',
        motivo: motivo.trim(),
        usuarioId,
      },
    })

    return tx.ordenTrabajo.update({
      where: { id },
      data: { estado: 'pendiente_firma', fechaCierre: null },
      include: {
        cierre: true,
        producto: { select: { id: true, identificador: true, tipoProducto: true } },
      },
    })
  })
}

// ─── Resultados de puntos ───────────────────────────────────────────────────

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
  if (data.observacion     !== undefined) updateData.observacion     = data.observacion
  if (data.completado      !== undefined) updateData.completado      = data.completado

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
      soporte: { select: { id: true, nombre: true, rol: true } },
      gerente: { select: { id: true, nombre: true, rol: true } },
      piloto:  { select: { id: true, nombre: true, rol: true } },
    },
  })
}

// Sincroniza las lecturas de la O/T al detalle del producto cuando cierra.
// Solo actualiza si la nueva lectura es ≥ a la actual (no permite retroceso).
async function sincronizarLecturasProducto(tx, orden) {
  const tipo = orden.producto.tipoProducto
  if (tipo === 'aeronave') {
    const detalle = await tx.aeronaveDetalle.findUnique({ where: { productoId: orden.productoId } })
    if (!detalle) return
    const data = {}
    if (orden.horasTotales != null && orden.horasTotales >= (detalle.horasTotales ?? 0))
      data.horasTotales = orden.horasTotales
    if (orden.horasMotorDer != null && orden.horasMotorDer >= (detalle.horasMotorDer ?? 0))
      data.horasMotorDer = orden.horasMotorDer
    if (orden.horasMotorIzq != null && orden.horasMotorIzq >= (detalle.horasMotorIzq ?? 0))
      data.horasMotorIzq = orden.horasMotorIzq
    if (Object.keys(data).length > 0) {
      await tx.aeronaveDetalle.update({ where: { productoId: orden.productoId }, data })
    }
  } else if (tipo === 'camion') {
    const detalle = await tx.camionDetalle.findUnique({ where: { productoId: orden.productoId } })
    if (!detalle) return
    if (orden.odometro != null && orden.odometro >= (detalle.odometro ?? 0)) {
      await tx.camionDetalle.update({
        where: { productoId: orden.productoId },
        data: { odometro: orden.odometro },
      })
    }
  } else if (tipo === 'planta') {
    const detalle = await tx.plantaDetalle.findUnique({ where: { productoId: orden.productoId } })
    if (!detalle) return
    if (orden.horimetro != null && orden.horimetro >= (detalle.horimetro ?? 0)) {
      await tx.plantaDetalle.update({
        where: { productoId: orden.productoId },
        data: { horimetro: orden.horimetro },
      })
    }
  }
  // sensor: sin lecturas que sincronizar
}

// Firma de cierre. El slot a firmar se infiere del rol del usuario + asignación.
// Aeronave requiere 3 firmas para cerrar (soporte + gerente + piloto), otros 2.
export async function firmarCierre(ordenId, usuarioId) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id: ordenId },
    include: {
      cierre: true,
      producto: { select: { id: true, tipoProducto: true } },
      soporte: { select: { id: true } },
      ingenieroAuxiliar: { select: { id: true } },
      gerente: { select: { id: true } },
      piloto:  { select: { id: true } },
    },
  })
  if (!orden) throw Object.assign(new Error('Orden no encontrada'), { code: 'NOT_FOUND' })
  if (!orden.cierre) throw Object.assign(new Error('Debe crear el cierre antes de firmar'), { code: 'BAD_STATE' })
  if (orden.estado === 'cerrada') {
    throw Object.assign(new Error('La orden ya está cerrada'), { code: 'BAD_STATE' })
  }

  // Los puntos críticos deben tener firma individual antes de firmar el cierre.
  // Esto cubre también el caso de reapertura, donde no se vuelve a pasar por gestionar().
  const criticos = await verificarCriticosFirmados(ordenId)
  if (!criticos.completo) {
    throw Object.assign(
      new Error(`Faltan ${criticos.faltan} de ${criticos.total} firmas en puntos críticos`),
      { code: 'BAD_STATE' },
    )
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, rol: true, superusuario: true },
  })
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado'), { code: 'NOT_FOUND' })

  // Determinar slot a firmar a partir del rol del usuario.
  // Solo el usuario asignado al slot (o un superusuario) puede firmar.
  const data = {}
  const ahora = new Date()
  const esSuper = usuario.superusuario === true

  if (usuario.rol === ROL_GERENTE) {
    if (!esSuper && orden.gerente?.id !== usuarioId) {
      throw Object.assign(new Error('No eres el gerente asignado a esta orden'), { code: 'FORBIDDEN' })
    }
    data.firmaGerenteId    = usuarioId
    data.fechaFirmaGerente = ahora
  } else if (usuario.rol === ROL_TECNICO || usuario.rol === ROL_INGENIERO) {
    const esSoporte  = orden.soporte?.id === usuarioId
    const esAuxiliar = orden.ingenieroAuxiliar?.id === usuarioId
    if (!esSuper && !esSoporte && !esAuxiliar) {
      throw Object.assign(new Error('No eres el soporte asignado a esta orden'), { code: 'FORBIDDEN' })
    }
    data.firmaSoporteId    = usuarioId
    data.fechaFirmaSoporte = ahora
  } else if (usuario.rol === ROL_PILOTO) {
    if (orden.producto.tipoProducto !== 'aeronave') {
      throw Object.assign(new Error('Solo aeronaves requieren firma de piloto'), { code: 'BAD_STATE' })
    }
    if (!esSuper && orden.piloto?.id !== usuarioId) {
      throw Object.assign(new Error('No eres el piloto asignado a esta orden'), { code: 'FORBIDDEN' })
    }
    data.firmaPilotoId    = usuarioId
    data.fechaFirmaPiloto = ahora
  } else {
    throw Object.assign(new Error(`El rol ${usuario.rol} no puede firmar el cierre`), { code: 'FORBIDDEN' })
  }

  // Transacción: actualizar firma + posiblemente cerrar la O/T + sincronizar lecturas.
  return prisma.$transaction(async (tx) => {
    const cierre = await tx.cierreOT.update({
      where: { ordenId },
      data,
      include: {
        soporte: { select: { id: true, nombre: true, rol: true } },
        gerente: { select: { id: true, nombre: true, rol: true } },
        piloto:  { select: { id: true, nombre: true, rol: true } },
      },
    })

    const tipo = orden.producto.tipoProducto
    const completo = tipo === 'aeronave'
      ? cierre.firmaSoporteId && cierre.firmaGerenteId && cierre.firmaPilotoId
      : cierre.firmaSoporteId && cierre.firmaGerenteId

    if (completo) {
      const ordenConDatos = await tx.ordenTrabajo.findUnique({
        where: { id: ordenId },
        include: { producto: { select: { tipoProducto: true } } },
      })
      await sincronizarLecturasProducto(tx, ordenConDatos)

      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: { estado: 'cerrada', fechaCierre: new Date() },
      })

      await tx.historialEstadoOT.create({
        data: {
          ordenId,
          estadoAnterior: orden.estado,
          estadoNuevo: 'cerrada',
          motivo: 'Cierre por firmas completas',
          usuarioId,
        },
      })
    }

    return cierre
  })
}

// ─── Validaciones ───────────────────────────────────────────────────────────

export async function verificarPuntosCompletos(ordenId) {
  const [total, completados] = await Promise.all([
    prisma.resultadoPunto.count({ where: { ordenId } }),
    prisma.resultadoPunto.count({ where: { ordenId, completado: true } }),
  ])
  return { total, completados, completo: total > 0 && total === completados }
}

// Los puntos críticos requieren firma digital individual antes de cerrar la O/T.
// Si el formato no tiene puntos críticos, `completo` es true (no bloquea nada).
export async function verificarCriticosFirmados(ordenId) {
  const [total, firmados] = await Promise.all([
    prisma.resultadoPunto.count({ where: { ordenId, punto: { esCritico: true } } }),
    prisma.resultadoPunto.count({
      where: { ordenId, punto: { esCritico: true }, firmadoPor: { not: null } },
    }),
  ])
  return { total, firmados, faltan: total - firmados, completo: total === firmados }
}
