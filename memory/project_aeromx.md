---
name: Project AeroMX — Estado actual
description: Estado del proyecto AeroMX al final de la Sesión 4, bugs resueltos y próximos pasos
type: project
---

Sistema web/móvil de gestión de mantenimiento aeronáutico. Contexto completo en CLAUDE.md.

**Estado al cierre de Sesión 4 (~50% total):**
- Backend 100% implementado y funcionando
- Frontend funcional: Login, Dashboard, CrearOT, InspeccionPage, CierreOTPage
- Crear O/T funciona end-to-end con los 14 secciones reales del Mantenimiento Menor

**Infraestructura local:**
- Docker Compose en `aeromx/docker-compose.yml` (Postgres:5432 + MinIO:9000)
- Backend en `aeromx/backend` — `npm run dev` → puerto 3000
- Frontend en `aeromx/frontend` — `npm run dev` → puerto 5173
- Para arrancar: `docker compose up -d` → `cd aeromx/backend && npm run dev` → `cd aeromx/frontend && npm run dev`

**Bugs resueltos en Sesión 4:**
- `supervisorId` no-nullable en schema → cambiado a `String?` + migración aplicada
- Controllers async sin try/catch → corregido con next(e)
- Prisma shorthand FK no aceptado → cambiado a sintaxis `connect` explícita
- React Router v7 future flag warnings → agregados en BrowserRouter

**Próximos pasos (Sesión 5):**
1. Probar flujo completo de inspección en InspeccionPage
2. Probar cierre y firma en CierreOTPage
3. Subir a GitHub
4. Pulir UX móvil

**Why:** El CLAUDE.md tiene el contexto técnico completo. Esta memoria cubre el estado operacional.
**How to apply:** Al inicio de sesión, leer CLAUDE.md + esta memoria para retomar sin re-explicar.
