# Registro de Fallas — Fase 1 (Fundación) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir crear, clasificar, asignar, resolver y descargar en PDF reportes de falla de forma manual, sobre la arquitectura multiproducto existente.

**Architecture:** Entidad ligera `ReporteFalla` con catálogo `CategoriaFalla`, fotos propias (`FotoFalla`) reusando la capa de storage, y un discriminador `tipoFormato` en `Formato`. El PDF del reporte reusa `pdf/theme.js` + `pdf/ui.js` (estética HYDRA). Backend Express + Prisma; frontend React + Vite.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, React, Vite, Tailwind, pdfkit. Sin dependencias nuevas en Fase 1 (recharts/exceljs son de Fase 3).

> **Spec:** [`docs/superpowers/specs/2026-05-25-registro-de-fallas-design.md`](../specs/2026-05-25-registro-de-fallas-design.md). Leer §3 (modelo), §4 (reglas) y §6 (API) antes de empezar.

> **Verificación (sin test runner):** cada tarea se verifica con `npm run build` (frontend), arranque del backend, query a Postgres y/o `curl` contra `:3001`. Login de prueba superusuario: `dev@aeromx.com / aeromx123`.

> **Setup:** `cd aeromx && docker compose up -d` (Postgres :5433 + MinIO). Backend `cd backend && npm run dev` (:3001). Frontend `cd frontend && npm run dev` (:5173).

---

## ⚠️ Reglas de base de datos (LEER — la BD de dev tiene datos reales)

- **NUNCA** `prisma migrate reset` ni `npm run db:seed`. La BD de dev tiene formatos reales (181 puntos).
- Respaldar con `pg_dump` antes de migrar (Tarea 1).
- Migración **a mano** (no `migrate diff`, que recrearía enums). Aplicar con `prisma migrate deploy`.
- **Detener el backend** antes de `npx prisma generate` (EPERM si la DLL está bloqueada en Windows).
- `prisma/migrations/` está en `.gitignore`: la migración no se versiona con el commit (confirmar con el usuario si versionarla).

---

## File Structure

**Backend (crear):**
- `aeromx/backend/prisma/migrations/20260525130000_registro_fallas/migration.sql` — migración a mano.
- `aeromx/backend/src/services/categoriasFallaService.js` — CRUD catálogo.
- `aeromx/backend/src/controllers/categoriasFallaController.js`
- `aeromx/backend/src/routes/categoriasFalla.js`
- `aeromx/backend/src/services/fallasService.js` — lógica de `ReporteFalla` + `numeroFalla`.
- `aeromx/backend/src/controllers/fallas/fallasController.js` — listar, obtener, crear.
- `aeromx/backend/src/controllers/fallas/workflowController.js` — asignarResponsable, resolver.
- `aeromx/backend/src/controllers/fallas/fotosController.js` — subir, eliminar.
- `aeromx/backend/src/controllers/fallas/pdfController.js` — generar PDF.
- `aeromx/backend/src/routes/fallas.js` — router índice.

**Backend (modificar):**
- `aeromx/backend/prisma/schema.prisma` — enums + modelos + relaciones inversas.
- `aeromx/backend/src/index.js` — registrar routers `/api/fallas` y `/api/categorias-falla`.
- `aeromx/backend/src/services/formatosService.js` — filtro `tipoFormato` + validación `categoriaFallaId`.

**Frontend (crear):**
- `aeromx/frontend/src/api/categoriasFallaService.js`
- `aeromx/frontend/src/api/fallasService.js`
- `aeromx/frontend/src/pages/CategoriasFallaPage.jsx`
- `aeromx/frontend/src/pages/CrearFallaPage.jsx`
- `aeromx/frontend/src/pages/FallasPage.jsx`
- `aeromx/frontend/src/pages/FallaDetallePage.jsx`

**Frontend (modificar):**
- `aeromx/frontend/src/tokens/design.js` — labels/colores de severidad, estado, origen.
- `aeromx/frontend/src/pages/FormatosPage.jsx` — distinguir tipo de formato + selector categoría.
- `aeromx/frontend/src/components/Header.jsx` — ítem "Fallas".
- `aeromx/frontend/src/App.jsx` — rutas nuevas.

---

## Task 1: Migración del schema (enums + tablas + columnas)

**Files:**
- Modify: `aeromx/backend/prisma/schema.prisma`
- Create: `aeromx/backend/prisma/migrations/20260525130000_registro_fallas/migration.sql`

- [ ] **Step 1: Respaldar la BD**

Run (desde `aeromx/backend`):
```bash
node -e "console.log(process.env.DATABASE_URL)" # confirmar URL
mkdir -p backups
pg_dump "$DATABASE_URL" > "backups/aeromx_backup_$(date +%Y%m%d_%H%M%S).sql"
```
Expected: archivo `.sql` creado en `backups/` con tamaño > 0.

- [ ] **Step 2: Editar `schema.prisma` — agregar enums**

Agregar después del enum `EstadoRevision` (línea ~47):
```prisma
enum TipoFormato {
  mantenimiento
  falla
}

enum SeveridadFalla {
  baja
  media
  alta
  critica
}

enum EstadoFalla {
  detectada
  en_proceso
  resuelta
}

enum OrigenFalla {
  mantenimiento
  prevuelo
  operacion
}
```

- [ ] **Step 3: Editar `schema.prisma` — `Formato` gana tipoFormato + categoría**

En `model Formato`, agregar campos (después de `activo`):
```prisma
  tipoFormato      TipoFormato @default(mantenimiento) @map("tipo_formato")
  categoriaFallaId String?     @map("categoria_falla_id")
```
Y en las relaciones del mismo modelo:
```prisma
  categoriaFalla CategoriaFalla? @relation(fields: [categoriaFallaId], references: [id])
  reportesFalla  ReporteFalla[]
```

- [ ] **Step 4: Editar `schema.prisma` — modelos nuevos**

