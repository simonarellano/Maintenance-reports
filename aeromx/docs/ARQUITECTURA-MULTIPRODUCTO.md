# Arquitectura Multiproducto + Roles + Modularización — AeroMX

> **Objetivo**: tres cambios de arquitectura que se entregan juntos porque se tocan los mismos archivos.
>
> 1. **Multiproducto** — generalizar el dominio para soportar 4 tipos: Aeronaves, Camiones, Plantas de energía, Sensores.
> 2. **Roles y permisos rediseñados** — 5 roles funcionales + 1 superusuario + reapertura de O/T.
> 3. **Modularización de `ordenesController.js`** — partir el archivo de 1101 líneas en sub-controllers por sub-recurso.
>
> **Estado actual de los datos**: solo datos de prueba. La migración puede ser destructiva sin riesgo.

---

## 1. Tipos de producto y atributos específicos

| Tipo (enum DB) | Label UI | Atributos específicos | Lectura del medidor (al iniciar mantenimiento) |
|---|---|---|---|
| `aeronave` | Aeronave | matrícula, número de serie, horas totales, horas motor der/izq | horas totales |
| `camion` | Camión | placas, VIN, número de serie, odómetro | odómetro (km) |
| `planta` | Planta de energía | número de serie, horímetro | horímetro (h) |
| `sensor` | Sensor | número de serie, fabricante propio, versión firmware, fecha de calibración | (sin medidor) |

**Reglas confirmadas:**
- Identificadores nunca chocan entre tipos (placas ≠ matrícula). Único por `(tipoProducto, identificador)`.
- Las lecturas del medidor se piden **al iniciar el mantenimiento** (Hito 3 del workflow), no al crear la O/T. Antes solo viven como FK al producto.
- Sensores guardan `fabricante` directo en `SensorDetalle` (no se hereda del modelo).
- Camión, planta y aeronave heredan `fabricante` del modelo asociado.
- Modelo es FK obligatoria para los 4 tipos (no texto libre).
- Formatos no son compartibles entre tipos.

---

## 2. Roles y permisos

### 2.1 Roles funcionales

| Rol (enum DB) | Label UI | Reemplaza a |
|---|---|---|
| `gerente_soporte` | Gerente de soporte técnico | `supervisor` (rename) |
| `ingeniero_soporte` | Ingeniero de soporte | `ingeniero` (rename con permisos ampliados) |
| `tecnico_soporte` | Técnico de soporte | `tecnico` (rename) |
| `mecanico` | Mecánico | NUEVO |
| `piloto` | Piloto | NUEVO |

> **Superusuario** (`Usuario.superusuario: boolean`) es **ortogonal al rol**, no un valor del enum. Es un flag que se cumple con `OR` antes de cualquier check de rol — útil para el desarrollador y futuras cuentas administrativas sin contaminar el enum funcional. Si `usuario.superusuario === true`, todas las verificaciones de rol pasan.

### 2.2 Asignación de O/T — modelo extendido

Cada O/T tiene **4 responsables obligatorios** (5 si es aeronave). El modelo de FKs en `OrdenTrabajo`:

| Campo | Tipo | Obligatoriedad | Rol del usuario asignado |
|---|---|---|---|
| `soporteId` | FK Usuario | **obligatorio** | `tecnico_soporte` o `ingeniero_soporte` |
| `ingenieroAuxiliarId` | FK Usuario | opcional, **solo si `soporteId` es técnico** | `ingeniero_soporte` |
| `mecanicoId` | FK Usuario | **obligatorio** | `mecanico` |
| `gerenteId` | FK Usuario | **obligatorio** | `gerente_soporte` |
| `pilotoId` | FK Usuario | **obligatorio si `producto.tipoProducto === 'aeronave'`**, prohibido en otros tipos | `piloto` |

**Reglas de validación al crear/reasignar O/T (a nivel servicio):**
1. Los 3 obligatorios siempre deben venir (`soporteId`, `mecanicoId`, `gerenteId`).
2. Si el producto es aeronave, `pilotoId` también es obligatorio. Si no es aeronave, `pilotoId` debe ser `null` (400 si se intenta asignar).
3. `ingenieroAuxiliarId` solo se acepta cuando `soporteId.rol === 'tecnico_soporte'`. Si el soporte ya es ingeniero, no tiene sentido un ingeniero auxiliar (400).
4. Cada FK debe corresponder a un usuario activo con el rol esperado.
5. El mecánico es **uno solo** por O/T pero **cambiable** vía endpoint de reasignación.

> El concepto "técnico" en el código pasa a llamarse **soporte** (`soporteId`, `firmaSoporteId`). Cubre tanto técnico como ingeniero porque comparten responsabilidades de ejecución y firma.

### 2.3 Matriz de permisos

| Acción | Gerente | Ing. Soporte | Téc. Soporte | Mecánico | Piloto | Superusuario |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Listar/ver O/T | ✅ | ✅ | ✅ propias | ✅ asignado | ✅ asignado | ✅ |
| Crear/editar/borrar **usuarios** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Crear/editar **modelos** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Crear/editar **productos** (flota) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Crear/editar **formatos** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Crear O/T (asigna a los 4-5 responsables) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reasignar responsables | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Recepcionar / iniciar mantenimiento | ✅ | ✅ asignado | ✅ asignado | ❌ | ❌ | ✅ |
| Completar puntos (estado/obs/fotos) | ✅ | ✅ asignado | ✅ asignado | ❌ | ❌ | ✅ |
| Firmar punto crítico | ✅ | ✅ asignado | ✅ asignado | ✅ asignado | ❌ | ✅ |
| Firmar cierre como soporte | ✅ | ✅ asignado | ✅ asignado | ❌ | ❌ | ✅ |
| Firmar cierre como gerente | ✅ asignado | ❌ | ❌ | ❌ | ❌ | ✅ |
| Firmar cierre como piloto (aeronave) | ❌ | ❌ | ❌ | ❌ | ✅ asignado | ✅ |
| Archivar / eliminar O/T | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Reabrir O/T cerrada** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

