# AeroMX — Contexto del Proyecto para Claude

> **IMPORTANTE — Estado del rediseño multiproducto**: el rediseño está **COMPLETO** — **Fases A, B, C, D y E aplicadas** (schema + roles + backend multiproducto + frontend completo: catálogos y O/T por tipo, reapertura). El backend pasa smoke test para los 4 tipos y el frontend compila (`npm run build` verde). **Lee primero [`aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md`](aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md)** — especialmente §0.2 (cómo saber en qué fase estás) y §8 (plan por fases). Las secciones de este CLAUDE.md sobre roles, schema, formatos y O/T en §"Roles de Usuario", §"Esquema de BD" y similares describen el **estado pre-rediseño** y ya **no son fuente de verdad**. La fuente de verdad ahora es el doc de arquitectura + el `schema.prisma` actual.

## ¿Qué es este proyecto?
Sistema web/móvil de gestión de mantenimiento aeronáutico. Reemplaza formatos Word manuales con un flujo digital de órdenes de mantenimiento paso a paso, con captura de evidencia fotográfica por punto de inspección y firma digital.

## Tu Rol?
Eres un experto en frontend, backe end y bases de datos.

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

## Estado del Proyecto — Última actualización: Sesión 10 (Fase A del rediseño completada)

> ⚠️ **Backend roto a propósito.** El schema fue reescrito a la arquitectura multiproducto + roles nuevos, pero `ordenesController.js`, `aeronavesService.js`, `formatosService.js`, `ordenesService.js` y todos los routes asociados siguen referenciando la API vieja (`aeronaveId`, `tecnicoId`, `supervisorId`, `ModeloAeronave`, enum `Rol` con valores viejos, etc.). El backend **no levanta** (`npm run dev` falla en el primer require de Prisma con la API vieja). El frontend tampoco funciona. Esto es esperado y se arregla en **Fase B** (backend) y **Fases C/D** (frontend). Ver bloque "Cambios en Sesión 10" abajo.

### Estado pre-rediseño (Fase 1 Core ~95%) — para referencia histórica

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

### Cambios en Sesión 10 — Fase A del rediseño multiproducto + roles + superusuario
**Fecha:** 2026-05-01 | **Rama:** `development` | **Estado:** Fase A done · Backend roto a propósito

> Esta sesión ejecuta exclusivamente la **Fase A** del plan en [`aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md`](aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md). La intención es que la app deje de levantar — los controllers/services/frontend siguen referenciando la API vieja y se adaptan en Fases B/C/D. **No intentar levantar el backend hasta empezar Fase B.**

#### Schema (`backend/prisma/schema.prisma`) — reescrito completo
- Enum `Rol` ahora: `gerente_soporte | ingeniero_soporte | tecnico_soporte | mecanico | piloto` (5 valores). Los nombres viejos (`tecnico/ingeniero/supervisor`) ya no existen.
- Nuevo enum `TipoProducto`: `aeronave | camion | planta | sensor`.
- `Usuario.superusuario: Boolean @default(false)` — flag ortogonal al rol que hace bypass de cualquier `requireRole`.
- `Modelo` (antes `ModeloAeronave`) unificado con discriminador `tipoProducto`. Unique `(tipoProducto, nombre)`.
- `Producto` (antes `Aeronave`) — tabla padre con `tipoProducto`, `modeloId`, `identificador` (matrícula/placas/serie), `numeroSerie`. Unique `(tipoProducto, identificador)`.
- 4 detalles 1:1 con `onDelete: Cascade` desde Producto: `AeronaveDetalle` (horas), `CamionDetalle` (placas/vin/odometro), `PlantaDetalle` (horimetro), `SensorDetalle` (fabricante/firmware/calibracion).
- `Formato` gana `tipoProducto` (formatos no son compartibles entre tipos).
- `OrdenTrabajo`: `aeronaveId` → `productoId`. `tecnicoId` → `soporteId`. `supervisorId` → `gerenteId` (NOT NULL ahora). Nuevos: `ingenieroAuxiliarId?` (solo si soporte es técnico), `mecanicoId` (NOT NULL), `pilotoId?` (obligatorio si producto = aeronave). `matriculaRecepcion` → `identificadorRecepcion`. Lecturas `horasTotales/horasMotorDer/horasMotorIzq/odometro/horimetro` ahora **opcionales** (se llenan al iniciar mantenimiento, Hito 3).
- `CierreOT`: 3 firmas — `firmaSoporteId/fechaFirmaSoporte`, `firmaGerenteId/fechaFirmaGerente`, `firmaPilotoId/fechaFirmaPiloto` (esta última solo aplica para aeronave).
- Nueva tabla `HistorialEstadoOT` — audit trail para reaperturas (id, ordenId, estadoAnterior, estadoNuevo, motivo, usuarioId, createdAt).

#### Migración aplicada
- Carpeta: `prisma/migrations/20260501123313_multiproducto_y_roles/migration.sql` (221 líneas).
- **Estrategia usada** (importante para futuras sesiones de Claude Code): `prisma migrate dev` requiere TTY interactivo y **no funciona en Claude Code**. El flujo correcto es:
  ```bash
  # 1. Resetear BD (si los datos son de prueba) — esto re-aplica el historial de migraciones existentes
  npx prisma migrate reset --force --skip-seed

  # 2. Generar SQL del diff (no-interactivo)
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  MIGDIR="prisma/migrations/${TIMESTAMP}_<nombre>"
  mkdir -p "$MIGDIR"
  npx prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --script > "$MIGDIR/migration.sql"

  # 3. Aplicar
  npx prisma migrate deploy

  # 4. Regenerar cliente
  npx prisma generate
  ```
- `migrate reset --force` también funciona después en sesiones posteriores (datos siguen siendo de prueba).

