import { Router } from 'express'
import { listar, obtener, crear, actualizar } from '../controllers/modelosController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

// Todos los autenticados pueden ver modelos
router.get('/', verifyToken, listar)
router.get('/:id', verifyToken, obtener)

// Solo supervisor puede crear/editar
router.post('/', verifyToken, requireRole('supervisor'), crear)
router.put('/:id', verifyToken, requireRole('supervisor'), actualizar)

export default router
