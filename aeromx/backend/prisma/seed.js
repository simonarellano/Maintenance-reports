import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (plain) => bcrypt.hash(plain, 10)

  const usuarios = [
    {
      nombre: 'Carlos Técnico',
      email: 'tecnico@aeromx.com',
      passwordHash: await hash('aeromx123'),
      rol: 'tecnico',
      licenciaNum: 'TEC-001',
    },
    {
      nombre: 'Ana Ingeniera',
      email: 'ingeniero@aeromx.com',
      passwordHash: await hash('aeromx123'),
      rol: 'ingeniero',
      licenciaNum: 'ING-001',
    },
    {
      nombre: 'Luis Supervisor',
      email: 'supervisor@aeromx.com',
      passwordHash: await hash('aeromx123'),
      rol: 'supervisor',
      licenciaNum: 'SUP-001',
    },
  ]

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    })
    console.log(`✓ Usuario: ${u.email} (${u.rol})`)
  }

  // Modelo de aeronave de prueba
  const modelo = await prisma.modeloAeronave.upsert({
    where: { nombre: 'Cessna 172S' },
    update: {},
    create: { nombre: 'Cessna 172S', fabricante: 'Cessna', descripcion: 'Avión de entrenamiento monomotor' },
  })
  console.log(`✓ Modelo: ${modelo.nombre}`)

  // Aeronave de prueba
  await prisma.aeronave.upsert({
    where: { matricula: 'XB-ABC' },
    update: {},
    create: {
      modeloId: modelo.id,
      matricula: 'XB-ABC',
      numeroSerie: 'C172S-12345',
      horasTotales: 1250.5,
      horasMotorDer: 0,
      horasMotorIzq: 0,
    },
  })
  console.log('✓ Aeronave: XB-ABC')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
