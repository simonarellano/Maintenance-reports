import * as svc from '../services/ordenesService.js'

const ESTADOS_VALIDOS = ['borrador', 'en_proceso', 'pendiente_firma', 'cerrada']
const ESTADOS_OBS_OBLIGATORIA = ['correcto_con_danos', 'requiere_atencion']

// ─── Órdenes de Trabajo ─────────────────────────────────────────────────────

export async function listar(req, res, next) {
  try {
    const { estado, aeronaveId, tecnicoId } = req.query
    const ordenes = await svc.listarOrdenes({ estado, aeronaveId, tecnicoId })
    res.json(ordenes)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const orden = await svc.obtenerOrden(req.params.id)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(orden)
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  const { formatoId, aeronaveId, supervisorId, cliente, ordenServicio,
    horasAlMomento, horasMotorDer, horasMotorIzq } = req.body

  const tecnicoId = req.user.sub

  if (!formatoId || !aeronaveId) {
    return res.status(400).json({ error: 'formatoId y aeronaveId son requeridos' })
  }

  try {
    const orden = await svc.crearOrden({
      formatoId, aeronaveId, tecnicoId, supervisorId,
      cliente, ordenServicio, horasAlMomento, horasMotorDer, horasMotorIzq,
    })
    res.status(201).json(orden)
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'P2003') return res.status(400).json({ error: 'Una o más referencias no existen' })
    next(e)
  }
}

