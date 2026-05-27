# AeroMX — Contexto del Proyecto para Claude

Sistema web/móvil (PWA) de gestión de mantenimiento de productos (aeronaves, GCS, plantas, sensores de inteligencia). Reemplaza formatos Word manuales por un flujo digital de órdenes de trabajo paso a paso, con evidencia fotográfica por punto de inspección, firmas digitales, y un registro de fallas.

> **Fuentes de verdad** (consultar antes que este archivo para detalles):
> - **Modelo de datos:** `aeromx/backend/prisma/schema.prisma`
> - **Arquitectura multiproducto + roles:** `aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md`
> - **Historial detallado de sesiones 4–23** (rediseño, PDF, fallas): `docs/historial-sesiones.md` (NO se carga al inicio)
>
> El rediseño multiproducto (Fases A–E) está **100% completo**. Este CLAUDE.md describe el estado **actual**; el código manda sobre cualquier discrepancia.

## Tu rol
Experto en frontend, backend y bases de datos. Comunicación, commits y comentarios **en español**.

## Contexto operacional
- Flota ~50 productos, ~10 operaciones activas simultáneas.
- Técnicos trabajan en campo con celular/tablet (móvil).
- Migración desde cero (formatos previos en Word). Sin sistema legado.
- Infraestructura agnóstica: debe correr on-premise o en nube sin cambios de código.

## Stack
| Capa | Tecnología |
|------|-----------|
| Frontend web/móvil | React + Vite (PWA, instala desde browser) |
| Backend/API | Node.js + Express (ESM, `type: module`) |
| ORM | Prisma |
| BD | PostgreSQL |
| Almacenamiento fotos | MinIO (self-hosted) o AWS S3 — capa de abstracción `backend/src/lib/storage/` (`STORAGE_PROVIDER=local\|minio\|s3`) |
| Auth | JWT + bcrypt |
| PDF | pdfkit, estética "HYDRA" en `backend/src/pdf/` (`theme.js`, `ui.js`, fonts Geist) |

## Estructura de carpetas
```
aeromx/
├── frontend/src/   → pages/ components/ hooks/ api/ store/ tokens/
├── backend/src/    → routes/ controllers/ middleware/ services/ lib/ pdf/
│   └── prisma/     → schema.prisma · migrations/ · seed.js
├── docs/           → ARQUITECTURA-MULTIPRODUCTO.md, api.md
└── docker-compose.yml  → Postgres :5433 + MinIO :9000/9001
docs/superpowers/    → specs/ y plans/ (brainstorming + planes de implementación)
docs/historial-sesiones.md  → log histórico (archivo)
```

## Modelo de dominio (multiproducto)

**Roles** (enum `Rol`, 6 valores) + flag ortogonal `superusuario` (bypass de cualquier `requireRole`):
`gerente_soporte` · `ingeniero_soporte` · `tecnico_soporte` · `mecanico` · `piloto` · `operador`.

**Tipos de producto** (enum `TipoProducto`): `aeronave` · `gcs` · `sensor_inteligencia` · `planta`.
- `Producto` es la tabla padre (`identificador`, `numeroSerie`, `modeloId`); cada tipo tiene un detalle 1:1 (`AeronaveDetalle` horas, `GcsDetalle` placas/vin/odómetro, `PlantaDetalle` horímetro, `SensorInteligenciaDetalle` fabricante/firmware/calibración). **Convención clave:** el nombre del campo de relación del detalle = el valor del enum (`producto[tipoProducto]`), porque el frontend lo usa dinámicamente.
- `Formato` lleva `tipoProducto` y `tipoFormato` (`mantenimiento` | `falla`). Los formatos no se comparten entre tipos.

## Reglas de negocio vigentes

### Punto de inspección
- `bueno` / `no_aplica` → observación opcional; fotos según config del punto.
- `correcto_con_danos` / `requiere_atencion` → observación **obligatoria al completar**, fotos **obligatorias** (mín. 1). La observación se valida al marcar `completado`, no al cambiar de estado.

### Fotos
- Amarradas a un punto (`FotoInspeccion.resultadoId`). Servidas vía `GET /uploads/:key` (proxy por backend, infra-agnóstico). ⚠️ Ruta **pública** — pendiente de hardening.

### Firmas y flujo de O/T
- Estados: `borrador → en_proceso → pendiente_firma → cerrada`.
- Pasos **críticos** (`esCritico`) requieren firma individual; el resto solo al cierre.
- **Reapertura** (gerente): `cerrada → pendiente_firma`, borra firmas del cierre, exige motivo, registra `HistorialEstadoOT`.
- **Rechazo** (gerente): devuelve a `en_proceso` e invalida firmas.

