import {
  findUserByEmail,
  validatePassword,
  generateToken,
  updateLastAccess,
} from '../services/authService.js'

export async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' })
  }

  const user = await findUserByEmail(email)

  if (!user || !user.activo) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  const valid = await validatePassword(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  await updateLastAccess(user.id)

  const token = generateToken(user)

  return res.json({
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      licenciaNum: user.licenciaNum,
    },
  })
}

export async function me(req, res) {
  // req.user viene del middleware verifyToken
  return res.json({
    id: req.user.sub,
    email: req.user.email,
    rol: req.user.rol,
  })
}
