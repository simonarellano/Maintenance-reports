import { Router } from 'express'
import { login, me } from '../controllers/authController.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/login
router.post('/login', login)

// GET /api/auth/me  — requiere token válido
router.get('/me', verifyToken, me)

export default router
