import * as svc from '../services/usuariosService.js'
import { storage, keyDesdeUrl } from '../lib/storage/index.js'

export async function listar(req, res, next) {
  try {
    const { rol, activo } = req.query
    const filtros = {}
    if (rol) filtros.rol = rol
    if (activo !== undefined) filtros.activo = activo === 'true'
    const usuarios = await svc.listarUsuarios(filtros)
    res.json(usuarios)
  } catch (e) { next(e) }
}

export async function obtener(req, res, next) {
  try {
    const usuario = await svc.obtenerUsuario(req.params.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(usuario)
  } catch (e) { next(e) }
}

export async function crear(req, res, next) {
  try {
    const { nombre, email, password, rol } = req.body
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, password y rol son requeridos' })
    }
    const usuario = await svc.crearUsuario(req.body)
    res.status(201).json(usuario)
  } catch (e) {
    if (e.code === 'VALIDATION') return res.status(400).json({ error: e.message })
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    next(e)
  }
}

export async function actualizar(req, res, next) {
  try {
    const usuario = await svc.actualizarUsuario(req.params.id, req.body)
    res.json(usuario)
  } catch (e) {
    if (e.code === 'VALIDATION') return res.status(400).json({ error: e.message })
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' })
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    next(e)
  }
}

export async function desactivar(req, res, next) {
  try {
    const usuario = await svc.desactivarUsuario(req.params.id)
    res.json(usuario)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' })
    next(e)
  }
}

// ── Auto-servicio (dueño) ─────────────────────────────────────
export async function obtenerMe(req, res, next) {
  try {
    const usuario = await svc.obtenerUsuario(req.user.sub)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(usuario)
  } catch (e) { next(e) }
}

export async function actualizarMe(req, res, next) {
  try {
    // Whitelist explícita: SOLO distintivo y descripcionPuesto.
    const { distintivo, descripcionPuesto } = req.body
    const usuario = await svc.actualizarUsuario(req.user.sub, { distintivo, descripcionPuesto })
    res.json(usuario)
  } catch (e) {
    if (e.code === 'VALIDATION') return res.status(400).json({ error: e.message })
    if (e.code === 'P2002')      return res.status(409).json({ error: 'Distintivo en uso' })
    if (e.code === 'P2025')      return res.status(404).json({ error: 'Usuario no encontrado' })
    next(e)
  }
}

// ── Foto (dueño o gerente — gateado en la ruta) ──────────────
export async function subirFoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'foto requerida' })

    const actual = await svc.obtenerUsuario(req.params.id)
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' })

    // Subir nueva foto al storage (el driver genera la key conservando la extensión).
    const { key } = await storage.put({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    })
    const fotoUrl = `/uploads/${key}`

    // Persistir en DB.
    const usuario = await svc.actualizarUsuario(req.params.id, { fotoUrl })

    // Best-effort: borrar la key anterior si había foto previa.
    if (actual.fotoUrl) {
      const keyAntigua = keyDesdeUrl(actual.fotoUrl)
      if (keyAntigua && keyAntigua !== key) {
        storage.delete(keyAntigua).catch((err) => console.error('[storage] error al borrar foto previa:', err))
      }
    }

    res.json(usuario)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' })
    next(e)
  }
}

export async function eliminarFoto(req, res, next) {
  try {
    const actual = await svc.obtenerUsuario(req.params.id)
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' })

    if (actual.fotoUrl) {
      const keyAntigua = keyDesdeUrl(actual.fotoUrl)
      if (keyAntigua) {
        try { await storage.delete(keyAntigua) } catch (err) { console.error('[storage] error al borrar foto:', err) }
      }
    }
    const usuario = await svc.actualizarUsuario(req.params.id, { fotoUrl: null })
    res.json(usuario)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' })
    next(e)
  }
}
