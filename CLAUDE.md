# AeroMX — Contexto del Proyecto para Claude

## ¿Qué es este proyecto?
Sistema web/móvil de gestión de mantenimiento aeronáutico. Reemplaza formatos Word manuales con un flujo digital de órdenes de mantenimiento paso a paso, con captura de evidencia fotográfica por punto de inspección y firma digital.

## Contexto Operacional
- Flota total: ~50 aeronaves
- Operaciones activas simultáneas: ~10 aeronaves
- Operaciones: Móviles — técnicos trabajan en rampa con celular/tablet
- Sistema legado: Ninguno. Formatos actuales en Word. Migración desde cero.
- Infraestructura: On-premise O nube — el sistema debe soportar ambos sin cambios de código.

## Roles de Usuario
| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| Técnico | Ejecuta el mantenimiento en campo | Abrir O/T, completar pasos, tomar fotos, firma digital |
| Ingeniero | Supervisa técnicamente | Todo lo del técnico + aprobar pasos críticos |
| Supervisor | Aprueba y cierra órdenes | Firma final, dashboard completo, reportes |

## Los 8 Tipos de Formatos
| # | Nombre en sistema | Nombre coloquial |
|---|-------------------|-----------------|
| 1 | Inspección 50h | 50 horas |
| 2 | Inspección 60h | 60 horas |
| 3 | Mantenimiento Menor | Menor / Preventivo |
| 4 | Mantenimiento Mayor | Mayor / 500h |
| 5 | Documento de Entrega / Aceptación | Entrega |
| 6 | Cambio de Componente | Cambio |
| 7 | Inspección Pre-vuelo / Post-vuelo | Pre/Post |
| 8 | Reporte de Anomalía / Defecto | Reporte |

**Prioridad de desarrollo: Mantenimiento Menor primero** (más complejo, sirve como plantilla base).

## Stack Tecnológico
| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend web | React + Vite | |
| App móvil | PWA (misma base React) | Sin App Store, instala desde browser |
| Backend / API | Node.js + Express | |
| ORM | Prisma | Migraciones, type-safety |
| Base de datos | PostgreSQL | On-premise friendly |
| Almacenamiento fotos | MinIO (self-hosted) o AWS S3 | Según infraestructura |
| Autenticación | JWT + bcrypt | Sin dependencias externas |
| Hosting frontend | Vercel o servidor propio | |
| Hosting backend | Railway o servidor propio | |

## Estructura de Carpetas
```
aeromx/
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       └── store/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── services/
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
├── database/
│   └── schema.sql
├── docs/
│   └── api.md
└── CLAUDE.md
```

## Reglas de Negocio Críticas

### Estado de punto de inspección
- **Bueno / No aplica** → Observación: OPCIONAL, Fotos: según config del punto
- **Correcto con daños / Requiere atención** → Observación: OBLIGATORIA, Fotos: OBLIGATORIAS (mín. 1)

### Fotografías
- Amarradas a un punto de inspección específico (FK a `resultados_puntos`)
- Cada punto puede tener múltiples fotos
- Algunos puntos requieren foto obligatoria (configurado en plantilla)

### Firmas
- Pasos **CRÍTICOS**: requieren firma digital individual por paso
- Pasos normales: solo firma al cierre del documento
- Cierre requiere dos firmas: técnico/ingeniero + supervisor
- Opción adicional: subir foto de firma física escaneada

### Flujo de Estados de O/T
```
BORRADOR → EN PROCESO → PENDIENTE FIRMA → CERRADA
```
- No se puede firmar sin 100% de puntos completados
- No se puede cerrar sin firmas de técnico Y supervisor
- O/T cerrada no se puede modificar

### Pasos Opcionales por Modelo
- Formatos estándar con mismos puntos para todos los modelos
- Algunos puntos se excluyen por modelo via `puntos_excluidos_por_modelo` (NO duplicando formatos)

