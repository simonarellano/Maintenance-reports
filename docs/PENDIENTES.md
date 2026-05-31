# Pendientes / Backlog — AeroMX

> Lista de funciones pendientes **ordenada por prioridad**. Cada ítem se convierte en su propio
> ciclo `spec → plan → implementación` (skills `superpowers`) al arrancarlo. Aquí solo se captura el
> qué, el alcance tentativo y las preguntas abiertas a resolver en brainstorming.
>
> Mantener este archivo como la fuente única del backlog. CLAUDE.md solo apunta aquí.

**Última actualización:** 2026-05-26

---

## 1. Panel de control (hub de administración) + limpiar la interfaz ✅ COMPLETADO 2026-05-29

**Qué:** Un botón/sección de "Panel de control" que agrupe la administración —**Formatos, Usuarios,
Modelos** (y probablemente **Categorías de falla**)— en un solo lugar, sacándolos del Header para
descongestionar la navegación principal.

**Alcance tentativo:**
- Nueva página `PanelControlPage` (ruta tipo `/admin` o `/panel`) con tarjetas/secciones que enlazan
  a las páginas existentes (`FormatosPage`, `UsuariosPage`, `ModelosPage`, `CategoriasFallaPage`).
- `Header` se reduce: catálogos admin salen del nav y quedan tras el panel. Header final tentativo:
  `Órdenes · Flota · Fallas · ⚙ Panel`.
- Visibilidad por rol: el panel (o cada sección) solo para `gerente_soporte`/`ingeniero_soporte`/super,
  como hoy. Usuarios solo gerente/super.

**Preguntas abiertas (brainstorming):**
- ¿Qué entra exactamente en el panel? (¿también Categorías de falla? ¿Productos?)
- ¿El panel es una página índice que enlaza, o pestañas internas que embeben cada catálogo?
- ¿Nombre/ícono del acceso en el Header?

**Riesgo:** Bajo (mayormente reorganización de UI; sin schema).

**Implementado:** ⚙ Panel agrupa Formatos, Usuarios, Modelos, Categorías de falla en `/panel`. Productos sigue en Header. Gate `gerente_soporte` o superusuario. Spec `docs/superpowers/specs/2026-05-29-panel-control-design.md`, plan `docs/superpowers/plans/2026-05-29-panel-control.md`.

---

## 2. Configuraciones de usuario (perfil) ✅ COMPLETADO 2026-05-30

**Qué:** Que cada usuario pueda editar su perfil: **cambiar foto**, **agregar distintivo** y
**agregar descripción de puesto**.

**Alcance tentativo:**
- Schema `Usuario`: nuevos campos `fotoUrl?`, `distintivo?`, `descripcionPuesto?` (migración aditiva
  a mano + `migrate deploy`, ver gotchas en CLAUDE.md).
- Foto de perfil: reusar la capa de storage (`backend/src/lib/storage/`) y `GET /uploads/:key` (igual
  que las fotos de inspección/falla).
- Página/sección `MiPerfilPage` o modal de perfil; endpoint `PUT /api/usuarios/:id` ya existe (extender)
  o `PATCH /api/usuarios/me`.
- Mostrar foto/distintivo donde se listan personas (cards de personal en O/T, firmantes, etc.) — definir
  alcance para no expandir de más.

**Preguntas abiertas (brainstorming):**
- ¿Qué es exactamente el **distintivo**? (¿insignia/rango visual, color, ícono, texto corto?)
- ¿Quién puede editar el perfil de quién? (cada quien el suyo; ¿gerente edita los de su equipo?)
- ¿Dónde se muestran foto/distintivo además del perfil?

**Riesgo:** Medio (migración + subida de archivos + varios puntos de UI donde se muestra).