> "Asignado" = el usuario en cuestión es el `soporteId` / `ingenieroAuxiliarId` / `mecanicoId` / `gerenteId` / `pilotoId` de la O/T. El ingeniero auxiliar tiene los mismos permisos de ejecución que el soporte principal.

### 2.4 Cierre

`CierreOT` tiene tres slots de firma:

| Firma | Campo | Aplica cuando |
|---|---|---|
| Soporte | `firmaSoporteId` (era `firma_tecnico_id`) | siempre |
| Gerente | `firmaGerenteId` (era `firma_supervisor_id`) | siempre |
| Piloto | `firmaPilotoId` | **solo `aeronave`, siempre obligatoria** |

**Regla de cierre**:
- O/T de `aeronave`: pasa a `cerrada` cuando están **3 firmas** (soporte + gerente + piloto). **Sin excepciones** — no hay caso de "vuelo de prueba no aplica".
- O/T de `camion` / `planta` / `sensor`: pasa a `cerrada` con **2 firmas** (soporte + gerente).

### 2.5 Reapertura de O/T

**Caso de uso**: una O/T cerrada tiene un error. Solo el gerente puede reabrirla.

**Tabla nueva `historial_estados_ot`** (audit trail):
```prisma
model HistorialEstadoOT {
  id             String   @id @default(uuid())
  ordenId        String   @map("orden_id")
  estadoAnterior EstadoOT @map("estado_anterior")
  estadoNuevo    EstadoOT @map("estado_nuevo")
  motivo         String?  // obligatorio en reaperturas
  usuarioId      String   @map("usuario_id")
  createdAt      DateTime @default(now()) @map("created_at")

  orden   OrdenTrabajo @relation(fields: [ordenId], references: [id])
  usuario Usuario      @relation(fields: [usuarioId], references: [id])

  @@index([ordenId])
  @@map("historial_estados_ot")
}
```

**Endpoint**: `POST /api/ordenes/:id/reabrir` (gerente).
- Body: `{ motivo: string (obligatorio) }`. **No se elige estado destino** — siempre vuelve a `pendiente_firma`.
- Efectos:
  1. Borra las firmas del `CierreOT` (`firmaSoporteId`, `firmaGerenteId`, `firmaPilotoId`) y sus fechas.
  2. Cambia `OrdenTrabajo.estado` a `pendiente_firma`.
  3. Limpia `OrdenTrabajo.fechaCierre`.
  4. Registra el evento en `historial_estados_ot` con el `motivo`.

**Frontend**: en `DashboardPage` y `InspeccionPage`, las O/T `cerrada` muestran un botón "Reabrir" solo visible para gerente/superusuario. Modal con campo `motivo` requerido.

**Visualización del histórico**: en `InspeccionPage` se muestra una sección desplegable "Historial de estados" con cada cambio (estado anterior → nuevo · usuario · fecha · motivo). Permite a cualquier asignado ver que la O/T fue reabierta y por qué.

---

## 3. Modelo de datos — patrón elegido

Patrón: **Class Table Inheritance (CTI)**. Una tabla padre `Producto` con los campos comunes + una tabla hija por tipo (`AeronaveDetalle`, `CamionDetalle`, `PlantaDetalle`, `SensorDetalle`) con relación 1:1 que guarda solo los atributos específicos.

**Por qué CTI y no STI con JSON ni tabla por tipo:**
- STI con todas las columnas opcionales genera tablas anchas y sin validación.
- STI con un campo JSON pierde validación a nivel BD.
- Tabla por tipo sin padre obligaría a hacer FK polimórficas en `OrdenTrabajo`, ramificando todo el código.
- CTI da: FK única en O/T (`productoId`), atributos específicos validados a nivel BD, queries simples.

### 3.1 Schema Prisma propuesto

