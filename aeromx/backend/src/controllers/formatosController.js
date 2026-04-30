import * as svc from '../services/formatosService.js'

// ─── Formatos ───────────────────────────────────────────────────────────────

export async function listar(req, res, next) {
  try {
    const soloActivos = req.query.todos !== 'true'
    const formatos = await svc.listarFormatos(soloActivos)
    res.json(formatos)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const formato = await svc.obtenerFormato(req.params.id)
    if (!formato) return res.status(404).json({ error: 'Formato no encontrado' })
    res.json(formato)
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { nombre, version, fechaVersion, objetivo, instrucciones, definiciones } = req.body
    if (!nombre || !version) {
      return res.status(400).json({ error: 'nombre y version son requeridos' })
    }
    const formato = await svc.crearFormato({
      nombre, version,
      fechaVersion: fechaVersion ? new Date(fechaVersion) : new Date(),
      objetivo, instrucciones, definiciones,
    })
    res.status(201).json(formato)
  } catch (e) { next(e) }
}

export async function actualizar(req, res, next) {
  const { nombre, version, fechaVersion, objetivo, instrucciones, definiciones, activo } = req.body
  const data = {}
  if (nombre !== undefined) data.nombre = nombre
  if (version !== undefined) data.version = version
  if (fechaVersion !== undefined) data.fechaVersion = new Date(fechaVersion)
  if (objetivo !== undefined) data.objetivo = objetivo
  if (instrucciones !== undefined) data.instrucciones = instrucciones
  if (definiciones !== undefined) data.definiciones = definiciones
  if (activo !== undefined) data.activo = activo

  try {
    const formato = await svc.actualizarFormato(req.params.id, data)
    res.json(formato)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Formato no encontrado' })
    next(e)
  }
}

export async function desactivar(req, res, next) {
  try {
    await svc.desactivarFormato(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Formato no encontrado' })
    next(e)
  }
}

// ─── Secciones ──────────────────────────────────────────────────────────────

export async function crearSeccion(req, res, next) {
  try {
    const { nombre, descripcion, orden } = req.body
    if (!nombre || orden === undefined) {
      return res.status(400).json({ error: 'nombre y orden son requeridos' })
    }
    const seccion = await svc.crearSeccion(req.params.id, { nombre, descripcion, orden: Number(orden) })
    res.status(201).json(seccion)
  } catch (e) { next(e) }
}

export async function actualizarSeccion(req, res, next) {
  const { nombre, descripcion, orden } = req.body
  const data = {}
  if (nombre !== undefined) data.nombre = nombre
  if (descripcion !== undefined) data.descripcion = descripcion
  if (orden !== undefined) data.orden = Number(orden)

  try {
    const seccion = await svc.actualizarSeccion(req.params.seccionId, data)
    res.json(seccion)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Sección no encontrada' })
    next(e)
  }
}

export async function eliminarSeccion(req, res, next) {
  try {
    await svc.eliminarSeccion(req.params.seccionId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Sección no encontrada' })
    if (e.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar esta sección porque tiene puntos que ya fueron usados en órdenes de trabajo. Edita los puntos individualmente o crea una sección nueva.',
      })
    }
    next(e)
  }
}

// ─── Puntos de Inspección ───────────────────────────────────────────────────

export async function crearPunto(req, res, next) {
  try {
    const { nombreComponente, categoria, descripcion, esCritico, fotoRequerida, orden } = req.body
    if (!nombreComponente || orden === undefined) {
      return res.status(400).json({ error: 'nombreComponente y orden son requeridos' })
    }
    const punto = await svc.crearPunto(req.params.seccionId, {
      nombreComponente, categoria, descripcion,
      esCritico: esCritico ?? false,
      fotoRequerida: fotoRequerida ?? false,
      orden: Number(orden),
    })
    res.status(201).json(punto)
  } catch (e) { next(e) }
}

export async function actualizarPunto(req, res, next) {
  const { nombreComponente, categoria, descripcion, esCritico, fotoRequerida, orden } = req.body
  const data = {}
  if (nombreComponente !== undefined) data.nombreComponente = nombreComponente
  if (categoria !== undefined) data.categoria = categoria
  if (descripcion !== undefined) data.descripcion = descripcion
  if (esCritico !== undefined) data.esCritico = esCritico
  if (fotoRequerida !== undefined) data.fotoRequerida = fotoRequerida
  if (orden !== undefined) data.orden = Number(orden)

  try {
    const punto = await svc.actualizarPunto(req.params.puntoId, data)
    res.json(punto)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Punto no encontrado' })
    next(e)
  }
}

export async function eliminarPunto(req, res, next) {
  try {
    await svc.eliminarPunto(req.params.puntoId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Punto no encontrado' })
    if (e.code === 'P2003') {
      // El punto ya fue usado en órdenes (resultados_puntos lo referencia).
      // No podemos eliminar físicamente sin borrar la historia. Devolvemos un
      // 409 explicando la situación; el supervisor puede editar el punto en
      // lugar de eliminarlo, o crear uno nuevo.
      return res.status(409).json({
        error: 'No se puede eliminar este punto porque ya tiene resultados en una o más órdenes de trabajo. Edítalo en su lugar o crea uno nuevo.',
      })
    }
    next(e)
  }
}

// ─── Secuencia del documento ────────────────────────────────────────────────

export async function actualizarSecuencia(req, res, next) {
  try {
    const formato = await svc.actualizarSecuencia(req.params.id, req.body?.secuencia)
    res.json(formato)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'P2025') return res.status(404).json({ error: 'Formato no encontrado' })
    next(e)
  }
}

// ─── Bloques de texto ───────────────────────────────────────────────────────

export async function crearBloqueTexto(req, res, next) {
  try {
    const { titulo, contenido, orden } = req.body
    if (!titulo?.trim() || !contenido?.trim() || orden === undefined) {
      return res.status(400).json({ error: 'titulo, contenido y orden son requeridos' })
    }
    const bloque = await svc.crearBloqueTexto(req.params.id, {
      titulo: titulo.trim(),
      contenido,
      orden: Number(orden),
    })
    res.status(201).json(bloque)
  } catch (e) { next(e) }
}

export async function actualizarBloqueTexto(req, res, next) {
  const { titulo, contenido, orden } = req.body
  const data = {}
  if (titulo !== undefined) data.titulo = titulo
  if (contenido !== undefined) data.contenido = contenido
  if (orden !== undefined) data.orden = Number(orden)

  try {
    const bloque = await svc.actualizarBloqueTexto(req.params.bloqueId, data)
    res.json(bloque)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Bloque no encontrado' })
    next(e)
  }
}

export async function eliminarBloqueTexto(req, res, next) {
  try {
    await svc.eliminarBloqueTexto(req.params.bloqueId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Bloque no encontrado' })
    next(e)
  }
}