Agregar al final del archivo:
```prisma
model CategoriaFalla {
  id          String   @id @default(uuid())
  nombre      String   @unique
  descripcion String?
  color       String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")

  formatos Formato[]
  fallas   ReporteFalla[]

  @@map("categorias_falla")
}

model ReporteFalla {
  id          String         @id @default(uuid())
  numeroFalla String         @unique @map("numero_falla")
  productoId  String         @map("producto_id")
  formatoId   String         @map("formato_id")
  categoriaId String         @map("categoria_id")
  severidad   SeveridadFalla
  origen      OrigenFalla
  componente  String?
  titulo      String
  descripcion String
  estado      EstadoFalla    @default(detectada)

  ordenOrigenId     String? @map("orden_origen_id")
  resultadoOrigenId String? @map("resultado_origen_id")

  reportadoPorId String  @map("reportado_por_id")
  responsableId  String? @map("responsable_id")

  accionCorrectiva  String?   @map("accion_correctiva")
  fechaResolucion   DateTime? @map("fecha_resolucion")
  resueltoPorId     String?   @map("resuelto_por_id")
  ordenCorrectivaId String?   @map("orden_correctiva_id")

  fechaDeteccion DateTime @default(now()) @map("fecha_deteccion")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  producto        Producto        @relation(fields: [productoId], references: [id])
  formato         Formato         @relation(fields: [formatoId], references: [id])
  categoria       CategoriaFalla  @relation(fields: [categoriaId], references: [id])
  ordenOrigen     OrdenTrabajo?   @relation("FallaOrdenOrigen", fields: [ordenOrigenId], references: [id])
  resultadoOrigen ResultadoPunto? @relation(fields: [resultadoOrigenId], references: [id])
  ordenCorrectiva OrdenTrabajo?   @relation("FallaOrdenCorrectiva", fields: [ordenCorrectivaId], references: [id])
  reportadoPor    Usuario         @relation("FallaReportadoPor", fields: [reportadoPorId], references: [id])
  responsable     Usuario?        @relation("FallaResponsable", fields: [responsableId], references: [id])
  resueltoPor     Usuario?        @relation("FallaResueltoPor", fields: [resueltoPorId], references: [id])
  fotos           FotoFalla[]

  @@index([productoId])
  @@index([categoriaId])
  @@index([estado])
  @@map("reportes_falla")
}

model FotoFalla {
  id             String    @id @default(uuid())
  reporteFallaId String    @map("reporte_falla_id")
  urlArchivo     String    @map("url_archivo")
  nombreArchivo  String    @map("nombre_archivo")
  tamanoBytes    Int?      @map("tamano_bytes")
  subidaPor      String    @map("subida_por")
  fechaCaptura   DateTime? @map("fecha_captura")
  createdAt      DateTime  @default(now()) @map("created_at")

  reporte ReporteFalla @relation(fields: [reporteFallaId], references: [id], onDelete: Cascade)
  usuario Usuario      @relation("FotoFallaSubida", fields: [subidaPor], references: [id])

  @@index([reporteFallaId])
  @@map("fotos_falla")
}
```

- [ ] **Step 5: Editar `schema.prisma` — relaciones inversas**

En `model Usuario` agregar:
```prisma
  fallasReportadas       ReporteFalla[] @relation("FallaReportadoPor")
  fallasComoResponsable  ReporteFalla[] @relation("FallaResponsable")
  fallasResueltas        ReporteFalla[] @relation("FallaResueltoPor")
  fotosFallaSubidas      FotoFalla[]    @relation("FotoFallaSubida")
```
En `model Producto` agregar: `reportesFalla ReporteFalla[]`
En `model ResultadoPunto` agregar: `reportesFalla ReporteFalla[]`
En `model OrdenTrabajo` agregar:
```prisma
  fallasOrigen     ReporteFalla[] @relation("FallaOrdenOrigen")
  fallasCorrectiva ReporteFalla[] @relation("FallaOrdenCorrectiva")
```

- [ ] **Step 6: Escribir la migración SQL a mano**

Crear `prisma/migrations/20260525130000_registro_fallas/migration.sql`:
```sql
-- Enums
CREATE TYPE "TipoFormato" AS ENUM ('mantenimiento', 'falla');
CREATE TYPE "SeveridadFalla" AS ENUM ('baja', 'media', 'alta', 'critica');
CREATE TYPE "EstadoFalla" AS ENUM ('detectada', 'en_proceso', 'resuelta');
CREATE TYPE "OrigenFalla" AS ENUM ('mantenimiento', 'prevuelo', 'operacion');

-- Formato: discriminador + categoría
ALTER TABLE "formatos"
  ADD COLUMN "tipo_formato" "TipoFormato" NOT NULL DEFAULT 'mantenimiento',
  ADD COLUMN "categoria_falla_id" TEXT;

-- Catálogo de categorías
CREATE TABLE "categorias_falla" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL UNIQUE,
  "descripcion" TEXT,
  "color" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reportes de falla
CREATE TABLE "reportes_falla" (
  "id" TEXT PRIMARY KEY,
  "numero_falla" TEXT NOT NULL UNIQUE,
  "producto_id" TEXT NOT NULL,
  "formato_id" TEXT NOT NULL,
  "categoria_id" TEXT NOT NULL,
  "severidad" "SeveridadFalla" NOT NULL,
  "origen" "OrigenFalla" NOT NULL,
  "componente" TEXT,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "estado" "EstadoFalla" NOT NULL DEFAULT 'detectada',
  "orden_origen_id" TEXT,
  "resultado_origen_id" TEXT,
  "reportado_por_id" TEXT NOT NULL,
  "responsable_id" TEXT,
  "accion_correctiva" TEXT,
  "fecha_resolucion" TIMESTAMP(3),
  "resuelto_por_id" TEXT,
  "orden_correctiva_id" TEXT,
  "fecha_deteccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "reportes_falla_producto_id_idx" ON "reportes_falla"("producto_id");
CREATE INDEX "reportes_falla_categoria_id_idx" ON "reportes_falla"("categoria_id");
CREATE INDEX "reportes_falla_estado_idx" ON "reportes_falla"("estado");

-- Fotos de falla
CREATE TABLE "fotos_falla" (
  "id" TEXT PRIMARY KEY,
  "reporte_falla_id" TEXT NOT NULL,
  "url_archivo" TEXT NOT NULL,
  "nombre_archivo" TEXT NOT NULL,
  "tamano_bytes" INTEGER,
  "subida_por" TEXT NOT NULL,
  "fecha_captura" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "fotos_falla_reporte_falla_id_idx" ON "fotos_falla"("reporte_falla_id");

-- FKs
ALTER TABLE "formatos" ADD CONSTRAINT "formatos_categoria_falla_id_fkey"
  FOREIGN KEY ("categoria_falla_id") REFERENCES "categorias_falla"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_producto_id_fkey"
  FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_formato_id_fkey"
  FOREIGN KEY ("formato_id") REFERENCES "formatos"("id") ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_categoria_id_fkey"
  FOREIGN KEY ("categoria_id") REFERENCES "categorias_falla"("id") ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_orden_origen_id_fkey"
  FOREIGN KEY ("orden_origen_id") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_resultado_origen_id_fkey"
  FOREIGN KEY ("resultado_origen_id") REFERENCES "resultados_puntos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_orden_correctiva_id_fkey"
  FOREIGN KEY ("orden_correctiva_id") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_reportado_por_id_fkey"
  FOREIGN KEY ("reportado_por_id") REFERENCES "usuarios"("id") ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_responsable_id_fkey"
  FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_resuelto_por_id_fkey"
  FOREIGN KEY ("resuelto_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fotos_falla" ADD CONSTRAINT "fotos_falla_reporte_falla_id_fkey"
  FOREIGN KEY ("reporte_falla_id") REFERENCES "reportes_falla"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fotos_falla" ADD CONSTRAINT "fotos_falla_subida_por_fkey"
  FOREIGN KEY ("subida_por") REFERENCES "usuarios"("id") ON UPDATE CASCADE;
```

