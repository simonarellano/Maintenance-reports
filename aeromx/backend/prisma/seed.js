import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (plain) => bcrypt.hash(plain, 10)

  // ── Usuarios — uno por rol + dev superusuario ─────────────────────────────
  const usuarios = [
    { nombre: 'Desarrollador',   email: 'dev@aeromx.com',        rol: 'gerente_soporte',   superusuario: true,  licenciaNum: 'DEV-000' },
    { nombre: 'Luis Gerente',    email: 'gerente@aeromx.com',    rol: 'gerente_soporte',   superusuario: false, licenciaNum: 'GER-001' },
    { nombre: 'Ana Ingeniera',   email: 'ingeniero@aeromx.com',  rol: 'ingeniero_soporte', superusuario: false, licenciaNum: 'ING-001' },
    { nombre: 'Carlos Técnico',  email: 'tecnico@aeromx.com',    rol: 'tecnico_soporte',   superusuario: false, licenciaNum: 'TEC-001' },
    { nombre: 'Pedro Mecánico',  email: 'mecanico@aeromx.com',   rol: 'mecanico',          superusuario: false, licenciaNum: 'MEC-001' },
    { nombre: 'María Piloto',    email: 'piloto@aeromx.com',     rol: 'piloto',            superusuario: false, licenciaNum: 'PIL-001' },
  ]

  for (const u of usuarios) {
    const passwordHash = await hash('aeromx123')
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { rol: u.rol, superusuario: u.superusuario, licenciaNum: u.licenciaNum },
      create: { ...u, passwordHash },
    })
    console.log(`✓ Usuario: ${u.email} (${u.rol}${u.superusuario ? ' · superusuario' : ''})`)
  }

  // ── Modelos — uno por tipo ────────────────────────────────────────────────
  const modelosData = [
    { tipoProducto: 'aeronave', nombre: 'Cessna 172S',     fabricante: 'Cessna',   descripcion: 'Avión de entrenamiento monomotor' },
    { tipoProducto: 'camion',   nombre: 'F-350 Super Duty', fabricante: 'Ford',     descripcion: 'Camión pesado de servicio en rampa' },
    { tipoProducto: 'planta',   nombre: 'XQ60',            fabricante: 'Cummins',  descripcion: 'Planta de energía portátil 60 kW' },
    { tipoProducto: 'sensor',   nombre: 'LiDAR VLP-16',    fabricante: 'Velodyne', descripcion: 'Sensor LiDAR de 16 canales' },
  ]

  const modelos = {}
  for (const m of modelosData) {
    const modelo = await prisma.modelo.upsert({
      where: { tipoProducto_nombre: { tipoProducto: m.tipoProducto, nombre: m.nombre } },
      update: { fabricante: m.fabricante, descripcion: m.descripcion },
      create: m,
    })
    modelos[m.tipoProducto] = modelo
    console.log(`✓ Modelo: ${m.tipoProducto} · ${m.nombre}`)
  }

  // ── Productos — uno por tipo, con su detalle ──────────────────────────────
  const productosData = [
    {
      tipoProducto: 'aeronave',
      modeloId: modelos.aeronave.id,
      identificador: 'XB-ABC',
      numeroSerie: 'C172S-12345',
      detalle: { horasTotales: 1250.5, horasMotorDer: 0, horasMotorIzq: 0 },
    },
    {
      tipoProducto: 'camion',
      modeloId: modelos.camion.id,
      identificador: 'MX-CAM-001',
      numeroSerie: 'FORD-F350-9876',
      detalle: { placas: 'MX-CAM-001', vin: '1FT8W3DT5KEE12345', odometro: 84200 },
    },
    {
      tipoProducto: 'planta',
      modeloId: modelos.planta.id,
      identificador: 'PE-001',
      numeroSerie: 'XQ60-2024-001',
      detalle: { horimetro: 320 },
    },
    {
      tipoProducto: 'sensor',
      modeloId: modelos.sensor.id,
      identificador: 'SE-001',
      numeroSerie: 'VLP16-78900',
      detalle: { fabricante: 'Velodyne', versionFirmware: '3.2.1', fechaCalibracion: new Date('2026-01-15') },
    },
  ]

  for (const p of productosData) {
    const existing = await prisma.producto.findUnique({
      where: { tipoProducto_identificador: { tipoProducto: p.tipoProducto, identificador: p.identificador } },
    })

    let producto
    if (existing) {
      producto = await prisma.producto.update({
        where: { id: existing.id },
        data: { modeloId: p.modeloId, numeroSerie: p.numeroSerie },
      })
    } else {
      producto = await prisma.producto.create({
        data: {
          tipoProducto: p.tipoProducto,
          modeloId: p.modeloId,
          identificador: p.identificador,
          numeroSerie: p.numeroSerie,
        },
      })
    }

    // Detalle por tipo
    const detalleArgs = { where: { productoId: producto.id }, update: p.detalle, create: { productoId: producto.id, ...p.detalle } }
    if (p.tipoProducto === 'aeronave') await prisma.aeronaveDetalle.upsert(detalleArgs)
    if (p.tipoProducto === 'camion')   await prisma.camionDetalle.upsert(detalleArgs)
    if (p.tipoProducto === 'planta')   await prisma.plantaDetalle.upsert(detalleArgs)
    if (p.tipoProducto === 'sensor')   await prisma.sensorDetalle.upsert(detalleArgs)

    console.log(`✓ Producto: ${p.tipoProducto} · ${p.identificador}`)
  }

  // ── Formato Aeronave: Mantenimiento Menor (14 secciones reales) ───────────
  const formatoAeronave = await crearFormato({
    tipoProducto: 'aeronave',
    nombre: 'Mantenimiento Menor',
    objetivo: 'Inspección de mantenimiento preventivo menor',
    instrucciones: 'Completar todas las secciones y puntos de inspección. Fotografiar componentes indicados.',
    definiciones: 'CM: Componente Mayor · AC: Aeronavegabilidad Crítica · fotoRequerida: punto que exige evidencia fotográfica',
  })
  await poblarFormato(formatoAeronave.id, seccionesMantenimientoMenor())

  // ── Formato Camión: Inspección Preventiva ─────────────────────────────────
  const formatoCamion = await crearFormato({
    tipoProducto: 'camion',
    nombre: 'Inspección Preventiva',
    objetivo: 'Inspección preventiva de camión de servicio',
  })
  await poblarFormato(formatoCamion.id, [
    {
      nombre: 'Motor',
      descripcion: 'Inspección general del motor y componentes asociados',
      puntos: [
        p('Nivel de aceite', false, true),
        p('Frenos',         false, true),
        p('Llantas',        true,  false, 'Inspección visual y presión'),
      ],
    },
  ])

  // ── Formato Planta: Mantenimiento de Horímetro 100h ───────────────────────
  const formatoPlanta = await crearFormato({
    tipoProducto: 'planta',
    nombre: 'Mantenimiento de Horímetro 100h',
    objetivo: 'Mantenimiento cada 100 horas de operación',
  })
  await poblarFormato(formatoPlanta.id, [
    {
      nombre: 'Motor y eléctrico',
      descripcion: 'Inspección de motor y sistema eléctrico de la planta',
      puntos: [
        p('Aceite',      false, true),
        p('Batería',     false, false),
        p('Conexiones',  true,  false, 'Verificar apriete y oxidación'),
      ],
    },
  ])

  // ── Formato Sensor: Calibración y Verificación ────────────────────────────
  const formatoSensor = await crearFormato({
    tipoProducto: 'sensor',
    nombre: 'Calibración y Verificación',
    objetivo: 'Calibración periódica y verificación funcional del sensor',
  })
  await poblarFormato(formatoSensor.id, [
    {
      nombre: 'Funcional',
      descripcion: 'Pruebas funcionales del sensor',
      puntos: [
        p('Lectura de prueba', true,  false, 'Capturar muestra de salida del sensor'),
        p('Firmware',          false, false, 'Verificar versión instalada'),
      ],
    },
  ])

  console.log('✅ Seed completado')
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function p(nombre, fotoRequerida = false, esCritico = false, descripcion = '') {
  return { nombre, fotoRequerida, esCritico, descripcion }
}

