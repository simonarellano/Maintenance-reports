import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function findUserByEmail(email) {
  return prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      nombre: true,
      email: true,
      passwordHash: true,
      rol: true,
      licenciaNum: true,
      activo: true,
    },
  })
}

export async function validatePassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

export async function updateLastAccess(userId) {
  return prisma.usuario.update({
    where: { id: userId },
    data: { ultimoAcceso: new Date() },
  })
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}
