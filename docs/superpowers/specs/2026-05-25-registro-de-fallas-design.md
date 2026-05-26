# Registro de Fallas — Diseño (spec)

**Fecha:** 2026-05-25 · **Rama:** `development` · **Autor:** Simón Arellano + Claude

> Sistema para reportar, clasificar, resolver y analizar **fallas** de los productos
> (aeronave / gcs / planta / sensor_inteligencia). Se construye **encima** de la arquitectura
> multiproducto ya estable. Reutiliza el sistema de formatos y el renderer PDF (estética HYDRA).

---

## 1. Objetivo y alcance

Hoy un defecto encontrado en mantenimiento vive como texto: a nivel punto
(`ResultadoPunto.estadoResultado` ∈ `requiere_atencion | correcto_con_danos` + observación + fotos)
y a nivel cierre (`CierreOT.seEncontroDefecto` + `refDocCorrectivo`, texto libre). No hay un registro
estructurado de la falla, ni histórico, ni analítica.

Este diseño agrega un **registro de fallas** que cubre tres frentes:

1. **Reporte de falla manual** — desde un producto, para fallas detectadas en prevuelo u operación.
2. **Disparo automático desde mantenimiento** — al marcar un punto como defecto, se ofrece crear la
   falla pre-llenada y se enlaza al `refDocCorrectivo` del cierre.
3. **Histórico + analítica + exportación** — dashboard de gráficas, histórico por producto y por
   modelo, y descarga en Excel + PDF resumen.

**Fuera de alcance:** notificaciones email/push, modo offline, reportes DGAC. No se modifica el flujo
de O/T de mantenimiento (solo se le agrega el botón de "crear falla" y el auto-llenado del
`refDocCorrectivo`).

---

## 2. Decisiones de diseño (cerradas en brainstorming)

| Tema | Decisión |
|---|---|
| Modelo | Entidad ligera **`ReporteFalla`** que usa un **formato-de-falla** como plantilla y se renderiza con el **mismo PDF estético** (HYDRA) del mantenimiento. NO reusa el flujo pesado de O/T. |
| Clasificación | Catálogo configurable de **categorías** (`CategoriaFalla`) + **severidad** (enum) + **componente** afectado (texto, heredado del punto o elegido). |
| Disparo auto | Al marcar un punto como defecto, **con confirmación** y pre-llenado (componente, descripción, fotos heredadas). |
| Personas/firmas | **Reportado por** (auto) + **Responsable** (asignado por gerente) + firma de **resuelto por** al cerrar. |
| Resolución | Estados `detectada → en_proceso → resuelta`. Al resolver: **acción correctiva** + fecha + responsable + enlace **opcional** a la O/T que la corrigió. |
| Exportación | **Excel (.xlsx)** (dependencia nueva `exceljs`) + **PDF resumen con gráficas** (dibujadas con primitivas de `pdf/ui.js`, sin librería de charting en backend). |
| Gráficas frontend | **recharts** (dependencia nueva del frontend). |

**Por qué entidad ligera y no O/T:** una tabla con una fila por falla da analítica directa
(`GROUP BY categoria/severidad/modelo/...`), export trivial, y no entrelaza fallas con mantenimientos
en la misma tabla. El detalle del descarte de la opción "falla = O/T" está en el historial de
brainstorming de esta sesión.

---

## 3. Modelo de datos

### 3.1 Enums nuevos

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
  mantenimiento   // disparada desde un punto de una O/T
  prevuelo        // detectada en inspección pre/post vuelo
  operacion       // detectada durante la operación
}
```

### 3.2 Cambios a modelos existentes

**`Formato`** gana el discriminador y la categoría:

```prisma
model Formato {
  // ... campos actuales ...
  tipoFormato     TipoFormato @default(mantenimiento) @map("tipo_formato")
  categoriaFallaId String?    @map("categoria_falla_id")  // solo si tipoFormato = falla

  categoriaFalla  CategoriaFalla? @relation(fields: [categoriaFallaId], references: [id])
  reportesFalla   ReporteFalla[]
}
```

- Los formatos existentes quedan en `mantenimiento` (default en la migración).
- Un formato `falla` **debe** tener `categoriaFallaId`; uno `mantenimiento` debe tenerlo en `null`
  (validación a nivel servicio).

**`CierreOT`** — el `refDocCorrectivo` (texto) se conserva, pero se auto-rellena con los `numeroFalla`
generados. La relación formal falla→O/T vive en `ReporteFalla.ordenOrigenId` (1 O/T → N fallas).

### 3.3 Modelos nuevos

```prisma
model CategoriaFalla {
  id          String   @id @default(uuid())
  nombre      String   @unique
  descripcion String?
  color       String?  // para badges y gráficas
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")

  formatos Formato[]
  fallas   ReporteFalla[]

  @@map("categorias_falla")
}