async function crearFormato({ tipoProducto, nombre, objetivo, instrucciones = null, definiciones = null }) {
  const existente = await prisma.formato.findFirst({ where: { tipoProducto, nombre } })
  if (existente) {
    console.log(`✓ Formato ya existe: ${tipoProducto} · ${nombre}`)
    return existente
  }
  const formato = await prisma.formato.create({
    data: {
      tipoProducto,
      nombre,
      version: '1.0',
      fechaVersion: new Date(),
      objetivo,
      instrucciones,
      definiciones,
      activo: true,
    },
  })
  console.log(`✓ Formato: ${tipoProducto} · ${nombre}`)
  return formato
}

async function poblarFormato(formatoId, secciones) {
  // Repoblar limpio (drop secciones previas + sus puntos por cascada lógica)
  const previas = await prisma.seccionFormato.findMany({ where: { formatoId }, include: { puntos: true } })
  for (const sec of previas) {
    await prisma.puntoInspeccion.deleteMany({ where: { seccionId: sec.id } })
  }
  await prisma.seccionFormato.deleteMany({ where: { formatoId } })

  let totalPuntos = 0
  for (let i = 0; i < secciones.length; i++) {
    const sec = await prisma.seccionFormato.create({
      data: {
        formatoId,
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
  console.log(`  → ${secciones.length} secciones · ${totalPuntos} puntos`)
}

function seccionesMantenimientoMenor() {
  return [
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
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
