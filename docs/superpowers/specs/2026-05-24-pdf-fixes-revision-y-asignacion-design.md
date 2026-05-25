# Diseño — Correcciones de PDF + flujo de revisión/rechazo + asignación de tareas

**Fecha:** 2026-05-24
**Rama base:** `development`
**Autor:** Simón Arellano (con Claude)
**Estado:** Aprobado para plan de implementación

## Contexto

El rediseño multiproducto (Fases A–E) y el rediseño visual del PDF estilo HYDRA (Sesión 16)
están cerrados. Este documento agrupa 7 mejoras detectadas en uso real, divididas en **5 sesiones
independientes** para ejecutarse una a la vez. Cada sesión es autocontenida: se puede implementar,
verificar y commitear sin depender de las siguientes.

Archivos núcleo del PDF: `aeromx/backend/src/pdf/ui.js` (primitivas de dibujo),
`aeromx/backend/src/pdf/theme.js` (tokens), `aeromx/backend/src/controllers/ordenes/pdfController.js`
(orquestación). No hay runner de pruebas automatizadas: la verificación del PDF es **generar el PDF
de los 4 tipos de producto y revisarlo visualmente** (método usado en sesiones previas).

## Decisiones tomadas (brainstorming 2026-05-24)

1. **Rechazar vs. Mandar a revisión (gerente):** "Rechazar" devuelve toda la orden a `en_proceso`
   e invalida las firmas del cierre; "Mandar a revisión" deja la orden en `pendiente_firma` pero
   marca puntos específicos como "en revisión".
2. **Pedir revisión (involucrado no gerente):** marca el punto en revisión **y bloquea el cierre**
   hasta resolverlo.
3. **Granularidad de asignación de tareas:** por **punto individual** (`resultados_puntos.asignadoId`).
4. **Firma de tarea:** cualquiera puede completar el punto, pero **el asignado debe firmar su tarea**;
   esa firma es requisito de cierre.
5. **Modelo de revisión:** tabla `RevisionPunto` con historial completo (no flags inline).
6. **División en 5 sesiones:** A1+A2, A3+A4, B, C, D.

---

## Sesión 1 — PDF: alineación de círculos/pills + autoajuste de texto (puntos 1 y 2)

**Alcance:** solo salida PDF. Sin cambios de datos, endpoints ni almacenamiento.

### Punto 1 — Alineación vertical dentro de círculos y pills
El texto dentro de elementos circulares/cápsula está descentrado porque usa offsets fijos en lugar
de centrar contra el centro geométrico real del elemento.

- `ui.js → timeline()`: el número se dibuja en `y+10` contra un círculo con centro en `y+14`.
  Centrar la línea base usando la altura real de la fuente (`doc.currentLineHeight()` /
  `heightOfString`) respecto al centro del círculo.
- `ui.js → pill()`: el punto de color está en `y+h/2` (=8.5) pero el texto en `y+4.5`. Alinear el
  texto al centro vertical del pill con el mismo criterio. Afecta a `statusPill`, `conditionPill`,
  `rolePill` (todas pasan por `pill()`).
- Verificar también el "check" de FIRMADO en `signatureCard` (líneas dibujadas con offsets fijos).

### Punto 2 — Texto largo que se traslapa
- `ui.js → signatureCard()`: la rúbrica `Courier-Oblique` 18pt con `lineBreak:false` se encima en la
  línea de firma cuando el nombre es largo. Auto-ajustar tamaño de fuente al ancho disponible
  (`w-28`) reduciendo el `fontSize` hasta que `widthOfString` quepa, con un mínimo razonable; si aun
  así no cabe, truncar con ellipsis. Aplicar el mismo cuidado al nombre semibold (línea +5).
- `ui.js → workRow()`: el componente con ✦ usa `continued:true`; al hacer wrap el ✦ puede salir del
  ancho. Permitir wrap real del componente y recalcular `compH`/`rowH` incluyendo el glifo crítico
  (hoy `rowH` ya considera `descH` y `compH`, pero el ✦ se añade después con `continued` sin medirse).