```prisma
// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum Rol {
  gerente_soporte
  ingeniero_soporte
  tecnico_soporte
  mecanico
  piloto
}

enum TipoProducto {
  aeronave
  camion
  planta
  sensor
}

enum EstadoOT {
  borrador
  en_proceso
  pendiente_firma
  cerrada
}

enum EstadoResultado {
  bueno
  correcto_con_danos
  requiere_atencion
  no_aplica
}

// ─────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────

model Usuario {
  id            String    @id @default(uuid())
  nombre        String
  email         String    @unique
  passwordHash  String    @map("password_hash")
  rol           Rol
  superusuario  Boolean   @default(false) // bypass de checks de rol
  licenciaNum   String?   @map("licencia_num")
  telefono      String?
  activo        Boolean   @default(true)
  ultimoAcceso  DateTime? @map("ultimo_acceso")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // Relaciones — asignaciones a O/T
  ordenesComoSoporte           OrdenTrabajo[]      @relation("SoporteOT")
  ordenesComoIngenieroAuxiliar OrdenTrabajo[]      @relation("IngenieroAuxiliarOT")
  ordenesComoMecanico          OrdenTrabajo[]      @relation("MecanicoOT")
  ordenesComoGerente           OrdenTrabajo[]      @relation("GerenteOT")
  ordenesComoPiloto            OrdenTrabajo[]      @relation("PilotoOT")
  // Firmas y otros
  firmasPorPaso                ResultadoPunto[]    @relation("FirmaPaso")
  fotosSubidas                 FotoInspeccion[]    @relation("FotoSubida")
  cierresSoporte               CierreOT[]          @relation("CierreSoporte")
  cierresGerente               CierreOT[]          @relation("CierreGerente")
  cierresPiloto                CierreOT[]          @relation("CierrePiloto")
  historialEstados             HistorialEstadoOT[]

  @@map("usuarios")
}

// ─────────────────────────────────────────────
// MODELOS — unificados con discriminador de tipo
// ─────────────────────────────────────────────

model Modelo {
  id           String       @id @default(uuid())
  tipoProducto TipoProducto @map("tipo_producto")
  nombre       String
  fabricante   String?
  descripcion  String?
  createdAt    DateTime     @default(now()) @map("created_at")

  productos        Producto[]
  puntosExcluidos  PuntoExcluidoPorModelo[]

  @@unique([tipoProducto, nombre])
  @@map("modelos")
}

// ─────────────────────────────────────────────
// PRODUCTO — tabla padre (CTI)
// ─────────────────────────────────────────────

model Producto {
  id            String       @id @default(uuid())
  tipoProducto  TipoProducto @map("tipo_producto")
  modeloId      String       @map("modelo_id")
  identificador String       // matrícula / placas / serie. Único dentro del tipo.
  numeroSerie   String?      @map("numero_serie")
  activo        Boolean      @default(true)
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  modelo   Modelo @relation(fields: [modeloId], references: [id])
  ordenes  OrdenTrabajo[]

  // Detalles 1:1 — solo uno estará poblado según tipoProducto
  aeronave AeronaveDetalle?
  camion   CamionDetalle?
  planta   PlantaDetalle?
  sensor   SensorDetalle?

  @@unique([tipoProducto, identificador])
  @@map("productos")
}

// ─────────────────────────────────────────────
// DETALLES POR TIPO
// ─────────────────────────────────────────────

model AeronaveDetalle {
  productoId    String @id @map("producto_id")
  // Lecturas "actuales" — se actualizan al cerrar cada O/T
  horasTotales  Float  @default(0) @map("horas_totales")
  horasMotorDer Float  @default(0) @map("horas_motor_der")
  horasMotorIzq Float  @default(0) @map("horas_motor_izq")

  producto Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@map("aeronave_detalle")
}

model CamionDetalle {
  productoId String  @id @map("producto_id")
  placas     String  @unique
  vin        String? @unique
  odometro   Float   @default(0)

  producto Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@map("camion_detalle")
}

model PlantaDetalle {
  productoId String @id @map("producto_id")
  horimetro  Float  @default(0)

  producto Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@map("planta_detalle")
}

model SensorDetalle {
  productoId        String    @id @map("producto_id")
  fabricante        String?   // se guarda directo, no se hereda del modelo
  versionFirmware   String?   @map("version_firmware")
  fechaCalibracion  DateTime? @map("fecha_calibracion")

  producto Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  @@map("sensor_detalle")
}

// ─────────────────────────────────────────────
// FORMATO — atado a un tipo de producto
// ─────────────────────────────────────────────

model Formato {
  id            String       @id @default(uuid())
  tipoProducto  TipoProducto @map("tipo_producto")
  nombre        String
  version       String
  fechaVersion  DateTime     @map("fecha_version")
  objetivo      String?
  instrucciones String?
  definiciones  String?
  activo        Boolean      @default(true)
  secuenciaDocumento Json?   @map("secuencia_documento")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  secciones    SeccionFormato[]
  bloquesTexto BloqueTextoFormato[]
  ordenes      OrdenTrabajo[]

  @@map("formatos")
}

// ─────────────────────────────────────────────
// EXCLUSIONES — modelo y formato deben tener mismo tipoProducto
// ─────────────────────────────────────────────

model PuntoExcluidoPorModelo {
  puntoId  String  @map("punto_id")
  modeloId String  @map("modelo_id")
  motivo   String?

  punto  PuntoInspeccion @relation(fields: [puntoId], references: [id])
  modelo Modelo          @relation(fields: [modeloId], references: [id])

  @@id([puntoId, modeloId])
  @@map("puntos_excluidos_por_modelo")
}

// ─────────────────────────────────────────────
// ORDEN DE TRABAJO — productoId + 5 asignaciones
// ─────────────────────────────────────────────

model OrdenTrabajo {
  id             String    @id @default(uuid())
  numeroOt       String    @unique @map("numero_ot")
  formatoId      String    @map("formato_id")
  productoId     String    @map("producto_id")     // antes: aeronaveId

  // Asignaciones — todas FK a Usuario
  soporteId            String   @map("soporte_id")              // OBLIGATORIO — técnico o ingeniero
  ingenieroAuxiliarId  String?  @map("ingeniero_auxiliar_id")   // opcional, solo si soporteId es técnico
  mecanicoId           String   @map("mecanico_id")             // OBLIGATORIO
  gerenteId            String   @map("gerente_id")              // OBLIGATORIO (antes: supervisorId)
  pilotoId             String?  @map("piloto_id")               // OBLIGATORIO si tipoProducto = 'aeronave'

  cliente        String?
  ordenServicio  String?   @map("orden_servicio")
  lugarMantenimiento String? @map("lugar_mantenimiento")

  // Lecturas del medidor — se llenan al INICIAR el mantenimiento (Hito 3), no al crear.
  // Solo el set correspondiente al tipo del producto se llena.
  horasTotales   Float?  @map("horas_totales")
  horasMotorDer  Float?  @map("horas_motor_der")
  horasMotorIzq  Float?  @map("horas_motor_izq")
  odometro       Float?
  horimetro      Float?

  estado         EstadoOT  @default(borrador)
  archivada      Boolean   @default(false)
  fechaRecepcion DateTime? @map("fecha_recepcion")
  identificadorRecepcion String? @map("identificador_recepcion") // antes: matriculaRecepcion
  fechaInicio    DateTime? @map("fecha_inicio")
  fechaCierre    DateTime? @map("fecha_cierre")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  formato            Formato          @relation(fields: [formatoId], references: [id])
  producto           Producto         @relation(fields: [productoId], references: [id])
  soporte            Usuario          @relation("SoporteOT",            fields: [soporteId],           references: [id])
  ingenieroAuxiliar  Usuario?         @relation("IngenieroAuxiliarOT",  fields: [ingenieroAuxiliarId], references: [id])
  mecanico           Usuario          @relation("MecanicoOT",           fields: [mecanicoId],          references: [id])
  gerente            Usuario          @relation("GerenteOT",            fields: [gerenteId],           references: [id])
  piloto             Usuario?         @relation("PilotoOT",             fields: [pilotoId],            references: [id])
  resultados         ResultadoPunto[]
  cierre             CierreOT?
  historial          HistorialEstadoOT[]

  @@map("ordenes_trabajo")
}

// ─────────────────────────────────────────────
// CIERRE — soporte + gerente + (piloto solo en aeronave)
// ─────────────────────────────────────────────

model CierreOT {
  ordenId                String    @id @map("orden_id")
  seEncontroDefecto      Boolean   @map("se_encontro_defecto")
  refDocCorrectivo       String?   @map("ref_doc_correctivo")
  observacionesGenerales String?   @map("observaciones_generales")

  // Tres firmas
  firmaSoporteId         String?   @map("firma_soporte_id")     // antes: firma_tecnico_id
  fechaFirmaSoporte      DateTime? @map("fecha_firma_soporte")
  firmaGerenteId         String?   @map("firma_gerente_id")     // antes: firma_supervisor_id
  fechaFirmaGerente      DateTime? @map("fecha_firma_gerente")
  firmaPilotoId          String?   @map("firma_piloto_id")      // NUEVO — solo aeronave
  fechaFirmaPiloto       DateTime? @map("fecha_firma_piloto")

  firmaFisicaUrl         String?   @map("firma_fisica_url")
  createdAt              DateTime  @default(now()) @map("created_at")

  orden     OrdenTrabajo @relation(fields: [ordenId], references: [id])
  soporte   Usuario?     @relation("CierreSoporte", fields: [firmaSoporteId], references: [id])
  gerente   Usuario?     @relation("CierreGerente", fields: [firmaGerenteId], references: [id])
  piloto    Usuario?     @relation("CierrePiloto",  fields: [firmaPilotoId],  references: [id])

  @@map("cierre_ot")
}

// ─────────────────────────────────────────────
// HISTORIAL DE ESTADOS — audit trail para reaperturas
// ─────────────────────────────────────────────

model HistorialEstadoOT {
  id             String   @id @default(uuid())
  ordenId        String   @map("orden_id")
  estadoAnterior EstadoOT @map("estado_anterior")
  estadoNuevo    EstadoOT @map("estado_nuevo")
  motivo         String?
  usuarioId      String   @map("usuario_id")
  createdAt      DateTime @default(now()) @map("created_at")

  orden   OrdenTrabajo @relation(fields: [ordenId], references: [id])
  usuario Usuario      @relation(fields: [usuarioId], references: [id])

  @@index([ordenId])
  @@map("historial_estados_ot")
}
```

