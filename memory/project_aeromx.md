---
name: Project AeroMX — Estado actual
description: Estado del proyecto AeroMX al cierre de la Sesión 8 (QA v4). Bugs resueltos, cambios pendientes y próximos pasos.
type: project
---

Sistema web/móvil de gestión de mantenimiento aeronáutico. Contexto completo en CLAUDE.md.

## Estado al cierre de Sesión 8 (~95% Fase 1)

- Backend 100% con todos los endpoints operativos (usuarios, modelos, aeronaves, formatos, órdenes, recepción, inicio-mantenimiento, archivar, eliminar, asignación, PDF).
- Frontend con estas páginas operativas:
  - LoginPage, DashboardPage, CrearOTPage, InspeccionPage, CierreOTPage
  - ModelosPage (supervisor)
  - AeronavesPage (supervisor)
  - UsuariosPage (supervisor)
  - FlotaPage (vista por aeronave con histórico desplegable)
- Header con navegación global entre las pestañas, con links condicionales por rol.

## Infraestructura local

- Docker Compose en `aeromx/docker-compose.yml` (Postgres:5432 + MinIO:9000).
- Backend en `aeromx/backend` — `npm run dev` → puerto 3000.
- Frontend en `aeromx/frontend` — `npm run dev` → puerto 5173.
- Arranque: `docker compose up -d` → `cd aeromx/backend && npm run dev` → `cd aeromx/frontend && npm run dev`.

## ⚠️ Regeneración obligatoria del cliente Prisma

Tras cada `git pull` que modifique `schema.prisma` hay que regenerar el cliente
antes de levantar el backend. Sin esto, Prisma lanza
`Unknown argument 'fechaRecepcion'/'lugarMantenimiento'/'archivada'`:

```bash
cd aeromx/backend
npx prisma migrate dev --name sync_latest   # crea y aplica migración
# o
npx prisma db push                          # sincroniza BD sin migraciones
```

## Cambios de Sesión 6 (commit `935c1d5`)
- Validación de observación movida al marcar como completado (no al cambiar estado).
- Endpoint `/api/usuarios` con CRUD y filtros por rol/activo.
- Campos de horas visibles en CrearOT/Inspección/Dashboard con autocarga desde aeronave.
- Selector de supervisor en CrearOT.
- Dashboard con búsqueda, tarjetas resumen y filtro "Todas".
- PDF completamente rediseñado (banda azul, tabla estructurada, coloreado por estado, doble firma, paginación).

## Cambios de Sesión 7 (commit `d2e9513` — QA v1)

### PDF
- Corrige overflow en tabla (7.5pt + padding + ellipsis + save/restore).
- KV grid con alto fijo y elipsis; bloque de datos generales con los 4 hitos temporales.

### Workflow de 4 hitos
- Schema: `fechaRecepcion` + `matriculaRecepcion` en OrdenTrabajo.
- `POST /ordenes/:id/recepcion` valida la matrícula ingresada.
- `POST /ordenes/:id/iniciar-mantenimiento` congela la orden hasta el botón.
- Inspección queda en solo lectura hasta iniciar el mantenimiento.
- Banners guía para Paso 1 (recepción) y Paso 2 (iniciar).
- Línea de tiempo "1. Creación · 2. Recepción · 3. Inicio · 4. Finalización".

### Asignación y permisos
- `PATCH /ordenes/:id/asignacion` — supervisor reasigna técnico/supervisor.
- `crearOrden` acepta `tecnicoId` cuando el creador es supervisor.
- Mutaciones de resultados/fotos/iniciar exigen ser el técnico asignado o
  el supervisor de la orden; otros usuarios reciben 403 y el frontend
  muestra banner de solo lectura.
- Modal de reasignación en InspeccionPage.
- Selector de técnico responsable en CrearOT (solo supervisor).

### Catálogo de modelos
- `ModelosPage` con CRUD; `DELETE /api/modelos/:id` protege modelos con aeronaves asociadas.

## Cambios de Sesión 8 (commit `7cacbb9` — QA v2)

### Schema
- `OrdenTrabajo` gana `lugarMantenimiento` (String?) y `archivada` (Boolean default false).

### Backend
- `listarOrdenes` acepta filtro `archivada = 'true' | 'false' | 'todas'`.
- `crearOrden` acepta `lugarMantenimiento`.
- `PATCH /ordenes/:id/archivar` (supervisor) — toggle archivada.
- `DELETE /ordenes/:id` (supervisor) — borrado en cascada manual, sólo en borrador o archivadas.
- PDF muestra "Lugar de mantenimiento" en datos generales.

### Frontend
- **AeronavesPage** `/aeronaves` (supervisor): CRUD de aeronaves con filtro de inactivas.
- **UsuariosPage** `/usuarios` (supervisor): alta/edición/desactivación con password y licencia.
- **FlotaPage** `/flota`: histórico desplegable por aeronave con técnico/supervisor/lugar/fecha.
- Dashboard con filtro `activas / archivadas / todas` y botones Archivar/Desarchivar/Eliminar para supervisor.
- CrearOT con campo "Lugar donde se realiza el mantenimiento".
- InspeccionPage muestra el lugar en datos generales.

## Cambios de Sesión 9 (commit por venir — QA v3)

### Flujo de cierre
- La firma digital **ya no descarga el PDF automáticamente**. Solo cierra la
  orden (estado `cerrada`) y muestra el bloque de éxito con un botón explícito
  "Descargar comprobante" y otro "Volver al dashboard".

### Dashboard — tres vistas de alto nivel
- **Mis órdenes abiertas** (default): filtra a órdenes donde el usuario es
  técnico o supervisor asignado y `estado !== 'cerrada'`. Oculta el filtro
  "cerrada" y la tarjeta de cerradas en este modo.
- **Ver todo**: todas las órdenes activas no archivadas (propias y ajenas).
- **Archivo**: sólo las órdenes archivadas.
- Estado vacío de "Mis órdenes" incluye botón directo a "Ver todo".

## Próximos pasos (Sesión 10+)

1. Regenerar Prisma client en el equipo del usuario (obligatorio tras pull).
2. Probar flujo completo en Windows con Postgres local.
3. Fase 2 — Operaciones: dashboard de flota avanzado, alertas de vencimiento,
   asignación automática por carga de trabajo.
4. Fase 3 — Gestión: inventario de partes, reportes y estadísticas,
   notificaciones email.
5. Limpieza técnica: revisar `backend/uploads/`, gitignore de binarios,
   auditoría de seguridad (rate-limit, input sanitization).

**Why:** CLAUDE.md tiene el contexto técnico completo; esta memoria cubre el
estado operacional acumulado por sesiones.
**How to apply:** Al inicio de cada sesión, leer CLAUDE.md + esta memoria para
retomar sin re-explicar.