#### Seed (`backend/prisma/seed.js`) — reescrito
- 6 usuarios (todos password `aeromx123`). Ver tabla "Usuarios de prueba" más abajo.
- 4 modelos (uno por tipo): Cessna 172S, F-350 Super Duty, XQ60, LiDAR VLP-16.
- 4 productos (uno por tipo): `XB-ABC` (aeronave), `MX-CAM-001` (camión), `PE-001` (planta), `SE-001` (sensor) — cada uno con su detalle correspondiente.
- 4 formatos:
  - **aeronave** · "Mantenimiento Menor" — las 14 secciones reales con 106 puntos (igual que antes).
  - **camion** · "Inspección Preventiva" — 1 sección (Motor) con 3 puntos.
  - **planta** · "Mantenimiento de Horímetro 100h" — 1 sección con 3 puntos.
  - **sensor** · "Calibración y Verificación" — 1 sección con 2 puntos.

#### Middleware y auth
- `backend/src/middleware/auth.js` — `requireRole` hace **bypass total** si `req.user.superusuario === true`.
- `backend/src/services/authService.js` — `findUserByEmail` ahora devuelve `superusuario`, y `generateToken` lo incluye en el payload del JWT.

#### `.env`
- **JWT_SECRET rotado** a 96 chars random. Cualquier token JWT emitido antes del rediseño ya no validará — los usuarios deben volver a hacer login. Esto era necesario porque los tokens viejos llevan `rol: 'supervisor'` que ya no existe en el enum.

#### Verificación post-Fase A (todos pasan)
- `grep -q "enum TipoProducto" prisma/schema.prisma` → ✅
- `SELECT tipo_producto, COUNT(*) FROM productos GROUP BY tipo_producto` → ✅ 1 fila por cada uno de los 4 tipos.
- Seed corre limpio (`npm run db:seed`) sin errores.

#### Lo que NO se tocó en Sesión 10 (queda para fases siguientes)
- ❌ `backend/src/controllers/ordenesController.js` (1101 líneas — se modulariza en Fase B)
- ❌ `backend/src/services/ordenesService.js`, `aeronavesService.js`, `formatosService.js`, `modelosService.js`
- ❌ `backend/src/routes/*.js` (excepto el implícito de auth)
- ❌ `backend/src/controllers/*.js` (excepto auth)
- ❌ Todo el frontend (Fases C/D)
- ❌ El PDF (`backend/src/pdf/markdown.js`)

#### Usuarios de prueba (Sesión 10+) — todos con password `aeromx123`
| Email | Rol | Superusuario |
|---|---|:-:|
| `dev@aeromx.com` | gerente_soporte | ✅ |
| `gerente@aeromx.com` | gerente_soporte | ❌ |
| `ingeniero@aeromx.com` | ingeniero_soporte | ❌ |
| `tecnico@aeromx.com` | tecnico_soporte | ❌ |
| `mecanico@aeromx.com` | mecanico | ❌ |
| `piloto@aeromx.com` | piloto | ❌ |

#### Productos de prueba creados
| Tipo | Identificador | Modelo | Detalle |
|---|---|---|---|
| aeronave | `XB-ABC` | Cessna 172S | horasTotales=1250.5 |
| camion | `MX-CAM-001` | F-350 Super Duty | placas=MX-CAM-001, vin=1FT8W3DT5KEE12345, odometro=84200 |
| planta | `PE-001` | XQ60 | horimetro=320 |
| sensor | `SE-001` | LiDAR VLP-16 | versionFirmware=3.2.1, fechaCalibracion=2026-01-15 |

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

### Cambios en Sesión 11 — Fase B completada (backend multiproducto)
**Fecha:** 2026-05-21 | **Rama:** `development` | **Estado:** Fase B done · backend funcional para los 4 tipos

#### Modularización de `ordenesController.js`
- Nuevo `backend/src/middleware/upload.js` (multer extraído desde `routes/ordenes.js`).
- Nueva carpeta `backend/src/controllers/ordenes/` con 6 sub-controllers:
  - `ordenesController.js` — listar, obtener, crear, actualizarEstado
  - `workflowController.js` — recepcionar, iniciarMantenimiento, asignar, archivar, eliminar, **reabrir** (nuevo)
  - `resultadosController.js` — actualizar, firmar
  - `fotosController.js` — subir, eliminar
  - `cierreController.js` — gestionar, firmar
  - `pdfController.js` — generar (con `RENDER_POR_TIPO` y firmas condicionales)
- `routes/ordenes.js` reescrito como router índice limpio.
- `backend/src/controllers/ordenesController.js` viejo **eliminado**.
- `recepcionarAeronave` renombrado a `recepcionar`.
- `verificarPermisoEdicion` ahora considera asignado a soporte/auxiliar/mecánico/gerente (5 slots) y respeta superusuario.

#### `productos*` reemplazan a `aeronaves*`
- Nuevo `backend/src/services/productosService.js` con dispatcher por tipo: maneja `aeronave`/`camion`/`planta`/`sensor` y CRUD de `*Detalle` 1:1.
- Nuevo `controllers/productosController.js` + `routes/productos.js` registrado en `index.js`.
- Eliminados: `services/aeronavesService.js`, `controllers/aeronavesController.js`, `routes/aeronaves.js`.
- Endpoints: `GET /api/productos?tipoProducto=camion&activo=true`, `GET /api/productos/:id` (incluye detalle), `POST/PUT/DELETE`.
- Body de POST: `{ tipoProducto, modeloId, identificador, numeroSerie, detalle: {…} }`. `detalle` se valida por tipo (placas obligatorias en camión, etc.).

#### Servicios adaptados al schema multiproducto
- `modelosService.js`: usa `prisma.modelo` (no `modeloAeronave`), acepta filtro `tipoProducto`, valida tipo al crear, devuelve `_count.productos`.
- `formatosService.js`: `listarFormatos` acepta `{ tipoProducto, soloActivos }`. `crearFormato` valida `tipoProducto`.
- `usuariosService.js`: `ROLES_VALIDOS` ahora son los 5 nuevos roles. Acepta y persiste el flag `superusuario` (booleano, default false).

#### `ordenesService.js` reescrito
- `crearOrden(data)` valida coherencia `formato.tipoProducto === producto.tipoProducto` (400 si no), y las 4-5 asignaciones obligatorias:
  - `soporteId`: rol ∈ {tecnico_soporte, ingeniero_soporte} — obligatorio.
  - `mecanicoId`, `gerenteId`: obligatorios con rol correspondiente.
  - `pilotoId`: obligatorio solo si tipo=aeronave, prohibido en otros.
  - `ingenieroAuxiliarId`: opcional, solo si soporte es técnico (rechaza si soporte es ingeniero).
  - Cada FK debe ser usuario activo con el rol esperado.
