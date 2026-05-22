# Rediseño visual del PDF de Orden de Trabajo (estilo HYDRA)

**Fecha:** 2026-05-22
**Autor:** Simón Arellano
**Estado:** Diseño aprobado — pendiente plan de implementación

---

## 1. Objetivo

Rediseñar **únicamente la salida PDF** de las órdenes de trabajo para que adopte
el lenguaje visual del prototipo de diseño entregado en
`PDF/design_handoff_orden_trabajo/` (marca **HYDRA**): un documento limpio,
moderno y escaneable sobre papel claro, con tipografía Geist, *status pills*,
*timeline* de hitos, KV grids con bordes redondeados, *person cards*, tabla de
trabajos con **galería de evidencia por renglón**, dictamen con barra de
progreso y *signature cards*.

Sustituye el look actual (banda azul marino + acento cian, tablas rectangulares,
sección de evidencia separada) generado por `pdfController.js`.

### Fuera de alcance (NO se toca)
- Vistas web de captura (`InspeccionPage`, `CrearOTPage`, `CierreOTPage`, etc.).
- Cualquier vista previa web del documento.
- El modelo de datos, schema Prisma, endpoints, permisos o flujo de negocio.
- La capa de almacenamiento de fotos (MinIO/S3) y `precargarFotos()`.
- La selección de secciones por tipo de producto (`resolverSecuencia` + `BUILTIN_RENDERERS`).

---

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Alcance | Solo el PDF de salida | Lo solicitado literalmente. |
| Motor de PDF | **Restilizar pdfkit** (el actual) | Reutiliza toda la plomería (fotos desde storage, secciones por tipo, markdown, paginación). Deploy ligero, sin dependencias nativas ni Chromium — coherente con el requisito on-premise/nube sin cambios de código. |
| Marca | **HYDRA tal cual** | Logo, nombre y línea de contacto del paquete de diseño. |
| Fotos de evidencia | **Galería por renglón** | Bajo cada trabajo va su galería, como el prototipo. Más fiel y escaneable. |
| Logo en tinta | Teñir `hydra-logo.png` una sola vez y commitear el PNG | pdfkit no aplica `filter: brightness(0)`. Evita dependencia nativa (`sharp`) en runtime. |

---

## 3. Enfoque técnico

Reescribir **solo la capa de dibujo** de
`aeromx/backend/src/controllers/ordenes/pdfController.js`. La arquitectura del
endpoint `generar()` se conserva:

- `obtenerOrden(id)` → mismo shape de datos (formato+secciones+puntos, producto+detalle,
  5 slots de personal, resultados+fotos, cierre, historial).
- `precargarFotos(orden)` → `Map<urlArchivo, Buffer>` desde la capa de storage. **Sin cambios.**
- `resolverSecuencia(orden.formato)` dirige el orden de las secciones; cada `item.tipo`
  mapea a un renderer en `BUILTIN_RENDERERS`. **Sin cambios estructurales.**
- Bloques markdown (`renderMarkdown`) — se conservan; solo se ajusta su paleta.
- Paginación con `bufferPages: true` + `switchToPage` para el footer. **Sin cambios.**

Lo que cambia es el cuerpo de los renderers y los helpers de dibujo (de un look
"banda oscura + tablas rectangulares" a "papel claro + componentes redondeados").

---

## 4. Sistema visual (tokens)

### Colores (oklch del diseño → hex para pdfkit)
| Token | Hex aprox. | Uso |
|---|---|---|
| paper | `#FFFFFF` | Fondo del documento |
| ink | `#111110` | Texto principal |
| ink-2 | `#3A3A36` | Texto secundario |
| muted | `#76746B` | Labels, metadatos |
| line | `#E7E5DD` | Bordes principales |
| line-2 | `#F0EEE7` | Hairlines internos / separadores |
| accent (azul) | `#2F5FA6` | Pills de rol |
| accent-soft | `#EDF1F8` | Fondo pills azul |
| ok (verde) | `#3F8F5F` | Cerrada / condición buena |
| ok-soft | `#EAF4EE` | Fondo verde |
| warn (ámbar) | `#C08A2E` | En proceso / con daños |
| warn-soft | `#FBF3E3` | Fondo ámbar |
| critical (rojo) | `#C0492F` | Defecto / requiere atención / punto crítico |
| critical-soft | `#F8EAE6` | Fondo rojo |
| head-bg | `#F6F4ED` | Header de tabla |
| evidence-bg | `#FDFCF7` | Panel de evidencia |
| group-bg | `#FBFAF4` | Group head |