## Anatomía del Formato (Mantenimiento Menor)
```
FORMATO DE MANTENIMIENTO
├── [SOLO SISTEMA] Metadata: versión, fecha de creación, metadata interna
├── [DOCUMENTO] Encabezado
│   ├── Logo empresa, objetivo, quién realiza/supervisa
│   ├── Orden de servicio, cliente, fecha/hora recepción
│   └── Datos aeronave: modelo, matrícula, serie, horas totales/motor der/izq
├── [DOCUMENTO] Instrucciones generales (texto fijo)
├── [DOCUMENTO] Definiciones (texto fijo: CM, AC, Tiempo límite, etc.)
├── [DOCUMENTO] Tablas de inspección — NÚCLEO
│   ├── Sección: Alas
│   ├── Sección: Tren Delantero
│   ├── Sección: Tren Principal
│   ├── Sección: Electrónica
│   ├── Sección: Superficies
│   └── Sección: Otros Componentes
│   Cada fila: Componente | Categoría | Descripción | Estado | Firma | Foto
└── [DOCUMENTO] Cierre
    ├── ¿Se encontró defecto? + ref. doc. correctivo
    └── Firmas: técnico/ingeniero + supervisor
```

## Esquema de BD (PostgreSQL via Prisma)

### BLOQUE 1 — Usuarios y Flota
- `usuarios`: id, nombre, email, password_hash, rol(tecnico|ingeniero|supervisor), licencia_num, telefono, activo
- `modelos_aeronave`: id, nombre, fabricante, descripcion
- `aeronaves`: id, modelo_id(FK), matricula, numero_serie, horas_totales, horas_motor_der, horas_motor_izq, activa

### BLOQUE 2 — Plantillas
- `formatos`: id, nombre, version, fecha_version, objetivo, instrucciones, definiciones, activo
- `secciones_formato`: id, formato_id(FK), nombre, descripcion, orden
- `puntos_inspeccion`: id, seccion_id(FK), nombre_componente, categoria, descripcion, es_critico, foto_requerida, orden
- `puntos_excluidos_por_modelo`: punto_id+modelo_id(PK compuesta), motivo

### BLOQUE 3 — Órdenes de Trabajo
- `ordenes_trabajo`: id, numero_ot(UNIQUE), formato_id, aeronave_id, tecnico_id, supervisor_id, cliente, orden_servicio, horas_al_momento, horas_motor_der, horas_motor_izq, estado(borrador|en_proceso|pendiente_firma|cerrada), fecha_inicio, fecha_cierre
- `resultados_puntos`: id, orden_id(FK), punto_id(FK), estado_resultado(bueno|correcto_con_daños|requiere_atencion|no_aplica), observacion, firmado_por(FK), fecha_firma, completado
- `fotos_inspeccion`: id, resultado_id(FK), url_archivo, nombre_archivo, tamano_bytes, subida_por(FK), fecha_captura

### BLOQUE 4 — Cierre
- `cierre_ot`: orden_id(FK UNIQUE 1:1), se_encontro_defecto, ref_doc_correctivo, observaciones_generales, firma_tecnico_id, fecha_firma_tecnico, firma_supervisor_id, fecha_firma_supervisor, firma_fisica_url

## Roadmap

### Fase 1 — Core (PRIORIDAD MÁXIMA)
- [x] Arquitectura, stack, estructura de BD y formatos definidos
- [x] CLAUDE.md creado
- [x] schema.prisma completo (todos los modelos, enums, relaciones, mapeos snake_case)
- [x] Estructura de carpetas del proyecto (frontend + backend + database + docs)
- [x] Autenticación JWT con roles (login, me, verifyToken, requireRole)
- [x] CRUD aeronaves y modelos (GET/POST/PUT/DELETE con manejo de errores Prisma)
- [ ] schema.sql completo (opcional — Prisma migrate lo genera automáticamente)
- [x] Módulo Órdenes de Mantenimiento (backend completo)
  - [x] Plantillas en DB (CRUD formatos + secciones + puntos de inspección)
  - [x] Crear O/T desde plantilla (genera resultados_puntos filtrando exclusiones por modelo)
  - [x] Flujo paso a paso (PATCH estado, observación, completado con validaciones de negocio)
  - [x] Captura de fotos por punto (multer disk storage, 10MB, solo imágenes)
  - [x] Firma digital (por paso crítico individual + doble firma al cierre)
  - [x] Generación de PDF al cerrar (pdfkit, streaming directo)