- `iniciarMantenimiento(id, lecturas)` ahora exige la lectura correspondiente al tipo:
  - aeronave → `horasTotales` (motor der/izq opcionales)
  - camión → `odometro`
  - planta → `horimetro`
  - sensor → ninguna
- `registrarRecepcion(id, { identificadorConfirmado })` valida contra `producto.identificador` (antes contra matrícula).
- `asignarOrden(id, parcial)` fusiona con la asignación actual y revalida coherencia antes de aplicar.
- **Nuevo `reabrirOrden(id, { motivo, usuarioId })`**: borra firmas del cierre, devuelve estado a `pendiente_firma`, limpia `fechaCierre`, registra evento en `historial_estados_ot`. Motivo obligatorio.
- `firmarCierre(ordenId, usuarioId)`: el slot a firmar se infiere del rol del usuario (gerente → gerente, técnico/ingeniero → soporte/auxiliar, piloto → piloto). Solo el usuario asignado al slot puede firmar (o superusuario). Aeronave requiere 3 firmas para cerrar; resto requiere 2. Al cerrar:
  - Sincroniza lecturas al `*Detalle` del producto (solo si la nueva ≥ la actual, no permite retroceso).
  - Registra el cambio de estado en `historial_estados_ot`.
- `eliminarOrden` ahora también borra `historial_estados_ot` en cascada.

#### PDF dinámico por tipo (`controllers/ordenes/pdfController.js`)
- `filasDatosProducto(orden)` genera el bloque "Datos del producto" según `tipoProducto`:
  - aeronave: matrícula + modelo + serie + 3 columnas de horas
  - camión: placas + VIN + serie + odómetro
  - planta: serie + modelo + horímetro
  - sensor: serie + modelo + fabricante + firmware + fecha de calibración
- `renderPersonal` ahora dibuja 4-5 cards: SOPORTE, INGENIERO AUXILIAR (si hay), MECÁNICO, GERENTE, PILOTO (si aeronave).
- `drawFirmas` pinta 3 cajas para aeronave (soporte + gerente + piloto) y 2 para el resto.
- Encabezado del PDF usa `producto.identificador` en lugar de `aeronave.matricula`.
- Compatibilidad: el renderer viejo `datos_aeronave` queda como alias de `datos_producto` para no romper formatos con secuencia guardada.

#### Permisos (routes)
- `requireRole(['supervisor','ingeniero'])` → `requireRole(['gerente_soporte','ingeniero_soporte'])` en todos los routes de `productos`, `modelos`, `formatos` y `ordenes` (escritura).
- **Excepción**: `routes/usuarios.js` solo permite escritura a `gerente_soporte` (no a ingeniero), conforme §2.3 del doc.
- `verifyToken` y `requireRole` ya tenían bypass por `superusuario`; los superusuarios pasan todos los checks.

#### Smoke test (cURL/Python en `tmp-smoke/`)
- Reset BD + seed limpio (6 usuarios, 4 productos, 4 formatos).
- Login con `dev@aeromx.com` (superusuario) → JWT.
- Para cada uno de los 4 tipos (aeronave, camión, planta, sensor):
  1. POST `/api/ordenes` con asignaciones completas (soporte=técnico, auxiliar=ingeniero, mecánico, gerente, +piloto si aeronave).
  2. POST `/recepcion` validando `identificador`.
  3. POST `/iniciar-mantenimiento` con la lectura del tipo (aeronave: 1300h, camión: 85000km, planta: 350h, sensor: nada).
  4. PATCH todos los puntos con `completado:true`, `estadoResultado:'bueno'`.
  5. POST `/cierre` con `seEncontroDefecto:false`.
  6. POST `/cierre/firmar` haciendo login como cada usuario asignado al slot (técnico para soporte, gerente para gerente, piloto para piloto).
  7. Verificar estado=`cerrada` y descargar PDF (`Content-Type: application/pdf`, header `%PDF-`).
- Reapertura: POST `/reabrir` sobre la O/T de aeronave con `motivo` → estado vuelve a `pendiente_firma`, las 3 firmas se borran, `historial_estados_ot` registra 2 entradas (cierre por firmas + reapertura).
- Sincronización de lecturas al cerrar: aeronave 1250.5 → 1300, camión 84200 → 85000, planta 320 → 350. ✓

#### Smoke test PASS ✅
Los 5 PDFs generados quedaron en `tmp-smoke/OT-*.pdf` (52-68 KB). Esta carpeta es scratch — se puede borrar.

#### Lo que NO se tocó en Sesión 11 (queda para Fase C/D/E)
- ❌ Todo el frontend (`frontend/src/**`). Tira 404s contra el backend porque sigue llamando a `/api/aeronaves`, manda `aeronaveId`/`tecnicoId`/`supervisorId` al crear O/T, no envía mecánico ni piloto, etc.
- ❌ `frontend/src/api/aeronavesService.js` aún existe (lo elimina Fase C).

#### Sesiones siguientes
- **Sesión 12 = Fase C** — Frontend catálogos: `ProductosPage` con tabs, `ModelosPage`/`FormatosPage` con tabs, `Header` con visibilidad por rol, `UsuariosPage` con superusuario.
- **Sesión 13 = Fase D** — Frontend O/T: `CrearOTPage` con selector de tipo + 4-5 selectores de asignación, `InspeccionPage` con lecturas según tipo + sección historial, `CierreOTPage` con slot piloto si aeronave, `DashboardPage` con botón Reabrir.
- **Sesión 14 = Fase E** — Pulido y QA final.

### Sesión 11 — Setup verificado
```bash
cd aeromx
docker compose up -d                           # Postgres :5433 + MinIO
cd backend
npx prisma migrate deploy                       # OK (5 migraciones aplicadas)
npm run db:seed                                 # 6 usuarios + 4 productos + 4 formatos
npm run dev                                     # API en :3001
# Smoke test:
cd ../../tmp-smoke
python smoke.py                                 # ✅ pasa los 4 tipos + reapertura
```

