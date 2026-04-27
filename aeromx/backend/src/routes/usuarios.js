import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/usuariosController.js'

const router = Router()

router.use(verifyToken)

// GET /api/usuarios?rol=supervisor&activo=true — cualquier usuario autenticado
router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)

// Gestión — solo supervisor
router.post('/', requireRole(['supervisor']), ctrl.crear)
router.put('/:id', requireRole(['supervisor']), ctrl.actualizar)
router.delete('/:id', requireRole(['supervisor']), ctrl.desactivar)

export default router
