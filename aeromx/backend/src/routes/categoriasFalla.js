import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/categoriasFallaController.js'

const router = Router()
router.use(verifyToken)

const ESCRITURA = requireRole(['gerente_soporte', 'ingeniero_soporte'])

router.get('/', ctrl.listar)
router.post('/', ESCRITURA, ctrl.crear)
router.put('/:id', ESCRITURA, ctrl.actualizar)
router.delete('/:id', ESCRITURA, ctrl.eliminar)

export default router