- [ ] **Step 7: Aplicar la migración y regenerar el cliente**

Detener el backend primero (Ctrl+C en la terminal de `npm run dev`). Luego desde `aeromx/backend`:
```bash
npx prisma migrate deploy
npx prisma generate
```
Expected: `migrate deploy` aplica `20260525130000_registro_fallas`; `generate` termina sin EPERM.

- [ ] **Step 8: Verificar las tablas en Postgres**

Run:
```bash
psql "$DATABASE_URL" -c "\dt categorias_falla" -c "\dt reportes_falla" -c "\dt fotos_falla" -c "\d formatos" | grep tipo_formato
```
Expected: las 3 tablas existen y `formatos` tiene la columna `tipo_formato`.

- [ ] **Step 9: Commit**

```bash
git add aeromx/backend/prisma/schema.prisma
git commit -m "feat(fallas): schema de registro de fallas (enums + CategoriaFalla + ReporteFalla + FotoFalla)"
```
> Nota: la carpeta `migrations/` está en `.gitignore`; preguntar al usuario si versionar `migration.sql`.

---

## Task 2: Catálogo CategoriaFalla (servicio + controller + rutas)

**Files:**
- Create: `aeromx/backend/src/services/categoriasFallaService.js`
- Create: `aeromx/backend/src/controllers/categoriasFallaController.js`
- Create: `aeromx/backend/src/routes/categoriasFalla.js`
- Modify: `aeromx/backend/src/index.js`

- [ ] **Step 1: Servicio**

Crear `categoriasFallaService.js`:
```js
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
  if (!cat) { const e = new Error('Categoría no encontrada'); e.status = 404; throw e }
  if (cat._count.fallas > 0 || cat._count.formatos > 0) {
    const e = new Error('No se puede eliminar: la categoría tiene fallas o formatos asociados')
    e.status = 409; throw e
  }
  return prisma.categoriaFalla.delete({ where: { id } })
}
```

- [ ] **Step 2: Controller**

Crear `categoriasFallaController.js`:
```js
import * as service from '../services/categoriasFallaService.js'

export async function listar(req, res, next) {
  try {
    const soloActivas = req.query.activo === 'true'
    res.json(await service.listar({ soloActivas }))
  } catch (e) { next(e) }
}
export async function crear(req, res, next) {
  try { res.status(201).json(await service.crear(req.body)) } catch (e) { next(e) }
}
export async function actualizar(req, res, next) {
  try { res.json(await service.actualizar(req.params.id, req.body)) } catch (e) { next(e) }
}
export async function eliminar(req, res, next) {
  try { await service.eliminar(req.params.id); res.status(204).end() } catch (e) { next(e) }
}
```

- [ ] **Step 3: Rutas**

Crear `routes/categoriasFalla.js`:
```js
import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import * as ctrl from '../controllers/categoriasFallaController.js'

const router = Router()
router.use(verifyToken)
const ESCRITURA = requireRole(['gerente_soporte', 'ingeniero_soporte'])

router.get('/', ctrl.listar)
router.post('/', ESCRITURA, ctrl.crear)
router.put('/:id', ESCRITURA, ctrl.actualizar)
router.delete('/:id', ESCRITURA, ctrl.eliminar)

export default router
```

- [ ] **Step 4: Registrar en `index.js`**

En `aeromx/backend/src/index.js`, junto a los otros `app.use('/api/...')`:
```js
import categoriasFallaRouter from './routes/categoriasFalla.js'
app.use('/api/categorias-falla', categoriasFallaRouter)
```

- [ ] **Step 5: Verificar vía API**

Arrancar backend (`npm run dev`). Login y crear/listar:
```bash
TOKEN=$(curl -s localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dev@aeromx.com","password":"aeromx123"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -X POST localhost:3001/api/categorias-falla -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"nombre":"Eléctrica","color":"#f59e0b"}'
curl -s localhost:3001/api/categorias-falla -H "Authorization: Bearer $TOKEN"
```
Expected: POST → 201 con la categoría; GET → array con "Eléctrica".

- [ ] **Step 6: Commit**

```bash
git add aeromx/backend/src/services/categoriasFallaService.js aeromx/backend/src/controllers/categoriasFallaController.js aeromx/backend/src/routes/categoriasFalla.js aeromx/backend/src/index.js
git commit -m "feat(fallas): CRUD de catálogo de categorías de falla"
```

---

## Task 3: Formato — filtro tipoFormato + validación de categoría

**Files:**
- Modify: `aeromx/backend/src/services/formatosService.js`

- [ ] **Step 1: Leer el servicio actual**

Run: abrir `aeromx/backend/src/services/formatosService.js` y localizar `listarFormatos` y `crearFormato`.

- [ ] **Step 2: Agregar filtro `tipoFormato` en `listarFormatos`**

En `listarFormatos({ tipoProducto, soloActivos })`, agregar `tipoFormato` al destructuring y al `where`:
```js
export async function listarFormatos({ tipoProducto, tipoFormato, soloActivos } = {}) {
  return prisma.formato.findMany({
    where: {
      ...(tipoProducto ? { tipoProducto } : {}),
      ...(tipoFormato ? { tipoFormato } : {}),
      ...(soloActivos ? { activo: true } : {}),
    },
    include: { categoriaFalla: true, _count: { select: { secciones: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
```
> Ajustar `include`/`orderBy` a lo que ya tenga el archivo; lo clave es agregar `tipoFormato` al `where` y `categoriaFalla` al include.

- [ ] **Step 3: Validar coherencia en `crearFormato`**

En `crearFormato(data)`, antes del `prisma.formato.create`, agregar:
```js
const tipoFormato = data.tipoFormato || 'mantenimiento'
if (tipoFormato === 'falla' && !data.categoriaFallaId) {
  const e = new Error('Un formato de falla requiere categoriaFallaId'); e.status = 400; throw e
}
if (tipoFormato === 'mantenimiento' && data.categoriaFallaId) {
  const e = new Error('Un formato de mantenimiento no lleva categoriaFallaId'); e.status = 400; throw e
}
```
Y asegurarse de pasar `tipoFormato` y `categoriaFallaId` al `data` del create.

- [ ] **Step 4: Verificar vía API**

```bash
# falla sin categoría → 400
curl -s -X POST localhost:3001/api/formatos -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"tipoProducto":"aeronave","tipoFormato":"falla","nombre":"Falla eléctrica","version":"1.0","fechaVersion":"2026-05-25"}'
# listar solo formatos de falla
curl -s "localhost:3001/api/formatos?tipoFormato=falla" -H "Authorization: Bearer $TOKEN"
```
Expected: el primero → 400 con mensaje de categoría; el GET filtra por tipo.