### Fase 2 — Operaciones
- [ ] Dashboard de flota
- [ ] Asignación de técnicos
- [ ] Alertas de vencimiento

### Fase 3 — Gestión
- [ ] Inventario de partes
- [ ] Reportes y estadísticas
- [ ] Histórico por aeronave
- [ ] Notificaciones email/push

### Fase 4 — Extra
- [ ] Modo offline (sin señal en rampa)
- [ ] Reportes DGAC
- [ ] PDF con formato oficial

## Decisiones de Diseño
1. PWA sobre app nativa — sin App Store
2. PostgreSQL — integridad referencial crítica para datos de mantenimiento
3. Fotos amarradas al punto específico — FK a `resultados_puntos`
4. Exclusiones por modelo — tabla `puntos_excluidos_por_modelo`, no duplicar formatos
5. Observación condicional — obligatoria cuando estado = daños o requiere atención
6. Dos niveles de firma — por paso (críticos) + cierre (todos)
7. Prisma como ORM — migraciones controladas, type-safety
8. Infraestructura agnóstica — MinIO o S3, Railway o on-premise

## Pendientes por Definir
- MinIO vs S3 — depende de permisos de IT
- Secciones y puntos exactos del Mantenimiento Menor (el usuario los tiene en Word)
- Confirmar si se necesita modo offline
- Confirmar si `ref_doc_correctivo` es solo texto o también permite adjuntar PDF

## Estado del Proyecto — Última actualización: Sesión 9 (~95% Fase 1)

