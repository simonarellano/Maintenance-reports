import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/productosController.js'

const router = Router()
router.use(verifyToken)

// Lectura — cualquier autenticado
router.get('/',    ctrl.listar)
router.get('/:id', ctrl.obtener)

// Escritura — gerente o ingeniero (o superusuario)
router.post('/',      requireRole(['gerente_soporte', 'ingeniero_soporte']), ctrl.crear)
router.put('/:id',    requireRole(['gerente_soporte', 'ingeniero_soporte']), ctrl.actualizar)
router.delete('/:id', requireRole(['gerente_soporte', 'ingeniero_soporte']), ctrl.desactivar)

export default router