**Implementado:** 3 campos en `Usuario` (`fotoUrl`, `distintivo` único ≤ 16 chars upper, `descripcionPuesto`), página `/mi-perfil` para auto-edición, 4 endpoints (`GET/PATCH /api/usuarios/me`, `POST/DELETE /api/usuarios/:id/foto`) con multer 2MB JPG/PNG/WebP + middleware `requireDueñoOGerente`. Componente `<Avatar />` en uso en Header, cards O/T (CrearOT vía selects nativos N/A; Cierre/Inspeccion/FallaDetalle), firmas UI del cierre y bloque de firmas del PDF de O/T + falla (foto circular + callsign mono acento). Spec `docs/superpowers/specs/2026-05-29-perfil-usuario-design.md`, plan `docs/superpowers/plans/2026-05-29-perfil-usuario.md`.

---

## 3. Autenticación: login funcional por correo o con Google

**Qué:** Login real más allá del JWT+bcrypt actual con usuarios sembrados. Dos caminos posibles
—**flujo por correo** (verificación/recuperación de contraseña por email) o **OAuth con Google**—
**pendiente decidir por dificultad**.

**Alcance tentativo (a definir según el camino elegido):**
- **Opción A — Correo:** verificación de email + recuperación de contraseña. Requiere un proveedor de
  envío de correo (SMTP/servicio) y tokens de verificación/reset. Cambios de schema menores.
- **Opción B — Google OAuth:** "Iniciar sesión con Google". Requiere registrar credenciales OAuth,
  manejar el callback, mapear cuenta Google ↔ `Usuario` (y decidir alta automática vs. invitación).
  Más piezas externas (consola de Google, dominios autorizados).

**Preguntas abiertas (decisión previa al brainstorming):**
- ¿Correo o Google? (decidir por dificultad/infra disponible — el usuario lo dejó pendiente).
- ¿Self-service de alta o solo el gerente da de alta y el usuario solo inicia sesión?
- ¿Qué proveedor de correo / dominio se usará?

**Riesgo:** Medio-Alto (depende de infra externa y de la decisión correo vs Google).

---

## 4. Despliegue de la aplicación (pre-producción / hardening)

**Qué:** Dejar la app lista para desplegar (on-premise o nube). Recopila el "Frente 1" de hardening.

**Puntos a cubrir:**
- **Auth en `GET /uploads/:key`** — hoy es pública; las fotos de mantenimiento/fallas quedan expuestas.
- **Secretos de producción** — rotar `JWT_SECRET`; credenciales S3/IAM fuera del repo; gestión de `.env`.
- **HTTPS + CORS de producción** (hoy CORS de dev).
- **Backups** de Postgres + MinIO (estrategia y automatización).
- **Storage en prod:** `STORAGE_PROVIDER=s3` + credenciales/rol IAM (o MinIO self-hosted endurecido).
- **Limpieza de datos de prueba** → datos reales del cliente (sin `db:seed`/`reset`; ver gotchas).
- **Hosting:** frontend (Vercel o servidor propio) + backend (Railway o servidor propio); build de prod.
- **Versionado de migraciones:** hoy `prisma/migrations/` está en `.gitignore` — decidir si versionar
  para reproducibilidad en el servidor de despliegue.

**Preguntas abiertas (brainstorming):**
- ¿On-premise o nube? (define storage, hosting, backups).
- ¿Qué dominio/infra de cliente?

**Riesgo:** Alto (toca seguridad, infra y datos reales; varias sub-tareas).

---

## En curso / ya con spec o plan escrito (no listadas arriba)

Estas existen aparte del backlog priorizado del usuario:

- **Fallas — evidencia por etapa** (reporte/resolución): spec + plan escritos
  (`docs/superpowers/specs|plans/2026-05-26-evidencia-falla-por-etapa*`). **Listo para implementar.**
- **Fallas — Fase 3 (analítica):** ✅ **Completada (Sesión 25).** Plan en
  `docs/superpowers/plans/2026-05-27-registro-de-fallas-fase3.md`. Endpoints `/api/fallas/estadisticas`,
  `/reporte.pdf`, `/export.xlsx`; `FallasDashboardPage` (recharts) + export Excel/PDF + histórico por
  producto desde Flota. Verificado por API + `npm run build`.