### Completado (backend 100% + frontend UI/UX mejorada)
| Archivo | Descripción |
|---------|-------------|
| `CLAUDE.md` | Contexto completo del proyecto |
| `backend/prisma/schema.prisma` | Todos los modelos, enums y relaciones |
| `backend/prisma/seed.js` | 3 usuarios de prueba + modelo Cessna 172S + aeronave XB-ABC |
| `backend/src/index.js` | Express app: cors, json, static /uploads, rutas, error handler global |
| `backend/src/lib/prisma.js` | Singleton PrismaClient compartido |
| `backend/src/middleware/auth.js` | `verifyToken` + `requireRole(roles)` |
| `backend/src/routes/auth.js` | POST /api/auth/login · GET /api/auth/me |
| `backend/src/routes/usuarios.js` | GET /usuarios?rol=supervisor&activo=true · CRUD usuarios (solo supervisor) |
| `backend/src/routes/modelos.js` | GET / · GET :id · POST · PUT |
| `backend/src/routes/aeronaves.js` | GET / · GET :id · POST · PUT · DELETE |
| `backend/src/routes/formatos.js` | CRUD formatos + secciones + puntos de inspección |
| `backend/src/routes/ordenes.js` | CRUD O/T + pasos + fotos + cierre + PDF profesional |
| `backend/src/controllers/authController.js` | login, me |
| `backend/src/controllers/usuariosController.js` | **NUEVO** — listar, obtener, crear, actualizar, desactivar usuarios |
| `backend/src/controllers/modelosController.js` | listar, obtener, crear, actualizar |
| `backend/src/controllers/aeronavesController.js` | listar, obtener, crear, actualizar, desactivar |
| `backend/src/controllers/formatosController.js` | CRUD formatos, secciones, puntos |
| `backend/src/controllers/ordenesController.js` | CRUD O/T, resultados, fotos, cierre, **PDF profesional rediseñado** |
| `backend/src/services/authService.js` | findUserByEmail, validatePassword, generateToken, updateLastAccess, hashPassword |
| `backend/src/services/usuariosService.js` | **NUEVO** — CRUD usuarios con búsqueda por rol y activo |
| `backend/src/services/modelosService.js` | listar, obtener, crear, actualizar |
| `backend/src/services/aeronavesService.js` | listar, obtener, crear, actualizar, desactivarAeronave (baja lógica) |
| `backend/src/services/formatosService.js` | listar, obtener, crear, actualizar, desactivar formatos · crearSeccion, actualizarSeccion, eliminarSeccion · crearPunto, actualizarPunto, eliminarPunto |
| `backend/src/services/ordenesService.js` | generarNumeroOT · CRUD O/T · actualizarResultado (validación movida a completado) · fotos · cierre · generarPDF |
| `backend/package.json` | type=module, pdfkit, bcryptjs, scripts dev/migrate/seed |
| `frontend/package.json` | React + Vite + TailwindCSS + Zustand + PWA + react-hook-form |
| `frontend/vite.config.js` | PWA manifest + proxy /api y /uploads → localhost:3000 |
| `backend/.env.example` | Variables: DATABASE_URL, JWT_SECRET, PORT, STORAGE_PROVIDER, CORS_ORIGIN |
| `backend/.env` | Configurado para desarrollo local (Postgres en Docker, MinIO local) |
| `aeromx/docker-compose.yml` | Postgres 16 + MinIO — levantar con `docker compose up -d` |
| `frontend/src/App.jsx` | React Router con future flags v7 configurados |
| `frontend/src/pages/LoginPage.jsx` | Login funcional con JWT |
| `frontend/src/pages/DashboardPage.jsx` | **MEJORADO** — Filtros por estado + "Todas", búsqueda por matrícula/cliente/técnico, tarjetas resumen, botón descargar PDF |
| `frontend/src/pages/CrearOTPage.jsx` | **MEJORADO** — Horas visible (totales, motor der/izq), selector supervisor, fecha de recepción, react-hook-form validaciones |
| `frontend/src/pages/InspeccionPage.jsx` | **MEJORADO** — Tabla por sección, datos de horas visibles, fecha de inicio/cierre, supervisor asignado |
| `frontend/src/pages/CierreOTPage.jsx` | Cierre y firma de O/T con validaciones |
| `frontend/src/api/usuariosService.js` | **NUEVO** — listar, obtener, crear, actualizar, desactivar usuarios |