- [ ] **Step 5: Commit**

```bash
git add aeromx/backend/src/services/formatosService.js
git commit -m "feat(fallas): Formato distingue tipoFormato y valida categoría de falla"
```

---

## Task 4: fallasService — numeroFalla + crear/listar/obtener

**Files:**
- Create: `aeromx/backend/src/services/fallasService.js`

- [ ] **Step 1: Generador de numeroFalla + crear**

Crear `fallasService.js`:
```js
import prisma from '../lib/prisma.js'

async function generarNumeroFalla() {
  const hoy = new Date()
  const ymd = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
  const prefijo = `RF-${ymd}-`
  const ultima = await prisma.reporteFalla.findFirst({
    where: { numeroFalla: { startsWith: prefijo } },
    orderBy: { numeroFalla: 'desc' },
    select: { numeroFalla: true },
  })
  const consecutivo = ultima ? parseInt(ultima.numeroFalla.slice(prefijo.length), 10) + 1 : 1
  return `${prefijo}${String(consecutivo).padStart(4, '0')}`
}

const ROLES_RESPONSABLE = ['tecnico_soporte', 'ingeniero_soporte', 'mecanico', 'gerente_soporte']

export async function crearFalla(data, usuarioActual) {
  const { productoId, formatoId, categoriaId, severidad, origen, componente, titulo, descripcion,
          ordenOrigenId, resultadoOrigenId } = data

  const formato = await prisma.formato.findUnique({ where: { id: formatoId } })
  if (!formato) { const e = new Error('Formato no encontrado'); e.status = 404; throw e }
  if (formato.tipoFormato !== 'falla') { const e = new Error('El formato no es de tipo falla'); e.status = 400; throw e }

  const producto = await prisma.producto.findUnique({ where: { id: productoId } })
  if (!producto) { const e = new Error('Producto no encontrado'); e.status = 404; throw e }
  if (formato.tipoProducto !== producto.tipoProducto) {
    const e = new Error('El tipo del formato no coincide con el del producto'); e.status = 400; throw e
  }

  const categoriaFinal = categoriaId || formato.categoriaFallaId
  if (!categoriaFinal) { const e = new Error('Falta categoría'); e.status = 400; throw e }
  if (!severidad) { const e = new Error('Falta severidad'); e.status = 400; throw e }
  if (!origen) { const e = new Error('Falta origen'); e.status = 400; throw e }

  const numeroFalla = await generarNumeroFalla()

  return prisma.$transaction(async (tx) => {
    const falla = await tx.reporteFalla.create({
      data: {
        numeroFalla,
        producto: { connect: { id: productoId } },
        formato: { connect: { id: formatoId } },
        categoria: { connect: { id: categoriaFinal } },
        severidad, origen, componente, titulo, descripcion,
        reportadoPor: { connect: { id: usuarioActual.id } },
        ...(ordenOrigenId ? { ordenOrigen: { connect: { id: ordenOrigenId } } } : {}),
        ...(resultadoOrigenId ? { resultadoOrigen: { connect: { id: resultadoOrigenId } } } : {}),
      },
    })
    // Auto-llenado de refDocCorrectivo si viene de mantenimiento (Fase 2 también lo usa)
    if (ordenOrigenId) {
      const cierre = await tx.cierreOT.findUnique({ where: { ordenId: ordenOrigenId } })
      const refPrev = cierre?.refDocCorrectivo?.trim()
      const nuevaRef = refPrev ? `${refPrev}, ${numeroFalla}` : numeroFalla
      await tx.cierreOT.upsert({
        where: { ordenId: ordenOrigenId },
        update: { refDocCorrectivo: nuevaRef, seEncontroDefecto: true },
        create: { ordenId: ordenOrigenId, seEncontroDefecto: true, refDocCorrectivo: nuevaRef },
      })
    }
    return falla
  })
}

export { generarNumeroFalla, ROLES_RESPONSABLE }
```

- [ ] **Step 2: listar + obtener (mismo archivo)**

Agregar:
```js
const INCLUDE_FALLA = {
  producto: { include: { modelo: true } },
  formato: true,
  categoria: true,
  reportadoPor: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
  responsable: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
  resueltoPor: { select: { id: true, nombre: true, rol: true, licenciaNum: true } },
  ordenOrigen: { select: { id: true, numeroOt: true } },
  ordenCorrectiva: { select: { id: true, numeroOt: true } },
  fotos: true,
}

export async function listarFallas(filtros = {}) {
  const { productoId, modeloId, categoriaId, severidad, estado, origen, desde, hasta } = filtros
  return prisma.reporteFalla.findMany({
    where: {
      ...(productoId ? { productoId } : {}),
      ...(modeloId ? { producto: { modeloId } } : {}),
      ...(categoriaId ? { categoriaId } : {}),
      ...(severidad ? { severidad } : {}),
      ...(estado ? { estado } : {}),
      ...(origen ? { origen } : {}),
      ...(desde || hasta ? { fechaDeteccion: { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) } } : {}),
    },
    include: INCLUDE_FALLA,
    orderBy: { fechaDeteccion: 'desc' },
  })
}

export async function obtenerFalla(id) {
  const falla = await prisma.reporteFalla.findUnique({ where: { id }, include: INCLUDE_FALLA })
  if (!falla) { const e = new Error('Falla no encontrada'); e.status = 404; throw e }
  return falla
}

export { INCLUDE_FALLA }
```

- [ ] **Step 3: Verificar (sintaxis, sin endpoint todavía)**

Run: `cd aeromx/backend && node --check src/services/fallasService.js`
Expected: sin salida (sintaxis OK).

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/services/fallasService.js
git commit -m "feat(fallas): servicio de reportes (numeroFalla, crear, listar, obtener)"
```

---

## Task 5: fallasController + workflow (asignar/resolver) + rutas

**Files:**
- Create: `aeromx/backend/src/controllers/fallas/fallasController.js`
- Create: `aeromx/backend/src/controllers/fallas/workflowController.js`
- Create: `aeromx/backend/src/routes/fallas.js`
- Modify: `aeromx/backend/src/services/fallasService.js` (asignar + resolver)
- Modify: `aeromx/backend/src/index.js`

- [ ] **Step 1: asignarResponsable + resolver en el servicio**

Agregar a `fallasService.js`:
```js
export async function asignarResponsable(id, responsableId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: responsableId } })
  if (!usuario || !usuario.activo) { const e = new Error('Responsable inválido'); e.status = 400; throw e }
  if (!ROLES_RESPONSABLE.includes(usuario.rol)) {
    const e = new Error('El responsable debe ser soporte, mecánico o gerente'); e.status = 400; throw e
  }
  return prisma.reporteFalla.update({
    where: { id },
    data: { responsable: { connect: { id: responsableId } }, estado: 'en_proceso' },
    include: INCLUDE_FALLA,
  })
}

