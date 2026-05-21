import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/formatosController.js'

const router = Router()
router.use(verifyToken)

const GERENTE_O_INGENIERO = ['gerente_soporte', 'ingeniero_soporte']

// Formatos
router.get('/',       ctrl.listar)
router.get('/:id',    ctrl.obtener)
router.post('/',      requireRole(GERENTE_O_INGENIERO), ctrl.crear)
router.put('/:id',    requireRole(GERENTE_O_INGENIERO), ctrl.actualizar)
router.delete('/:id', requireRole(GERENTE_O_INGENIERO), ctrl.desactivar)

// Secciones
router.post(  '/:id/secciones',              requireRole(GERENTE_O_INGENIERO), ctrl.crearSeccion)
router.put(   '/:id/secciones/:seccionId',   requireRole(GERENTE_O_INGENIERO), ctrl.actualizarSeccion)
router.delete('/:id/secciones/:seccionId',   requireRole(GERENTE_O_INGENIERO), ctrl.eliminarSeccion)

// Puntos
router.post(  '/:id/secciones/:seccionId/puntos',            requireRole(GERENTE_O_INGENIERO), ctrl.crearPunto)
router.put(   '/:id/secciones/:seccionId/puntos/:puntoId',   requireRole(GERENTE_O_INGENIERO), ctrl.actualizarPunto)
router.delete('/:id/secciones/:seccionId/puntos/:puntoId',   requireRole(GERENTE_O_INGENIERO), ctrl.eliminarPunto)

// Bloques de texto
router.post(  '/:id/bloques',            requireRole(GERENTE_O_INGENIERO), ctrl.crearBloqueTexto)
router.put(   '/:id/bloques/:bloqueId',  requireRole(GERENTE_O_INGENIERO), ctrl.actualizarBloqueTexto)
router.delete('/:id/bloques/:bloqueId',  requireRole(GERENTE_O_INGENIERO), ctrl.eliminarBloqueTexto)

// Secuencia
router.put('/:id/secuencia', requireRole(GERENTE_O_INGENIERO), ctrl.actualizarSecuencia)

export default router