### Cambios en Sesión 12 — Fase C completada (frontend catálogos por tipo + permisos)
**Fecha:** 2026-05-21 | **Rama:** `development` | **Estado:** Fase C done · catálogos UI multiproducto funcionando

> Esta sesión ejecutó la **Fase C** del plan en [`aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md`](aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md). El frontend de catálogos ya habla con el backend multiproducto. Las páginas de O/T siguen rotas a propósito hasta Fase D.

#### Fundacional
- `frontend/src/tokens/design.js`: `ROL_LABELS`/`ROL_COLOR` reescritos con los **5 roles nuevos** (`gerente_soporte`, `ingeniero_soporte`, `tecnico_soporte`, `mecanico`, `piloto`). Nuevos exports: `ROLES` (lista para selects), `TIPO_PRODUCTO` (label/ícono/color por tipo) y `TIPOS_PRODUCTO`.
- **Backend `authController.js`**: `superusuario` ahora viaja en la respuesta de `POST /api/auth/login` (objeto `user`) y `GET /api/auth/me`. Antes solo iba en el JWT; sin esto el frontend no podía aplicar permisos de superusuario. (Ajuste mínimo necesario, no contemplado originalmente en el plan de Fase C.)

#### API frontend
- **Nuevo** `frontend/src/api/productosService.js` (listar/obtener/crear/actualizar/desactivar contra `/api/productos`). POST/PUT envían `detalle:{…}` según tipo.
- **Eliminados** `frontend/src/api/aeronavesService.js` y `frontend/src/pages/AeronavesPage.jsx`.
- `modelosService.listar` y `formatosService.listar` ahora aceptan `{ tipoProducto }` como query param.

#### Páginas / componentes
- **Nuevo** `frontend/src/pages/ProductosPage.jsx` (reemplaza `AeronavesPage`): pestañas por tipo persistidas en query string (`?tipo=`), tabla con columna "Detalle" dinámica por tipo, y un `FormularioProducto` que muta sus campos según el tipo (aeronave: horas; camión: placas\*/vin/odómetro; planta: horímetro; sensor: fabricante/firmware/fecha calibración). Envía `{ tipoProducto, modeloId, identificador, numeroSerie, detalle }`.
- `ModelosPage.jsx`: tabs por tipo, `listar({ tipoProducto })`, `crear` inyecta `tipoProducto` del tab activo, `_count.aeronaves` → `_count.productos`, permiso `puedeEditar` (gerente/ingeniero/super).
- `FormatosPage.jsx`: tabs por tipo, `listar({ tipoProducto })`, `crear` inyecta `tipoProducto`. `esSupervisor` redefinido a gerente/ingeniero/super.
- `FlotaPage.jsx`: reescrita — tabs por tipo, usa `productosService`, agrupa O/T por `productoId`, muestra `identificador` y detalle por tipo; el resumen de O/T usa `soporte`/`gerente` (antes `tecnico`/`supervisor`).
- `UsuariosPage.jsx`: filtros y selector de rol generados desde `ROLES` (5 valores), checkbox **⚡ Superusuario** en el form (se persiste vía `superusuario` en el body), badge "⚡ Super" en la tabla. Permiso de página: gerente_soporte o superusuario.
- `Header.jsx`: link "Aeronaves" → "Productos" (`/productos`); visibilidad por rol — catálogos (Productos/Modelos/Formatos) para gerente/ingeniero/super, Usuarios solo gerente/super, Flota/Órdenes para todos.
- `App.jsx`: ruta `/productos` reemplaza `/aeronaves`.

#### Ajuste mínimo fuera de alcance (para no romper el build)
- `CrearOTPage.jsx` importaba el `aeronavesService` eliminado → se cambió **solo** el import y la llamada a `productosService.listar()`. Su lógica completa (envía `aeronaveId`/`tecnicoId`/`supervisorId`, roles viejos) sigue siendo **Fase D** y está rota en runtime, como estaba previsto.

#### Verificación
- `npm run build` (Vite) del frontend: ✅ 120 módulos transformados, sin errores de imports.
- Grep de seguridad: no quedan referencias a `aeronavesService`/`AeronavesPage`/`_count.aeronaves`/`/aeronaves` en archivos de Fase C. Los `'supervisor'`/`rol === 'tecnico'` restantes viven solo en `CrearOTPage`/`CierreOTPage`/`DashboardPage`/`InspeccionPage` (Fase D).

#### Lo que NO se tocó en Sesión 12 (queda para Fase D/E)
- ❌ `CrearOTPage` (salvo el import), `InspeccionPage`, `CierreOTPage`, `DashboardPage`, `frontend/src/api/ordenesService.js`. Siguen rotas contra el backend nuevo.

### Siguiente paso — Sesión 13 = **Fase D** (frontend O/T multiproducto)

> **Antes de empezar**: leer §2.2, §6.4 y §7.4 de [`aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md`](aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md). Verificar §0.2 — Fases A, B y C deberían estar done.

**Setup inicial de la sesión** (no destructivo, solo verifica):
```bash
cd aeromx
docker compose ps                              # postgres :5433 + minio :9000/9001
cd backend && npm run dev                       # API en :3001
cd ../frontend && npm run build                 # debería pasar (Fase C verde)
```

**Plan de Fase D** (O/T multiproducto en UI + reapertura):
- **Fase D**: `CrearOTPage` con selector de tipo (carga modelos/productos/formatos del tipo) + sección de asignación con 4-5 selectores (`soporteId`, `ingenieroAuxiliarId` condicional, `mecanicoId`, `gerenteId`, `pilotoId` si aeronave) — quitar inputs de horas. `InspeccionPage` con panel "Iniciar mantenimiento" que pide lecturas según tipo + header dinámico + sección "Historial de estados". `CierreOTPage` con slot de firma de piloto si aeronave. `DashboardPage` con `identificador` correcto + botón "Reabrir" (gerente) + modal de motivo. `ordenesService.js` adaptado (endpoint `reabrir`, body de `crear`).
- **Fase E**: pulido (copy, validaciones, etiquetas, actualizar este CLAUDE.md con resumen final).