> **Lo que NO cambia**: `SeccionFormato`, `PuntoInspeccion`, `BloqueTextoFormato`, `ResultadoPunto`, `FotoInspeccion`. Siguen funcionando idénticos.

### 3.2 Reglas de negocio nuevas (validación a nivel servicio)

1. **Coherencia de tipo en O/T**: `formato.tipoProducto === producto.tipoProducto` al crear. 400 si no.
2. **Coherencia de tipo en exclusiones**: `modelo.tipoProducto === formato.tipoProducto` (donde formato es el dueño del punto excluido). 400 si no.
3. **Asignaciones obligatorias al crear O/T**:
   - `soporteId` (rol = `tecnico_soporte` | `ingeniero_soporte`) — obligatorio.
   - `mecanicoId` (rol = `mecanico`) — obligatorio.
   - `gerenteId` (rol = `gerente_soporte`) — obligatorio.
   - `pilotoId` (rol = `piloto`) — obligatorio si `producto.tipoProducto === 'aeronave'`, prohibido en otros tipos.
   - `ingenieroAuxiliarId` (rol = `ingeniero_soporte`) — opcional, **solo aceptable si `soporteId` es de rol `tecnico_soporte`**.
4. **Lecturas obligatorias al iniciar mantenimiento** (no al crear):
   - `aeronave`: requiere `horasTotales`. `horasMotorDer/Izq` opcionales.
   - `camion`: requiere `odometro`.
   - `planta`: requiere `horimetro`.
   - `sensor`: ninguna lectura.
5. **Identificador de recepción** (Hito 2): se valida contra `producto.identificador`.
6. **Sincronización de lecturas al cerrar**: al pasar la O/T a `cerrada`, las lecturas de la O/T se copian al `*Detalle` del producto (odómetro/horímetro/horas se actualizan al valor más reciente). Solo si la lectura nueva es ≥ a la actual (no permitir retroceso).
7. **Eliminación de modelo**: 409 si tiene productos asociados.
8. **Eliminación de producto**: 409 si tiene O/T no archivadas.
9. **Reapertura**: solo gerente o superusuario. Requiere `motivo`. Borra firmas del cierre. Estado destino siempre = `pendiente_firma`.
10. **Firma de cierre**: cada firmante solo puede firmar el slot que le corresponde según su rol y asignación. Aeronave requiere las 3 firmas para pasar a `cerrada`; otros tipos requieren 2.

---

## 4. Modularización de `ordenesController.js`

El archivo actual tiene **1101 líneas con 16 handlers**. Se parte en **6 sub-controllers** por sub-recurso, dejando un router índice que los compone.

### 4.1 Nueva estructura

```
backend/src/
├── routes/
│   └── ordenes.js                          # router índice — compone los sub-routers
├── middleware/
│   └── upload.js                           # multer extraído
└── controllers/
    └── ordenes/
        ├── ordenesController.js            # listar, obtener, crear, actualizarEstado
        ├── workflowController.js           # recepcionar, iniciarMantenimiento, asignar, archivar, eliminar, reabrir (NUEVO)
        ├── resultadosController.js         # actualizarResultado, firmarResultado
        ├── fotosController.js              # subirFoto, eliminarFoto
        ├── cierreController.js             # gestionarCierre, firmarCierre
        └── pdfController.js                # generarPDF
```

### 4.2 Mapeo handler → archivo nuevo

| Handler actual | Archivo nuevo |
|---|---|
| `listar`, `obtener`, `crear`, `actualizarEstado` | `ordenesController.js` |
| `recepcionarAeronave` → `recepcionar`, `iniciarMantenimiento`, `asignarOrden`, `archivar`, `eliminar`, **`reabrir`** | `workflowController.js` |
| `actualizarResultado`, `firmarResultado` | `resultadosController.js` |
| `subirFoto`, `eliminarFoto` | `fotosController.js` |
| `gestionarCierre`, `firmarCierre` | `cierreController.js` |
| `generarPDF` | `pdfController.js` |