- `ui.js → personCard()`: revisar nombre (13pt) y pie ROL/LICENCIA — ya usan ellipsis; confirmar que
  no se traslapan con el pill de rol del header cuando el nombre es largo.

### Criterios de aceptación (Sesión 1)
- Generar PDF de los 4 tipos: números de timeline y texto de pills visualmente centrados.
- Firma con nombre largo (ej. "María Guadalupe de la Concepción Hernández") no se encima en la línea.
- Componente de tarea largo con ✦ no se sale del ancho de columna.

---

## Sesión 2 — PDF: continuidad de página + páginas en blanco (puntos 3 y 4)

**Alcance:** solo salida PDF. Conviene depurar generando PDFs reales (skill systematic-debugging).

### Punto 3 — Continuidad: no separar fila + título + evidencia al saltar de hoja
Hoy `workRow()` reserva su propio alto con `ensureSpace(rowH+4)`, pero `evidenceGallery()` se dibuja
**después**, por separado. Si la fila cae al pie, la foto salta a la siguiente página y queda
desligada del título de la actividad.

- En `pdfController.js → renderTrabajos()`: antes de dibujar una fila con fotos, medir el **alto
  combinado** (fila + galería de esa fila) y, si no cabe completo antes del margen inferior, forzar
  `doc.addPage()` para que fila y evidencia queden juntas. Extraer un helper de medición de galería
  (alto = `22 + rows*cellH + (rows-1)*gap + 8`, ya calculado dentro de `evidenceGallery`) y exponerlo
  para poder reservar sin dibujar.
- `ui.js → groupHead()`: evitar encabezado de grupo huérfano al pie. Reservar espacio para el grupo +
  al menos la primera fila (`ensureSpace` con un alto mínimo mayor que los 22 actuales).

### Punto 4 — Páginas en blanco extra al final
Causa probable: `ensureSpace`/`moveDown` al cerrar una sección empuja `doc.y` a una página nueva que
ya no recibe contenido; con `bufferPages:true` esa página vacía se conserva y el footer la numera.

- Diagnosticar con un PDF real (revisar `doc.bufferedPageRange().count` vs. contenido).
- Evitar el salto al cerrar secciones (no llamar `ensureSpace`/`addPage` "por si acaso" al final de un
  renderer).
- Si tras el render queda una última página sin contenido, **podarla** antes del bucle de footer
  (no numerar páginas vacías). pdfkit no borra páginas fácilmente; alternativa preferida: prevenir su
  creación. Documentar la solución elegida.

### Criterios de aceptación (Sesión 2)
- En una orden con muchas actividades + fotos, ninguna foto queda separada de su título de actividad.
- Ningún encabezado de grupo queda solo al pie de página.
- Los 4 PDFs terminan sin páginas en blanco; "Página N de M" refleja el conteo real.

---

## Sesión 3 — Descarga de PDF en órdenes cerradas (punto 5)

**Alcance:** frontend. El backend ya soporta `GET /api/ordenes/:id/pdf` y `?fotos=false`.

- Hoy la descarga solo aparece justo tras cerrar (en `CierreOTPage`). Exponerla en **cualquier orden
  cerrada**:
  - `DashboardPage.jsx`: en las tarjetas de O/T `cerrada`, botones "📥 Descargar PDF" y
    "Descargar sin fotos".
  - `InspeccionPage.jsx` (o vista de detalle): mismo par de acciones cuando la orden está cerrada.
- Reutilizar el helper de descarga existente en `api/ordenesService.js` (el que ya usa `CierreOTPage`);
  si no existe uno reutilizable, extraerlo para no duplicar la lógica de blob/Content-Disposition.
- Respetar permisos: descarga disponible para cualquier usuario autenticado que ya puede ver la orden
  (mismo criterio que el endpoint actual).