model ReporteFalla {
  id          String         @id @default(uuid())
  numeroFalla String         @unique @map("numero_falla")   // RF-YYYYMMDD-000N

  // Clasificación
  productoId  String         @map("producto_id")
  formatoId   String         @map("formato_id")             // plantilla (tipoFormato = falla)
  categoriaId String         @map("categoria_id")           // default desde el formato
  severidad   SeveridadFalla
  origen      OrigenFalla
  componente  String?                                       // sistema/componente afectado

  // Contenido
  titulo      String
  descripcion String
  estado      EstadoFalla    @default(detectada)

  // Trazabilidad de origen en mantenimiento (cuando origen = mantenimiento)
  ordenOrigenId     String?  @map("orden_origen_id")
  resultadoOrigenId String?  @map("resultado_origen_id")

  // Personas
  reportadoPorId String       @map("reportado_por_id")
  responsableId  String?      @map("responsable_id")        // asignado por gerente

  // Resolución
  accionCorrectiva  String?   @map("accion_correctiva")
  fechaResolucion   DateTime? @map("fecha_resolucion")
  resueltoPorId     String?   @map("resuelto_por_id")
  ordenCorrectivaId String?   @map("orden_correctiva_id")   // O/T que la resolvió (opcional)

  fechaDeteccion DateTime @default(now()) @map("fecha_deteccion")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  producto        Producto        @relation(fields: [productoId], references: [id])
  formato         Formato         @relation(fields: [formatoId], references: [id])
  categoria       CategoriaFalla  @relation(fields: [categoriaId], references: [id])
  ordenOrigen     OrdenTrabajo?   @relation("FallaOrdenOrigen",     fields: [ordenOrigenId],     references: [id])
  resultadoOrigen ResultadoPunto? @relation(fields: [resultadoOrigenId], references: [id])
  ordenCorrectiva OrdenTrabajo?   @relation("FallaOrdenCorrectiva", fields: [ordenCorrectivaId], references: [id])
  reportadoPor    Usuario         @relation("FallaReportadoPor", fields: [reportadoPorId], references: [id])
  responsable     Usuario?        @relation("FallaResponsable",  fields: [responsableId],  references: [id])
  resueltoPor     Usuario?        @relation("FallaResueltoPor",  fields: [resueltoPorId],  references: [id])
  fotos           FotoFalla[]

  @@index([productoId])
  @@index([categoriaId])
  @@index([estado])
  @@map("reportes_falla")
}