**Notas vigentes (NO borrar — siguen aplicando)**:
- ⚠️ Ya no existen los roles `tecnico/ingeniero/supervisor` — solo `gerente_soporte/ingeniero_soporte/tecnico_soporte/mecanico/piloto`. Cualquier referencia hardcoded en frontend rompe.
- ⚠️ El JWT ahora lleva `superusuario: boolean` en el payload. Aprovecharlo en el frontend para mostrar/ocultar acciones administrativas.
- 💡 Token de prueba con superusuario: login `dev@aeromx.com / aeromx123`.

### Cambios en Sesión 13 — Fases D y E completadas (frontend O/T multiproducto + pulido) · REDISEÑO COMPLETO
**Fecha:** 2026-05-21 | **Rama:** `development` | **Estado:** Fases D y E done · rediseño multiproducto terminado de punta a punta

> Esta sesión ejecutó las **Fases D y E** del plan en [`aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md`](aeromx/docs/ARQUITECTURA-MULTIPRODUCTO.md). Con esto el frontend de órdenes habla con el backend multiproducto y el rediseño queda **cerrado**.

#### `api/ordenesService.js`
- `recepcionarAeronave` → **`recepcionar(id, identificadorConfirmado)`** (body `{ identificadorConfirmado }`, valida contra `producto.identificador`).
- `iniciarMantenimiento(id, lecturas)` — ahora envía las lecturas del medidor en el body (aeronave: `horasTotales`/motor der/izq; camión: `odometro`; planta: `horimetro`; sensor: nada).
- `asignar(id, asignaciones)` — body con los 5 slots (`soporteId`, `ingenieroAuxiliarId`, `mecanicoId`, `gerenteId`, `pilotoId`).
- **Nuevo `reabrir(id, motivo)`** → `POST /ordenes/:id/reabrir`.
- `firmarCierre(id)` — sin body; el backend infiere el slot del rol del usuario.

#### `CrearOTPage.jsx`
- Selector de **tipo de producto** en pestañas (`TIPO_PRODUCTO`). Al cambiar tipo recarga formatos+productos del tipo (`listar({ tipoProducto })`).
- Sección "Asignación de responsables" con 4-5 selectores filtrados por rol: soporte (técnico/ingeniero), ingeniero auxiliar (solo si soporte es técnico), mecánico, gerente, piloto (solo aeronave, obligatorio).
- **Sin inputs de horas** (las lecturas se piden al iniciar). Guard de página: solo gerente/ingeniero/super; el resto ve aviso.
- Payload nuevo: `{ formatoId, productoId, soporteId, ingenieroAuxiliarId?, mecanicoId, gerenteId, pilotoId?, cliente?, ordenServicio?, lugarMantenimiento? }`.

#### `InspeccionPage.jsx`
- Todo `orden.aeronave`/`matricula`/`tecnico`/`supervisor` → `orden.producto`/`identificador`/`soporte`/`gerente` (+ mecánico, piloto).
- Header dinámico: ícono+badge por tipo, `identificador`, y bloque de **lecturas del medidor** según tipo (solo tras iniciar).
- **`IniciarPanel`**: pide la lectura correspondiente al tipo antes de iniciar el mantenimiento; prefill desde el detalle del producto.
- Recepción valida `identificador` genérico (matrícula/placas/serie).
- Permisos `puedeEditar` espejan `verificarPermisoEdicion` del backend: soporte/auxiliar/mecánico/gerente asignado o superusuario. Reasignación (gerente/super) con modal de **5 slots**.
- Nueva sección desplegable **"Historial de estados"** (`orden.historial`: estado anterior → nuevo · usuario · fecha · motivo).

#### `CierreOTPage.jsx`
- Firmas soporte/gerente/(piloto si aeronave). `firmaTecnicoId/firmaSupervisorId` → `firmaSoporteId/firmaGerenteId/firmaPilotoId`.
- Aeronave requiere **3 firmas**, resto **2**. El slot del usuario se infiere del rol; el bloque de firma solo aparece si el usuario está asignado a ese slot y aún no firmó.
- Datos de la orden con `identificador`, soporte, gerente y piloto (si aeronave).

