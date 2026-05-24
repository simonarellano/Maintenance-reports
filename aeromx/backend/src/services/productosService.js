import prisma from '../lib/prisma.js'

const TIPOS_VALIDOS = ['aeronave', 'gcs', 'planta', 'sensor_inteligencia']

// ─── Listar / obtener ───────────────────────────────────────────────────────

export function listarProductos({ tipoProducto, activo } = {}) {
  const where = {}
  if (tipoProducto) where.tipoProducto = tipoProducto
  if (activo === true)  where.activo = true
  else if (activo === false) where.activo = false

  return prisma.producto.findMany({
    where,
    orderBy: [{ tipoProducto: 'asc' }, { identificador: 'asc' }],
    include: {
      modelo:   { select: { id: true, nombre: true, fabricante: true } },
      aeronave: true,
      gcs:      true,
      planta:   true,
      sensor_inteligencia: true,
    },
  })
}

export function obtenerProducto(id) {
  return prisma.producto.findUnique({
    where: { id },
    include: {
      modelo:   true,
      aeronave: true,
      gcs:      true,
      planta:   true,
      sensor_inteligencia: true,
    },
  })
}

// ─── Crear ──────────────────────────────────────────────────────────────────

// Dispatcher: crea producto + detalle según tipo, en una transacción.
export async function crearProducto({ tipoProducto, modeloId, identificador, numeroSerie, detalle = {} }) {
  if (!TIPOS_VALIDOS.includes(tipoProducto)) {
    throw Object.assign(
      new Error(`tipoProducto inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`),
      { code: 'BAD_INPUT' },
    )
  }
  if (!modeloId)      throw Object.assign(new Error('modeloId es obligatorio'),      { code: 'BAD_INPUT' })
  if (!identificador) throw Object.assign(new Error('identificador es obligatorio'), { code: 'BAD_INPUT' })

  // Verificar que el modelo exista y sea del mismo tipo
  const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } })
  if (!modelo) throw Object.assign(new Error('Modelo no encontrado'), { code: 'NOT_FOUND' })
  if (modelo.tipoProducto !== tipoProducto) {
    throw Object.assign(
      new Error(`El modelo es de tipo ${modelo.tipoProducto} pero el producto es ${tipoProducto}`),
      { code: 'BAD_INPUT' },
    )
  }

  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.create({
      data: {
        tipoProducto,
        modeloId,
        identificador: identificador.toUpperCase(),
        numeroSerie,
      },
    })

    if (tipoProducto === 'aeronave') {
      await tx.aeronaveDetalle.create({
        data: {
          productoId:    producto.id,
          horasTotales:  Number(detalle.horasTotales ?? 0),
          horasMotorDer: Number(detalle.horasMotorDer ?? 0),
          horasMotorIzq: Number(detalle.horasMotorIzq ?? 0),
        },
      })
    } else if (tipoProducto === 'gcs') {
      if (!detalle.placas) {
        throw Object.assign(new Error('placas es obligatorio para GCS'), { code: 'BAD_INPUT' })
      }
      await tx.gcsDetalle.create({
        data: {
          productoId: producto.id,
          placas: String(detalle.placas).toUpperCase(),
          vin: detalle.vin || null,
          odometro: Number(detalle.odometro ?? 0),
        },
      })
    } else if (tipoProducto === 'planta') {
      await tx.plantaDetalle.create({
        data: {
          productoId: producto.id,
          horimetro: Number(detalle.horimetro ?? 0),
        },
      })
    } else if (tipoProducto === 'sensor_inteligencia') {
      await tx.sensorInteligenciaDetalle.create({
        data: {
          productoId: producto.id,
          fabricante: detalle.fabricante || null,
          versionFirmware: detalle.versionFirmware || null,
          fechaCalibracion: detalle.fechaCalibracion ? new Date(detalle.fechaCalibracion) : null,
        },
      })
    }

    return tx.producto.findUnique({
      where: { id: producto.id },
      include: {
        modelo:   true,
        aeronave: true,
        gcs:      true,
        planta:   true,
        sensor_inteligencia: true,
      },
    })
  })
}

// ─── Actualizar ─────────────────────────────────────────────────────────────

// No permite cambiar tipoProducto. Actualiza producto + detalle del tipo correspondiente.
export async function actualizarProducto(id, { modeloId, identificador, numeroSerie, activo, detalle }) {
  const existente = await prisma.producto.findUnique({ where: { id } })
  if (!existente) throw Object.assign(new Error('Producto no encontrado'), { code: 'NOT_FOUND' })

  const data = {}
  if (modeloId !== undefined) {
    const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } })
    if (!modelo) throw Object.assign(new Error('Modelo no encontrado'), { code: 'NOT_FOUND' })
    if (modelo.tipoProducto !== existente.tipoProducto) {
      throw Object.assign(
        new Error('No se puede cambiar el producto a un modelo de otro tipo'),
        { code: 'BAD_INPUT' },
      )
    }
    data.modeloId = modeloId
  }
  if (identificador !== undefined) data.identificador = String(identificador).toUpperCase()
  if (numeroSerie   !== undefined) data.numeroSerie   = numeroSerie
  if (activo        !== undefined) data.activo        = Boolean(activo)

  return prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.producto.update({ where: { id }, data })
    }

    if (detalle && typeof detalle === 'object') {
      const tipo = existente.tipoProducto
      if (tipo === 'aeronave') {
        const u = {}
        if (detalle.horasTotales  !== undefined) u.horasTotales  = Number(detalle.horasTotales)
        if (detalle.horasMotorDer !== undefined) u.horasMotorDer = Number(detalle.horasMotorDer)
        if (detalle.horasMotorIzq !== undefined) u.horasMotorIzq = Number(detalle.horasMotorIzq)
        if (Object.keys(u).length > 0) {
          await tx.aeronaveDetalle.update({ where: { productoId: id }, data: u })
        }
      } else if (tipo === 'gcs') {
        const u = {}
        if (detalle.placas   !== undefined) u.placas   = String(detalle.placas).toUpperCase()
        if (detalle.vin      !== undefined) u.vin      = detalle.vin || null
        if (detalle.odometro !== undefined) u.odometro = Number(detalle.odometro)
        if (Object.keys(u).length > 0) {
          await tx.gcsDetalle.update({ where: { productoId: id }, data: u })
        }
      } else if (tipo === 'planta') {
        if (detalle.horimetro !== undefined) {
          await tx.plantaDetalle.update({
            where: { productoId: id },
            data: { horimetro: Number(detalle.horimetro) },
          })
        }
      } else if (tipo === 'sensor_inteligencia') {
        const u = {}
        if (detalle.fabricante       !== undefined) u.fabricante       = detalle.fabricante || null
        if (detalle.versionFirmware  !== undefined) u.versionFirmware  = detalle.versionFirmware || null
        if (detalle.fechaCalibracion !== undefined) u.fechaCalibracion = detalle.fechaCalibracion ? new Date(detalle.fechaCalibracion) : null
        if (Object.keys(u).length > 0) {
          await tx.sensorInteligenciaDetalle.update({ where: { productoId: id }, data: u })
        }
      }
    }

    return tx.producto.findUnique({
      where: { id },
      include: {
        modelo:   true,
        aeronave: true,
        gcs:      true,
        planta:   true,
        sensor_inteligencia: true,
      },
    })
  })
}

// Baja lógica — preserva historial de O/T.
export function desactivarProducto(id) {
  return prisma.producto.update({ where: { id }, data: { activo: false } })
}
