import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/usuariosController.js'

const router = Router()
router.use(verifyToken)

// Lectura — cualquier autenticado
router.get('/',    ctrl.listar)
router.get('/:id', ctrl.obtener)

// Escritura — solo gerente (o superusuario por bypass del middleware)
const SOLO_GERENTE = ['gerente_soporte']
router.post('/',      requireRole(SOLO_GERENTE), ctrl.crear)
router.put('/:id',    requireRole(SOLO_GERENTE), ctrl.actualizar)
router.delete('/:id', requireRole(SOLO_GERENTE), ctrl.desactivar)

export default router
