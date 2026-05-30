import { Router } from 'express'
import multer from 'multer'
import { verifyToken, requireRole, requireDueñoOGerente } from '../middleware/auth.js'
import * as ctrl from '../controllers/usuariosController.js'

const router = Router()
router.use(verifyToken)

// Multer local: 2MB, JPG/PNG/WebP únicamente.
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : Object.assign(new Error('TIPO_FOTO_INVALIDO'), { status: 400 }), ok)
  },
})

const SOLO_GERENTE = ['gerente_soporte']

// ── Auto-servicio ───────────────────────────────────────────────
router.get('/me',    ctrl.obtenerMe)
router.patch('/me',  ctrl.actualizarMe)

// ── Lectura ─────────────────────────────────────────────────────
router.get('/',    ctrl.listar)
router.get('/:id', ctrl.obtener)

// ── Foto (dueño o gerente) ──────────────────────────────────────
router.post('/:id/foto',   requireDueñoOGerente, uploadFoto.single('foto'), ctrl.subirFoto)
router.delete('/:id/foto', requireDueñoOGerente, ctrl.eliminarFoto)

// ── Escritura (solo gerente) ────────────────────────────────────
router.post('/',      requireRole(SOLO_GERENTE), ctrl.crear)
router.put('/:id',    requireRole(SOLO_GERENTE), ctrl.actualizar)
router.delete('/:id', requireRole(SOLO_GERENTE), ctrl.desactivar)

export default router
