import * as svc from '../services/ordenesService.js'
import prisma from '../lib/prisma.js'

const ESTADOS_VALIDOS = ['borrador', 'en_proceso', 'pendiente_firma', 'cerrada']
const ESTADOS_OBS_OBLIGATORIA = ['correcto_con_danos', 'requiere_atencion']

// Solo el técnico asignado puede editar puntos/fotos (o ingeniero/supervisor también
// cuando el rol lo amerita). Los usuarios no asignados quedan en solo lectura.
async function verificarPermisoEdicion(ordenId, user) {
  const orden = await prisma.ordenTrabajo.findUnique({
    where: { id: ordenId },
    select: { tecnicoId: true, supervisorId: true, estado: true },
  })
  if (!orden) return { ok: false, status: 404, error: 'Orden no encontrada' }
  if (orden.estado === 'cerrada') {
    return { ok: false, status: 400, error: 'La orden está cerrada y no se puede modificar' }
  }
  const esAsignado = orden.tecnicoId === user.sub
  const esSupervisor = user.rol === 'supervisor' && orden.supervisorId === user.sub
  if (!esAsignado && !esSupervisor) {
    return {
      ok: false,
      status: 403,
      error: 'Solo el técnico asignado puede editar esta orden (modo solo lectura)',
    }
  }
  return { ok: true, orden }
}

// ─── Órdenes de Trabajo ─────────────────────────────────────────────────────

