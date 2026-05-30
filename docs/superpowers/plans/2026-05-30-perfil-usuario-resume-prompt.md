# Prompt para retomar el plan de perfil (Sesión 28+)

Pega esto al inicio de la nueva sesión.

---

Continúa el plan de perfil de usuario desde T12.

Plan: `docs/superpowers/plans/2026-05-29-perfil-usuario.md`
Spec: `docs/superpowers/specs/2026-05-29-perfil-usuario-design.md`

Lee primero la sección "🚦 Checkpoint Sesión 27" al inicio del plan — tiene los commits ya hechos (T1-T11) y caveats lockeados durante reviews.

Estado:
- Phase 1 (T1-T6 backend) y Phase 2 (T7-T10 Mi Perfil + Header) cerradas y pusheadas a `origin/development`.
- Phase 3 parcial: T11 (UsuariosPage modal) listo. Faltan T12-T16.

Arranca con `subagent-driven-development` desde T12 — Cards O/T con `<Avatar />` (4 páginas: `CrearOTPage`, `CierreOTPage`, `InspeccionPage`, `FallaDetallePage`). Luego T13 (firmas UI + extender selects backend), T14 (`signatureCard` PDF), T15 (PDF controllers + buffers), T16 (cierre PENDIENTES + CLAUDE + smoke E2E).

Antes de despachar T12 verifica:
1. `cd aeromx/backend && npm run dev` arranca limpio en `:3001`.
2. `cd aeromx/frontend && npm run build` pasa.
3. Login `dev@aeromx.com` → `/mi-perfil` → distintivo y descripción editables (NO inputs vacíos — si lo están, el fix `4043312` no llegó).

Caveats CRÍTICOS (del checkpoint, no los olvides en los dispatches a subagentes):
- `Field` y `FieldTextarea` de `components/ui.jsx` NO aceptan children — usar API de props (`value`/`onChange`/`placeholder`/`mono`/`inputProps`).
- JWT payload: `req.user.sub` (no `req.user.id`).
- Storage facade: `import { storage, keyDesdeUrl } from '../lib/storage/index.js'` — `storage.put({ buffer, contentType, originalName })`.
- Backend bootstrap: `aeromx/backend/src/index.js` (no `app.js`).
- `prisma/migrations/` en `.gitignore` — no committear SQL de migración.

T13 puede requerir extender el `include`/`select` del backend de la orden para que firmantes traigan `fotoUrl` y `distintivo` — preparado en el plan T13 Step 3.

Modo de ejecución: subagent-driven (consistente con sesión anterior). Yo estoy en caveman mode full.