*(Los valores hex son aproximaciones a los oklch del prototipo; diferencia de tono mínima.)*

### Tipografía
- **Geist** (sans) y **Geist Mono** — embebidas como TTF, vendoreadas en
  `aeromx/backend/src/pdf/fonts/`. Licencia OFL (libre redistribución).
- Pesos a vendorear: Geist 400/500/600/700; Geist Mono 400/500.
- Registro en pdfkit con `doc.registerFont('Geist', ...)`, `doc.registerFont('GeistMono', ...)`, etc.
- **Geist Mono** para: folios, IDs, nº de serie, timestamps, labels uppercase, contadores.
- **Geist sans** para: títulos, nombres, valores, descripciones.
- `font-feature-settings` (ss01, zero) **no** se replica — pdfkit no lo soporta; sin impacto visible relevante.

### Forma y espaciado
- Radios: `4px` (sm) / `8px` (lg) vía `doc.roundedRect()`.
- Márgenes de documento Letter: se mantiene `margin: 40`; padding interno equivalente al prototipo.
- Sin sombras (no aplican a PDF).

---

## 5. Mapa de secciones (1:1 con el prototipo)

El orden lo sigue dictando `resolverSecuencia`. Cada renderer existente se
restiliza:

### 5.1 Header (`drawHeader`)
- Fondo **papel** (se elimina la banda azul marino y el borde cian).
- Izquierda: **logo HYDRA en tinta** (44px alto) + `HYDRA · Gestión de mantenimiento`
  (Geist 600) + línea de contacto (Geist Mono, muted).
- Derecha (Geist Mono, muted, alineado a la derecha): `Documento O/T`,
  `Generado <fecha · hora>`, `Formato vX · <nombre>`.
- Separador inferior: línea sólida 1px en tinta.

### 5.2 Título del documento (nuevo bloque, antes embebido en header)
- **Kicker** mono uppercase: `ORDEN DE TRABAJO DE MANTENIMIENTO`.
- **Título** Geist ~28–36px weight 500, letter-spacing negativo: nombre del formato
  (`orden.formato.nombre`).
- **Folio** mono: `N.º   <orden.numeroOt>`.
- **Status pill** a la derecha (ver §6.1).

### 5.3 Timeline de 4 hitos (`timeline()` — nuevo)
- Strip con borde superior e inferior, 4 columnas iguales con separadores verticales tenues.
- Cada paso: número en círculo negro (22×22, mono), label mono uppercase, valor fecha + hora (hora en mono).
- Pasos y datos: **1.** Creación (`createdAt`) · **2.** Recepción (`fechaRecepcion`) ·
  **3.** Inicio (`fechaInicio`) · **4.** Cierre/firma (`fechaCierre`). Hitos sin fecha → "Pendiente".

### 5.4 §01 Datos generales (`renderDatosGenerales`)
- Reemplaza la mezcla actual de datos+hitos: los hitos pasan al **timeline**, así que
  esta sección queda con campos puros: N.º Orden, Tipo de producto, Formato+versión,
  Cliente, Orden de servicio, Lugar de mantenimiento, Duración total\*, Estado actual (con color).
- KV grid 4-col redondeado (ver §6.3).
- \* Duración total = `fechaCierre - createdAt` formateada (si cerrada); si no, "—".

### 5.5 §02 Datos del producto (`renderDatosProducto`)
- KV grid 3-col, valores grandes (`lg`) en los campos prominentes.
- Campos dinámicos por tipo: **se conserva `filasDatosProducto(orden)` tal cual** (ya
  resuelve aeronave/camión/planta/sensor). Solo cambia el estilo del grid.
- Título dinámico por tipo (se conserva el `tituloMap` actual).

### 5.6 §03 Personal responsable (`renderPersonal` + `personCard()`)
- Person cards en grid de 3 columnas que envuelve a múltiples filas.
- **2 a 5 cards** según tipo (soporte, ingeniero auxiliar si existe, mecánico, gerente,
  piloto si aeronave) — se conserva la lógica de armado de `cards[]` actual.
- Cada card: header con categoría (Soporte/Mantenimiento/Aprobación…) + **pill de rol**;
  nombre grande (Geist 600); pie con borde punteado superior: Rol + Licencia (mono).
- Mapeo categoría: SOPORTE→"Soporte", INGENIERO AUXILIAR→"Soporte", MECÁNICO→"Mantenimiento",
  GERENTE→"Aprobación", PILOTO→"Operación".

