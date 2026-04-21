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

  const { default: PDFDocument } = await import('pdfkit')

  const doc = new PDFDocument({ margin: 40, size: 'LETTER' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="OT-${orden.numeroOt}.pdf"`)
  doc.pipe(res)

  // ── Encabezado ──
  doc.fontSize(20).font('Helvetica-Bold')
    .text('AEROMX', { align: 'center' })
  doc.fontSize(14).font('Helvetica-Bold')
    .text('ORDEN DE TRABAJO DE MANTENIMIENTO', { align: 'center' })
  doc.fontSize(12).font('Helvetica')
    .text(orden.numeroOt, { align: 'center' })

  // Línea separadora
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
  doc.moveDown(0.3)

  // ── Datos generales ──
  doc.fontSize(10).font('Helvetica-Bold').text('INFORMACIÓN GENERAL')
  doc.fontSize(9).font('Helvetica')
  doc.text(`Formato: ${orden.formato.nombre} v${orden.formato.version}`)
  doc.text(`Aeronave: ${orden.aeronave.matricula} (${orden.aeronave.modelo.nombre})`)
  doc.text(`Técnico: ${orden.tecnico.nombre}${orden.tecnico.licenciaNum ? ` | Lic. ${orden.tecnico.licenciaNum}` : ''}`)
  if (orden.supervisor) doc.text(`Supervisor: ${orden.supervisor.nombre}`)
  if (orden.cliente) doc.text(`Cliente: ${orden.cliente}`)
  if (orden.ordenServicio) doc.text(`Orden de Servicio: ${orden.ordenServicio}`)
  doc.fontSize(9).text(`Horas: Total ${orden.horasAlMomento} | Motor Der. ${orden.horasMotorDer} | Motor Izq. ${orden.horasMotorIzq}`)
  doc.text(`Estado: ${orden.estado.replace(/_/g, ' ').toUpperCase()}`)
  if (orden.fechaInicio) doc.text(`Inicio: ${new Date(orden.fechaInicio).toLocaleDateString('es-MX')}`)
  if (orden.fechaCierre) doc.text(`Cierre: ${new Date(orden.fechaCierre).toLocaleDateString('es-MX')}`)
  doc.moveDown(0.3)

  // Línea separadora
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
  doc.moveDown(0.3)

  // ── Secciones e inspección ──
  doc.fontSize(10).font('Helvetica-Bold').text('RESULTADOS DE INSPECCIÓN')
  doc.fontSize(9).font('Helvetica')
  const resultadosPorPunto = Object.fromEntries(orden.resultados.map(r => [r.puntoId, r]))

  let puntosCompletos = 0
  let totalPuntos = 0

  for (const seccion of orden.formato.secciones) {
    doc.moveDown(0.2)
    doc.font('Helvetica-Bold').fontSize(10).text(`► ${seccion.nombre.toUpperCase()}`)
    doc.font('Helvetica').fontSize(9)

    for (const punto of seccion.puntos) {
      const r = resultadosPorPunto[punto.id]
      if (!r) continue
      totalPuntos++
      if (r.completado) puntosCompletos++

      const estado = r.estadoResultado.replace(/_/g, ' ').toUpperCase()
      const critico = punto.esCritico ? ' [CRÍTICO]' : ''
      const firma = r.firmadoPor ? ` ✓ ${r.firmante?.nombre ?? 'Firmado'}` : ''
      const completado = r.completado ? '✓' : '○'
      doc.text(`  ${completado} ${punto.nombreComponente}${critico}: ${estado}${firma}`)
      if (r.observacion) doc.text(`      ► ${r.observacion}`, { indent: 30, fontSize: 8 })
      if (r.fotos.length > 0) doc.text(`      Fotos: ${r.fotos.length}`, { indent: 30, fontSize: 8, color: '#0066cc' })
    }
  }
  doc.moveDown(0.3)

  // Línea separadora
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
  doc.moveDown(0.2)

  // ── Resumen ──
  doc.fontSize(10).font('Helvetica-Bold').text('RESUMEN')
  doc.fontSize(9).font('Helvetica')
  doc.text(`Puntos completados: ${puntosCompletos} / ${totalPuntos}`)

  // ── Cierre ──
  if (orden.cierre) {
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica-Bold').text('CIERRE Y FIRMAS')
    doc.fontSize(9).font('Helvetica')
    doc.text(`¿Se encontró defecto?: ${orden.cierre.seEncontroDefecto ? 'Sí' : 'No'}`)
    if (orden.cierre.refDocCorrectivo) doc.text(`Documento correctivo: ${orden.cierre.refDocCorrectivo}`)
    if (orden.cierre.observacionesGenerales) doc.text(`Observaciones: ${orden.cierre.observacionesGenerales}`)
    doc.moveDown(0.2)
    if (orden.cierre.tecnico) {
      doc.text(`✓ Firma Técnico/Ingeniero: ${orden.cierre.tecnico.nombre}`)
      if (orden.cierre.fechaFirmaTecnico) doc.text(`  ${new Date(orden.cierre.fechaFirmaTecnico).toLocaleString('es-MX')}`, { fontSize: 8 })
    }
    if (orden.cierre.supervisor) {
      doc.text(`✓ Firma Supervisor: ${orden.cierre.supervisor.nombre}`)
      if (orden.cierre.fechaFirmaSupervisor) doc.text(`  ${new Date(orden.cierre.fechaFirmaSupervisor).toLocaleString('es-MX')}`, { fontSize: 8 })
    }
  }

  // Pie de página
  doc.moveDown(1)
  doc.fontSize(8).font('Helvetica').fillColor('#999')
    .text('Documento generado digitalmente por AeroMX', { align: 'center' })
    .text(`Fecha de emisión: ${new Date().toLocaleString('es-MX')}`, { align: 'center' })

  doc.end()
  } catch (e) { next(e) }
}