### API completa — Endpoints implementados
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /api/auth/login | público | Login, retorna JWT |
| GET | /api/auth/me | cualquier rol | Usuario actual |
| **GET** | **/api/usuarios** | **autenticado** | **NUEVO** Listar usuarios (filtros: rol, activo) |
| **GET** | **/api/usuarios/:id** | **autenticado** | **NUEVO** Detalle usuario |
| **POST** | **/api/usuarios** | **supervisor** | **NUEVO** Crear usuario |
| **PUT** | **/api/usuarios/:id** | **supervisor** | **NUEVO** Actualizar usuario |
| **DELETE** | **/api/usuarios/:id** | **supervisor** | **NUEVO** Desactivar usuario (soft) |
| GET | /api/modelos | autenticado | Listar modelos |
| GET | /api/modelos/:id | autenticado | Detalle modelo |
| POST | /api/modelos | supervisor | Crear modelo |
| PUT | /api/modelos/:id | supervisor | Actualizar modelo |
| GET | /api/aeronaves | autenticado | Listar aeronaves |
| GET | /api/aeronaves/:id | autenticado | Detalle aeronave |
| POST | /api/aeronaves | supervisor | Crear aeronave |
| PUT | /api/aeronaves/:id | supervisor | Actualizar aeronave |
| DELETE | /api/aeronaves/:id | supervisor | Desactivar aeronave (soft) |
| GET | /api/formatos | autenticado | Listar formatos |
| GET | /api/formatos/:id | autenticado | Formato con secciones y puntos |
| POST | /api/formatos | supervisor | Crear formato |
| PUT | /api/formatos/:id | supervisor | Actualizar formato |
| DELETE | /api/formatos/:id | supervisor | Desactivar formato |
| POST | /api/formatos/:id/secciones | supervisor | Agregar sección |
| PUT | /api/formatos/:id/secciones/:seccionId | supervisor | Actualizar sección |
| DELETE | /api/formatos/:id/secciones/:seccionId | supervisor | Eliminar sección |
| POST | /api/formatos/:id/secciones/:seccionId/puntos | supervisor | Agregar punto |
| PUT | /api/formatos/:id/secciones/:seccionId/puntos/:puntoId | supervisor | Actualizar punto |
| DELETE | /api/formatos/:id/secciones/:seccionId/puntos/:puntoId | supervisor | Eliminar punto |
| GET | /api/ordenes | autenticado | Listar O/T (filtros: estado, aeronaveId, tecnicoId) |
| GET | /api/ordenes/:id | autenticado | O/T con resultados, fotos y cierre |
| POST | /api/ordenes | autenticado | Crear O/T con horas y supervisor asignado |
| PATCH | /api/ordenes/:id/estado | supervisor\|ingeniero | Cambiar estado de O/T |
| PATCH | /api/ordenes/:id/puntos/:resultadoId | autenticado | Actualizar resultado (estado/obs/completado) — validación en completado |
| POST | /api/ordenes/:id/puntos/:resultadoId/firmar | autenticado | Firmar punto crítico |
| POST | /api/ordenes/:id/puntos/:resultadoId/fotos | autenticado | Subir foto (multipart, max 10MB) |
| DELETE | /api/ordenes/:id/puntos/:resultadoId/fotos/:fotoId | autenticado | Eliminar foto |
| POST | /api/ordenes/:id/cierre | autenticado | Crear/actualizar datos de cierre |
| POST | /api/ordenes/:id/cierre/firmar | autenticado | Firmar cierre (tecnico/ingeniero o supervisor) |
| GET | /api/ordenes/:id/pdf | autenticado | Descargar PDF profesional de la O/T |

### Reglas de negocio implementadas
- **observacion obligatoria AL COMPLETAR** punto con `estadoResultado = correcto_con_danos | requiere_atencion` (no al cambiar estado)
- Cambio de `estadoResultado` libre sin observación — validación solo al marcar `completado: true`
- Solo puntos con `esCritico = true` se pueden firmar individualmente
- El punto debe estar `completado = true` antes de poder firmar
- No se puede iniciar cierre sin que todos los puntos estén completados
- `refDocCorrectivo` obligatorio cuando `seEncontroDefecto = true`
- O/T pasa a `cerrada` automáticamente cuando ambas firmas del cierre están presentes
- Puntos excluidos por modelo de aeronave no se incluyen al crear la O/T
- Horas (totales, motor der/izq) se registran al crear O/T y se vizualizan en toda la orden
- Supervisor es opcional al crear O/T pero asignación recomendada antes de cierre

### Usuarios de prueba (seed)
| Email | Password | Rol |
|-------|----------|-----|
| tecnico@aeromx.com | aeromx123 | tecnico |
| ingeniero@aeromx.com | aeromx123 | ingeniero |
| supervisor@aeromx.com | aeromx123 | supervisor |

### Para levantar en desarrollo local (primera vez)
```bash
# 1. Clonar el repo
git clone <url-del-repo>

# 2. Configurar variables de entorno
cd aeromx/backend
cp .env.example .env
# El .env.example ya tiene los valores correctos para Docker local — no necesita edición

# 3. Infraestructura
cd ..
docker compose up -d          # levanta Postgres:5432 + MinIO:9000/9001

# 4. Backend
cd backend
npm install
npx prisma migrate deploy     # aplica migraciones (usa deploy en máquina nueva, no dev)
npm run db:seed               # carga usuarios de prueba + aeronave XB-ABC + puntos Mantenimiento Menor
npm run dev                   # API en http://localhost:3000

# 5. Frontend (otra terminal)
cd aeromx/frontend
npm install
npm run dev                   # UI en http://localhost:5173
```

> **De la segunda vez en adelante**: solo `docker compose up -d` + `npm run dev` en backend y frontend.