### 5.7 §04 Trabajos realizados (`renderTrabajos` + `evidenceGallery()`)
- Contenedor redondeado.
- **Header de tabla** (fondo `head-bg`, mono uppercase): `# | Componente | Descripción | Condición | Firma | Fotos`.
- **Group head** por sección del formato (fondo `group-bg`, mono uppercase): nombre de
  sección + contador `N de M ejecutados` (N = puntos completados de esa sección, M = total).
- **Work row** por punto: índice mono, componente Geist 600 (✦ rojo si `esCritico`),
  descripción en gris, **condition pill** (ver §6.2), celda de firma
  (nombre del firmante / "— No requerida" si no es crítico), contador de fotos `N/M`.
- **Galería de evidencia bajo cada renglón** con fotos (`evidence-bg`, borde punteado superior):
  grid de 3 columnas (ancho de página), cada celda imagen aspect 4:3 + caption
  `Foto N · <nombre/fecha>`. Solo se dibuja si el punto tiene fotos.
  - Buffers desde `ctx.fotosBuffers` (sin cambios). Placeholder "Archivo no disponible"
    si falta el buffer o el formato no es PNG/JPEG (se conserva la lógica actual).
  - **Importante:** esto fusiona la sección `fotos` separada dentro de `trabajos`.
    Ver §7 (decisión de la sección `fotos`).
- Leyenda al final: ✦ = punto crítico; chips de color BUENO/CON DAÑOS/REQUIERE ATENCIÓN/N/A.

### 5.8 §05 Dictamen y observaciones (`renderDictamen` + `progressBar()`)
- Bloque 3-col redondeado:
  1. **Puntos ejecutados** `N / M` + barra de progreso verde.
  2. **¿Se encontró defecto?** Sí/No grande, color (rojo si Sí, verde si No).
  3. **Documento correctivo** referencia o "—".
- Debajo: bloque de **observaciones generales** (fondo claro, borde redondeado);
  si vacío, estado vacío en cursiva gris ("Sin observaciones adicionales registradas…").

### 5.9 §06 Firmas (`renderFirmas` + `signatureCard()`)
- Signature cards: **2** (Soporte + Aprobación/Gerente) para no-aeronave, **3** para
  aeronave (Soporte + Gerente + Piloto). Se conserva la lógica de `cajas[]` actual.
- Cada card: categoría + estado "Firmado" con check verde (si firmada);
  línea de firma con **rúbrica = nombre en Geist Mono italic** encima; nombre + rol + licencia;
  pie con timestamp de firma (mono, borde punteado superior).
- Si no firmada: línea vacía sin rúbrica ni check.

### 5.10 Footer (`drawFooter`)
- Mono 10px, muted, borde superior 1px: `HYDRA · O/T <folio> · Generado <fecha hora>`
  a la izquierda; `Página N de M` a la derecha. (Igual que hoy, restilizado.)

---

## 6. Primitivas pdfkit nuevas

Reemplazan/extienden los helpers actuales (`drawKVGrid`, `drawTableRow`,
`drawFirmas`, `drawEvidenciaFotografica`, `sectionTitle`, `drawHeader`, `drawFooter`):

| Primitiva | Responsabilidad | Reemplaza |
|---|---|---|
| `statusPill(doc, x, y, estado)` | Pill redondeado con punto de color + label, color por estado | (nuevo) |
| `conditionPill(doc, x, y, estado)` | Pill de condición con punto de color | (parte de filas) |
| `kvGrid(doc, pairs, cols, M, W)` | Grid redondeado con hairlines internos; última fila/columna sin borde | `drawKVGrid` |
| `timeline(doc, steps, M, W)` | Strip de 4 hitos con círculos numerados | (nuevo) |
| `personCard(doc, x, y, w, h, card)` | Card con header+pill, nombre, pie punteado | `drawPersonaCard` |
| `worksTable / workRow / groupHead` | Tabla redondeada con header, group heads y filas con pill | `drawTableHeader`/`drawTableRow` |
| `evidenceGallery(doc, fotos, buffers, M, W)` | Grid 3-col de fotos bajo cada renglón | `drawEvidenciaFotografica` (re-ubicada) |
| `progressBar(doc, x, y, w, ratio)` | Barra de progreso verde | (nuevo) |
| `signatureCard(doc, x, y, w, h, caja)` | Card de firma con rúbrica y check | `drawFirmaBox` |
| `sectionHead(doc, num, titulo, M, W)` | `§ NN  Título  ────` (kicker mono + regla) | `sectionTitle` |
| `roundedPanel(doc, x, y, w, h, opts)` | Panel base con borde redondeado y relleno | (base reutilizable) |