> Renombre adicional: `recepcionarAeronave` → `recepcionar` (ya no es solo aeronave).

### 4.3 Router índice (routes/ordenes.js)

```js
import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import * as ordenes    from '../controllers/ordenes/ordenesController.js'
import * as workflow   from '../controllers/ordenes/workflowController.js'
import * as resultados from '../controllers/ordenes/resultadosController.js'
import * as fotos      from '../controllers/ordenes/fotosController.js'
import * as cierre     from '../controllers/ordenes/cierreController.js'
import * as pdf        from '../controllers/ordenes/pdfController.js'

const router = Router()
router.use(verifyToken)

// CRUD base
router.get('/',           ordenes.listar)
router.get('/:id',        ordenes.obtener)
router.post('/',          requireRole(['gerente_soporte','ingeniero_soporte']), ordenes.crear)
router.patch('/:id/estado', requireRole(['gerente_soporte','ingeniero_soporte']), ordenes.actualizarEstado)

// Workflow
router.post('/:id/recepcion',              workflow.recepcionar)
router.post('/:id/iniciar-mantenimiento',  workflow.iniciarMantenimiento)
router.patch('/:id/asignacion',            requireRole(['gerente_soporte']), workflow.asignar)
router.patch('/:id/archivar',              requireRole(['gerente_soporte']), workflow.archivar)
router.delete('/:id',                      requireRole(['gerente_soporte']), workflow.eliminar)
router.post('/:id/reabrir',                requireRole(['gerente_soporte']), workflow.reabrir)

// Resultados / fotos / cierre / PDF
router.patch('/:id/puntos/:resultadoId',                     resultados.actualizar)
router.post( '/:id/puntos/:resultadoId/firmar',              resultados.firmar)
router.post( '/:id/puntos/:resultadoId/fotos', upload.single('foto'), fotos.subir)
router.delete('/:id/puntos/:resultadoId/fotos/:fotoId',      fotos.eliminar)
router.post( '/:id/cierre',         cierre.gestionar)
router.post( '/:id/cierre/firmar',  cierre.firmar)
router.get(  '/:id/pdf',            pdf.generar)

export default router
```

### 4.4 Multer extraído

`middleware/upload.js` exporta el `upload` de multer (hoy mezclado en `routes/ordenes.js`). Esto deja al router limpio y permite reusar multer en otros endpoints futuros (ej. logo de empresa, firma física).

### 4.5 Servicio sigue siendo uno solo

`ordenesService.js` (351 líneas) **no se parte**. Es la capa de acceso a Prisma y dividirla introduce indirección sin valor. Sí se renombran funciones para reflejar los conceptos nuevos (`crearOrden` acepta `productoId` y los 4-5 IDs de asignación, etc.).

---

## 5. Migración desde el schema actual

> Datos solo de prueba — la migración puede ser destructiva. Aun así se diseña para preservar lo migrable.

### 5.1 Una sola migración Prisma con SQL crudo

