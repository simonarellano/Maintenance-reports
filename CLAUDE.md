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
- [x] schema.prisma completo
- [x] Estructura de carpetas del proyecto
- [ ] schema.sql completo
- [ ] Autenticación JWT con roles
- [ ] CRUD aeronaves y modelos
- [ ] Módulo Órdenes de Mantenimiento
  - [ ] Plantillas en DB
  - [ ] Crear O/T desde plantilla
  - [ ] Flujo paso a paso móvil
  - [ ] Captura de fotos por punto
  - [ ] Firma digital (por paso crítico + cierre)
  - [ ] Generación de PDF al cerrar

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

## Estado del Proyecto — Última actualización: Sesión 2
### Completado en Sesión 2
- CLAUDE.md creado
- schema.prisma completo (todos los modelos, enums, relaciones)
- Estructura de carpetas del proyecto creada
- package.json de backend (Node.js + Express + Prisma + JWT + bcrypt)
- package.json de frontend (React + Vite + TailwindCSS)

### Siguiente paso
- Crear schema.sql como referencia
- Setup de Prisma (datasource, generate)
- Autenticación JWT: rutas /auth/login, /auth/me, middleware de roles
