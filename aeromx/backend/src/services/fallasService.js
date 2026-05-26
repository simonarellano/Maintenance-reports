import prisma from '../lib/prisma.js'

// ─── Generador de número de falla ────────────────────────────────────────────

async function generarNumeroFalla() {
  const hoy = new Date()
  const ymd = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
  const prefijo = `RF-${ymd}-`
  const ultima = await prisma.reporteFalla.findFirst({
    where: { numeroFalla: { startsWith: prefijo } },
    orderBy: { numeroFalla: 'desc' },
    select: { numeroFalla: true },
  })
  const consecutivo = ultima ? parseInt(ultima.numeroFalla.slice(prefijo.length), 10) + 1 : 1
  return `${prefijo}${String(consecutivo).padStart(4, '0')}`
}

// ─── Roles válidos para responsable de falla ─────────────────────────────────

const ROLES_RESPONSABLE = ['tecnico_soporte', 'ingeniero_soporte', 'mecanico', 'gerente_soporte']

// ─── Include estándar ─────────────────────────────────────────────────────────

const INCLUDE_FALLA = {
  producto: { include: { modelo: true } },
  formato: true,
  categoria: true,
  reportadoPor: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
  responsable:  { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
  resueltoPor:  { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
  ordenOrigen:     { select: { id: true, numeroOt: true } },
  ordenCorrectiva: { select: { id: true, numeroOt: true } },
  fotos: true,
}

// ─── crearFalla ───────────────────────────────────────────────────────────────

export async function crearFalla(data, usuarioActual) {
  const {
    productoId,
    formatoId,
    categoriaId,
    severidad,
    origen,
    componente,
    titulo,
    descripcion,
    ordenOrigenId,
    resultadoOrigenId,
  } = data

  // Validar formato
  const formato = await prisma.formato.findUnique({ where: { id: formatoId } })
  if (!formato) {
    const e = new Error('Formato no encontrado'); e.status = 404; throw e
  }
  if (formato.tipoFormato !== 'falla') {
    const e = new Error('El formato no es de tipo falla'); e.status = 400; throw e
  }

  // Validar producto
  const producto = await prisma.producto.findUnique({ where: { id: productoId } })
  if (!producto) {
    const e = new Error('Producto no encontrado'); e.status = 404; throw e
  }
  if (formato.tipoProducto !== producto.tipoProducto) {
    const e = new Error('El tipo del formato no coincide con el del producto'); e.status = 400; throw e
  }

  // Categoría: explícita o heredada del formato
  const categoriaFinal = categoriaId || formato.categoriaFallaId
  if (!categoriaFinal) {
    const e = new Error('Falta categoría: proporciona categoriaId o asigna una al formato'); e.status = 400; throw e
  }

  // Campos obligatorios
  if (!severidad) {
    const e = new Error('Falta severidad'); e.status = 400; throw e
  }
  if (!origen) {
    const e = new Error('Falta origen'); e.status = 400; throw e
  }
  if (!titulo) {
    const e = new Error('Falta título'); e.status = 400; throw e
  }
  if (!descripcion) {
    const e = new Error('Falta descripción'); e.status = 400; throw e
  }

  const numeroFalla = await generarNumeroFalla()

  return prisma.$transaction(async (tx) => {
    const falla = await tx.reporteFalla.create({
      data: {
        numeroFalla,
        producto:    { connect: { id: productoId } },
        formato:     { connect: { id: formatoId } },
        categoria:   { connect: { id: categoriaFinal } },
        severidad,
        origen,
        componente,
        titulo,
        descripcion,
        reportadoPor: { connect: { id: usuarioActual.id } },
        ...(ordenOrigenId     ? { ordenOrigen:     { connect: { id: ordenOrigenId } } }     : {}),
        ...(resultadoOrigenId ? { resultadoOrigen: { connect: { id: resultadoOrigenId } } } : {}),
      },
    })

    // Auto-llenar refDocCorrectivo en el cierre de la O/T de origen (Fase 2 también lo usa)
    if (ordenOrigenId) {
      const cierre = await tx.cierreOT.findUnique({ where: { ordenId: ordenOrigenId } })
      const refPrev = cierre?.refDocCorrectivo?.trim()
      const nuevaRef = refPrev ? `${refPrev}, ${numeroFalla}` : numeroFalla
      await tx.cierreOT.upsert({
        where:  { ordenId: ordenOrigenId },
        update: { refDocCorrectivo: nuevaRef, seEncontroDefecto: true },
        create: { ordenId: ordenOrigenId, seEncontroDefecto: true, refDocCorrectivo: nuevaRef },
      })
    }

    return falla
  })
}

// ─── listarFallas ─────────────────────────────────────────────────────────────

export async function listarFallas(filtros = {}) {
  const { productoId, modeloId, categoriaId, severidad, estado, origen, desde, hasta } = filtros
  return prisma.reporteFalla.findMany({
    where: {
      ...(productoId  ? { productoId }                         : {}),
      ...(modeloId    ? { producto: { modeloId } }             : {}),
      ...(categoriaId ? { categoriaId }                        : {}),
      ...(severidad   ? { severidad }                          : {}),
      ...(estado      ? { estado }                             : {}),
      ...(origen      ? { origen }                             : {}),
      ...(desde || hasta
        ? {
            fechaDeteccion: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lte: new Date(hasta) } : {}),
            },
          }
        : {}),
    },
    include: INCLUDE_FALLA,
    orderBy: { fechaDeteccion: 'desc' },
  })
}

// ─── obtenerFalla ─────────────────────────────────────────────────────────────

export async function obtenerFalla(id) {
  const falla = await prisma.reporteFalla.findUnique({ where: { id }, include: INCLUDE_FALLA })
  if (!falla) {
    const e = new Error('Falla no encontrada'); e.status = 404; throw e
  }
  return falla
}

// ─── Exports nombrados adicionales ───────────────────────────────────────────

export { generarNumeroFalla, ROLES_RESPONSABLE, INCLUDE_FALLA }