### Matriz de personal por tipo (asignación de O/T)
| Tipo | mecánico | piloto | operador | firmas de cierre |
|---|:-:|:-:|:-:|---|
| aeronave | obligatorio | obligatorio | — | 3: soporte + gerente + piloto |
| gcs | opcional | — | obligatorio | 3: soporte + gerente + operador |
| planta | obligatorio | — | — | 2: soporte + gerente |
| sensor_inteligencia | prohibido | — | — | 2: soporte + gerente |

`soporte` (técnico o ingeniero) y `gerente` son obligatorios siempre. `ingenieroAuxiliar` es opcional y solo si el soporte es técnico.

### Gates de cierre (acumulados — todos deben cumplirse)
1. Todos los puntos `completado`. · 2. Puntos críticos firmados. · 3. Sin revisiones de punto `abierta`. · 4. Sin tareas asignadas por punto sin firmar. · + las firmas de slot por tipo (tabla arriba). Ni el superusuario evade estos (son reglas de negocio).

## Estado actual del proyecto

**Completado y verificado:**
- Rediseño multiproducto Fases A–E (schema + roles + backend + frontend de catálogos y O/T por tipo, reapertura).
- Almacenamiento real de fotos MinIO/S3 (capa de abstracción).
- PDF rediseñado estilo HYDRA, dinámico por tipo de producto.
- Rol `operador` + matriz de personal por tipo.
- Plan "pdf-fixes": descarga PDF con/sin fotos, rechazo de orden + revisión de puntos (gate), asignación de tarea por punto + firma de tarea (gate).
- **Registro de fallas Fase 1** (CRUD manual: `ReporteFalla`, `CategoriaFalla`, `FotoFalla`, formato `tipoFormato=falla`, PDF) y **Fase 2** (disparo automático desde un punto defectuoso de mantenimiento: copia de fotos del punto + auto-llenado de `refDocCorrectivo` + badge). Endpoints `/api/fallas`, `/api/categorias-falla`.

**Pendiente / en curso:**
- **Fallas — evidencia por etapa** (reporte/resolución): spec y plan escritos (`docs/superpowers/specs|plans/2026-05-26-evidencia-falla-por-etapa*`), **sin implementar**.
- **Fallas Fase 3** (analítica): dashboard recharts + export `.xlsx` (exceljs) + PDF resumen con gráficas.
- **Frente 1 — pre-despliegue/hardening:** auth en `GET /uploads/:key`; secretos de producción (rotar `JWT_SECRET`, credenciales S3/IAM fuera del repo); HTTPS/CORS de prod; backups Postgres+MinIO; limpieza de datos de prueba.
- **Roadmap Fase 2+:** dashboard de flota avanzado, alertas de vencimiento, inventario de partes, notificaciones, modo offline (PWA), reportes DGAC.

## Setup (verificado)
```bash
cd aeromx && docker compose up -d        # Postgres :5433 + MinIO :9000/9001 (suelen quedar arriba entre sesiones)
cd backend && npm run dev                 # API :3001 — revisa GET /api/health antes (suele quedar corriendo)
cd ../frontend && npm run dev             # UI :5173 — login dev@aeromx.com / aeromx123
```

**Usuarios de prueba** (todos `aeromx123`): `dev@aeromx.com` (gerente_soporte, ⚡superusuario), `gerente@`, `ingeniero@`, `tecnico@`, `mecanico@`, `piloto@`, `operador@`. Productos/formatos de muestra: ver `backend/prisma/seed.js`.

## Gotchas críticos (NO ignorar)
- **Prisma sin TTY:** `prisma migrate dev` **no funciona** en Claude Code. Flujo: escribir el SQL de migración a mano + `prisma migrate deploy`. (Para diffs: `prisma migrate diff --from-url … --to-schema-datamodel … --script`.)
- **NUNCA `db:seed` ni `migrate reset` sobre la BD de dev** — tiene formatos reales hechos a mano. Solo `migrate deploy`. **Respaldar con `pg_dump` antes de migrar** (`backend/backups/`, gitignored).
- **Detener el backend antes de `prisma generate`** (EPERM por DLL bloqueada en Windows).
- `prisma/migrations/` está en `.gitignore` → las migraciones no se versionan con el commit (convención actual del repo).

## Decisiones de diseño (resumen)
PWA sobre nativa · PostgreSQL (integridad referencial) · fotos amarradas al punto · exclusiones por modelo (no duplicar formatos) · observación condicional · firmas en dos niveles (críticos + cierre) · infraestructura agnóstica (MinIO/S3, on-prem/nube) · entidad ligera `ReporteFalla` (no reusa el flujo pesado de O/T) que se renderiza con el mismo PDF HYDRA.

## Cadencia de sesiones
Al cerrar un bloque de trabajo, registrar un resumen breve. Mantener este CLAUDE.md **esbelto**: los logs detallados de sesión van a `docs/historial-sesiones.md`, no aquí. Ejecutar features con las skills de `superpowers` (brainstorming → writing-plans → subagent-driven-development / executing-plans).
