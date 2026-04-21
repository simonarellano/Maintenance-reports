import * as svc from '../services/usuariosService.js'

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