Notas de implementación:
- **KV grid redondeado con hairlines internos:** dibujar el panel exterior con
  `roundedRect().stroke()`, luego hairlines internos como líneas rectas (sin tocar el
  borde redondeado exterior). Las celdas de la última fila/columna omiten su hairline.
- **Pills:** `roundedRect` con radio = altura/2 (cápsula) + `circle()` para el punto + texto mono.
- Mantener `ensureSpace()` para saltos de página; **el group head se re-dibuja** si una
  sección de la tabla salta de página.

---

## 7. Decisión: sección `fotos` separada

Hoy existen dos renderers: `trabajos` (tabla) y `fotos` (sección de evidencia agrupada
al final). Con galería por renglón, las fotos van **dentro de `trabajos`**.

**Decisión:** el renderer `fotos` queda como **no-op** (no dibuja nada) para no romper
formatos cuya `secuencia` guardada lo incluya. La evidencia se dibuja exclusivamente
dentro de `renderTrabajos` bajo cada renglón. Así no hay duplicación ni dependemos de
editar las secuencias guardadas en cada formato.

---

## 8. Mapeos de estado

### Estado de la orden → color del status pill
| Estado | Color |
|---|---|
| `cerrada` | verde (ok) |
| `pendiente_firma` | ámbar (warn) |
| `en_proceso` | ámbar (warn) |
| `borrador` | gris (muted) |

### Estado de resultado → condition pill (4 reales → paleta)
| `estadoResultado` | Label | Color |
|---|---|---|
| `bueno` | BUENO | verde |
| `correcto_con_danos` | CON DAÑOS | ámbar |
| `requiere_atencion` | REQUIERE ATENCIÓN | rojo |
| `no_aplica` | N/A | gris |

---

## 9. Assets a preparar

1. **Fuentes Geist + Geist Mono (TTF)** → `aeromx/backend/src/pdf/fonts/`.
   - Origen: paquete npm `geist` (incluye los TTF) o el repo oficial `vercel/geist-font` (OFL).
   - Solo se vendorea (commitea) el subconjunto de pesos usado.
2. **Logo HYDRA en tinta** → `aeromx/backend/public/hydra-logo.png`.
   - Generar **una sola vez** a partir de `PDF/design_handoff_orden_trabajo/hydra-logo.png`
     (gris con alpha) tiñendo los píxeles a negro conservando el canal alfa.
   - Herramienta de un solo uso (script efímero con `sharp`/`pngjs`, o ImageMagick). **No** se
     agrega dependencia de runtime; solo se commitea el PNG resultante.
   - `drawHeader` apunta a `hydra-logo.png` en vez de `logo.png`.

---

## 10. Riesgos y caveats de fidelidad

- pdfkit es procedural: bordes redondeados con hairlines internos y pills quedan muy
  cercanos pero no idénticos al render CSS. Meta: **~90–95%** de fidelidad visual.
- oklch → hex es aproximado; diferencias de tono mínimas.
- La rúbrica es el nombre en mono italic, no una firma manuscrita capturada. Si en el
  futuro se persiste una firma escaneada (`firma_fisica_url` u similar), `signatureCard`
  podría embeber la imagen — fuera de alcance ahora.
- Órdenes largas (aeronave ~106 puntos / 14 secciones) generan varias páginas; la
  galería por renglón aumenta el alto. Verificar paginación con la O/T de aeronave (`XB-ABC`).

---

## 11. Verificación

- Generar PDF para los **4 tipos** (aeronave, camión, planta, sensor) usando las O/T de
  prueba existentes (o nuevas) y revisar visualmente cada sección contra el prototipo.
- Caso con fotos (aeronave con foto en punto "con daños") → galería por renglón visible y
  fotos embebidas.
- Caso sin fotos → no se dibuja galería; sin huecos.
- Punto crítico firmado vs. no firmado → marca ✦ y celda de firma correctas.
- Paginación: footer "Página N de M" correcto; group head re-dibujado tras salto de página.
- `%PDF-` y `Content-Type: application/pdf` en la respuesta del endpoint.
```bash
cd aeromx && docker compose up -d
cd backend && npm run dev     # API :3001
# GET /api/ordenes/:id/pdf con token de dev@aeromx.com
```

---

## 12. Lo que NO cambia (resumen)

- `obtenerOrden` y todo el shape de datos.
- `precargarFotos` + capa de storage.
- `resolverSecuencia` + `BUILTIN_RENDERERS` (estructura; solo cambian los cuerpos).
- `renderMarkdown` (solo paleta).
- Endpoints, permisos, schema, flujo de negocio.
