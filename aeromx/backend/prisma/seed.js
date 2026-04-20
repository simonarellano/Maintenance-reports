import { config } from 'dotenv'
config()

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

  // Formatos de inspección
  let formatoMenor = await prisma.formato.findFirst({
    where: { nombre: 'Mantenimiento Menor' }
  })

  if (!formatoMenor) {
    formatoMenor = await prisma.formato.create({
      data: {
        nombre: 'Mantenimiento Menor',
        version: '1.0',
        fechaVersion: new Date(),
        objetivo: 'Inspección de mantenimiento preventivo menor cada 50 horas',
        instrucciones: 'Completar todas las secciones y puntos de inspección. Fotografiar defectos encontrados.',
        definiciones: 'CM: Componente Mayor, AC: Aeronavegabilidad Crítica',
        activo: true,
      },
    })
  }
  console.log(`✓ Formato: ${formatoMenor.nombre}`)

  // Secciones del Mantenimiento Menor
  const secciones = [
    { nombre: 'Alas', descripcion: 'Inspección de alas y superficies de control' },
    { nombre: 'Fuselaje', descripcion: 'Inspección del cuerpo del avión' },
    { nombre: 'Tren de Aterrizaje', descripcion: 'Inspección del tren delantero y principal' },
    { nombre: 'Motor y Accesorios', descripcion: 'Inspección del motor y sistemas' },
    { nombre: 'Sistemas Eléctricos', descripcion: 'Inspección de sistemas eléctricos' },
    { nombre: 'Cabina y Interior', descripcion: 'Inspección de controles y compartimento de pasajeros' },
  ]

  const seccionesCreadas = []
  for (let i = 0; i < secciones.length; i++) {
    let sec = await prisma.seccionFormato.findFirst({
      where: { formatoId: formatoMenor.id, nombre: secciones[i].nombre }
    })
    if (!sec) {
      sec = await prisma.seccionFormato.create({
        data: {
          formatoId: formatoMenor.id,
          nombre: secciones[i].nombre,
          descripcion: secciones[i].descripcion,
          orden: i + 1,
        },
      })
    }
    seccionesCreadas.push(sec)
  }
  console.log(`✓ ${seccionesCreadas.length} secciones creadas`)

  // Puntos de inspección para Alas
  const puntosAlas = [
    { nombre: 'Revestimiento de ala', categoria: 'Estructura', descripcion: 'Verificar grietas, abolladuras', esCritico: false, fotoRequerida: false },
    { nombre: 'Alerones', categoria: 'Control', descripcion: 'Movimiento libre, ausencia de daño', esCritico: true, fotoRequerida: true },
    { nombre: 'Flaps', categoria: 'Control', descripcion: 'Extensión completa, sin ruidos', esCritico: true, fotoRequerida: false },
    { nombre: 'Luces de navegación', categoria: 'Iluminación', descripcion: 'Funcionamiento de luces', esCritico: false, fotoRequerida: false },
  ]

  const puntosTren = [
    { nombre: 'Rueda delantera', categoria: 'Tren', descripcion: 'Presión, desgaste', esCritico: true, fotoRequerida: true },
    { nombre: 'Ruedas principales', categoria: 'Tren', descripcion: 'Presión, desgaste, alineación', esCritico: true, fotoRequerida: true },
    { nombre: 'Frenos', categoria: 'Frenado', descripcion: 'Funcionamiento, desgaste de pastillas', esCritico: true, fotoRequerida: false },
    { nombre: 'Amortiguadores', categoria: 'Suspensión', descripcion: 'Integridad estructural', esCritico: false, fotoRequerida: false },
  ]

  const puntosMotor = [
    { nombre: 'Filtro de aire', categoria: 'Consumibles', descripcion: 'Cambio si es necesario', esCritico: false, fotoRequerida: false },
    { nombre: 'Aceite motor', categoria: 'Fluidos', descripcion: 'Nivel y condición', esCritico: true, fotoRequerida: false },
    { nombre: 'Combustible', categoria: 'Combustible', descripcion: 'Contaminación, drenaje', esCritico: true, fotoRequerida: false },
    { nombre: 'Bujías', categoria: 'Encendido', descripcion: 'Condición y limpieza', esCritico: false, fotoRequerida: false },
  ]

  const puntosElectricos = [
    { nombre: 'Batería', categoria: 'Eléctrico', descripcion: 'Carga y conexiones', esCritico: true, fotoRequerida: false },
    { nombre: 'Generador/Alternador', categoria: 'Carga', descripcion: 'Funcionamiento', esCritico: true, fotoRequerida: false },
    { nombre: 'Instrumentos', categoria: 'Aviónicos', descripcion: 'Iluminación y función', esCritico: false, fotoRequerida: false },
  ]

  const puntosCabina = [
    { nombre: 'Cinturones de seguridad', categoria: 'Seguridad', descripcion: 'Integridad de hebillas y telas', esCritico: true, fotoRequerida: false },
    { nombre: 'Puertas y escotillas', categoria: 'Acceso', descripcion: 'Cierre seguro', esCritico: true, fotoRequerida: false },
    { nombre: 'Espejos', categoria: 'Accesorios', descripcion: 'Presencia y condición', esCritico: false, fotoRequerida: false },
  ]

  const todosPuntos = [
    { seccion: 0, puntos: puntosAlas },
    { seccion: 1, puntos: [] }, // Fuselaje sin puntos por ahora
    { seccion: 2, puntos: puntosTren },
    { seccion: 3, puntos: puntosMotor },
    { seccion: 4, puntos: puntosElectricos },
    { seccion: 5, puntos: puntosCabina },
  ]

  let totalPuntos = 0
  for (const grupo of todosPuntos) {
    for (let i = 0; i < grupo.puntos.length; i++) {
      let punto = await prisma.puntoInspeccion.findFirst({
        where: {
          seccionId: seccionesCreadas[grupo.seccion].id,
          nombreComponente: grupo.puntos[i].nombre,
        },
      })
      if (!punto) {
        punto = await prisma.puntoInspeccion.create({
          data: {
            seccionId: seccionesCreadas[grupo.seccion].id,
            nombreComponente: grupo.puntos[i].nombre,
            categoria: grupo.puntos[i].categoria,
            descripcion: grupo.puntos[i].descripcion,
            esCritico: grupo.puntos[i].esCritico,
            fotoRequerida: grupo.puntos[i].fotoRequerida,
            orden: i + 1,
          },
        })
      }
      totalPuntos++
    }
  }
  console.log(`✓ ${totalPuntos} puntos de inspección creados`)

  // Formatos simples adicionales
  let formatoInspeccion50 = await prisma.formato.findFirst({
    where: { nombre: 'Inspección 50 horas' }
  })
  if (!formatoInspeccion50) {
    formatoInspeccion50 = await prisma.formato.create({
      data: {
        nombre: 'Inspección 50 horas',
        version: '1.0',
        fechaVersion: new Date(),
        objetivo: 'Inspección de mantenimiento cada 50 horas de vuelo',
        instrucciones: 'Completar todas las áreas de inspección',
        definiciones: 'Inspección rutinaria básica',
        activo: true,
      },
    })
  }
  console.log(`✓ Formato: ${formatoInspeccion50.nombre}`)

  let formatoMayor = await prisma.formato.findFirst({
    where: { nombre: 'Mantenimiento Mayor' }
  })
  if (!formatoMayor) {
    formatoMayor = await prisma.formato.create({
      data: {
        nombre: 'Mantenimiento Mayor',
        version: '1.0',
        fechaVersion: new Date(),
        objetivo: 'Inspección completa cada 500 horas de vuelo',
        instrucciones: 'Inspección exhaustiva de todos los sistemas',
        definiciones: 'Mantenimiento completo e integral',
        activo: true,
      },
    })
  }
  console.log(`✓ Formato: ${formatoMayor.nombre}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