```sql
-- 1. Renombrar enum Rol y agregar valores nuevos
ALTER TABLE usuarios ALTER COLUMN rol TYPE TEXT;
DROP TYPE "Rol";
CREATE TYPE "Rol" AS ENUM ('gerente_soporte','ingeniero_soporte','tecnico_soporte','mecanico','piloto');
UPDATE usuarios SET rol = CASE rol
  WHEN 'supervisor' THEN 'gerente_soporte'
  WHEN 'ingeniero'  THEN 'ingeniero_soporte'
  WHEN 'tecnico'    THEN 'tecnico_soporte'
  ELSE rol
END;
ALTER TABLE usuarios ALTER COLUMN rol TYPE "Rol" USING rol::"Rol";
ALTER TABLE usuarios ADD COLUMN superusuario BOOLEAN DEFAULT false;

-- 2. Crear nuevo enum TipoProducto
CREATE TYPE "TipoProducto" AS ENUM ('aeronave','camion','planta','sensor');

-- 3. Migrar 'modelos_aeronave' → 'modelos'
CREATE TABLE modelos (
  id TEXT PRIMARY KEY,
  tipo_producto "TipoProducto" NOT NULL DEFAULT 'aeronave',
  nombre TEXT NOT NULL,
  fabricante TEXT,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (tipo_producto, nombre)
);
INSERT INTO modelos (id, tipo_producto, nombre, fabricante, descripcion, created_at)
SELECT id, 'aeronave', nombre, fabricante, descripcion, created_at FROM modelos_aeronave;

-- 4. Migrar 'aeronaves' → 'productos' + 'aeronave_detalle'
CREATE TABLE productos (
  id TEXT PRIMARY KEY,
  tipo_producto "TipoProducto" NOT NULL,
  modelo_id TEXT NOT NULL REFERENCES modelos(id),
  identificador TEXT NOT NULL,
  numero_serie TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (tipo_producto, identificador)
);
INSERT INTO productos (id, tipo_producto, modelo_id, identificador, numero_serie, activo, created_at, updated_at)
SELECT id, 'aeronave', modelo_id, matricula, numero_serie, activa, created_at, updated_at FROM aeronaves;

CREATE TABLE aeronave_detalle (
  producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  horas_totales DOUBLE PRECISION DEFAULT 0,
  horas_motor_der DOUBLE PRECISION DEFAULT 0,
  horas_motor_izq DOUBLE PRECISION DEFAULT 0
);
INSERT INTO aeronave_detalle (producto_id, horas_totales, horas_motor_der, horas_motor_izq)
SELECT id, horas_totales, horas_motor_der, horas_motor_izq FROM aeronaves;

-- 5. Crear tablas de detalle vacías para los demás tipos
CREATE TABLE camion_detalle (
  producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  placas TEXT NOT NULL UNIQUE,
  vin TEXT UNIQUE,
  odometro DOUBLE PRECISION DEFAULT 0
);
CREATE TABLE planta_detalle (
  producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  horimetro DOUBLE PRECISION DEFAULT 0
);
CREATE TABLE sensor_detalle (
  producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  fabricante TEXT,
  version_firmware TEXT,
  fecha_calibracion TIMESTAMP
);

-- 6. Formato gana tipo_producto
ALTER TABLE formatos ADD COLUMN tipo_producto "TipoProducto" NOT NULL DEFAULT 'aeronave';

-- 7. Renombres y nuevas columnas en ordenes_trabajo
ALTER TABLE ordenes_trabajo RENAME COLUMN aeronave_id          TO producto_id;
ALTER TABLE ordenes_trabajo RENAME COLUMN matricula_recepcion  TO identificador_recepcion;
ALTER TABLE ordenes_trabajo RENAME COLUMN tecnico_id           TO soporte_id;
ALTER TABLE ordenes_trabajo RENAME COLUMN supervisor_id        TO gerente_id;
ALTER TABLE ordenes_trabajo
  ADD COLUMN ingeniero_auxiliar_id TEXT REFERENCES usuarios(id),
  ADD COLUMN mecanico_id           TEXT REFERENCES usuarios(id), -- backfill obligatorio antes de NOT NULL
  ADD COLUMN piloto_id             TEXT REFERENCES usuarios(id),
  ADD COLUMN odometro              DOUBLE PRECISION,
  ADD COLUMN horimetro             DOUBLE PRECISION,
  ALTER COLUMN horas_totales   DROP NOT NULL,
  ALTER COLUMN horas_motor_der DROP NOT NULL,
  ALTER COLUMN horas_motor_izq DROP NOT NULL;

-- gerente_id era nullable (supervisor_id lo era). Como ahora es obligatorio,
-- backfill: si hay O/T sin gerente, asignar el primer gerente activo. Mismo para mecanico_id.
UPDATE ordenes_trabajo SET gerente_id = (
  SELECT id FROM usuarios WHERE rol = 'gerente_soporte' AND activo = true LIMIT 1
) WHERE gerente_id IS NULL;
UPDATE ordenes_trabajo SET mecanico_id = (
  SELECT id FROM usuarios WHERE rol = 'mecanico' AND activo = true LIMIT 1
) WHERE mecanico_id IS NULL;
ALTER TABLE ordenes_trabajo
  ALTER COLUMN gerente_id  SET NOT NULL,
  ALTER COLUMN mecanico_id SET NOT NULL;

-- 8. cierre_ot — renombres y tercera firma
ALTER TABLE cierre_ot RENAME COLUMN firma_tecnico_id      TO firma_soporte_id;
ALTER TABLE cierre_ot RENAME COLUMN fecha_firma_tecnico   TO fecha_firma_soporte;
ALTER TABLE cierre_ot RENAME COLUMN firma_supervisor_id   TO firma_gerente_id;
ALTER TABLE cierre_ot RENAME COLUMN fecha_firma_supervisor TO fecha_firma_gerente;
ALTER TABLE cierre_ot
  ADD COLUMN firma_piloto_id   TEXT REFERENCES usuarios(id),
  ADD COLUMN fecha_firma_piloto TIMESTAMP;

-- 9. Nueva tabla historial_estados_ot
CREATE TABLE historial_estados_ot (
  id TEXT PRIMARY KEY,
  orden_id TEXT NOT NULL REFERENCES ordenes_trabajo(id),
  estado_anterior "EstadoOT" NOT NULL,
  estado_nuevo    "EstadoOT" NOT NULL,
  motivo TEXT,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_historial_estados_orden ON historial_estados_ot(orden_id);

-- 10. Reapuntar FK en puntos_excluidos_por_modelo
ALTER TABLE puntos_excluidos_por_modelo
  DROP CONSTRAINT IF EXISTS puntos_excluidos_por_modelo_modelo_id_fkey,
  ADD  CONSTRAINT puntos_excluidos_por_modelo_modelo_id_fkey
    FOREIGN KEY (modelo_id) REFERENCES modelos(id);

-- 11. Drop de tablas viejas
DROP TABLE aeronaves;
DROP TABLE modelos_aeronave;
```

### 5.2 Orden de ejecución

1. Editar `schema.prisma` con los modelos nuevos.
2. `npx prisma migrate dev --name multiproducto_y_roles` en local.
3. Ajustar `seed.js`:
   - Roles renombrados.
   - Crear superusuario `dev@aeromx.com` (`superusuario: true`).
   - Crear usuarios: 1 gerente, 1 ingeniero soporte, 1 técnico soporte, 1 mecánico, 1 piloto.
   - Crear un modelo+producto de cada tipo (aeronave, camión, planta, sensor) para QA.
   - Crear un formato por tipo con 1-2 secciones de muestra.
4. `npm run db:seed`.

---

## 6. API — endpoints nuevos y renombrados

### 6.1 Catálogos

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/api/modelos?tipoProducto=aeronave` | autenticado | filtro por tipo |
| POST | `/api/modelos` | gerente \| ingeniero | requiere `tipoProducto` |
| PUT | `/api/modelos/:id` | gerente \| ingeniero | no permite cambiar `tipoProducto` |
| DELETE | `/api/modelos/:id` | gerente \| ingeniero | 409 si tiene productos |

**Productos** (reemplaza `/api/aeronaves`):

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/api/productos?tipoProducto=camion&activo=true` | autenticado | |
| GET | `/api/productos/:id` | autenticado | retorna producto + detalle |
| POST | `/api/productos` | gerente \| ingeniero | body `{ tipoProducto, modeloId, identificador, numeroSerie, detalle: {…} }` |
| PUT | `/api/productos/:id` | gerente \| ingeniero | no permite cambiar tipo |
| DELETE | `/api/productos/:id` | gerente \| ingeniero | soft delete |

### 6.2 Formatos

Sin cambios de ruta. El body acepta y filtra por `tipoProducto`:
- `GET /api/formatos?tipoProducto=planta`
- `POST /api/formatos` requiere `tipoProducto`.
- Permisos: `gerente_soporte | ingeniero_soporte` para crear/editar/borrar.