#### `DashboardPage.jsx`
- `esSupervisor` → `esGerente` (gerente/super) para archivar/eliminar/**reabrir**; `puedeCrear` (gerente/ingeniero/super) controla el botón "+ Nueva Orden".
- Tarjeta con `producto.identificador` + badge de tipo; metas Soporte/Gerente; "Mis órdenes" filtra por los **5 slots** de asignación.
- Botón **"↺ Reabrir"** en O/T cerradas (gerente) + **modal de motivo** obligatorio.

#### Verificación
- `npm run build` (Vite): ✅ 120 módulos, sin errores de imports.
- Grep de seguridad: no quedan referencias a `aeronave?`/`.matricula`/`orden.tecnico`/`orden.supervisor`/roles viejos/`firmaTecnicoId`/`recepcionarAeronave` en `frontend/src` (salvo un comentario en `productosService.js`).
- Backend sin cambios esta sesión — sigue el de Fase B (smoke test de los 4 tipos + reapertura pasando). Los contratos del frontend coinciden con esos endpoints.

#### Smoke test e2e (Sesión 13) — 31/31 PASS ✅
Script efímero (urllib, sin dependencias) corrido contra la API real en `:3001`. Validó los **contratos que consume la Fase D** de punta a punta para **camión + aeronave**:
- login + flag `superusuario`; crear O/T con asignación 4-5 slots; recepción validando `identificador`; iniciar con lectura por tipo (camión `odometro`, aeronave `horasTotales`+motores); completar puntos; cierre; **firma por slot** (login como tecnico@/gerente@/piloto@); estado→`cerrada`; PDF (`%PDF`); **sincronización de odómetro** (86000); **reapertura** (vuelve a `pendiente_firma`, borra firmas, historial ≥2, exige `motivo`).
- ⚠️ Aprendizaje (para el smoke, no es bug): hay **2 `gerente_soporte`** (dev super + gerente@). Para firmar el slot gerente hay que loguearse como el usuario **asignado** (gerente@), no como cualquier gerente — seleccionar usuarios por **email**, no por `by_role[...][0]`.
- ⚠️ `prisma generate` da `EPERM` si el backend está corriendo (DLL bloqueada). Si cambias el schema, **detén el backend antes de `prisma generate`**. El smoke no necesitó regenerar.

#### Setup rápido para arrancar (verificado en Sesión 13)
```bash
cd aeromx && docker compose up -d        # Postgres :5433 + MinIO (suelen quedar arriba entre sesiones)
cd backend && npm run dev                 # API :3001  (revisa primero si ya corre: curl localhost:3001/api/health)
cd ../frontend && npm run dev             # UI :5173 — login dev@aeromx.com / aeromx123
```
> El backend suele quedar corriendo vía nodemon entre sesiones. Antes de `npm run dev` revisa `GET /api/health` o `Get-CimInstance Win32_Process -Filter "name='node.exe'"`.

### Cambios en Sesión 14 — QA visual e2e + fix de firma de puntos críticos · REDISEÑO CERRADO
**Fecha:** 2026-05-21 | **Rama:** `development` | **Estado:** QA navegador completo (4 tipos) · 1 bug encontrado y arreglado

> QA manual guiado en navegador (el usuario maneja la UI, Claude verifica en vivo contra Postgres + archivos de `uploads/`). Cubrió lo que el smoke por API no cubría: visibilidad por rol, flujo completo en pantalla, revisión visual de PDFs y fotos.

#### QA — todo verificado en navegador (PASS)
- **Visibilidad por rol** (Header + botones): `tecnico_soporte` solo ve Órdenes/Flota; `ingeniero_soporte` ve catálogos y puede crear pero no Usuarios ni Reabrir; `gerente_soporte`/super ven todo + Reabrir. ✅
- **Flujo completo por tipo** (crear → recepción → iniciar → puntos → cierre → firmas → PDF):
  - **aeronave** (XB-ABC): 5 slots con auxiliar condicional, recepción valida identificador, iniciar pide horas, foto en punto "con daños", 3 firmas (soporte+gerente+piloto por rol), sincronización de horas con no-retroceso. ✅
  - **camión** (MX-CAM-001): iniciar pide **odómetro**, 4 slots sin piloto, 2 firmas, odómetro sincronizado. ✅
  - **planta** (PE-001): iniciar pide **horímetro**, 2 firmas, horímetro sincronizado. ✅
  - **sensor** (SE-001): iniciar **sin medidor**, 2 firmas. ✅
- **Fotos**: suben, se ven en inspección (miniatura) y quedan **embebidas en el PDF** (el PDF de aeronave pesa ~61 KB más por la foto). ✅
  - ⚠️ **Hallazgo (no bug):** la subida de fotos NO usa MinIO. Pese a `STORAGE_PROVIDER=minio` en `.env` y MinIO en docker, `src/middleware/upload.js` usa `multer.diskStorage` a `backend/uploads/` y se sirve vía proxy estático `/uploads`. No hay SDK de MinIO/S3 ni `putObject` en el backend. La integración a MinIO/S3 está **pendiente de implementar** (relevante para despliegue nube/on-premise).
- **PDFs por tipo** (revisión visual): datos correctos por tipo, nº de firmas (3 aeronave / 2 resto), bloque de asignaciones. ✅

#### 🔴 Bug encontrado y ARREGLADO — cierre sin firma de puntos críticos
- **Síntoma:** se podía firmar y cerrar una O/T con puntos `es_critico` sin su firma individual (regla de negocio: "pasos críticos requieren firma digital individual por paso"). Reproducido en navegador: aeronave cerrada con 19/20 críticos sin firmar.
- **Causa raíz:** el gate de cierre (`cierreController.gestionar`) solo validaba `verificarPuntosCompletos` (cuenta `completado`), nunca la firma de críticos.
- **Fix aplicado:**
  - `services/ordenesService.js`: nueva `verificarCriticosFirmados(ordenId)` → `{ total, firmados, faltan, completo }` sobre puntos `es_critico`.
  - `controllers/ordenes/cierreController.js`: gate al crear cierre (rechaza con *"faltan N de M firmas en puntos críticos"*).
  - `services/ordenesService.js` → `firmarCierre`: gate al firmar (defensa en profundidad — **cubre el bypass por reapertura**, que no vuelve a pasar por `gestionar`). Ni el superusuario lo evade (es regla de negocio, no de permiso).
- **Verificación:** bloquea con críticos sin firmar (vía API y en UI, en aeronave y camión) y permite cuando están firmados. El frontend ya muestra el error (`CierreOTPage.jsx:135`). Universal a los 4 tipos: aeronave (20 críticos), camión (2), planta (1), sensor (0 → no-op).
- ⏳ **Sin commitear aún** (el usuario commitea cuando decide).

#### 💡 Mejora opcional pendiente (no hecha)
- Frontend: que `CierreOTPage` liste/enlace los puntos críticos pendientes de firma, en vez de solo mostrar el error al intentar firmar.

#### ❓ Sin confirmar (revisar si reaparece)
- En la 0009 se probó "¿Se encontró defecto? = Sí" + `RPT-001`, pero el cierre guardó `se_encontro_defecto=false`. La validación de "ref obligatorio si hay defecto" SÍ funcionó (lee el valor en vivo), así que probablemente el usuario lo cambió a "No" antes de guardar. **No confirmado** si el toggle persiste correctamente el "Sí" — verificar en una próxima O/T si vuelve a aparecer.

#### Estado de datos de prueba tras la sesión
- Órdenes nuevas creadas en QA: `OT-...-0009` (aeronave, con foto), `0010` (camión), `0011` (planta), `0012` (sensor) — todas `cerrada`.
- PDFs de QA quedaron en `/tmp/qa-pdfs/` (scratch, se puede borrar).

### Cambios en Sesión 15 — Almacenamiento real MinIO/S3 para fotos + commit del fix de críticos
**Fecha:** 2026-05-22 | **Rama:** `development` | **Estado:** integración de storage completa y verificada (MinIO + driver local)

#### Fix de firma de puntos críticos — COMMITEADO
- Commit `4822c24`: `verificarCriticosFirmados()` + gate doble (`cierreController.gestionar` y `ordenesService.firmarCierre`). Solo los 2 archivos del fix (sin CLAUDE.md ni `.claude/`).

#### Capa de abstracción de almacenamiento (nuevo `src/lib/storage/`)
- `helpers.js` — `generarKey()`, `contentTypeDesdeKey()`, `keyDesdeUrl()` (puros, sin estado, evitan dependencia circular).
- `localDriver.js` — disco `backend/uploads/` (comportamiento histórico + fallback). Guard anti path-traversal.
- `s3Driver.js` — **un solo driver para MinIO y AWS S3** (`@aws-sdk/client-s3`). MinIO usa `endpoint` + `forcePathStyle:true`; S3 usa region/credenciales (o cadena por defecto IAM). `ensureReady()` crea el bucket si falta.
- `index.js` — fachada con selección **perezosa** del driver por `STORAGE_PROVIDER` (`local|minio|s3`). Perezosa porque `dotenv.config()` corre **después** de los imports en `index.js` (no hay preload `-r dotenv/config`); construir el driver al importar leería env vacío. `storageProvider()` tolera comentarios en línea del `.env` (`minio   # ...`) tomando el primer token.
- Métodos: `ensureReady`, `put({buffer,contentType,originalName})→{key}`, `putRaw({key,buffer,contentType})` (preserva key, para migración), `getBuffer(key)`, `getStream(key)`, `delete(key)`.

#### Wiring
- `npm i @aws-sdk/client-s3 @aws-sdk/lib-storage`.
- `middleware/upload.js` → `multer.memoryStorage()` (antes `diskStorage`). El controller recibe `req.file.buffer`.
- `controllers/ordenes/fotosController.js` → `subir` llama `storage.put()` y guarda `urlArchivo=/uploads/<key>`; `eliminar` además llama `storage.delete(key)` → **arregla el bug de archivos huérfanos** (antes solo borraba la fila).
- `index.js` → reemplaza `express.static('/uploads')` por ruta **`GET /uploads/:key`** que hace stream vía `storage.getStream()` (proxy por backend, infra-agnóstico, frontend intacto). Llama `storage.ensureReady()` al arranque (no bloqueante).
- `controllers/ordenes/pdfController.js` → como los renderers son **síncronos**, se **pre-cargan los buffers** async (`precargarFotos()` → `Map<urlArchivo,Buffer>`) antes del loop y `doc.image(buffer,…)` los embebe. Se eliminó `resolverArchivoFoto` (leía de disco). Solo embebe PNG/JPEG; el resto cae a placeholder "Archivo no disponible".

#### Migración (`scripts/migrar-fotos-a-storage.js`)
- Sube los archivos de `backend/uploads/` al bucket conservando la key (para que los `url_archivo` ya guardados resuelvan). Idempotente; no-op si `STORAGE_PROVIDER=local`.
- **Ejecutado:** 23 fotos previas (QA) migradas a MinIO. Segunda corrida: 0 subidos / 23 ya existían.

#### Decisión de arquitectura tomada en esta sesión
- **Servir fotos = proxy por backend** (no presigned URLs) — elegido por el usuario. Mantiene `urlArchivo` y el frontend sin cambios; funciona igual on-premise o nube sin exponer el bucket.

#### Verificación e2e (todo PASS ✅)
- Subida (OT-0008, campo multipart `foto`) → 201 con `urlArchivo`; `GET /uploads/:key` → 200, `image/png`, bytes idénticos; **no** queda en disco local (fue a MinIO); bucket lista el objeto.
- Borrado → 204, serve 404, bucket vuelve a 0 objetos.
- PDF de la orden → `%PDF`, 68 KB con la foto embebida.
- Driver `local` (aislado): put/getBuffer/getStream/delete round-trip + guard de path-traversal + delete idempotente.
- `.gitignore` ya cubre `.env` y `backend/uploads` — el SDK aparece en `package.json`/`package-lock.json`.

#### Notas / pendientes
- `.env` real sigue con `STORAGE_PROVIDER=minio`. Para despliegue AWS: `STORAGE_PROVIDER=s3` + credenciales (o rol IAM).
- Los 23 archivos siguen también en `backend/uploads/` (no se borraron del disco; ya están en MinIO y el bucket es la fuente al servir con `minio`).
- Sigue pendiente (opcional): UI de cierre que liste puntos críticos sin firmar.

#### Commits de la sesión (rama `development`)
- `4822c24` — Fix: firma obligatoria de puntos críticos antes de cerrar.
- `e8260b6` — Almacenamiento real de fotos en MinIO/S3 (capa de abstracción) + notas de esta sesión en CLAUDE.md.

---

### Cambios en Sesión 16 — Rediseño visual del PDF de O/T (estilo HYDRA)
**Fecha:** 2026-05-22/23 | **Rama:** `development` | **Estado:** rediseño del PDF completo y verificado (4 tipos) · trabajo en `development`, sin push/merge

> Ejecutado con **subagent-driven-development** siguiendo [`docs/superpowers/plans/2026-05-22-rediseno-pdf-orden-trabajo.md`](docs/superpowers/plans/2026-05-22-rediseno-pdf-orden-trabajo.md) (spec en `docs/superpowers/specs/`). 11 tareas, cada una con implementador + revisión en dos etapas (cumplimiento de spec → calidad). Solo se tocó la **salida PDF**; **datos, endpoints y almacenamiento intactos**.

#### Sistema de diseño nuevo (`backend/src/pdf/`)
- **`theme.js`** (nuevo): paleta `COLOR` (oklch→hex del prototipo), tokens `FONT` + `registerFonts(doc)`/`font(doc, token)` con **fallback a Helvetica/Courier** si faltan los TTF, y formateadores `fmtFecha`/`fmtHora`/`fmtFechaHora`/`fmtDuracion`.
- **`ui.js`** (nuevo): 17 primitivas de dibujo pdfkit — `ensureSpace`, `roundedPanel`, `sectionHead`, `statusPill`/`conditionPill`/`rolePill`, `timeline`, `kvGrid`, `personCard`, `worksColumns`/`worksTableHeader`/`groupHead`/`workRow`, `evidenceGallery`, `progressBar`/`dictumBlock`, `signatureCard`.
- **`fonts/`** (nuevo): 6 TTF Geist/Geist Mono (OFL). ⚠️ las URLs del repo `vercel/geist-font` del plan estaban obsoletas (404); la ruta correcta es `fonts/Geist/ttf/` y `fonts/GeistMono/ttf/`.
- **`public/hydra-logo.png`** (nuevo): logo del handoff teñido a negro (alpha preservado) con `pngjs` (dependencia temporal, ya desinstalada).

#### `controllers/ordenes/pdfController.js` — restilizado de punta a punta
- Cabecera papel claro (logo en tinta + meta a la derecha + separador), título grande + folio mono + **status pill** por estado, **timeline de 4 hitos**, §01 datos generales (KV grid 4-col redondeado, hitos movidos al timeline + "Duración total"), §02 datos del producto (KV grid 3-col por tipo, conserva `filasDatosProducto`), §03 **person cards** (2–5 según tipo), §04 tabla de trabajos (group heads con progreso + condition pills + ✦ críticos) con **galería de evidencia por renglón** (se eliminó la sección de fotos separada), §05 dictamen con **barra de progreso** + observaciones, §06 **signature cards** (2/3 según tipo, rúbrica mono-italic + check + timestamp), footer "Página N de M".
- Se eliminaron todos los helpers/colores legacy (`sectionTitle`, `drawKVGrid`, `drawTableHeader/Row`, `drawPersonaCard`, `drawFirmaBox`, `drawEvidenciaFotografica`, etc.) y el shim temporal `_COMPAT` (existió en commits intermedios para no romper generación durante la migración sección por sección).

#### Defectos atrapados por las revisiones (corregidos antes de commit final)
- `fmtDuracion`: guardia falsy con `desde=0` → `== null`; `"1 d 0 h"` → `"1 d"`.
- shim `_COMPAT.accent` pisaba el azul del theme usado por `rolePill` → renombrado `obsColor`.
- ✦ crítico mal ubicado al hacer wrap el componente → texto `continued`.
- `evidenceGallery`: faltaba `doc.restore()` si `doc.image()` lanzaba (clip leak) → `finally`.
- signature card: solapamiento rol/licencia con la línea del pie → `lineY` ajustado.
- **fix post-cierre (`ad9806c`)**: `obtenerOrden` no traía `licenciaNum` de los firmantes del cierre → las tarjetas firmadas omitían la licencia. Añadido `licenciaNum: true` a los 3 `select` de `cierre.{soporte,gerente,piloto}`.

#### Verificación
- No hay runner de pruebas automatizadas; el método es **generar el PDF y revisarlo** (igual que smoke tests previos). Los 4 tipos generan PDF válido (`%PDF-`, `application/pdf`): sensor ~61 KB, planta ~61 KB, camión ~62 KB, aeronave ~138 KB (multipágina, foto embebida inline). Grep limpio: sin `Helvetica`/`_COMPAT`/claves del shim/helpers viejos en el controller; `theme.COLOR` pristino.
- Script de verificación efímero (`tmp-pdf-check/gen.mjs`) usado durante toda la ejecución; **borrado** al final (scratch, no commiteado).

#### Commits de la sesión (rama `development`, 12 commits: `02ae77c`…`ad9806c`)
`02ae77c` assets+theme · `92c5dc2` primitivas base · `433a9d6` cabecera+título · `0d1391e` timeline · `2a0009c` KV grids · `b54fbee` person cards · `464c8d4` tabla trabajos · `4d468e5` galería por renglón · `40ea9ad` dictamen+progreso · `83c903f` signature cards · `a90cc4d` footer+limpieza · `ad9806c` fix licenciaNum.

#### Pendiente menor (no hecho)
- `aeromx/backend/public/logo.png` (logo viejo AEROMX) sigue en disco sin referenciarse — inofensivo, se puede borrar.

---

### Siguiente paso — Sesión 17

> **El rediseño de arquitectura (Fases A–E) está 100% completo y verificado** — confirmado contra los checklists de §8 del doc de arquitectura (todos los ítems `[x]`). El **rediseño visual del PDF** (Sesión 16) también está completo. Lo que queda **NO es arquitectura**: se construye encima de la arquitectura ya estable. Son dos frentes distintos: — confirmado contra los checklists de §8 del doc de arquitectura (todos los ítems `[x]`). Lo que queda **NO es arquitectura**: se construye encima de la arquitectura ya estable. Son dos frentes distintos:

**Frente 1 — Pre-despliegue / hardening (el grueso del trabajo restante, ~3–4 sesiones):**
- ⚠️ La ruta `GET /uploads/:key` es **pública** (igual que el `express.static` previo). Para fotos de mantenimiento sensibles, evaluar exigir auth.
- ⚠️ Toggle "¿Se encontró defecto?" — duda de QA Sesión 14 sin confirmar (¿persiste el "Sí"?). Verificar en una O/T nueva.
- Gestión de secretos de producción (rotar `JWT_SECRET`, credenciales S3/IAM fuera del repo).
- HTTPS, CORS de producción, backups de Postgres + MinIO.
- Limpieza de datos de prueba → datos reales del cliente.
- (Opcional) UI de cierre que liste los puntos críticos pendientes de firma.

**Frente 2 — Roadmap original Fase 2+ (features, ~5–8 sesiones; el modo offline es el comodín de riesgo):**
- Fase 2 Operaciones: dashboard de flota avanzado · asignación de técnicos · alertas de vencimiento.
- Fase 3 Gestión: inventario de partes · reportes/estadísticas · histórico por producto · notificaciones email/push.
- Fase 4 Extra: modo offline (PWA sync en rampa) · reportes DGAC · PDF formato oficial.

> **Sugerencia para abrir la Sesión 17:** acordar con el usuario un *checklist de pre-despliegue* (Frente 1) antes de meterse a features de Fase 2+. El usuario tiene pendientes propios en mente que no están todos aquí.

**Setup rápido (verificado en Sesión 15):**
```bash
cd aeromx && docker compose up -d        # Postgres :5433 + MinIO :9000/9001
cd backend && npm run dev                 # API :3001  (revisa GET /api/health primero)
cd ../frontend && npm run dev             # UI :5173 — login dev@aeromx.com / aeromx123
```
> Almacenamiento activo = MinIO (`STORAGE_PROVIDER=minio`). Las 23 fotos previas ya están en el bucket `aeromx-fotos`. Para migrar fotos de disco a un bucket nuevo: `node scripts/migrar-fotos-a-storage.js`.
