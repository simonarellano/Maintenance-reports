import * as svc from '../../services/ordenesService.js'
import { verificarPermisoEdicion } from './workflowController.js'
import { storage, keyDesdeUrl } from '../../lib/storage/index.js'

export async function subir(req, res, next) {
  try {
    const { id: ordenId, resultadoId } = req.params

    const perm = await verificarPermisoEdicion(ordenId, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

    const resultado = await svc.obtenerResultado(ordenId, resultadoId)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const { key } = await storage.put({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    })

    const fechaCaptura = req.body.fechaCaptura ? new Date(req.body.fechaCaptura) : null
    const foto = await svc.agregarFoto(resultadoId, {
      urlArchivo: `/uploads/${key}`,
      nombreArchivo: req.file.originalname,
      tamanoBytes: req.file.size,
      subidaPor: req.user.sub,
      fechaCaptura,
    })
    res.status(201).json(foto)
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    const perm = await verificarPermisoEdicion(req.params.id, req.user)
    if (!perm.ok) return res.status(perm.status).json({ error: perm.error })

    const foto = await svc.obtenerFoto(req.params.fotoId)
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' })

    await svc.eliminarFoto(req.params.fotoId)

    // Borrar el objeto físico tras eliminar la fila (evita huérfanos).
    // Si el archivo ya no existe, no es un error que deba propagarse.
    const key = keyDesdeUrl(foto.urlArchivo)
    if (key) {
      try { await storage.delete(key) } catch (err) { console.error('[storage] error al borrar objeto:', err) }
    }

    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Foto no encontrada' })
    next(e)
  }
}