### 6.3 Usuarios

Sin cambios de ruta. El permiso de escritura es **solo `gerente_soporte`** (no `ingeniero_soporte`). El body de POST/PUT acepta el flag `superusuario` (solo gerente o superusuario actual puede activarlo).

### 6.4 Órdenes

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/api/ordenes` | gerente \| ingeniero | body usa `productoId` y los 4-5 IDs de asignación |
| PATCH | `/api/ordenes/:id/asignacion` | gerente | reasigna cualquier responsable (incl. mecánico) |
| POST | `/api/ordenes/:id/recepcion` | soporte/auxiliar/gerente asignado | valida `identificador` contra producto |
| POST | `/api/ordenes/:id/iniciar-mantenimiento` | soporte/auxiliar/gerente asignado | acepta lecturas según tipo |
| POST | `/api/ordenes/:id/puntos/:resultadoId/firmar` | soporte/auxiliar/mecánico/gerente asignado | mecánico solo firma, no edita |
| POST | `/api/ordenes/:id/cierre/firmar` | soporte/gerente/piloto asignado | el body especifica el slot a firmar |
| **POST** | **`/api/ordenes/:id/reabrir`** | **gerente** | **NUEVO — body `{ motivo }`. Vuelve siempre a `pendiente_firma`.** |

---

## 7. Frontend — navegación, selector de tipo y form de O/T

### 7.1 Patrón

Se mantienen 3 páginas (`/flota`, `/modelos`, `/formatos`) y cada una agrega una **barra de pestañas de tipo de producto** persistida en query string:

```
/flota?tipo=aeronave|camion|planta|sensor
/modelos?tipo=...
/formatos?tipo=...
```

Botones de "Nuevo X" abren un formulario distinto según la pestaña activa.

### 7.2 Renombre de páginas

- `AeronavesPage` → `ProductosPage`. Tabs por tipo + sub-componentes `<FormularioAeronave>`, `<FormularioCamion>`, `<FormularioPlanta>`, `<FormularioSensor>`.
- `ModelosPage` agrega tabs (form casi idéntico para los 4: nombre + fabricante + descripción).
- `FormatosPage` agrega tabs (cada formato es de un solo tipo).
- `Header` cambia "Aeronaves" → "Productos".

### 7.3 Permisos UI

- Ítems del header se muestran/ocultan según rol:
  - **Productos / Modelos / Formatos**: gerente_soporte, ingeniero_soporte (o superusuario).
  - **Usuarios**: gerente_soporte (o superusuario).
  - **Flota / Órdenes**: todos los roles autenticados.
- Botones "Reabrir", "Archivar", "Eliminar", "Reasignar" en `DashboardPage` / `InspeccionPage`: solo gerente_soporte (o superusuario).
- Botón "Firmar como piloto" en `CierreOTPage`: solo si `producto.tipoProducto === 'aeronave'` y `usuario.rol === 'piloto'` y `usuario.id === orden.pilotoId`.

### 7.4 Form de creación de O/T (`CrearOTPage`)

Sección de asignación con **4 selectores fijos + 1 condicional + 1 opcional**:

```
Asignación de responsables
├── Soporte * (técnico o ingeniero — selector de Usuario filtrado por rol ∈ {tecnico_soporte, ingeniero_soporte})
├── Ingeniero auxiliar (visible y opcional solo si "Soporte" seleccionado es técnico)
├── Mecánico * (selector filtrado por rol = mecanico)
├── Gerente * (selector filtrado por rol = gerente_soporte)
└── Piloto * (visible y obligatorio solo si tipoProducto = aeronave; rol = piloto)
```

> Validación cliente + servidor. El supervisor que crea la O/T no se autoasigna; siempre elige explícitamente.

### 7.5 PDF dinámico por tipo

`RENDER_POR_TIPO` en `pdfController.js` (o helper):

```js
const RENDER_POR_TIPO = {
  aeronave: { titulo: 'Datos de aeronave', filas: ['Matrícula','Modelo','Serie','Horas totales','Horas motor der','Horas motor izq'] },
  camion:   { titulo: 'Datos del camión',   filas: ['Placas','Modelo','VIN','Serie','Odómetro'] },
  planta:   { titulo: 'Datos de la planta', filas: ['Serie','Modelo','Horímetro'] },
  sensor:   { titulo: 'Datos del sensor',   filas: ['Serie','Modelo','Fabricante','Firmware','Calibración'] },
}
```

Bloque de firmas: si `tipoProducto === 'aeronave'`, muestra **3 firmas** (soporte + gerente + piloto). Resto: **2 firmas** (soporte + gerente).

Bloque de asignación en el header del PDF: muestra los 4-5 responsables (soporte / auxiliar si existe / mecánico / gerente / piloto si aplica).

---

## 8. Plan de implementación por fases

> Cada fase es una sesión cerrable. Backend y frontend van juntos para que el `dev` no quede roto entre fases.

### Fase A — Schema + roles + migración + seed
- [ ] Editar `schema.prisma` completo (roles, multiproducto, asignaciones, historial, cierre con piloto).
- [ ] Migración SQL combinada.
- [ ] Ajustar `seed.js`: usuarios por rol, superusuario, productos/modelos/formatos de cada tipo.
- [ ] Actualizar `middleware/auth.js`: `requireRole` deja pasar siempre si `usuario.superusuario === true`.
- ✅ Done cuando: `migrate dev` corre limpio, `db:seed` repuebla, la app actual queda rota a propósito.

### Fase B — Backend: modularizar controller + servicios multiproducto
- [ ] Mover `ordenesController.js` a `controllers/ordenes/*.js` (6 archivos).
- [ ] Extraer `multer` a `middleware/upload.js`.
- [ ] Adaptar router índice `routes/ordenes.js`.
- [ ] `productosService.js` con dispatcher por tipo.
- [ ] `productosController.js` + `routes/productos.js`. Eliminar `aeronaves.js` viejo.
- [ ] Adaptar `modelosService` para `tipoProducto`.
- [ ] Adaptar `formatosService` para `tipoProducto`.
- [ ] Adaptar `ordenesService.crearOrden`: validar 4-5 asignaciones obligatorias + coherencia de tipo + roles correctos.
- [ ] Adaptar `iniciarMantenimiento` para guardar lecturas según tipo.
- [ ] Implementar `reabrir` + `historial_estados_ot` (siempre vuelve a `pendiente_firma`).
- [ ] Adaptar `firmarCierre` para aceptar firma de soporte / gerente / piloto según slot.
- [ ] Sincronizar lectura del producto al cerrar.
- [ ] PDF dinámico por tipo + 3 firmas condicionales + bloque de asignaciones.
- ✅ Done cuando: smoke test cURL para crear/iniciar/cerrar O/T en los 4 tipos pasa.

### Fase C — Frontend: catálogos por tipo + permisos
- [ ] `productosService.js` (frontend) reemplaza `aeronavesService.js`.
- [ ] `ProductosPage` con tabs + 4 formularios.
- [ ] `ModelosPage` y `FormatosPage` con tabs.
- [ ] `Header`: rename "Aeronaves" → "Productos" + visibilidad por rol.
- [ ] `FlotaPage` con selector de tipo.
- [ ] `UsuariosPage`: agregar checkbox `superusuario` + soporte para los 5 roles nuevos.
- ✅ Done cuando: alta de un camión, planta y sensor desde la UI.

### Fase D — Frontend: O/T multiproducto + asignaciones + reapertura
- [ ] `CrearOTPage`: selector de tipo → carga modelos+productos+formatos del tipo. Sección de asignación con 4-5 selectores. Quita inputs de horas.
- [ ] `InspeccionPage`: panel de "Iniciar mantenimiento" pide lecturas según tipo. Header muestra atributos correctos. Sección "Historial de estados" desplegable.
- [ ] `CierreOTPage`: si aeronave, muestra slot de firma de piloto; el botón solo aparece para el usuario asignado al slot que falta firmar.
- [ ] `DashboardPage`: tarjeta muestra `identificador` correcto. Botón "Reabrir" para gerente.
- [ ] Modal de reapertura con campo `motivo` requerido (sin selector de estado).
- ✅ Done cuando: un gerente puede crear O/T para un camión, asignar a 4 responsables, completar el flujo, cerrar, reabrir, y descargar PDF.

### Fase E — Pulido y QA
- [ ] Copy/etiquetas por tipo.
- [ ] Validaciones de form (rol del seleccionado, exclusión de auxiliar cuando soporte es ingeniero).
- [ ] Histórico de estados visible en `InspeccionPage`.
- [ ] Actualizar `CLAUDE.md` con resumen de Sesión 10.

---

## 9. Decisiones tomadas (todas resueltas)

| # | Tema | Resolución |
|---|---|---|
| 1 | Aeronave puede cerrarse sin piloto | **No.** La firma de piloto siempre es obligatoria en aeronave. Sin checkbox de excepción. |
| 2 | Cuándo se asigna mecánico | **Al crear la O/T.** La asignación es obligatoria de los 4 responsables (5 si es aeronave). Si soporte es técnico, opcionalmente se incluye un ingeniero auxiliar. |
| 3 | Múltiples mecánicos por O/T | **Uno solo.** Cambiable vía endpoint de reasignación (gerente). |
| 4 | Endpoint dedicado de histórico de lecturas | **No.** La serie temporal de odómetro/horímetro/horas se deriva con un query sobre las O/T cerradas del producto cuando se necesite. No se crea endpoint todavía. |
| 5 | Estado destino al reabrir | **Siempre `pendiente_firma`.** El histórico queda registrado en `historial_estados_ot` con motivo. La O/T necesita las firmas otra vez para cerrarse. |

---

## 10. Riesgos identificados

- **Datos de prueba**: confirmado que se pueden perder. La migración igual está diseñada para preservar lo migrable; si en el futuro hay datos reales, la misma migración sirve sin cambios.
- **Cliente Prisma**: tras la migración hay que regenerar (`npx prisma generate`) o el backend tira `Unknown argument`. Ya documentado en `CLAUDE.md`.
- **Compatibilidad de tokens JWT viejos**: tras renombrar el enum `Rol`, los tokens emitidos con `rol: 'supervisor'` ya no validarán. Forzar logout o invalidar `JWT_SECRET` tras la migración.
- **Frontend que llame al endpoint viejo de `/api/aeronaves`**: dejar de soportar la ruta vieja y migrar el frontend en la misma fase para evitar 404s en QA.
- **Backfill obligatorio del mecánico en O/T existentes**: la migración asigna el primer mecánico activo a las O/T sin asignar para poder hacer la columna NOT NULL. Si no hay ningún mecánico en la BD al momento de migrar, el seed debe crear el mecánico **antes** de la migración o la migración fallará. Solución: seed primero, migración después; o asignar nullable temporalmente y backfill manual.

---

## 11. Resumen ejecutivo

| Cambio | Tipo | Impacto |
|---|---|---|
| Roles renombrados + 2 nuevos + flag `superusuario` | Schema + middleware | medio |
| Tabla `productos` + `*_detalle` por tipo | Schema | medio |
| `OrdenTrabajo`: `productoId` + 4-5 asignaciones obligatorias | Schema | medio |
| `CierreOT`: tercera firma (piloto) obligatoria en aeronave | Schema | bajo |
| `historial_estados_ot` + endpoint `reabrir` | Schema + backend | bajo |
| Modularización `ordenesController.js` (6 archivos) | Backend | bajo (refactor mecánico) |
| Servicios y controllers `productosService` | Backend | medio |
| Páginas con tabs por tipo + permisos por rol + form de O/T con asignación múltiple | Frontend | medio-alto |
| PDF dinámico por tipo + 3 firmas condicionales | Backend | bajo |

**Tiempo estimado**: 3-4 sesiones (A: schema+roles+seed · B: backend completo · C: catálogos UI · D: O/T UI + reapertura · E: pulido).
