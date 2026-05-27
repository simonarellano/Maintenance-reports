import prisma from '../../lib/prisma.js'
import { storage, keyDesdeUrl } from '../../lib/storage/index.js'

export async function subir(req, res, next) {
  try {
    const { id } = req.params
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const falla = await prisma.reporteFalla.findUnique({ where: { id } })
    if (!falla) return res.status(404).json({ error: 'Falla no encontrada' })

    const etapa = req.body?.etapa || 'reporte'
    if (etapa !== 'reporte' && etapa !== 'resolucion') {
      return res.status(400).json({ error: 'etapa inválida (reporte | resolucion)' })
    }

    const { key } = await storage.put({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    })

    const foto = await prisma.fotoFalla.create({
      data: {
        reporte: { connect: { id } },
        urlArchivo: `/uploads/${key}`,
        nombreArchivo: req.file.originalname,
        tamanoBytes: req.file.size,
        usuario: { connect: { id: req.user.sub } },
        fechaCaptura: new Date(),
        etapa,
      },
    })
    res.status(201).json(foto)
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    const { fotoId } = req.params

    const foto = await prisma.fotoFalla.findUnique({ where: { id: fotoId } })
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' })

    await prisma.fotoFalla.delete({ where: { id: fotoId } })

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