### Criterios de aceptación (Sesión 3)
- Desde el Dashboard, una orden cerrada antigua permite descargar PDF con y sin fotos.
- La descarga funciona también desde la vista de inspección/detalle de una orden cerrada.

---

## Sesión 4 — Rechazo y revisión (punto 6)

**Alcance:** schema + migración + backend + frontend.

### Modelo de datos
Nueva tabla `RevisionPunto` (historial completo):

```
RevisionPunto
  id            String   @id
  resultadoId   String   @map("resultado_id")   // FK → resultados_puntos
  solicitanteId String   @map("solicitante_id")  // FK → usuarios
  comentario    String
  estado        EstadoRevision @default(abierta) // abierta | resuelta
  resueltoPorId String?  @map("resuelto_por_id")
  fechaResuelto DateTime?
  createdAt     DateTime @default(now())
```

- Nuevo enum `EstadoRevision { abierta, resuelta }`.
- Relación 1:N desde `resultados_puntos`. `onDelete: Cascade` al borrar el resultado/orden.
- Migración **aditiva** escrita a mano (convención del repo, ver memoria `prisma_migrations_no_tty`):
  `CREATE TYPE` + `CREATE TABLE` + FKs. Aplicar con `migrate deploy` (NO `migrate reset` ni `db:seed`
  — la BD de dev tiene formatos reales; ver memoria `seed_destruye_formatos`). Respaldar con `pg_dump`
  antes de migrar.

### Backend
- **Gerente — Rechazar:** `POST /api/ordenes/:id/rechazar` (motivo obligatorio). Devuelve la orden a
  `en_proceso`, borra firmas del cierre (soporte/gerente/piloto/operador y sus fechas), limpia
  `fechaCierre`, registra evento en `HistorialEstadoOT` (estadoAnterior → `en_proceso`, motivo).
  Reutilizar la lógica existente de `reabrirOrden` como base. Solo gerente asignado o superusuario.
- **Gerente — Mandar a revisión:** `POST /api/ordenes/:id/revision` con lista de `resultadoId` +
  comentario. Crea una `RevisionPunto(estado=abierta)` por punto. La orden permanece en
  `pendiente_firma`.
- **Involucrado — Pedir revisión de un punto:** `POST /api/ordenes/:id/puntos/:resultadoId/revision`
  con comentario. Crea `RevisionPunto(estado=abierta)`. Permitido a cualquier usuario asignado a la
  orden (los 5–6 slots) o superusuario.
- **Resolver revisión:** `POST /api/ordenes/:id/revisiones/:revisionId/resolver` → `estado=resuelta`,
  `resueltoPorId`, `fechaResuelto`.
