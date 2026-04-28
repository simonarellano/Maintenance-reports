import * as svc from '../services/formatosService.js'

// ─── Formatos ───────────────────────────────────────────────────────────────

export async function listar(req, res) {
  const soloActivos = req.query.todos !== 'true'
  const formatos = await svc.listarFormatos(soloActivos)
  res.json(formatos)
}

export async function obtener(req, res) {
  const formato = await svc.obtenerFormato(req.params.id)
  if (!formato) return res.status(404).json({ error: 'Formato no encontrado' })
  res.json(formato)
}

export async function crear(req, res) {
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
}

export async function actualizar(req, res) {
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
    throw e
  }
}

export async function desactivar(req, res) {
  try {
    await svc.desactivarFormato(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Formato no encontrado' })
    throw e
  }
}

// ─── Secciones ──────────────────────────────────────────────────────────────

export async function crearSeccion(req, res) {
  const { nombre, descripcion, orden } = req.body
  if (!nombre || orden === undefined) {
    return res.status(400).json({ error: 'nombre y orden son requeridos' })
  }
  const seccion = await svc.crearSeccion(req.params.id, { nombre, descripcion, orden: Number(orden) })
  res.status(201).json(seccion)
}

export async function actualizarSeccion(req, res) {
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
    throw e
  }
}

export async function eliminarSeccion(req, res) {
  try {
    await svc.eliminarSeccion(req.params.seccionId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Sección no encontrada' })
    throw e
  }
}

// ─── Puntos de Inspección ───────────────────────────────────────────────────

export async function crearPunto(req, res) {
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
}

export async function actualizarPunto(req, res) {
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
    throw e
  }
}

export async function eliminarPunto(req, res) {
  try {
    await svc.eliminarPunto(req.params.puntoId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Punto no encontrado' })
    throw e
  }
}

// ─── Secuencia del documento ────────────────────────────────────────────────

export async function actualizarSecuencia(req, res) {
  try {
    const formato = await svc.actualizarSecuencia(req.params.id, req.body?.secuencia)
    res.json(formato)
  } catch (e) {
    if (e.code === 'BAD_INPUT') return res.status(400).json({ error: e.message })
    if (e.code === 'P2025') return res.status(404).json({ error: 'Formato no encontrado' })
    throw e
  }
}

// ─── Bloques de texto ───────────────────────────────────────────────────────

export async function crearBloqueTexto(req, res) {
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
}

export async function actualizarBloqueTexto(req, res) {
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
    throw e
  }
}

export async function eliminarBloqueTexto(req, res) {
  try {
    await svc.eliminarBloqueTexto(req.params.bloqueId)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Bloque no encontrado' })
    throw e
  }
}
