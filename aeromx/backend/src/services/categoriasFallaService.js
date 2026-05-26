import prisma from '../lib/prisma.js'

export async function listar({ soloActivas } = {}) {
  return prisma.categoriaFalla.findMany({
    where: soloActivas ? { activo: true } : undefined,
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { fallas: true, formatos: true } } },
  })
}

export async function crear({ nombre, descripcion, color }) {
  return prisma.categoriaFalla.create({ data: { nombre, descripcion, color } })
}

export async function actualizar(id, { nombre, descripcion, color, activo }) {
  return prisma.categoriaFalla.update({
    where: { id },
    data: { nombre, descripcion, color, activo },
  })
}

export async function eliminar(id) {
  const cat = await prisma.categoriaFalla.findUnique({
    where: { id },
    include: { _count: { select: { fallas: true, formatos: true } } },
  })
  if (!cat) {
    const e = new Error('Categoría no encontrada')
    e.status = 404
    throw e
  }
  if (cat._count.fallas > 0 || cat._count.formatos > 0) {
    const e = new Error('No se puede eliminar: la categoría tiene fallas o formatos asociados')
    e.status = 409
    throw e
  }
  return prisma.categoriaFalla.delete({ where: { id } })
}