export async function actualizarEstado(req, res, next) {
  const { estado } = req.body
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` })
  }
  try {
    const orden = await svc.actualizarEstadoOrden(req.params.id, estado)
    res.json(orden)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Orden no encontrada' })
    next(e)
  }
}

// ─── Resultados de Puntos ───────────────────────────────────────────────────

export async function actualizarResultado(req, res, next) {
  try {
    const { estadoResultado, observacion, completado } = req.body
    const { id: ordenId, resultadoId } = req.params

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })

    // Regla de negocio: observación obligatoria cuando hay daños o requiere atención
    const estadoFinal = estadoResultado ?? resultado.estadoResultado
    if (ESTADOS_OBS_OBLIGATORIA.includes(estadoFinal)) {
      const obsFinal = observacion ?? resultado.observacion
      if (!obsFinal?.trim()) {
        return res.status(400).json({ error: 'observacion es obligatoria para este estado' })
      }
    }

    const actualizado = await svc.actualizarResultado(resultadoId, { estadoResultado, observacion, completado })
    res.json(actualizado)
  } catch (e) { next(e) }
}

export async function firmarResultado(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    if (!resultado.punto.esCritico) {
      return res.status(400).json({ error: 'Solo los puntos críticos requieren firma individual' })
    }
    if (!resultado.completado) {
      return res.status(400).json({ error: 'El punto debe estar completado antes de firmar' })
    }

    const firmado = await svc.firmarResultado(resultadoId, req.user.sub)
    res.json(firmado)
  } catch (e) { next(e) }
}

// ─── Fotos ──────────────────────────────────────────────────────────────────

export async function subirFoto(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const fechaCaptura = req.body.fechaCaptura ? new Date(req.body.fechaCaptura) : null
    const foto = await svc.agregarFoto(resultadoId, {
      urlArchivo: `/uploads/${req.file.filename}`,
      nombreArchivo: req.file.originalname,
      tamanoBytes: req.file.size,
      subidaPor: req.user.sub,
      fechaCaptura,
    })
    res.status(201).json(foto)
  } catch (e) { next(e) }
}

export async function eliminarFoto(req, res, next) {
  try {
    const foto = await svc.obtenerFoto(req.params.fotoId)
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' })
    await svc.eliminarFoto(req.params.fotoId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Foto no encontrada' })
    next(e)
  }
}

// ─── Cierre ─────────────────────────────────────────────────────────────────

export async function gestionarCierre(req, res, next) {
  try {
    const { id: ordenId } = req.params
    const { seEncontroDefecto, refDocCorrectivo, observacionesGenerales } = req.body

    const orden = await svc.obtenerOrden(ordenId)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    if (orden.estado === 'cerrada') return res.status(400).json({ error: 'La orden ya está cerrada' })

    const { completo, total, completados } = await svc.verificarPuntosCompletos(ordenId)
    if (!completo) {
      return res.status(400).json({
        error: `No se puede cerrar: ${completados}/${total} puntos completados`,
      })
    }

    if (seEncontroDefecto && !refDocCorrectivo?.trim()) {
      return res.status(400).json({ error: 'refDocCorrectivo es requerido cuando se encontró defecto' })
    }

    if (orden.estado === 'en_proceso') {
      await svc.actualizarEstadoOrden(ordenId, 'pendiente_firma')
    }

    const cierre = await svc.crearOActualizarCierre(ordenId, {
      seEncontroDefecto: seEncontroDefecto ?? false,
      refDocCorrectivo,
      observacionesGenerales,
    })
    res.json(cierre)
  } catch (e) { next(e) }
}

export async function firmarCierre(req, res, next) {
  try {
    const { id: ordenId } = req.params

    const orden = await svc.obtenerOrden(ordenId)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    if (!orden.cierre) return res.status(400).json({ error: 'Debe crear el cierre antes de firmar' })
    if (orden.estado === 'cerrada') return res.status(400).json({ error: 'La orden ya está cerrada' })

    const cierre = await svc.firmarCierre(ordenId, req.user.sub, req.user.rol)
    res.json(cierre)
  } catch (e) { next(e) }
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export async function generarPDF(req, res, next) {
  try {
  const orden = await svc.obtenerOrden(req.params.id)
  if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

  // pdfkit es CJS — se importa dinámicamente para compatibilidad con ESM
  const { default: PDFDocument } = await import('pdfkit')

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${orden.numeroOt}.pdf"`)
  doc.pipe(res)

  // ── Encabezado ──
  doc.fontSize(18).font('Helvetica-Bold')
    .text('AeroMX — Orden de Trabajo', { align: 'center' })
  doc.fontSize(14).font('Helvetica')
    .text(orden.numeroOt, { align: 'center' })
  doc.moveDown(0.5)

  // ── Datos generales ──
  doc.fontSize(10)
  doc.text(`Formato: ${orden.formato.nombre} v${orden.formato.version}`)
  doc.text(`Aeronave: ${orden.aeronave.matricula} — ${orden.aeronave.modelo.nombre}`)
  doc.text(`Técnico: ${orden.tecnico.nombre}${orden.tecnico.licenciaNum ? ` (Lic. ${orden.tecnico.licenciaNum})` : ''}`)
  doc.text(`Supervisor: ${orden.supervisor.nombre}`)
  if (orden.cliente) doc.text(`Cliente: ${orden.cliente}`)
  if (orden.ordenServicio) doc.text(`Orden de servicio: ${orden.ordenServicio}`)
  doc.text(`Horas totales: ${orden.horasAlMomento}  |  Motor Der: ${orden.horasMotorDer}  |  Motor Izq: ${orden.horasMotorIzq}`)
  doc.text(`Estado: ${orden.estado.replace(/_/g, ' ').toUpperCase()}`)
  if (orden.fechaInicio) doc.text(`Inicio: ${new Date(orden.fechaInicio).toLocaleDateString('es-MX')}`)
  if (orden.fechaCierre) doc.text(`Cierre: ${new Date(orden.fechaCierre).toLocaleDateString('es-MX')}`)
  doc.moveDown()

  // ── Secciones e inspección ──
  const resultadosPorPunto = Object.fromEntries(orden.resultados.map(r => [r.puntoId, r]))

  for (const seccion of orden.formato.secciones) {
    doc.font('Helvetica-Bold').fontSize(11).text(seccion.nombre.toUpperCase())
    doc.font('Helvetica').fontSize(9)

    for (const punto of seccion.puntos) {
      const r = resultadosPorPunto[punto.id]
      if (!r) continue

      const estado = r.estadoResultado.replace(/_/g, ' ').toUpperCase()
      const critico = punto.esCritico ? ' [CRÍTICO]' : ''
      const firma = r.firmadoPor ? ` ✓ Firmado: ${r.firmante?.nombre ?? ''}` : ''
      doc.text(`  • ${punto.nombreComponente}${critico}: ${estado}${firma}`)
      if (r.observacion) doc.text(`      Obs: ${r.observacion}`, { indent: 20 })
      if (r.fotos.length > 0) doc.text(`      Fotos adjuntas: ${r.fotos.length}`, { indent: 20 })
    }
    doc.moveDown(0.4)
  }

  // ── Cierre ──
  if (orden.cierre) {
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(11).text('CIERRE')
    doc.font('Helvetica').fontSize(10)
    doc.text(`¿Se encontró defecto?: ${orden.cierre.seEncontroDefecto ? 'Sí' : 'No'}`)
    if (orden.cierre.refDocCorrectivo) doc.text(`Ref. doc. correctivo: ${orden.cierre.refDocCorrectivo}`)
    if (orden.cierre.observacionesGenerales) doc.text(`Observaciones: ${orden.cierre.observacionesGenerales}`)
    doc.moveDown(0.4)
    if (orden.cierre.tecnico) {
      doc.text(`Firma técnico/ingeniero: ${orden.cierre.tecnico.nombre}`)
      if (orden.cierre.fechaFirmaTecnico) doc.text(`  Fecha: ${new Date(orden.cierre.fechaFirmaTecnico).toLocaleDateString('es-MX')}`)
    }
    if (orden.cierre.supervisor) {
      doc.text(`Firma supervisor: ${orden.cierre.supervisor.nombre}`)
      if (orden.cierre.fechaFirmaSupervisor) doc.text(`  Fecha: ${new Date(orden.cierre.fechaFirmaSupervisor).toLocaleDateString('es-MX')}`)
    }
  }

  doc.end()
  } catch (e) { next(e) }
}
