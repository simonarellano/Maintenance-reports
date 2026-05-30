import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import usuariosRoutes from './routes/usuarios.js'
import modelosRoutes from './routes/modelos.js'
import productosRoutes from './routes/productos.js'
import formatosRoutes from './routes/formatos.js'
import ordenesRoutes from './routes/ordenes.js'
import categoriasFallaRoutes from './routes/categoriasFalla.js'
import fallasRoutes from './routes/fallas.js'
import { storage } from './lib/storage/index.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

// Fotos de inspección — se sirven vía la capa de almacenamiento (local/MinIO/S3)
// haciendo stream desde el backend. Así el frontend usa siempre `/uploads/<key>`
// sin importar el proveedor y sin exponer el bucket.
app.get('/uploads/:key', async (req, res, next) => {
  try {
    const objeto = await storage.getStream(req.params.key)
    if (!objeto) return res.status(404).json({ error: 'Archivo no encontrado' })
    res.setHeader('Content-Type', objeto.contentType)
    if (objeto.contentLength != null) res.setHeader('Content-Length', objeto.contentLength)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    objeto.stream.on('error', next)
    objeto.stream.pipe(res)
  } catch (e) { next(e) }
})

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/modelos', modelosRoutes)
app.use('/api/productos', productosRoutes)
app.use('/api/formatos', formatosRoutes)
app.use('/api/ordenes', ordenesRoutes)
app.use('/api/categorias-falla', categoriasFallaRoutes)
app.use('/api/fallas', fallasRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// Errores de Multer (subida de archivos): mapear a 400 antes del genérico.
app.use((err, _req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Archivo excede el límite permitido' })
  }
  if (err && err.message === 'TIPO_FOTO_INVALIDO') {
    return res.status(400).json({ error: 'Tipo de imagen no permitido (JPG/PNG/WebP)' })
  }
  next(err)
})

// Manejador global de errores — captura lo que no se manejó en controllers
app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err.status ?? 500
  res.status(status).json({ error: err.message || 'Error interno del servidor' })
})

// Prepara el almacenamiento (crea el bucket de MinIO/S3 si falta). No bloquea
// el arranque: si falla, lo registra y la app sigue (las subidas darán error claro).
storage.ensureReady().catch((e) => console.error('[storage] ensureReady falló:', e.message))

app.listen(PORT, () => {
  console.log(`AeroMX API corriendo en http://localhost:${PORT}`)
})

export default app
