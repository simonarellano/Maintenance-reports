import { Router } from 'express'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/ordenesController.js'

// Directorio de uploads relativo a la raíz del backend
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true)
    cb(new Error('Solo se permiten archivos de imagen'))
  },
})

const router = Router()
router.use(verifyToken)

// ── Órdenes de Trabajo ──────────────────────────────────────────────────────
router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)
router.post('/', ctrl.crear)
router.patch('/:id/estado', requireRole(['supervisor', 'ingeniero']), ctrl.actualizarEstado)

// ── Hitos del ciclo de vida ────────────────────────────────────────────────
router.post('/:id/recepcion', ctrl.recepcionarAeronave)
router.post('/:id/iniciar-mantenimiento', ctrl.iniciarMantenimiento)
router.patch('/:id/asignacion', requireRole(['supervisor']), ctrl.asignarOrden)

// ── Archivar / eliminar ────────────────────────────────────────────────────
router.patch('/:id/archivar', requireRole(['supervisor']), ctrl.archivar)
router.delete('/:id', requireRole(['supervisor']), ctrl.eliminar)

// ── Resultados de puntos ────────────────────────────────────────────────────
router.patch('/:id/puntos/:resultadoId', ctrl.actualizarResultado)
router.post('/:id/puntos/:resultadoId/firmar', ctrl.firmarResultado)

// ── Fotos por punto ─────────────────────────────────────────────────────────
router.post('/:id/puntos/:resultadoId/fotos', upload.single('foto'), ctrl.subirFoto)
router.delete('/:id/puntos/:resultadoId/fotos/:fotoId', ctrl.eliminarFoto)

// ── Cierre y firmas ─────────────────────────────────────────────────────────
router.post('/:id/cierre', ctrl.gestionarCierre)
router.post('/:id/cierre/firmar', ctrl.firmarCierre)

// ── PDF ─────────────────────────────────────────────────────────────────────
router.get('/:id/pdf', ctrl.generarPDF)

export default router