- **Gate de cierre:** `cierreController.gestionar` y `ordenesService.firmarCierre` rechazan el cierre
  si existe alguna `RevisionPunto` con `estado=abierta` (mensaje claro: "hay N punto(s) en revisión
  pendientes de resolver"). Defensa en profundidad como el gate de críticos firmados existente.
- `obtenerOrden` incluye las revisiones por resultado para que el frontend las muestre.

### Frontend
- `InspeccionPage.jsx`: por cada punto, mostrar bandera "En revisión" + comentario + solicitante
  cuando hay `RevisionPunto` abierta; acción "Pedir revisión" (cualquier involucrado) y "Resolver"
  (cuando aplica). Botón de gerente "Mandar a revisión" (selección de puntos + comentario).
- `CierreOTPage.jsx`: botón de gerente "Rechazar" (modal de motivo, distinto de "Reabrir"); mostrar el
  error de gate cuando hay revisiones abiertas, idealmente listando los puntos pendientes.
- `DashboardPage.jsx`: indicador de orden con revisiones abiertas.

### Criterios de aceptación (Sesión 4)
- Gerente puede rechazar: la orden vuelve a `en_proceso`, se borran firmas, queda historial.
- Gerente puede mandar puntos específicos a revisión sin tumbar la orden.
- Un involucrado puede pedir revisión de un punto; con revisión abierta el cierre se bloquea.
- Resolver todas las revisiones abiertas vuelve a permitir el cierre.

---

## Sesión 5 — Asignación de tareas por punto (punto 7)

**Alcance:** schema + migración + backend + frontend.

### Modelo de datos
Sobre `resultados_puntos` (granularidad por punto):

```
resultados_puntos (campos nuevos)
  asignadoId        String?   @map("asignado_id")      // FK → usuarios (responsable de la tarea)
  firmaTareaPorId   String?   @map("firma_tarea_por_id") // FK → usuarios (quien firmó la tarea)
  fechaFirmaTarea   DateTime? @map("fecha_firma_tarea")
```

- FKs con `onDelete: SetNull`. Migración aditiva a mano + `migrate deploy` (mismas precauciones que
  Sesión 4: respaldo `pg_dump`, sin `reset`/`seed`).
- La firma de tarea es **distinta** de la firma de punto crítico existente (`firmadoPor`/`fechaFirma`):
  un punto puede ser crítico, tener asignado, o ambos.

### Backend
- **Asignar:** `PATCH /api/ordenes/:id/puntos/:resultadoId/asignacion` con `asignadoId`. El asignado
  debe ser un usuario **involucrado en la orden** (uno de los 5–6 slots) o el gate lo rechaza. Asignar
  permitido a gerente asignado o superusuario.
- **Completar:** cualquier involucrado puede seguir actualizando el resultado (sin cambio).
- **Firmar tarea:** `POST /api/ordenes/:id/puntos/:resultadoId/firmar-tarea`. Solo el `asignadoId`
  (o superusuario) puede firmar; registra `firmaTareaPorId`/`fechaFirmaTarea`. El punto debe estar
  `completado` antes de firmar la tarea.
- **Gate de cierre:** además de críticos firmados y revisiones resueltas, exigir que **todo punto con
  `asignadoId` tenga `fechaFirmaTarea`**. Helper `verificarTareasFirmadas(ordenId)` análogo a
  `verificarCriticosFirmados`. Gate doble (`cierreController.gestionar` + `firmarCierre`).
- `obtenerOrden`/`listarOrdenes` incluyen `asignado` y datos de firma de tarea.

### Frontend
- `InspeccionPage.jsx`: selector de "Responsable" por punto (gerente asigna entre los involucrados);
  indicador del asignado; acción "Firmar mi tarea" visible solo para el asignado cuando el punto está
  completado y sin firmar. Vista/filtro **"Mis tareas"** que agrupa los puntos asignados al usuario
  actual.
- `CierreOTPage.jsx`: mostrar el gate cuando faltan firmas de tarea, listando los puntos pendientes.
- `DashboardPage.jsx`: (opcional) indicador de tareas asignadas al usuario actual.

### Criterios de aceptación (Sesión 5)
- El gerente puede asignar un punto a un involucrado (ej. punto de motor → mecánico).
- Solo el asignado puede firmar su tarea; el punto debe estar completado antes.
- El cierre se bloquea mientras haya tareas asignadas sin firmar y se permite al firmarlas todas.
- "Mis tareas" lista correctamente los puntos del usuario actual.

---

## Fuera de alcance (todas las sesiones)
- Sin cambios al sistema de almacenamiento de fotos (MinIO/S3).
- Sin cambios a la estructura de formatos/secciones/puntos ni al seed.
- Sin notificaciones por email/push (las banderas son visuales en la app).

## Notas de proceso (memoria del proyecto)
- Comunicación, commits y docs en **español**.
- Migraciones: `migrate diff`/SQL a mano + `migrate deploy`; **nunca** `migrate reset` ni `db:seed`
  sobre la BD de dev (tiene formatos reales). Respaldar con `pg_dump` antes de migrar. Detener el
  backend antes de `prisma generate` (EPERM si corre).
- Verificación del PDF = generar y revisar los 4 tipos (no hay runner automatizado).
- Commits/push solo cuando el usuario lo decida.
