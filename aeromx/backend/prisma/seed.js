import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (plain) => bcrypt.hash(plain, 10)

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const usuarios = [
    { nombre: 'Carlos Técnico',  email: 'tecnico@aeromx.com',    passwordHash: await hash('aeromx123'), rol: 'tecnico',    licenciaNum: 'TEC-001' },
    { nombre: 'Ana Ingeniera',   email: 'ingeniero@aeromx.com',  passwordHash: await hash('aeromx123'), rol: 'ingeniero',  licenciaNum: 'ING-001' },
    { nombre: 'Luis Supervisor', email: 'supervisor@aeromx.com', passwordHash: await hash('aeromx123'), rol: 'supervisor', licenciaNum: 'SUP-001' },
  ]
  for (const u of usuarios) {
    await prisma.usuario.upsert({ where: { email: u.email }, update: {}, create: u })
    console.log(`✓ Usuario: ${u.email} (${u.rol})`)
  }

  // ── Modelo y aeronave ─────────────────────────────────────────────────────
  const modelo = await prisma.modeloAeronave.upsert({
    where: { nombre: 'Cessna 172S' },
    update: {},
    create: { nombre: 'Cessna 172S', fabricante: 'Cessna', descripcion: 'Avión de entrenamiento monomotor' },
  })
  console.log(`✓ Modelo: ${modelo.nombre}`)

  await prisma.aeronave.upsert({
    where: { matricula: 'XB-ABC' },
    update: {},
    create: { modeloId: modelo.id, matricula: 'XB-ABC', numeroSerie: 'C172S-12345', horasTotales: 1250.5, horasMotorDer: 0, horasMotorIzq: 0 },
  })
  console.log('✓ Aeronave: XB-ABC')

  // ── Formato Mantenimiento Menor ───────────────────────────────────────────
  let formatoMenor = await prisma.formato.findFirst({ where: { nombre: 'Mantenimiento Menor' } })
  if (!formatoMenor) {
    formatoMenor = await prisma.formato.create({
      data: {
        nombre: 'Mantenimiento Menor',
        version: '1.0',
        fechaVersion: new Date(),
        objetivo: 'Inspección de mantenimiento preventivo menor',
        instrucciones: 'Completar todas las secciones y puntos de inspección. Fotografiar componentes indicados.',
        definiciones: 'CM: Componente Mayor · AC: Aeronavegabilidad Crítica · fotoRequerida: punto que exige evidencia fotográfica',
        activo: true,
      },
    })
  }
  console.log(`✓ Formato: ${formatoMenor.nombre}`)

  // Borrar secciones previas para repoblar limpio
  await prisma.seccionFormato.deleteMany({ where: { formatoId: formatoMenor.id } })

  // ── Secciones y puntos reales ─────────────────────────────────────────────
  // p(nombre, fotoRequerida, esCritico, descripcion?)
  const p = (nombre, fotoRequerida = false, esCritico = false, descripcion = '') =>
    ({ nombre, fotoRequerida, esCritico, descripcion })

  const secciones = [
    {
      nombre: 'Generalidades',
      descripcion: 'Documentación y elementos generales de la aeronave',
      puntos: [
        p('Caja de transporte'),
        p('Bitácora de vuelo'),
        p('Reporte de bitácora de vuelo'),
      ],
    },
    {
      nombre: 'Reemplazo de bujías — Motor delantero (tabla I)',
      descripcion: 'Registro de bujías retiradas e instaladas en motor delantero',
      puntos: [
        p('Registro fotográfico de bujías (nuevas, usadas e instaladas)', true, false, 'Fotografiar bujías nuevas, usadas y finalmente instaladas'),
      ],
    },
    {
      nombre: 'Reemplazo de bujías — Motor delantero (tabla II)',
      descripcion: 'Segunda tabla de registro de bujías motor delantero',
      puntos: [
        p('Registro fotográfico de bujías (nuevas, usadas e instaladas)', true, false, 'Fotografiar bujías nuevas, usadas y finalmente instaladas'),
      ],
    },
    {
      nombre: 'Motor delantero',
      descripcion: 'Inspección de componentes del motor delantero',
      puntos: [
        p('Hélice', false, true),
        p('Conjunto mofle', true, false, 'Mofle, tornillo de sujeción, tuerca de sujeción y empaque'),
        p('Conjunto spinner', true, false, 'Spinner, base de spinner, tornillo de spinner, tornillo de sujeción de hélice'),
        p('Bobina del magneto', false, true),
        p('Bobinas de las bujías', true, false, 'Derecha e izquierda, capuchones'),
        p('Carburador'),
        p('Cabezas de motor', false, true),
        p('Empaque del monobloc', false, true),
        p('Empaque del carburador'),
        p('Conjunto servo acelerador', true, false, 'Base, mando, fusible'),
        p('Línea de pulso'),
        p('Conjunto bancada', true, false, 'Bancada antivibratoria, bancada'),
        p('Mangueras'),
        p('Extensión RPM'),
      ],
    },
    {
      nombre: 'Reemplazo de bujías — Motor trasero (tabla I)',
      descripcion: 'Registro de bujías retiradas e instaladas en motor trasero',
      puntos: [
        p('Registro fotográfico de bujías (nuevas, usadas e instaladas)', true, false, 'Fotografiar bujías nuevas, usadas y finalmente instaladas'),
      ],
    },
    {
      nombre: 'Reemplazo de bujías — Motor trasero (tabla II)',
      descripcion: 'Segunda tabla de registro de bujías motor trasero',
      puntos: [
        p('Registro fotográfico de bujías (nuevas, usadas e instaladas)', true, false, 'Fotografiar bujías nuevas, usadas y finalmente instaladas'),
      ],
    },
    {
      nombre: 'Motor trasero',
      descripcion: 'Inspección de componentes del motor trasero',
      puntos: [
        p('Hélice', false, true),
        p('Conjunto mofle', true, false, 'Mofle, tornillo de sujeción, tuerca de sujeción y empaque'),
        p('Conjunto spinner', true, false, 'Spinner, base de spinner, tornillo de spinner, tornillo de sujeción de hélice'),
        p('Bobina del magneto', false, true),
        p('Bobinas de las bujías', true, false, 'Derecha e izquierda, capuchones'),
        p('Carburador'),
        p('Cabezas de motor', false, true),
        p('Empaque del monobloc', false, true),
        p('Empaque del carburador'),
        p('Conjunto servo acelerador', true, false, 'Base, mando, fusible'),
        p('Línea de pulso'),
        p('Conjunto bancada', true, false, 'Bancada antivibratoria, bancada'),
        p('Mangueras'),
        p('Extensión RPM'),
        p('Generador de corriente', false, true),
      ],
    },
    {
      nombre: 'Fuselaje',
      descripcion: 'Inspección del fuselaje, aviónica y sistemas eléctricos',
      puntos: [
        p('Fuselaje'),
        p('Cowling delantero', true, false, 'Cowling, tornillo, seguro, muelle y remaches'),
        p('Cowling trasero', true, false, 'Cowling, tornillo, seguro, muelle y remaches'),
        p('Tapa trasera', true, false, 'Tapa, tornillo, seguro, muelle y remaches'),
        p('Tapa delantera', true, false, 'Tapa, tornillo, seguro, muelle y remaches'),
        p('Conjunto payload', true, false, 'Bahía, tornillos de sujeción de bahía'),
        p('Arnés principal'),
        p('Arnés payload'),
        p('Extensión coaxial ESF'),
        p('Extensión transmisión 58'),
        p('Extensión transponder'),
        p('Extensiones data'),
        p('Tierras', true, false, 'Tierra izquierda y derecha'),
        p('Transponder'),
        p('Switches'),
        p('Antena GPS data'),
        p('Antena GPS INS'),
        p('Antena GPS ESF'),
        p('Rectificador'),
        p('ESF'),
        p('Marco rack'),
        p('Bahías'),
        p('TCE'),
        p('Communication board'),
        p('Flow sensor'),
        p('Altímetro'),
        p('TCB'),
        p('Arnés data'),
        p('Antena trans'),
        p('Antena 24'),
        p('Antivib ESF', true, false, 'Tornillería, montajes'),
        p('Antivib rack bahía'),
      ],
    },
    {
      nombre: 'Tren delantero',
      descripcion: 'Inspección del tren de aterrizaje delantero',
      puntos: [
        p('Tornillo de horquilla', false, true),
        p('Spirol'),
        p('Resorte'),
        p('Conjunto servo', true, false, 'Mando, montaje'),
        p('Llanta', true, false, 'Llanta, rin, seguros'),
      ],
    },
    {
      nombre: 'Tren principal',
      descripcion: 'Inspección del tren de aterrizaje principal',
      puntos: [
        p('Estructura', false, true),
        p('Baleros'),
        p('Frenos', false, true),
        p('Llanta', true, false, 'Llanta, rin, tornillos, tuerca de seguridad'),
      ],
    },
    {
      nombre: 'Ala derecha',
      descripcion: 'Inspección del ala derecha y sus componentes',
      puntos: [
        p('Estructura', false, true),
        p('Winder'),
        p('Mandos'),
        p('Antena'),
        p('Pitot', false, true),
        p('Bisagra'),
        p('Luz de navegación'),
      ],
    },
    {
      nombre: 'Ala izquierda',
      descripcion: 'Inspección del ala izquierda y sus componentes',
      puntos: [
        p('Estructura', false, true),
        p('Winder'),
        p('Mandos'),
        p('Antena'),
        p('Pitot', false, true),
        p('Bisagra'),
        p('Tubo antirotatorio'),
        p('Sistema tubular'),
        p('Tornillos bahía'),
        p('Luz de navegación'),
        p('Luz de aterrizaje'),
        p('Sistema CAM', true, false, 'BN, C, D, LA, I'),
      ],
    },
    {
      nombre: 'Varios',
      descripcion: 'Sistemas de combustible y accesorios varios',
      puntos: [
        p('Tanque de combustible', false, true),
        p('Tornillos de sujeción AL'),
        p('Toma de combustible'),
        p('Líneas de combustible', false, true),
        p('Tapas GPS'),
      ],
    },
    {
      nombre: 'Estabilizador',
      descripcion: 'Inspección del estabilizador y superficies de cola',
      puntos: [
        p('Estabilizador horizontal', false, true),
        p('Elevadores y timones', false, true),
        p('Tapas de servos'),
        p('Mandos de elevadores y servos', true, false, 'Brazos, servos, fusibles, extensiones'),
        p('Seguro quick'),
      ],
    },
  ]

  let totalPuntos = 0
  for (let i = 0; i < secciones.length; i++) {
    const sec = await prisma.seccionFormato.create({
      data: {
        formatoId: formatoMenor.id,
        nombre: secciones[i].nombre,
        descripcion: secciones[i].descripcion,
        orden: i + 1,
      },
    })

    for (let j = 0; j < secciones[i].puntos.length; j++) {
      const pt = secciones[i].puntos[j]
      await prisma.puntoInspeccion.create({
        data: {
          seccionId: sec.id,
          nombreComponente: pt.nombre,
          descripcion: pt.descripcion,
          fotoRequerida: pt.fotoRequerida,
          esCritico: pt.esCritico,
          orden: j + 1,
        },
      })
      totalPuntos++
    }
  }
  console.log(`✓ ${secciones.length} secciones · ${totalPuntos} puntos creados`)

  // ── Formatos adicionales (sin puntos por ahora) ───────────────────────────
  const otrosFormatos = [
    { nombre: 'Inspección 50 horas',   objetivo: 'Inspección cada 50 horas de vuelo' },
    { nombre: 'Inspección 60 horas',   objetivo: 'Inspección cada 60 horas de vuelo' },
    { nombre: 'Mantenimiento Mayor',   objetivo: 'Inspección completa cada 500 horas de vuelo' },
    { nombre: 'Documento de Entrega',  objetivo: 'Entrega y aceptación de aeronave' },
    { nombre: 'Cambio de Componente',  objetivo: 'Registro de cambio de componente' },
    { nombre: 'Inspección Pre/Post vuelo', objetivo: 'Inspección pre-vuelo y post-vuelo' },
    { nombre: 'Reporte de Anomalía',   objetivo: 'Reporte de defecto o anomalía detectada' },
  ]
  for (const f of otrosFormatos) {
    const existe = await prisma.formato.findFirst({ where: { nombre: f.nombre } })
    if (!existe) {
      await prisma.formato.create({
        data: { nombre: f.nombre, version: '1.0', fechaVersion: new Date(), objetivo: f.objetivo, activo: true },
      })
    }
    console.log(`✓ Formato: ${f.nombre}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
