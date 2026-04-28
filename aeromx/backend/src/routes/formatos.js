import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/formatosController.js'

const router = Router()
router.use(verifyToken)

// Formatos
router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)
router.post('/', requireRole('supervisor'), ctrl.crear)
router.put('/:id', requireRole('supervisor'), ctrl.actualizar)
router.delete('/:id', requireRole('supervisor'), ctrl.desactivar)

// Secciones
router.post('/:id/secciones', requireRole('supervisor'), ctrl.crearSeccion)
router.put('/:id/secciones/:seccionId', requireRole('supervisor'), ctrl.actualizarSeccion)
router.delete('/:id/secciones/:seccionId', requireRole('supervisor'), ctrl.eliminarSeccion)

// Puntos de inspección
router.post('/:id/secciones/:seccionId/puntos', requireRole('supervisor'), ctrl.crearPunto)
router.put('/:id/secciones/:seccionId/puntos/:puntoId', requireRole('supervisor'), ctrl.actualizarPunto)
router.delete('/:id/secciones/:seccionId/puntos/:puntoId', requireRole('supervisor'), ctrl.eliminarPunto)

// Bloques de texto del documento (alcance, descripciones, notas, etc.)
router.post('/:id/bloques', requireRole('supervisor'), ctrl.crearBloqueTexto)
router.put('/:id/bloques/:bloqueId', requireRole('supervisor'), ctrl.actualizarBloqueTexto)
router.delete('/:id/bloques/:bloqueId', requireRole('supervisor'), ctrl.eliminarBloqueTexto)

// Secuencia/orden del documento (ordena built-ins + bloques entre sí)
router.put('/:id/secuencia', requireRole('supervisor'), ctrl.actualizarSecuencia)

export default router
