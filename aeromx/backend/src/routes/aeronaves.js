import { Router } from 'express'
import { listar, obtener, crear, actualizar, desactivar } from '../controllers/aeronavesController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

// Todos los autenticados pueden ver aeronaves
router.get('/', verifyToken, listar)
router.get('/:id', verifyToken, obtener)

// Solo supervisor puede crear/editar/desactivar
router.post('/', verifyToken, requireRole('supervisor'), crear)
router.put('/:id', verifyToken, requireRole('supervisor'), actualizar)
router.delete('/:id', verifyToken, requireRole('supervisor'), desactivar)

export default router