export async function resolverFalla(id, { accionCorrectiva, ordenCorrectivaId }, usuarioActual) {
  if (!accionCorrectiva || !accionCorrectiva.trim()) {
    const e = new Error('La acción correctiva es obligatoria'); e.status = 400; throw e
  }
  return prisma.reporteFalla.update({
    where: { id },
    data: {
      estado: 'resuelta',
      accionCorrectiva,
      fechaResolucion: new Date(),
      resueltoPor: { connect: { id: usuarioActual.id } },
      ...(ordenCorrectivaId ? { ordenCorrectiva: { connect: { id: ordenCorrectivaId } } } : {}),
    },
    include: INCLUDE_FALLA,
  })
}
```

- [ ] **Step 2: fallasController**

Crear `controllers/fallas/fallasController.js`:
```js
import * as service from '../../services/fallasService.js'

export async function listar(req, res, next) {
  try { res.json(await service.listarFallas(req.query)) } catch (e) { next(e) }
}
export async function obtener(req, res, next) {
  try { res.json(await service.obtenerFalla(req.params.id)) } catch (e) { next(e) }
}
export async function crear(req, res, next) {
  try { res.status(201).json(await service.crearFalla(req.body, req.user)) } catch (e) { next(e) }
}
```

- [ ] **Step 3: workflowController**

Crear `controllers/fallas/workflowController.js`:
```js
import * as service from '../../services/fallasService.js'
import prisma from '../../lib/prisma.js'

export async function asignarResponsable(req, res, next) {
  try { res.json(await service.asignarResponsable(req.params.id, req.body.responsableId)) } catch (e) { next(e) }
}

export async function resolver(req, res, next) {
  try {
    const falla = await prisma.reporteFalla.findUnique({ where: { id: req.params.id } })
    if (!falla) { return res.status(404).json({ error: 'Falla no encontrada' }) }
    const u = req.user
    const permitido = u.superusuario || u.rol === 'gerente_soporte' ||
      ['tecnico_soporte', 'ingeniero_soporte'].includes(u.rol) || u.id === falla.responsableId
    if (!permitido) { return res.status(403).json({ error: 'No autorizado para resolver esta falla' }) }
    res.json(await service.resolverFalla(req.params.id, req.body, u))
  } catch (e) { next(e) }
}
```

- [ ] **Step 4: Router índice (incluye fotos y pdf que se crean en Tareas 6 y 7)**

Crear `routes/fallas.js`:
```js
import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import * as fallas from '../controllers/fallas/fallasController.js'
import * as workflow from '../controllers/fallas/workflowController.js'
import * as fotos from '../controllers/fallas/fotosController.js'
import * as pdf from '../controllers/fallas/pdfController.js'

const router = Router()
router.use(verifyToken)

router.get('/', fallas.listar)
router.get('/:id', fallas.obtener)
router.post('/', fallas.crear)
router.patch('/:id/responsable', requireRole(['gerente_soporte']), workflow.asignarResponsable)
router.post('/:id/resolver', workflow.resolver)
router.post('/:id/fotos', upload.single('foto'), fotos.subir)
router.delete('/:id/fotos/:fotoId', fotos.eliminar)
router.get('/:id/pdf', pdf.generar)