export async function listar(req, res, next) {
  try {
    const { estado, aeronaveId, tecnicoId, archivada } = req.query
    // archivada: 'true' | 'false' | 'todas' (por defecto excluye archivadas)
    let archivadaFiltro = false
    if (archivada === 'true') archivadaFiltro = true
    else if (archivada === 'todas') archivadaFiltro = undefined

    const ordenes = await svc.listarOrdenes({
      estado, aeronaveId, tecnicoId,
      ...(archivadaFiltro !== undefined ? { archivada: archivadaFiltro } : {}),
    })
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
  const { formatoId, aeronaveId, supervisorId, cliente, ordenServicio, lugarMantenimiento,
    horasAlMomento, horasMotorDer, horasMotorIzq, tecnicoId: tecnicoIdBody } = req.body

  // Supervisores pueden asignar la orden a otro técnico al crearla;
  // técnicos e ingenieros sólo pueden crear órdenes a su nombre.
  const tecnicoId = (req.user.rol === 'supervisor' && tecnicoIdBody)
    ? tecnicoIdBody
    : req.user.sub

  if (!formatoId || !aeronaveId) {
    return res.status(400).json({ error: 'formatoId y aeronaveId son requeridos' })
  }

  try {
    const orden = await svc.crearOrden({
      formatoId, aeronaveId, tecnicoId, supervisorId,
      cliente, ordenServicio, lugarMantenimiento,
      horasAlMomento, horasMotorDer, horasMotorIzq,
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

// ─── Hitos del ciclo de vida ────────────────────────────────────────────────

export async function recepcionarAeronave(req, res, next) {
  try {
    const { matriculaConfirmada } = req.body
    if (!matriculaConfirmada?.trim()) {
      return res.status(400).json({ error: 'Debes confirmar la matrícula de la aeronave' })
    }
    const orden = await svc.registrarRecepcion(req.params.id, { matriculaConfirmada })
    res.json(orden)
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message })
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function iniciarMantenimiento(req, res, next) {
  try {
    // Solo el técnico asignado o supervisor pueden iniciar
    const perm = await verificarPermisoEdicion(req.params.id, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

    const orden = await svc.iniciarMantenimiento(req.params.id)
    res.json(orden)
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message })
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function archivar(req, res, next) {
  try {
    const { archivada = true } = req.body
    const orden = await svc.archivarOrden(req.params.id, Boolean(archivada))
    res.json(orden)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Orden no encontrada' })
    next(e)
  }
}

export async function eliminar(req, res, next) {
  try {
    await svc.eliminarOrden(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message })
    if (e.code === 'BAD_STATE') return res.status(400).json({ error: e.message })
    next(e)
  }
}

export async function asignarOrden(req, res, next) {
  try {
    const { tecnicoId, supervisorId } = req.body
    if (tecnicoId === undefined && supervisorId === undefined) {
      return res.status(400).json({ error: 'Debes especificar al menos tecnicoId o supervisorId' })
    }
    const orden = await svc.asignarOrden(req.params.id, { tecnicoId, supervisorId })
    res.json(orden)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Orden, técnico o supervisor no encontrado' })
    if (e.code === 'P2003') return res.status(400).json({ error: 'Una o más referencias no existen' })
    next(e)
  }
}

// ─── Resultados de Puntos ───────────────────────────────────────────────────

export async function actualizarResultado(req, res, next) {
  try {
    const { estadoResultado, observacion, completado } = req.body
    const { id: ordenId, resultadoId } = req.params

    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })
    if (!perm.orden.estado || perm.orden.estado === 'borrador') {
      return res.status(400).json({
        error: 'Debes iniciar el mantenimiento antes de capturar resultados',
      })
    }

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })

    // Regla de negocio: observación obligatoria SOLO al marcar como completado
    // con estado que requiera justificación. Cambios de estado sin completar son libres.
    const completandoAhora = completado === true
    if (completandoAhora) {
      const estadoFinal = estadoResultado ?? resultado.estadoResultado
      if (ESTADOS_OBS_OBLIGATORIA.includes(estadoFinal)) {
        const obsFinal = observacion ?? resultado.observacion
        if (!obsFinal?.trim()) {
          return res.status(400).json({
            error: 'La observación es obligatoria para marcar como completado con daños o requiere atención',
          })
        }
      }
    }

    const actualizado = await svc.actualizarResultado(resultadoId, { estadoResultado, observacion, completado })
    res.json(actualizado)
  } catch (e) { next(e) }
}

export async function firmarResultado(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params

    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

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

    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

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
    const perm = await verificarPermisoEdicion(req.params.id, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

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

const COMPANY = {
  nombre: 'AEROMX',
  lema: 'Sistema de Gestión de Mantenimiento Aeronáutico',
  direccion: 'Aeropuerto Internacional · México',
  telefono: '+52 (55) 0000-0000',
  email: 'mantenimiento@aeromx.com',
}

const COLOR = {
  primary: '#0b3d91',   // azul aeronáutico
  accent:  '#cc0000',   // rojo acento
  light:   '#eef3fb',
  gray:    '#6b7280',
  dark:    '#111827',
  border:  '#cbd5e1',
}

const ESTADO_LABELS_PDF = {
  bueno:              'BUENO',
  correcto_con_danos: 'CON DAÑOS',
  requiere_atencion:  'REQUIERE ATENCIÓN',
  no_aplica:          'N/A',
}

const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'
const fmtHora  = (d) => d ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtFechaHora = (d) => d ? `${fmtFecha(d)} ${fmtHora(d)}` : '—'

export async function generarPDF(req, res, next) {
  try {
    const orden = await svc.obtenerOrden(req.params.id)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    const { default: PDFDocument } = await import('pdfkit')
    const doc = new PDFDocument({
      margin: 40,
      size: 'LETTER',
      bufferPages: true,
      info: {
        Title:    `Orden de Mantenimiento ${orden.numeroOt}`,
        Author:   COMPANY.nombre,
        Subject:  `Mantenimiento ${orden.aeronave.matricula}`,
        Keywords: 'mantenimiento, aeronáutico, aeromx',
      },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="OT-${orden.numeroOt}.pdf"`)
    doc.pipe(res)

    const PAGE_W = doc.page.width
    const M = 40
    const CONTENT_W = PAGE_W - M * 2

    // Numeración de páginas — se recorre al final con bufferPages
    let pageNumber = 1

    // ═══════════════════════════════════════════════════════════════════════
    // ENCABEZADO con banda de color
    // ═══════════════════════════════════════════════════════════════════════
    drawHeader(doc, orden, M, CONTENT_W)

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE 1 — Datos generales
    // ═══════════════════════════════════════════════════════════════════════
    sectionTitle(doc, '1. DATOS GENERALES DEL SERVICIO', M, CONTENT_W)

    const fechaCreacion  = orden.createdAt      ? fmtFechaHora(orden.createdAt)      : '—'
    const fechaRecepcion = orden.fechaRecepcion ? fmtFechaHora(orden.fechaRecepcion) : 'Pendiente'
    const fechaInicio    = orden.fechaInicio    ? fmtFechaHora(orden.fechaInicio)    : 'Pendiente'
    const fechaCierre    = orden.fechaCierre    ? fmtFechaHora(orden.fechaCierre)    : 'Pendiente'

    drawKVGrid(doc, [
      ['N.º Orden',              orden.numeroOt],
      ['Formato',                `${orden.formato.nombre} · v${orden.formato.version}`],
      ['Cliente',                orden.cliente || '—'],
      ['Orden de servicio',      orden.ordenServicio || '—'],
      ['Lugar de mantenimiento', orden.lugarMantenimiento || '—'],
      ['Estado actual',          orden.estado.replace(/_/g, ' ').toUpperCase()],
      ['1. Creación de orden',   fechaCreacion],
      ['2. Recepción aeronave',  fechaRecepcion],
      ['3. Inicio mantenimiento', fechaInicio],
      ['4. Cierre / firma',      fechaCierre],
    ], M, CONTENT_W)

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE 2 — Aeronave
    // ═══════════════════════════════════════════════════════════════════════
    sectionTitle(doc, '2. DATOS DE LA AERONAVE', M, CONTENT_W)

    drawKVGrid(doc, [
      ['Matrícula',       orden.aeronave.matricula],
      ['Modelo',          orden.aeronave.modelo?.nombre || '—'],
      ['Fabricante',      orden.aeronave.modelo?.fabricante || '—'],
      ['N.º de serie',    orden.aeronave.numeroSerie || '—'],
      ['Horas totales',   `${orden.horasAlMomento} h`],
      ['Horas Motor Der.', `${orden.horasMotorDer} h`],
      ['Horas Motor Izq.', `${orden.horasMotorIzq} h`],
      ['Fecha medición',  fechaInicio !== '—' ? fechaInicio : fechaCreacion],
    ], M, CONTENT_W)

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE 3 — Personal responsable
    // ═══════════════════════════════════════════════════════════════════════
    sectionTitle(doc, '3. PERSONAL RESPONSABLE', M, CONTENT_W)

    drawKVGrid(doc, [
      ['Técnico / Ingeniero', orden.tecnico?.nombre || '—'],
      ['Rol',                 (orden.tecnico?.rol || '').toUpperCase() || '—'],
      ['Licencia',            orden.tecnico?.licenciaNum || '—'],
      ['Supervisor',          orden.supervisor?.nombre || 'No asignado'],
      ['Rol supervisor',      (orden.supervisor?.rol || '').toUpperCase() || '—'],
      ['Licencia supervisor', orden.supervisor?.licenciaNum || '—'],
    ], M, CONTENT_W)

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE 4 — Trabajos realizados (la lista)
    // ═══════════════════════════════════════════════════════════════════════
    sectionTitle(doc, '4. TRABAJOS REALIZADOS', M, CONTENT_W)

    const resultadosPorPunto = Object.fromEntries(orden.resultados.map(r => [r.puntoId, r]))
    let totalPuntos = 0
    let completados = 0

    for (const seccion of orden.formato.secciones) {
      // Header de sección
      doc.moveDown(0.2)
      ensureSpace(doc, 60)
      const secY = doc.y
      doc.save()
      doc.rect(M, secY, CONTENT_W, 18).fill(COLOR.primary)
      doc.restore()
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10)
        .text(seccion.nombre.toUpperCase(), M + 8, secY + 5, { width: CONTENT_W - 16, lineBreak: false, ellipsis: true })
      doc.fillColor(COLOR.dark)
      doc.y = secY + 22

      // Tabla de puntos: # | Componente | Descripción | Estado | Obs | Firma
      // El ancho total debe ser igual a CONTENT_W (doc.page.width - 2*M)
      const cols = [
        { w: 24,  label: '#'           },
        { w: 130, label: 'COMPONENTE'  },
        { w: 175, label: 'DESCRIPCIÓN' },
        { w: 85,  label: 'CONDICIÓN'   },
        { w: 80,  label: 'FIRMA'       },
        { w: 41,  label: 'FOTOS'       },
      ]
      drawTableHeader(doc, cols, M)

      let idx = 1
      for (const punto of seccion.puntos) {
        const r = resultadosPorPunto[punto.id]
        if (!r) continue
        totalPuntos++
        if (r.completado) completados++

        drawTableRow(doc, cols, M, [
          String(idx++),
          `${punto.nombreComponente}${punto.esCritico ? ' ★' : ''}`,
          punto.descripcion || '—',
          ESTADO_LABELS_PDF[r.estadoResultado] || r.estadoResultado,
          r.firmadoPor ? (r.firmante?.nombre || 'Firmado') : '—',
          String(r.fotos?.length || 0),
        ], r)
      }
    }

    doc.moveDown(0.3)
    ensureSpace(doc, 40)
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLOR.gray)
      .text('★ = Punto crítico — requiere firma individual del técnico.', M, doc.y)
    doc.fillColor(COLOR.dark)

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE 5 — Observaciones y defectos
    // ═══════════════════════════════════════════════════════════════════════
    if (orden.cierre) {
      sectionTitle(doc, '5. DICTAMEN Y OBSERVACIONES GENERALES', M, CONTENT_W)

      const c = orden.cierre
      drawKVGrid(doc, [
        ['Puntos ejecutados',     `${completados} de ${totalPuntos}`],
        ['¿Se encontró defecto?', c.seEncontroDefecto ? 'SÍ' : 'NO'],
        ['Doc. correctivo',       c.refDocCorrectivo || '—'],
      ], M, CONTENT_W)

      if (c.observacionesGenerales) {
        ensureSpace(doc, 60)
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.dark)
          .text('Observaciones:', M, doc.y + 4)
        doc.font('Helvetica').fontSize(9)
          .text(c.observacionesGenerales, M, doc.y + 2, { width: CONTENT_W, align: 'justify' })
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOQUE 6 — Firmas
    // ═══════════════════════════════════════════════════════════════════════
    sectionTitle(doc, '6. FIRMAS DE CONFORMIDAD', M, CONTENT_W)
    drawFirmas(doc, orden, M, CONTENT_W)

    // ═══════════════════════════════════════════════════════════════════════
    // Pie + numeración en todas las páginas
    // ═══════════════════════════════════════════════════════════════════════
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      drawFooter(doc, orden, i + 1, pages.count, M, CONTENT_W)
    }

    doc.end()
  } catch (e) { next(e) }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers de dibujo del PDF
// ────────────────────────────────────────────────────────────────────────────

function drawHeader(doc, orden, M, W) {
  // Banda azul superior
  doc.rect(0, 0, doc.page.width, 70).fill(COLOR.primary)

  // Logo / nombre de compañía
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(22)
    .text(COMPANY.nombre, M, 18)
  doc.font('Helvetica').fontSize(9)
    .text(COMPANY.lema, M, 44)

  // Datos de contacto (columna derecha)
  doc.fontSize(8).fillColor('#e2e8f0')
    .text(COMPANY.direccion, M, 18, { width: W, align: 'right' })
    .text(`${COMPANY.telefono} · ${COMPANY.email}`, M, 32, { width: W, align: 'right' })

  // Título del documento
  doc.fillColor(COLOR.dark)
  doc.y = 82
  doc.font('Helvetica-Bold').fontSize(14)
    .text('ORDEN DE TRABAJO DE MANTENIMIENTO', M, doc.y, { width: W, align: 'center' })

  // N.º OT en recuadro destacado
  const boxY = doc.y + 4
  doc.rect(M, boxY, W, 26).fill(COLOR.light).stroke(COLOR.primary)
  doc.fillColor(COLOR.primary).font('Helvetica-Bold').fontSize(13)
    .text(`N.º ${orden.numeroOt}`, M, boxY + 7, { width: W, align: 'center' })
  doc.fillColor(COLOR.dark)
  doc.y = boxY + 34
}

function sectionTitle(doc, txt, M, W) {
  ensureSpace(doc, 40)
  doc.moveDown(0.4)
  const titleY = doc.y
  doc.rect(M, titleY, W, 18).fill(COLOR.light)
  doc.fillColor(COLOR.primary).font('Helvetica-Bold').fontSize(11)
    .text(txt, M + 8, titleY + 4, { width: W - 16, lineBreak: false })
  doc.fillColor(COLOR.dark)
  doc.y = titleY + 22
}

function drawKVGrid(doc, pairs, M, W) {
  const colW = W / 2
  const rowH = 20
  const rows = Math.ceil(pairs.length / 2)
  ensureSpace(doc, rows * rowH + 12)
  const gridY = doc.y

  for (let i = 0; i < pairs.length; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M + col * colW
    const y = gridY + row * rowH

    doc.lineWidth(0.5).strokeColor(COLOR.border)
    doc.rect(x, y, colW, rowH).stroke()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.gray)
      .text(pairs[i][0].toUpperCase(), x + 6, y + 3, {
        width: colW - 12, lineBreak: false, ellipsis: true,
      })
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.dark)
      .text(String(pairs[i][1] ?? ''), x + 6, y + 10, {
        width: colW - 12, height: rowH - 11, ellipsis: true, lineBreak: false,
      })
  }
  doc.y = gridY + rows * rowH + 6
}

// Padding y tamaños de fuente uniformes dentro de la tabla
const TABLE_PAD_X = 4
const TABLE_PAD_Y = 4
const TABLE_FONT_SIZE = 7.5
const TABLE_HEADER_FONT_SIZE = 7.5
const TABLE_OBS_FONT_SIZE = 7
const TABLE_MIN_ROW_H = 18

function drawTableHeader(doc, cols, M) {
  ensureSpace(doc, 40)
  const headerY = doc.y
  const totalW = cols.reduce((a, c) => a + c.w, 0)
  doc.save()
  doc.rect(M, headerY, totalW, 16).fill(COLOR.dark)
  doc.restore()

  let x = M
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(TABLE_HEADER_FONT_SIZE)
  for (const c of cols) {
    doc.text(c.label, x + TABLE_PAD_X, headerY + TABLE_PAD_Y, {
      width: c.w - TABLE_PAD_X * 2,
      lineBreak: false,
      ellipsis: true,
    })
    x += c.w
  }
  doc.fillColor(COLOR.dark)
  doc.y = headerY + 18
}

function drawTableRow(doc, cols, M, values, r) {
  const totalW = cols.reduce((a, c) => a + c.w, 0)

  // Calcular altura requerida con el mismo tamaño de fuente de texto de celda
  doc.font('Helvetica').fontSize(TABLE_FONT_SIZE)
  const heights = values.map((v, i) =>
    doc.heightOfString(String(v ?? ''), {
      width: cols[i].w - TABLE_PAD_X * 2,
      align: 'left',
    }),
  )
  const baseH = Math.max(TABLE_MIN_ROW_H, Math.max(...heights) + TABLE_PAD_Y * 2)

  // Altura del bloque de observación (ocupa todo el ancho de la fila)
  doc.font('Helvetica-Oblique').fontSize(TABLE_OBS_FONT_SIZE)
  const obsH = r?.observacion
    ? doc.heightOfString(`Obs: ${r.observacion}`, {
        width: totalW - TABLE_PAD_X * 2,
      }) + 6
    : 0
  const rowH = baseH + obsH

  ensureSpace(doc, rowH + 10)
  const rowY = doc.y

  // Fondo de fila según estado — usamos save/restore para no contaminar fillColor
  const bg = r?.estadoResultado === 'requiere_atencion' ? '#fff4f4'
    : r?.estadoResultado === 'correcto_con_danos' ? '#fffbea'
    : r?.completado ? '#f7fbf7'
    : null
  if (bg) {
    doc.save()
    doc.rect(M, rowY, totalW, rowH).fill(bg)
    doc.restore()
  }

  // Bordes de celda (sin relleno) y luego texto en color oscuro
  let x = M
  doc.lineWidth(0.5).strokeColor(COLOR.border)
  for (const c of cols) {
    doc.rect(x, rowY, c.w, rowH).stroke()
    x += c.w
  }

  x = M
  doc.fillColor(COLOR.dark).font('Helvetica').fontSize(TABLE_FONT_SIZE)
  for (let i = 0; i < cols.length; i++) {
    doc.text(String(values[i] ?? ''), x + TABLE_PAD_X, rowY + TABLE_PAD_Y, {
      width: cols[i].w - TABLE_PAD_X * 2,
      height: baseH - TABLE_PAD_Y * 2,
      ellipsis: true,
      lineBreak: true,
    })
    x += cols[i].w
  }

  if (r?.observacion) {
    doc.font('Helvetica-Oblique').fontSize(TABLE_OBS_FONT_SIZE).fillColor(COLOR.accent)
      .text(`Obs: ${r.observacion}`, M + TABLE_PAD_X, rowY + baseH + 1, {
        width: totalW - TABLE_PAD_X * 2,
      })
    doc.fillColor(COLOR.dark)
  }

  doc.y = rowY + rowH
}

function drawFirmas(doc, orden, M, W) {
  ensureSpace(doc, 140)
  const c = orden.cierre
  const boxW = (W - 20) / 2
  const startY = doc.y + 6

  const firmaBox = (x, y, titulo, nombre, fecha, rol, licencia) => {
    doc.rect(x, y, boxW, 100).stroke(COLOR.border)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.primary)
      .text(titulo, x + 6, y + 6, { width: boxW - 12, lineBreak: false })

    // Línea de firma
    doc.moveTo(x + 10, y + 60).lineTo(x + boxW - 10, y + 60).stroke(COLOR.dark)
    doc.font('Helvetica').fontSize(9).fillColor(COLOR.dark)
      .text(nombre || '____________________________', x + 6, y + 65, { width: boxW - 12, align: 'center' })
    doc.fontSize(8).fillColor(COLOR.gray)
      .text(rol || '', x + 6, y + 78, { width: boxW - 12, align: 'center', lineBreak: false })
      .text(licencia ? `Lic. ${licencia}` : '', x + 6, y + 88, { width: boxW - 12, align: 'center', lineBreak: false })

    if (fecha) {
      doc.fontSize(7).fillColor(COLOR.gray)
        .text(`Firmado: ${fmtFechaHora(fecha)}`, x + 6, y + 42, { width: boxW - 12, align: 'center', lineBreak: false })
    }
    if (nombre) {
      doc.fontSize(14).fillColor(COLOR.primary).font('Helvetica-Oblique')
        .text('✓ Firmado', x + 6, y + 22, { width: boxW - 12, align: 'center', lineBreak: false })
      doc.fillColor(COLOR.dark)
    }
  }

  firmaBox(
    M, startY,
    'TÉCNICO / INGENIERO',
    c?.tecnico?.nombre || orden.tecnico?.nombre,
    c?.fechaFirmaTecnico,
    (orden.tecnico?.rol || '').toUpperCase(),
    orden.tecnico?.licenciaNum,
  )

  firmaBox(
    M + boxW + 20, startY,
    'SUPERVISOR',
    c?.supervisor?.nombre || orden.supervisor?.nombre,
    c?.fechaFirmaSupervisor,
    (orden.supervisor?.rol || '').toUpperCase(),
    orden.supervisor?.licenciaNum,
  )

  doc.y = startY + 110
}

function drawFooter(doc, orden, pageNum, totalPages, M, W) {
  const y = doc.page.height - 30
  doc.moveTo(M, y).lineTo(M + W, y).stroke(COLOR.border)
  doc.font('Helvetica').fontSize(7).fillColor(COLOR.gray)
    .text(
      `${COMPANY.nombre} · O/T ${orden.numeroOt} · Generado ${fmtFechaHora(new Date())}`,
      M, y + 4, { width: W, align: 'left', lineBreak: false },
    )
    .text(`Página ${pageNum} de ${totalPages}`, M, y + 4, { width: W, align: 'right', lineBreak: false })
  doc.fillColor(COLOR.dark)
}

// Si no queda espacio en la página, inserta salto
function ensureSpace(doc, needed) {
  const bottom = doc.page.height - 50
  if (doc.y + needed > bottom) {
    doc.addPage()
  }
}
