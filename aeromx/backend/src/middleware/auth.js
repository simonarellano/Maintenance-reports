import jwt from 'jsonwebtoken'

export function verifyToken(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' })
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// Uso: requireRole('gerente_soporte') o requireRole(['gerente_soporte', 'ingeniero_soporte'])
// Bypass: si req.user.superusuario === true, pasa siempre (independiente del rol).
export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return (req, res, next) => {
    if (req.user?.superusuario === true) return next()
    if (!allowed.includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado para este rol' })
    }
    next()
  }
}