> **Diferencia `migrate dev` vs `migrate deploy`**: usar `dev` en tu máquina de desarrollo (crea migraciones nuevas), usar `deploy` en máquina nueva o producción (solo aplica las existentes).

### Bugs corregidos en Sesión 4
- `supervisorId` era `String` no-nullable en schema pero el frontend no lo envía → cambiado a `String?` + relación `supervisor?` opcional + migración aplicada
- `ordenesController.js`: todos los handlers async sin `try/catch` ni `next` → corregido (Express 4 no captura async errors automáticamente)
- `ordenesService.crearOrden`: usaba shorthand de FK (`formatoId`) que el cliente Prisma no aceptaba → cambiado a sintaxis `connect` explícita para todas las relaciones
- `frontend/App.jsx`: warnings de React Router v7 future flags → agregados `v7_startTransition` y `v7_relativeSplatPath`

### Cambios en Sesión 5
- **Rediseño de InspeccionPage** (commit `ad2c2b3`): las tarjetas por punto se reemplazaron por una **tabla por sección** con columnas Componente · Descripción de trabajo · Condición · Firma técnico · Registro fotográfico. Se respeta el orden del formato y se puede colapsar/expandir cada sección.
- `ordenesService.obtenerOrden` ahora incluye `punto.seccion` en el resultado — sin esto, el frontend no podía agrupar los puntos por sección real y caían todos en "Sin sección".
- Subida/eliminación de fotos y firma de puntos críticos quedan integradas en la misma tabla.
- `vite.config.js`: se agregó proxy de `/uploads` → `localhost:3000` para que las miniaturas carguen en dev.
- Ajustes menores en `.env.example` y `docker-compose.yml` (commit `70c0ef3`).
- ⚠️ Quedaron dos archivos de prueba commiteados en `backend/uploads/` — revisar si deben limpiarse y agregarse al `.gitignore`.

### Cambios en Sesión 6 — Arreglos críticos post-auditoría
**Fecha:** 2026-04-21 | **Commit:** `935c1d5` | **Rama:** `claude/fix-maintenance-reports-1w0OD`

#### 🐛 Bugs corregidos
1. **Dropdown de condición bloqueado** — Backend validaba observación obligatoria AL CAMBIAR estado. Movida validación al momento de `completado: true`. Ahora permite seleccionar "Con daños" y "Requiere atención" sin error.
2. **Validación de observación** — Ahora la observación es obligatoria SOLO al marcar como completado, no al cambiar `estadoResultado`. UX más fluida.

#### ✨ Nuevas funcionalidades
1. **Gestión de usuarios** — Nuevo endpoint `/api/usuarios` con CRUD completo + filtros por rol/activo. Permite crear y asignar supervisores.
2. **Horas de vuelo** — Campos visibles en CrearOT, InspeccionPage, Dashboard. Auto-precarga desde datos de aeronave.
3. **Supervisor asignable** — Selector en CrearOT (opcional), visible en toda la orden. Recomendado antes de cierre.
4. **Fecha visible en todas partes** — Recepción, inicio, cierre. Headers mejorados con información completa.

#### 🎨 UX/UI mejorada
1. **Dashboard rediseñado** — Filtro "Todas", búsqueda por matrícula/cliente/técnico/formato, tarjetas resumen (total, en proceso, pendiente, cerradas), botón PDF directo desde O/T cerradas.
2. **CrearOT actualizado** — Secciones organizadas (datos generales, aeronave y horas, asignación, datos de servicio), react-hook-form validaciones, layout responsive.
3. **InspeccionPage enriquecida** — Datos de horas en tarjeta destacada, fecha de inicio/cierre, supervisor asignado, estado visible.