model FotoFalla {
  id            String   @id @default(uuid())
  reporteFallaId String  @map("reporte_falla_id")
  urlArchivo    String   @map("url_archivo")
  nombreArchivo String   @map("nombre_archivo")
  tamanoBytes   Int?     @map("tamano_bytes")
  subidaPor     String   @map("subida_por")
  fechaCaptura  DateTime? @map("fecha_captura")
  createdAt     DateTime @default(now()) @map("created_at")

  reporte ReporteFalla @relation(fields: [reporteFallaId], references: [id], onDelete: Cascade)
  usuario Usuario      @relation("FotoFallaSubida", fields: [subidaPor], references: [id])

  @@index([reporteFallaId])
  @@map("fotos_falla")
}
```

> Relaciones inversas a agregar en `Usuario`, `Producto`, `OrdenTrabajo` y `ResultadoPunto`
> (`reportesFalla`, `fallasReportadas`, `fallasComoResponsable`, etc.). El detalle exacto se resuelve
> al editar el schema.

### 3.4 Manejo de fotos

`FotoFalla` es espejo de `FotoInspeccion` con `reporteFallaId` en vez de `resultadoId`. Reutiliza la
capa de storage (`src/lib/storage/`, MinIO/S3) y el endpoint de servido `GET /uploads/:key`.

Cuando la falla nace de un punto (origen = mantenimiento), se **copian las referencias** de las fotos
del punto: misma `urlArchivo`/key de storage, fila nueva en `fotos_falla`. No se duplica el binario en
el bucket; ambas filas apuntan a la misma key. (Si en el futuro se borra una, se debe verificar que la
otra no quede colgada — se documenta como nota, no se implementa borrado compartido ahora.)

### 3.5 Migración

- **Aditiva**, escrita a mano (no `migrate diff` que recrearía enums). Crea los 4 enums, las 2 tablas
  nuevas, y agrega columnas a `formatos`.
- Aplicar con `migrate deploy`. **Nunca** `migrate reset` ni `db:seed` (la BD de dev tiene formatos
  reales). Respaldo `pg_dump` previo a `backend/backups/`.
- Detener el backend antes de `prisma generate` (EPERM con la DLL bloqueada).
- `prisma/migrations/` está en `.gitignore` — decidir con el usuario si versionar la migración.

---

## 4. Reglas de negocio

1. **Coherencia de tipo de formato**: un `ReporteFalla.formatoId` debe apuntar a un formato con
   `tipoFormato = falla`. 400 si no.
2. **Coherencia de tipo de producto**: `formato.tipoProducto === producto.tipoProducto`. 400 si no.
3. **Categoría**: `categoriaId` por defecto se toma del formato; se puede sobreescribir al crear.
4. **Severidad y origen** son obligatorios al crear.
5. **Estados**: `detectada → en_proceso → resuelta`. Solo el gerente (o super) cambia a `en_proceso`
   al asignar responsable. Resolver (`→ resuelta`) requiere `accionCorrectiva` y registra
   `resueltoPorId` + `fechaResolucion`.
6. **Permisos**:
   - **Reportar (crear)**: cualquier usuario autenticado (un piloto en prevuelo, operador, etc.).
   - **Asignar responsable**: solo `gerente_soporte` (o super).
   - **Resolver**: el responsable asignado, soporte, gerente o super.
   - **Editar catálogo de categorías y formatos de falla**: `gerente_soporte | ingeniero_soporte` (o super).
7. **Auto-llenado `refDocCorrectivo`**: al crear una falla con `ordenOrigenId`, se agrega su
   `numeroFalla` al `refDocCorrectivo` del cierre de esa O/T (concatenado si ya hay otros).
8. **`numeroFalla`**: formato `RF-YYYYMMDD-000N`, secuencia diaria, igual estilo que `numeroOt`.

---

## 5. Fases de entrega

Cada fase = su propia spec breve (deriva de esta) → plan → implementación. El **modelo de datos
completo (§3) se crea en la Fase 1** porque es compartido; las fases 2 y 3 solo agregan lógica/UI.

### Fase 1 — Fundación (crear y gestionar fallas manualmente)

**Backend**
- Migración del schema completo (§3).
- CRUD `CategoriaFalla` (`/api/categorias-falla`), escritura gerente/ingeniero.
- `Formato`: filtro `?tipoFormato=falla`, validación de `categoriaFallaId` según `tipoFormato`.
- Servicio + controller `ReporteFalla`:
  - `crear` (manual): valida reglas §4, genera `numeroFalla`.
  - `listar` con filtros (producto, modelo, categoria, severidad, estado, origen, rango fechas).
  - `obtener`.
  - `asignarResponsable` (gerente) → pasa a `en_proceso`.
  - `resolver` (acción correctiva + firma + enlace O/T correctiva) → pasa a `resuelta`.
  - fotos: subir/eliminar (reusa storage + `middleware/upload.js`).
- `numeroFalla` generator.
- **PDF del reporte de falla** reusando `pdf/theme.js` + `pdf/ui.js`: header papel claro + logo,
  status pill por `estado`, datos del producto (reusa el bloque por tipo del PDF de O/T), person cards
  (reportado por / responsable / resuelto por), sección de descripción + acción correctiva, galería de
  fotos, signature card de resolución. Endpoint `GET /api/fallas/:id/pdf`.

**Frontend**
- `tokens/design.js`: labels/colores de `SeveridadFalla`, `EstadoFalla`, `OrigenFalla`.
- Catálogo de categorías de falla (página o sección dentro de `FormatosPage`).
- `FormatosPage`: distinguir formato mantenimiento vs falla (toggle/sección de tipo); al crear falla,
  selector de categoría.
- `CrearFallaPage` (manual): producto → formato-falla → categoría/severidad/origen/componente →
  título/descripción → fotos.
- `FallaDetallePage`: ver, asignar responsable (gerente), resolver, descargar PDF.
- `FallasPage` (lista con filtros).
- `Header`: ítem "Fallas" (visible a todos los roles autenticados).
- `api/fallasService.js`, `api/categoriasFallaService.js`.

### Fase 2 — Disparo automático desde mantenimiento

- `InspeccionPage`: cuando un punto está en `requiere_atencion`/`correcto_con_danos`, botón
  **"Crear reporte de falla"** → modal pre-llenado (componente del punto, observación → descripción,
  fotos heredadas, `origen = mantenimiento`, `ordenOrigenId`/`resultadoOrigenId`). El usuario elige
  formato-falla + categoría + severidad y confirma.
- Backend: el endpoint `crear` acepta el payload con origen mantenimiento → **copia las fotos del
  punto** a `fotos_falla` y **auto-rellena `refDocCorrectivo`** del cierre.
- Indicador en el punto de que ya tiene falla(s) asociada(s) (badge + número).

### Fase 3 — Histórico, analítica y exportación

- **Histórico por producto y por modelo**: sección de fallas en `FlotaPage` / detalle de producto.
- **Dashboard de fallas** (`FallasDashboardPage`) con filtros comunes (rango de fechas, tipo de
  producto, producto, modelo, categoría, severidad, estado, origen). Todas las gráficas y la tabla
  reaccionan a los filtros.
  - **KPIs**: total, abiertas vs resueltas, críticas abiertas, MTTR (días detección→resolución),
    % por origen.
  - **Gráficas**: (1) fallas por categoría [barras], (2) por severidad [dona], (3) top componentes
    [barras horizontales/Pareto], (4) tendencia temporal [línea/área], (5) por modelo [barras],
    (6) por producto [barras], (7) por origen [dona].
  - **Análisis derivados**: Pareto 80/20 de categorías/componentes, MTTR por categoría y severidad,
    embudo de estados.
  - **Tabla de detalle** filtrable y ordenable = lo que se exporta.
- Backend: endpoints de agregación `GET /api/fallas/estadisticas?...` (devuelve los datasets ya
  agrupados) y export.
- **Exportación**:
  - Excel `.xlsx` vía `exceljs`: pestaña resumen + pestaña detalle. `GET /api/fallas/export.xlsx`.
  - PDF resumen con gráficas dibujadas con primitivas de `pdf/ui.js` (barras = rectángulos),
    estética HYDRA. Incluye KPIs + gráficas 1–4. `GET /api/fallas/reporte.pdf`.
- Frontend: `recharts` para las gráficas interactivas.

---

## 6. API — endpoints nuevos

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/api/categorias-falla` | autenticado | lista |
| POST | `/api/categorias-falla` | gerente \| ingeniero | crear |
| PUT | `/api/categorias-falla/:id` | gerente \| ingeniero | editar |
| DELETE | `/api/categorias-falla/:id` | gerente \| ingeniero | 409 si tiene fallas/formatos |
| GET | `/api/fallas` | autenticado | filtros: producto, modelo, categoria, severidad, estado, origen, fechas |
| GET | `/api/fallas/:id` | autenticado | incluye fotos, personas, trazabilidad |
| POST | `/api/fallas` | autenticado | crear (manual o desde mantenimiento) |
| PATCH | `/api/fallas/:id/responsable` | gerente | asigna responsable → `en_proceso` |
| POST | `/api/fallas/:id/resolver` | responsable/soporte/gerente | acción correctiva + firma → `resuelta` |
| POST | `/api/fallas/:id/fotos` | autenticado | multipart, reusa storage |
| DELETE | `/api/fallas/:id/fotos/:fotoId` | autenticado | |
| GET | `/api/fallas/:id/pdf` | autenticado | PDF del reporte (estética HYDRA) |
| GET | `/api/fallas/estadisticas` | autenticado | datasets agregados para el dashboard (Fase 3) |
| GET | `/api/fallas/export.xlsx` | autenticado | Excel (Fase 3) |
| GET | `/api/fallas/reporte.pdf` | autenticado | PDF resumen con gráficas (Fase 3) |
| GET | `/api/formatos?tipoFormato=falla` | autenticado | filtro nuevo |

