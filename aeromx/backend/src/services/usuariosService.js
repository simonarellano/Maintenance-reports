import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'

const ROLES_VALIDOS = ['tecnico', 'ingeniero', 'supervisor']

export function listarUsuarios({ rol, activo } = {}) {
  const where = {}
  if (rol) where.rol = rol
  if (activo !== undefined) where.activo = activo

  return prisma.usuario.findMany({
    where,
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      licenciaNum: true,
      telefono: true,
      activo: true,
      ultimoAcceso: true,
      createdAt: true,
    },
  })
}

export function obtenerUsuario(id) {
  return prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      licenciaNum: true,
      telefono: true,
      activo: true,
      ultimoAcceso: true,
      createdAt: true,
    },
  })
}

export async function crearUsuario(data) {
  const { nombre, email, password, rol, licenciaNum, telefono } = data

  if (!ROLES_VALIDOS.includes(rol)) {
    throw Object.assign(new Error(`rol debe ser: ${ROLES_VALIDOS.join(', ')}`), { code: 'VALIDATION' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  return prisma.usuario.create({
    data: { nombre, email, passwordHash, rol, licenciaNum, telefono },
    select: {
      id: true, nombre: true, email: true, rol: true,
      licenciaNum: true, telefono: true, activo: true, createdAt: true,
    },
  })
}

export async function actualizarUsuario(id, data) {
  const { nombre, email, password, rol, licenciaNum, telefono, activo } = data
  const updateData = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (email !== undefined) updateData.email = email
  if (rol !== undefined) {
    if (!ROLES_VALIDOS.includes(rol)) {
      throw Object.assign(new Error(`rol debe ser: ${ROLES_VALIDOS.join(', ')}`), { code: 'VALIDATION' })
    }
    updateData.rol = rol
  }
  if (licenciaNum !== undefined) updateData.licenciaNum = licenciaNum
  if (telefono !== undefined) updateData.telefono = telefono
  if (activo !== undefined) updateData.activo = activo
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10)

  return prisma.usuario.update({
    where: { id },
    data: updateData,
    select: {
      id: true, nombre: true, email: true, rol: true,
      licenciaNum: true, telefono: true, activo: true, createdAt: true,
    },
  })
}

export function desactivarUsuario(id) {
  return prisma.usuario.update({
    where: { id },
    data: { activo: false },
    select: { id: true, nombre: true, activo: true },
  })
}
