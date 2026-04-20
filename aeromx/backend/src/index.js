import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import authRoutes from './routes/auth.js'
import modelosRoutes from './routes/modelos.js'
import aeronavesRoutes from './routes/aeronaves.js'
import formatosRoutes from './routes/formatos.js'
import ordenesRoutes from './routes/ordenes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

// Archivos estáticos — fotos subidas desde móvil
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/modelos', modelosRoutes)
app.use('/api/aeronaves', aeronavesRoutes)
app.use('/api/formatos', formatosRoutes)
app.use('/api/ordenes', ordenesRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// Manejador global de errores — captura lo que no se manejó en controllers
app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err.status ?? 500
  res.status(status).json({ error: err.message || 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`AeroMX API corriendo en http://localhost:${PORT}`)
})

export default app
