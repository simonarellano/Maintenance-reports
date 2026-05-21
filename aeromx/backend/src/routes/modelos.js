import { Router } from 'express'
import { listar, obtener, crear, actualizar, eliminar } from '../controllers/modelosController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken)

// Lectura — cualquier autenticado
router.get('/',    listar)
router.get('/:id', obtener)

// Escritura — gerente o ingeniero
const GERENTE_O_INGENIERO = ['gerente_soporte', 'ingeniero_soporte']
router.post('/',      requireRole(GERENTE_O_INGENIERO), crear)
router.put('/:id',    requireRole(GERENTE_O_INGENIERO), actualizar)
router.delete('/:id', requireRole(GERENTE_O_INGENIERO), eliminar)

export default router