#### 📄 PDF completamente rediseñado
- **Encabezado profesional** — Banda azul con marca AEROMX, contacto, número de O/T destacado.
- **Secciones estructuradas** — Datos generales, aeronave, personal responsable, lista de trabajos (tabla), observaciones, firmas.
- **Tabla de trabajos** — Columnas: # | Componente | Descripción | Condición | Firma | Fotos. Coloreado por estado de riesgo (rojo=requiere atención, amarillo=con daños, verde=completado).
- **Bloque de firmas** — Doble firma (técnico + supervisor) con espacios, datos de licencia, fecha/hora de firma digital, check de conformidad.
- **Numeración de páginas** — En pie de página, con metadata y fecha de emisión.

#### 🔧 Cambios técnicos
- **Backend:** Nuevo servicio `usuariosService.js`, nuevo controlador `usuariosController.js`, nueva ruta `usuarios.js`.
- **Backend:** `ordenesService.listarOrdenes` ahora incluye `resultados` completos (para calcular progreso en frontend).
- **Backend:** PDF con `bufferPages: true` + `switchToPage` para numeración multi-página.
- **Frontend:** `CrearOTPage` con react-hook-form, `DashboardPage` con useMemo para búsqueda eficiente.
- **Frontend:** Nuevo service `usuariosService.js` para consumir endpoint de usuarios.

#### 📊 Resultados
- ✅ Dropdown funciona al 100%
- ✅ Todas las horas visibles y registradas
- ✅ Supervisores asignables
- ✅ Fechas visibles en todo el flujo
- ✅ Dashboard con histórico completo
- ✅ PDF profesional y estructurado
- ✅ ~85% del proyecto completado (Fase 1 Core prácticamente terminada)

### Cambios en Sesión 7 — QA v1 (workflow de 4 hitos + asignación)
**Commit:** `d2e9513` | **Rama:** `claude/qa-ui-fixes-gs3pE`

#### PDF
- Corrige overflow de texto en celdas (7.5pt, padding uniforme, `ellipsis`, `save/restore` para evitar bleed de color).
- KV grid con alto fijo y elipsis; bloque de datos generales con los 4 hitos temporales.

#### Workflow de 4 hitos
- Schema: `fechaRecepcion` (DateTime?) y `matriculaRecepcion` (String?) en `OrdenTrabajo`.
- `POST /api/ordenes/:id/recepcion` — valida matrícula ingresada vs. esperada antes de registrar recepción.
- `POST /api/ordenes/:id/iniciar-mantenimiento` — congela la orden hasta que el técnico pulsa el botón; registra `fechaInicio` y cambia a `en_proceso`.
- `InspeccionPage` en solo lectura hasta iniciar el mantenimiento.
- Línea de tiempo "1. Creación · 2. Recepción · 3. Inicio · 4. Finalización" visible en todo el flujo.
- Banners guía para Paso 1 (recepción con validación de matrícula) y Paso 2 (iniciar mantenimiento).

#### Asignación y permisos
- `PATCH /api/ordenes/:id/asignacion` (supervisor) — reasigna técnico y/o supervisor de la orden.
- `crearOrden` acepta `tecnicoId` cuando el creador es supervisor; resto crea a su nombre.
- Mutaciones de puntos/fotos/iniciar mantenimiento exigen ser el técnico asignado o el supervisor de la orden; otros reciben 403 y el frontend muestra banner 🔒 "Modo solo lectura".
- Modal de reasignación en `InspeccionPage` (solo supervisor).
- Selector de técnico responsable en `CrearOT` (solo supervisor).

#### Catálogo de modelos
- `ModelosPage` en `/modelos` con CRUD.
- `DELETE /api/modelos/:id` protegido contra modelos con aeronaves asociadas (409).

### Cambios en Sesión 8 — QA v2 (lugar, archivado, vista por flota, usuarios)
**Commit:** `7cacbb9` | **Rama:** `claude/qa-ui-fixes-gs3pE`

#### Schema
- `OrdenTrabajo.lugarMantenimiento` (String?) — hangar, rampa, base operativa.
- `OrdenTrabajo.archivada` (Boolean default false) — permite ocultar órdenes del dashboard principal sin borrarlas.