export default router
```
> Las Tareas 6 y 7 crean `fotosController.js` y `pdfController.js`. Para que el backend arranque ahora, crear stubs temporales o implementar Tareas 6 y 7 antes de registrar el router. **Recomendado:** implementar 6 y 7 y registrar el router en `index.js` al final de la Tarea 7. En esta tarea, dejar `routes/fallas.js` escrito pero comentar los imports de fotos/pdf y sus rutas hasta la Tarea 7.

- [ ] **Step 5: Verificar crear/listar/asignar/resolver vía API**

Con `routes/fallas.js` registrado (imports de fotos/pdf comentados temporalmente) en `index.js`:
```js
import fallasRouter from './routes/fallas.js'
app.use('/api/fallas', fallasRouter)
```
Necesitas una categoría (Tarea 2) y un formato de falla. Crea el formato de falla:
```bash
CAT=$(curl -s localhost:3001/api/categorias-falla -H "Authorization: Bearer $TOKEN" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -X POST localhost:3001/api/formatos -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"tipoProducto\":\"aeronave\",\"tipoFormato\":\"falla\",\"categoriaFallaId\":\"$CAT\",\"nombre\":\"Reporte de falla eléctrica\",\"version\":\"1.0\",\"fechaVersion\":\"2026-05-25\"}"
```
Obtén un `productoId` (aeronave) y un `formatoId` falla, luego:
```bash
curl -s -X POST localhost:3001/api/fallas -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productoId\":\"<PROD>\",\"formatoId\":\"<FMT>\",\"categoriaId\":\"$CAT\",\"severidad\":\"alta\",\"origen\":\"prevuelo\",\"titulo\":\"Luz de nav intermitente\",\"descripcion\":\"...\"}"
curl -s localhost:3001/api/fallas -H "Authorization: Bearer $TOKEN"
```
Expected: POST → 201 con `numeroFalla` `RF-YYYYMMDD-0001`; GET lista la falla. Probar `PATCH /:id/responsable` (con un usuario mecánico) → `estado: en_proceso`; `POST /:id/resolver` con `accionCorrectiva` → `estado: resuelta`.

- [ ] **Step 6: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/ aeromx/backend/src/routes/fallas.js aeromx/backend/src/services/fallasService.js aeromx/backend/src/index.js
git commit -m "feat(fallas): endpoints crear/listar/obtener/asignar/resolver"
```

---

## Task 6: Fotos de falla (controller, reusa storage)

**Files:**
- Create: `aeromx/backend/src/controllers/fallas/fotosController.js`

- [ ] **Step 1: Leer el patrón existente**

Run: abrir `aeromx/backend/src/controllers/ordenes/fotosController.js` para copiar el patrón de `storage.put`/`storage.delete` y `keyDesdeUrl`.

- [ ] **Step 2: fotosController de fallas**

Crear `controllers/fallas/fotosController.js` (espejo del de órdenes, con `reporteFallaId`):
```js
import prisma from '../../lib/prisma.js'
import * as storage from '../../lib/storage/index.js'
import { keyDesdeUrl } from '../../lib/storage/helpers.js'

export async function subir(req, res, next) {
  try {
    const { id } = req.params
    if (!req.file) { return res.status(400).json({ error: 'No se recibió archivo' }) }
    const falla = await prisma.reporteFalla.findUnique({ where: { id } })
    if (!falla) { return res.status(404).json({ error: 'Falla no encontrada' }) }
    const { key } = await storage.put({
      buffer: req.file.buffer, contentType: req.file.mimetype, originalName: req.file.originalname,
    })
    const foto = await prisma.fotoFalla.create({
      data: {
        reporte: { connect: { id } },
        urlArchivo: `/uploads/${key}`,
        nombreArchivo: req.file.originalname,
        tamanoBytes: req.file.size,
        usuario: { connect: { id: req.user.id } },
        fechaCaptura: new Date(),
      },
    })
    res.status(201).json(foto)
  } catch (e) { next(e) }
}

export async function eliminar(req, res, next) {
  try {
    const { fotoId } = req.params
    const foto = await prisma.fotoFalla.findUnique({ where: { id: fotoId } })
    if (!foto) { return res.status(404).json({ error: 'Foto no encontrada' }) }
    await prisma.fotoFalla.delete({ where: { id: fotoId } })
    try { await storage.delete(keyDesdeUrl(foto.urlArchivo)) } catch { /* la key puede ser compartida con un punto */ }
    res.status(204).end()
  } catch (e) { next(e) }
}
```
> Nota: la key puede estar compartida con una `FotoInspeccion` (foto heredada de un punto en Fase 2). El `try/catch` alrededor de `storage.delete` evita romper si la key ya no existe; documentado como deuda en la spec §8.

- [ ] **Step 3: Verificar subida/listado vía API**

Descomentar imports/rutas de fotos en `routes/fallas.js`. Reiniciar backend.
```bash
curl -s -X POST localhost:3001/api/fallas/<FALLA_ID>/fotos -H "Authorization: Bearer $TOKEN" -F "foto=@/ruta/a/imagen.png"
curl -s localhost:3001/api/fallas/<FALLA_ID> -H "Authorization: Bearer $TOKEN" | grep urlArchivo
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "localhost:3001/uploads/<KEY>" # 200 image/png
```
Expected: POST → 201; el GET de la falla trae la foto; `/uploads/:key` sirve la imagen.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/fotosController.js aeromx/backend/src/routes/fallas.js
git commit -m "feat(fallas): subida y borrado de fotos de falla (reusa storage)"
```

---

## Task 7: PDF del reporte de falla (estética HYDRA)

**Files:**
- Create: `aeromx/backend/src/controllers/fallas/pdfController.js`
- Modify: `aeromx/backend/src/index.js` (registrar router con pdf activo)

- [ ] **Step 1: Estudiar el PDF de O/T**

Run: abrir `aeromx/backend/src/controllers/ordenes/pdfController.js` y `aeromx/backend/src/pdf/ui.js`. Identificar: `registerFonts`, `COLOR`/`font`, `sectionHead`, `kvGrid`, `personCard`, `statusPill`, `signatureCard`, `roundedPanel`, `evidenceGallery`, `precargarFotos`, y el bloque por tipo de producto (`filasDatosProducto`).

- [ ] **Step 2: pdfController de fallas**

Crear `controllers/fallas/pdfController.js` reusando las primitivas. Estructura: cabecera (logo + meta), título + `numeroFalla` mono + status pill por estado; §01 datos del producto (reusar el bloque por tipo, o un `kvGrid` con identificador/modelo/serie); §02 clasificación (categoría, severidad, origen, componente); §03 descripción; §04 person cards (Reportado por / Responsable / Resuelto por); §05 acción correctiva + enlace O/T correctiva; §06 galería de fotos; §07 signature card de resolución. Footer "Página N de M".
```js
import PDFDocument from 'pdfkit'
import prisma from '../../lib/prisma.js'
import * as storage from '../../lib/storage/index.js'
import { registerFonts, font, COLOR, fmtFecha, fmtFechaHora } from '../../pdf/theme.js'
import { sectionHead, kvGrid, personCard, statusPill, signatureCard, evidenceGallery } from '../../pdf/ui.js'
import { INCLUDE_FALLA } from '../../services/fallasService.js'

const SEVERIDAD_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
const ESTADO_LABEL = { detectada: 'Detectada', en_proceso: 'En proceso', resuelta: 'Resuelta' }
const ORIGEN_LABEL = { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }

async function precargarFotos(fotos) {
  const map = new Map()
  for (const f of fotos) {
    try {
      const key = f.urlArchivo.replace('/uploads/', '')
      map.set(f.urlArchivo, await storage.getBuffer(key))
    } catch { /* placeholder si falla */ }
  }
  return map
}

export async function generar(req, res, next) {
  try {
    const falla = await prisma.reporteFalla.findUnique({ where: { id: req.params.id }, include: INCLUDE_FALLA })
    if (!falla) { return res.status(404).json({ error: 'Falla no encontrada' }) }
    const buffers = await precargarFotos(falla.fotos)

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
    registerFonts(doc)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${falla.numeroFalla}.pdf"`)
    doc.pipe(res)

    // Cabecera + título + status pill (reusar helpers del PDF de O/T como referencia)
    // §01 Datos del producto, §02 Clasificación, §03 Descripción, §04 Personas,
    // §05 Resolución, §06 Fotos (evidenceGallery con buffers), §07 firma de resolución.
    // Usar sectionHead/kvGrid/personCard/statusPill/signatureCard de pdf/ui.js.

    doc.end()
  } catch (e) { next(e) }
}
```
> El cuerpo (dibujo sección por sección) debe replicar el orden y las primitivas del PDF de O/T para que la estética sea idéntica. Reutilizar exactamente `sectionHead`, `kvGrid`, `personCard`, `statusPill`, `signatureCard`, `evidenceGallery` y los colores de `theme.COLOR`. No forkear estilos.

- [ ] **Step 3: Activar router pdf y verificar**

En `routes/fallas.js` descomentar el import/ruta de `pdf`. Reiniciar backend.
```bash
curl -s -o /tmp/falla.pdf -w "%{content_type}\n" "localhost:3001/api/fallas/<FALLA_ID>/pdf" -H "Authorization: Bearer $TOKEN"
head -c 5 /tmp/falla.pdf   # debe imprimir %PDF-
```
Expected: `application/pdf`, archivo empieza con `%PDF-`. Abrir el PDF y verificar que la estética coincide con la del PDF de O/T.

- [ ] **Step 4: Commit**

```bash
git add aeromx/backend/src/controllers/fallas/pdfController.js aeromx/backend/src/routes/fallas.js
git commit -m "feat(fallas): PDF del reporte de falla con estética HYDRA"
```

---

## Task 8: Frontend — tokens de severidad/estado/origen

**Files:**
- Modify: `aeromx/frontend/src/tokens/design.js`

- [ ] **Step 1: Agregar labels y colores**

Agregar al final de `design.js`:
```js
export const SEVERIDAD = {
  baja:    { label: 'Baja',    color: '#22c55e' },
  media:   { label: 'Media',   color: '#eab308' },
  alta:    { label: 'Alta',    color: '#f97316' },
  critica: { label: 'Crítica', color: '#ef4444' },
}
export const ESTADO_FALLA = {
  detectada:  { label: 'Detectada',  color: '#3b82f6' },
  en_proceso: { label: 'En proceso', color: '#eab308' },
  resuelta:   { label: 'Resuelta',   color: '#22c55e' },
}
export const ORIGEN_FALLA = {
  mantenimiento: { label: 'Mantenimiento' },
  prevuelo:      { label: 'Prevuelo' },
  operacion:     { label: 'Operación' },
}
export const SEVERIDADES = Object.entries(SEVERIDAD).map(([value, v]) => ({ value, ...v }))
export const ORIGENES_FALLA = Object.entries(ORIGEN_FALLA).map(([value, v]) => ({ value, ...v }))
```

- [ ] **Step 2: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build verde (sin errores de import).

- [ ] **Step 3: Commit**

```bash
git add aeromx/frontend/src/tokens/design.js
git commit -m "feat(fallas): tokens de severidad, estado y origen"
```

---

## Task 9: Frontend — API services (categorías + fallas)

**Files:**
- Create: `aeromx/frontend/src/api/categoriasFallaService.js`
- Create: `aeromx/frontend/src/api/fallasService.js`

- [ ] **Step 1: Leer un service existente para el patrón**

Run: abrir `aeromx/frontend/src/api/productosService.js`. **Patrón real (confirmado):** import default `client` desde `./client`; se exporta un **objeto nombrado** (ej. `export const productosService = {...}`); cada método **devuelve la respuesta axios completa** (`client.get(...)`), **sin** `.then(r => r.data)`. Los componentes hacen `const { data } = await productosService.listar()`.

- [ ] **Step 2: categoriasFallaService**

Crear `api/categoriasFallaService.js` (mismo patrón que `productosService`):
```js
import client from './client'

export const categoriasFallaService = {
  listar: (params) => client.get('/categorias-falla', { params }),
  crear: (data) => client.post('/categorias-falla', data),
  actualizar: (id, data) => client.put(`/categorias-falla/${id}`, data),
  eliminar: (id) => client.delete(`/categorias-falla/${id}`),
}
```

- [ ] **Step 3: fallasService**

Crear `api/fallasService.js`:
```js
import client from './client'

export const fallasService = {
  listar: (params) => client.get('/fallas', { params }),
  obtener: (id) => client.get(`/fallas/${id}`),
  crear: (data) => client.post('/fallas', data),
  asignarResponsable: (id, responsableId) => client.patch(`/fallas/${id}/responsable`, { responsableId }),
  resolver: (id, data) => client.post(`/fallas/${id}/resolver`, data),
  subirFoto: (id, file) => {
    const fd = new FormData(); fd.append('foto', file)
    return client.post(`/fallas/${id}/fotos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  eliminarFoto: (id, fotoId) => client.delete(`/fallas/${id}/fotos/${fotoId}`),
  urlPDF: (id) => `/api/fallas/${id}/pdf`,
}
```
> Los componentes consumen la respuesta como `const { data } = await fallasService.listar(params)`. Mantener este patrón en las Tareas 10–14.

- [ ] **Step 4: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build verde.

- [ ] **Step 5: Commit**

```bash
git add aeromx/frontend/src/api/categoriasFallaService.js aeromx/frontend/src/api/fallasService.js
git commit -m "feat(fallas): servicios API frontend (categorías + fallas)"
```

---

## Task 10: Frontend — Catálogo de categorías de falla

**Files:**
- Create: `aeromx/frontend/src/pages/CategoriasFallaPage.jsx`
- Modify: `aeromx/frontend/src/App.jsx` (ruta `/categorias-falla`)

- [ ] **Step 1: Leer una página CRUD existente**

Run: abrir `aeromx/frontend/src/pages/ModelosPage.jsx` para reusar el patrón de tabla + formulario + permisos (`esSupervisor`/gerente-ingeniero-super).

- [ ] **Step 2: CategoriasFallaPage**

Crear `pages/CategoriasFallaPage.jsx` con: tabla (nombre, descripción, color, # fallas, # formatos, activo), formulario de alta/edición (nombre, descripción, color picker), botón eliminar (deshabilitado si tiene asociadas → maneja 409). Permiso de edición: `rol ∈ {gerente_soporte, ingeniero_soporte}` o `superusuario`. Usa `categoriasFallaService`.

- [ ] **Step 3: Ruta en App.jsx**

Agregar `<Route path="/categorias-falla" element={<CategoriasFallaPage />} />` junto a las otras rutas.

- [ ] **Step 4: Verificar build + manual**

Run: `cd aeromx/frontend && npm run build` (verde). Manual: abrir `/categorias-falla`, crear una categoría, verla en la tabla.

- [ ] **Step 5: Commit**

```bash
git add aeromx/frontend/src/pages/CategoriasFallaPage.jsx aeromx/frontend/src/App.jsx
git commit -m "feat(fallas): página de catálogo de categorías de falla"
```

---

## Task 11: Frontend — FormatosPage distingue tipo de formato

**Files:**
- Modify: `aeromx/frontend/src/pages/FormatosPage.jsx`

- [ ] **Step 1: Leer FormatosPage actual**

Run: abrir `aeromx/frontend/src/pages/FormatosPage.jsx`. Localizar tabs por tipo de producto, listado (`formatosService.listar`) y formulario de creación.

- [ ] **Step 2: Selector de tipo de formato + categoría**

Agregar un toggle "Tipo de formato" (Mantenimiento / Falla) que filtra el listado (`listar({ tipoProducto, tipoFormato })`). En el formulario de creación, cuando `tipoFormato === 'falla'`, mostrar un selector de **categoría** (de `categoriasFallaService.listar({ activo: true })`) obligatorio, y enviar `tipoFormato` + `categoriaFallaId` en el create. Mostrar la categoría como columna/badge en el listado de formatos falla.

- [ ] **Step 3: Verificar build + manual**

Run: `npm run build` (verde). Manual: crear un formato de falla con categoría; aparece bajo el toggle "Falla"; intentar sin categoría → error visible.

- [ ] **Step 4: Commit**

```bash
git add aeromx/frontend/src/pages/FormatosPage.jsx
git commit -m "feat(fallas): FormatosPage distingue mantenimiento vs falla + categoría"
```

---

## Task 12: Frontend — CrearFallaPage (manual)

**Files:**
- Create: `aeromx/frontend/src/pages/CrearFallaPage.jsx`
- Modify: `aeromx/frontend/src/App.jsx`

- [ ] **Step 1: Leer CrearOTPage para el patrón**

Run: abrir `aeromx/frontend/src/pages/CrearOTPage.jsx` (react-hook-form, selector de tipo de producto, carga de productos/formatos por tipo).

- [ ] **Step 2: CrearFallaPage**

Crear `pages/CrearFallaPage.jsx`: selector de tipo de producto → carga productos (`productosService.listar({ tipoProducto })`) y formatos falla (`formatosService.listar({ tipoProducto, tipoFormato: 'falla' })`). Campos: producto, formato-falla, categoría (default del formato, editable), severidad (`SEVERIDADES`), origen (`ORIGENES_FALLA`, sin `mantenimiento` en el manual → solo prevuelo/operación), componente (texto), título, descripción, fotos (subida tras crear). Submit → `fallasService.crear`, luego permite subir fotos a la falla creada y redirige a `/fallas/:id`. Guard: cualquier usuario autenticado.

- [ ] **Step 3: Ruta + verificar**

Agregar `<Route path="/fallas/nueva" element={<CrearFallaPage />} />`. Run `npm run build` (verde). Manual: crear una falla manual de aeronave; redirige al detalle.

- [ ] **Step 4: Commit**

```bash
git add aeromx/frontend/src/pages/CrearFallaPage.jsx aeromx/frontend/src/App.jsx
git commit -m "feat(fallas): página de creación manual de reporte de falla"
```

---

## Task 13: Frontend — FallasPage (lista con filtros)

**Files:**
- Create: `aeromx/frontend/src/pages/FallasPage.jsx`
- Modify: `aeromx/frontend/src/App.jsx`

- [ ] **Step 1: Leer DashboardPage para el patrón de lista + filtros**

Run: abrir `aeromx/frontend/src/pages/DashboardPage.jsx` (filtros, tarjetas, useMemo de búsqueda).

- [ ] **Step 2: FallasPage**

Crear `pages/FallasPage.jsx`: filtros (tipo de producto, categoría, severidad, estado, origen, búsqueda por número/título). Tarjetas o tabla con: `numeroFalla`, producto (`identificador`) + modelo, categoría (badge color), severidad (badge `SEVERIDAD`), estado (badge `ESTADO_FALLA`), fecha de detección, responsable. Botón "+ Nueva falla" → `/fallas/nueva`. Click en una fila → `/fallas/:id`. Usa `fallasService.listar`.

- [ ] **Step 3: Ruta + verificar**

Agregar `<Route path="/fallas" element={<FallasPage />} />`. Run `npm run build` (verde). Manual: la falla creada aparece; los filtros funcionan.

- [ ] **Step 4: Commit**

```bash
git add aeromx/frontend/src/pages/FallasPage.jsx aeromx/frontend/src/App.jsx
git commit -m "feat(fallas): listado de fallas con filtros"
```

---

## Task 14: Frontend — FallaDetallePage (ver, asignar, resolver, PDF)

**Files:**
- Create: `aeromx/frontend/src/pages/FallaDetallePage.jsx`
- Modify: `aeromx/frontend/src/App.jsx`

- [ ] **Step 1: Leer InspeccionPage / CierreOTPage para el patrón**

Run: abrir `aeromx/frontend/src/pages/CierreOTPage.jsx` (firma/resolución, modales) e `InspeccionPage.jsx` (galería de fotos, reasignación con modal).

- [ ] **Step 2: FallaDetallePage**

Crear `pages/FallaDetallePage.jsx` (ruta `/fallas/:id`): muestra todos los campos, timeline de estado, galería de fotos (subir/eliminar). Acciones según permiso:
- **Asignar responsable** (solo gerente/super): selector de usuario (roles soporte/mecánico/gerente) → `fallasService.asignarResponsable`.
- **Resolver** (responsable/soporte/gerente/super, si `estado !== 'resuelta'`): modal con `accionCorrectiva` (obligatoria) + selector opcional de O/T correctiva → `fallasService.resolver`.
- **Descargar PDF**: link a `fallasService.urlPDF(id)` con el token (igual que descarga de PDF de O/T en DashboardPage).

- [ ] **Step 3: Ruta + verificar**

Agregar `<Route path="/fallas/:id" element={<FallaDetallePage />} />`. Run `npm run build` (verde). Manual: abrir una falla, asignar responsable (estado → en proceso), resolver (estado → resuelta), descargar PDF.

- [ ] **Step 4: Commit**

```bash
git add aeromx/frontend/src/pages/FallaDetallePage.jsx aeromx/frontend/src/App.jsx
git commit -m "feat(fallas): detalle de falla (asignar, resolver, fotos, PDF)"
```

---

## Task 15: Frontend — Header "Fallas" + verificación e2e

**Files:**
- Modify: `aeromx/frontend/src/components/Header.jsx`

- [ ] **Step 1: Agregar ítem "Fallas" al Header**

Run: abrir `aeromx/frontend/src/components/Header.jsx`. Agregar link "Fallas" → `/fallas` (visible a todos los roles autenticados, igual que "Órdenes"/"Flota"). Si el catálogo de categorías va en el menú, mostrar "Categorías de falla" solo a gerente/ingeniero/super.

- [ ] **Step 2: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build verde (120+ módulos, sin errores).

- [ ] **Step 3: Smoke e2e manual completo**

Con backend + frontend arriba, login `dev@aeromx.com`:
1. Crear categoría de falla.
2. Crear formato de falla (aeronave) con esa categoría.
3. Crear falla manual (origen prevuelo) en `XB-ABC`, subir 1 foto.
4. Asignar responsable (mecánico) → estado "En proceso".
5. Resolver con acción correctiva → estado "Resuelta".
6. Descargar PDF → abre con estética HYDRA, foto embebida.
7. Verificar que aparece en `/fallas` y que los filtros (categoría/severidad/estado) funcionan.

Expected: los 7 pasos pasan sin error en consola del navegador ni del backend.

- [ ] **Step 4: Commit**

```bash
git add aeromx/frontend/src/components/Header.jsx
git commit -m "feat(fallas): navegación a Fallas en el Header + cierre de Fase 1"
```

---

## Self-Review (cobertura de la spec)

- §3.1 enums → Tarea 1 ✓ · §3.2 Formato.tipoFormato/categoría → Tareas 1, 3, 11 ✓
- §3.3 CategoriaFalla → Tareas 1, 2, 10 ✓ · ReporteFalla → Tareas 1, 4, 5 ✓ · FotoFalla → Tareas 1, 6 ✓
- §3.4 fotos (storage, copia por referencia) → Tarea 6 (la copia desde punto es Fase 2) ✓
- §3.5 migración a mano + pg_dump + deploy → Tarea 1 ✓
- §4 reglas (coherencia tipo, categoría, severidad/origen, estados, permisos, refDocCorrectivo, numeroFalla) → Tareas 4, 5 ✓
- §5 Fase 1 backend + frontend → Tareas 2–15 ✓
- §6 endpoints de Fase 1 → Tareas 2, 5, 6, 7 ✓ (estadísticas/export son Fase 3, no aquí)
- §7 dependencias: ninguna nueva en Fase 1 ✓ (recharts/exceljs son Fase 3)

**Nota de scope:** el auto-llenado de `refDocCorrectivo` (Tarea 4, paso 1) ya queda implementado en el servicio porque es trivial incluirlo, aunque el disparo desde la UI de mantenimiento (con copia de fotos del punto) es Fase 2.