---

## 7. Dependencias nuevas

| Paquete | Dónde | Fase | Para qué |
|---|---|---|---|
| `recharts` | frontend | 3 | gráficas interactivas del dashboard |
| `exceljs` | backend | 3 | exportación `.xlsx` |

`pdfkit` (ya presente) cubre el PDF del reporte y el PDF resumen. No se agrega librería de charting en
backend; las barras del PDF se dibujan con primitivas de `pdf/ui.js`.

---

## 8. Riesgos y notas

- **Migración sobre BD con datos reales** (Fase 1): respaldar con `pg_dump`, SQL a mano, `migrate
  deploy`, nunca `reset`/`seed`. Detener backend antes de `prisma generate`.
- **`prisma/migrations/` en `.gitignore`**: la migración nueva no se versiona con la convención actual
  del repo — confirmar con el usuario si versionarla.
- **Fotos compartidas por referencia** (punto → falla): borrar una no debe romper la otra. Documentar;
  no implementar borrado en cascada de la key compartida.
- **Ruta `/uploads/:key` pública**: hereda el pendiente de hardening del proyecto; las fotos de fallas
  quedan igual de expuestas que las de inspección. No se resuelve aquí.
- **Estética HYDRA**: el PDF de falla debe reusar `pdf/theme.js` + `pdf/ui.js` sin forkear estilos,
  para no divergir del PDF de mantenimiento.
```