#### Backend
- `listarOrdenes` acepta `archivada = 'true' | 'false' | 'todas'` (por defecto excluye archivadas).
- `crearOrden` acepta `lugarMantenimiento`.
- `PATCH /api/ordenes/:id/archivar` (supervisor) — toggle archivada.
- `DELETE /api/ordenes/:id` (supervisor) — borrado en cascada manual de fotos → resultados → cierre → orden. Sólo se permite en estado `borrador` o cuando la orden ya está archivada.
- PDF muestra "Lugar de mantenimiento" en datos generales.

#### Frontend — nuevas páginas
- `AeronavesPage` en `/aeronaves` (supervisor) — CRUD completo de aeronaves con filtro de inactivas, selección de modelo y horas.
- `UsuariosPage` en `/usuarios` (supervisor) — alta/edición/desactivación con password, confirmación, licencia, teléfono y filtro por rol.
- `FlotaPage` en `/flota` — vista agrupada por aeronave con histórico desplegable de O/T. Cada resumen muestra técnico, supervisor, lugar y fecha.
- `Header` con navegación Órdenes · Flota · Aeronaves · Modelos · Usuarios (los tres últimos solo para supervisor).

#### Frontend — Dashboard
- Filtro de archivo: activas / archivadas / todas.
- Botones Archivar/Desarchivar y Eliminar (este último solo en borrador o archivadas) visibles para supervisores.
- Tarjetas muestran lugar de mantenimiento y badge "Archivada".

#### Frontend — CrearOT / Inspección
- Nuevo campo "📍 Lugar donde se realiza el mantenimiento" en CrearOT.
- InspeccionPage muestra el lugar en el bloque de datos generales.

### Cambios en Sesión 9 — QA v3 (flujo de cierre + dashboard por rol)
**Rama:** `claude/qa-ui-fixes-gs3pE`

#### Flujo de cierre — separar firma de descarga
- La firma digital **ya no descarga el PDF automáticamente**.
- `handleFirmar` solo cierra la orden (estado `cerrada`) y refresca el estado en memoria.
- El bloque de éxito ahora expone dos acciones explícitas:
  - "📥 Descargar comprobante" (bajo demanda)
  - "Volver al dashboard"

#### Dashboard — tres vistas de alto nivel
- **Mis órdenes abiertas** (default): filtra en cliente a `o.tecnico?.id === user.id || o.supervisor?.id === user.id` y `estado !== 'cerrada'`. Oculta el filtro "cerrada" y la tarjeta "Cerradas" en este modo.
- **Ver todo**: todas las órdenes activas no archivadas (propias y ajenas).
- **Archivo**: sólo órdenes archivadas.
- Estado vacío de "Mis órdenes" incluye un botón directo a "Ver todo".
- El selector de vista está como una barra de pestañas al inicio del dashboard; al cambiar vista, el filtro de estado vuelve a "Todas".

## ⚠️ Regeneración del cliente Prisma (obligatorio tras pull)

Cada sesión agrega campos al `schema.prisma`. Si al correr el backend ves
`Unknown argument 'fechaRecepcion'/'lugarMantenimiento'/'archivada'`,
el cliente no se regeneró. Soluciónalo:

```bash
cd aeromx/backend
npx prisma migrate dev --name sync_latest   # crea y aplica migración
# o, sin crear migración:
npx prisma db push
```

Luego reinicia `npm run dev`.

### Siguiente paso — Sesión 10+
1. **Fase 2 — Operaciones**: Dashboard de flota con alertas de vencimiento, asignación automática por carga de trabajo.
2. **Fase 3 — Gestión**: Inventario de partes, reportes y estadísticas, notificaciones email/push.
3. **Pruebas UAT**: Con usuarios reales en flota (técnicos en rampa, supervisores en oficina).
4. **Limpieza técnica**: revisar `backend/uploads/`, agregar `.gitignore`, auditoría de seguridad, rate-limit, input sanitization.
5. **Roadmap de despliegue**: backend/DB estable, UI en ajuste (vistas recién entregadas), funcionalidad en ajuste (firma/descarga separados), seguridad estable.
