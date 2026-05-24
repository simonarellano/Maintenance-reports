# Prompt para Claude Code — Implementación del formato "Orden de Trabajo HYDRA"

Copia y pega el bloque siguiente en tu sesión de Claude Code. Ajusta las secciones marcadas con `<TU_…>` antes de enviar.

---

## Prompt

Hola Claude. Voy a implementar en el codebase un nuevo formato de **Orden de Trabajo de Mantenimiento Aeronáutico** para HYDRA. Tengo un paquete de diseño de referencia y necesito que lo traduzcas al stack de este proyecto.

### Contexto del proyecto
- **Stack**: `<TU_STACK — p. ej. Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma + tRPC>`
- **Backend / Datos**: `<TU_BACKEND — p. ej. Postgres + Prisma; almacenamiento de fotos en S3>`
- **PDF**: `<TU_LIB_PDF — p. ej. Puppeteer server-side; o React-PDF; o aún sin decidir>`
- **Sistema de diseño existente**: `<TU_DS — p. ej. shadcn/ui base, tokens en tailwind.config.ts; o "no hay, propóngalo">`
- **i18n**: `<sí/no — p. ej. next-intl en es-MX>`

### Archivos de diseño (en `design_handoff_orden_trabajo/`)
- `Orden de Trabajo.html` — prototipo HTML/CSS de referencia (2 páginas tamaño Carta)
- `image-slot.js` — referencia de UX de drag-and-drop de fotos (NO llevar a producción)
- `hydra-logo.png` — logo
- `referencia-original.pdf` — formato actual que se reemplaza
- `README.md` — especificación completa con design tokens, screens y comportamiento

**Lee primero el `README.md` completo antes de programar nada.**

### Objetivo
Implementar dos vistas y un generador:

1. **Vista de captura** (web responsive): el técnico captura datos, sube fotos a cada trabajo, firma. Debe guardar en cada cambio (autosave + estado optimista).
2. **Vista de lectura / impresión**: render exacto al HTML de referencia, con paginación tamaño Carta. Usada para la previsualización antes de cerrar.
3. **Generación de PDF** server-side al cerrar la orden, archivado en storage y vinculado al registro.

### Reglas no negociables
- **Las fotos son obligatorias** para cerrar la orden. La UI debe bloquear el botón "Cerrar y generar PDF" si:
  - Hay campos obligatorios vacíos
  - Algún trabajo tiene slots de foto requeridos sin llenar
  - Faltan firmas
- **El número de slots de foto por trabajo es variable** — viene del catálogo de formatos por tipo de producto. La galería se itera sobre `work.photoSlots[]`, no es fija.
- **El PDF se genera server-side**, nunca desde el browser del cliente (consistencia tipográfica + firmable).
- **Tipografía**: Geist + Geist Mono (Google Fonts). NO sustituir por Inter/Roboto.
- **No filler / no slop**: respetar la jerarquía y densidad del prototipo. Si una sección queda vacía, mantener el estado vacío explícito ("Sin observaciones registradas" en cursiva gris), no rellenar con dummy.

### Modelo de datos
Usar el `type WorkOrder` definido en el `README.md` (sección "State management") como contrato de tipos. Generar el schema de Prisma a partir de ahí, manteniendo el mismo naming. Si ya existe una tabla `WorkOrder` en el codebase, migra los campos faltantes y avísame antes de tocar lo existente.

### Plan que quiero que sigas
1. **Lee** `design_handoff_orden_trabajo/README.md` completo y el HTML de referencia. Resume en 5–10 líneas qué entendiste antes de tocar código.
2. **Inventaria** el codebase: identifica el sistema de componentes (Button, Card, Input, Dialog) y reusa. Lista los que faltan y los que vas a crear.
3. **Propón** el plan de archivos / rutas / componentes / endpoints. Espera mi confirmación antes de implementar.
4. **Implementa** en este orden, abriendo un commit por paso:
   1. Tipos + schema de DB + migración
   2. Tokens de diseño (colores, tipografía, escala) en el sistema existente
   3. Componentes atómicos: `StatusPill`, `ConditionPill`, `KVGrid`, `KV`, `Timeline`, `PersonCard`, `Progress`, `SignaturePad`, `PhotoSlot`
   4. Composiciones de sección: `DocHeader`, `DocTitleRow`, `WorksTable` + `WorkRow` + `EvidenceGallery`, `DictumBlock`, `SignaturesBlock`
   5. Página principal de captura (autosave, validaciones)
   6. Página de lectura/impresión (1:1 con el HTML)
   7. Endpoint de generación de PDF server-side + integración con storage
   8. Tests: unitarios de validación de cierre, e2e del flujo completo (Playwright)
5. **Verifica** con screenshots: en cada paso, dame una captura del componente o página para confirmar fidelidad.

### Tokens (extracto — el resto en el README)
```
--bg: #FAFAF7;  --paper: #FFFFFF;
--ink: #111110;  --ink-2: #3A3A36;  --muted: #76746B;
--line: #E7E5DD;  --line-2: #F0EEE7;
--accent: oklch(0.48 0.12 248);
--ok: oklch(0.55 0.13 150);  --ok-soft: oklch(0.95 0.04 150);
--warn: oklch(0.65 0.16 70);
--critical: oklch(0.58 0.20 25);
```

Fuentes:
```
font-family: 'Geist', ui-sans-serif, system-ui;
font-family: 'Geist Mono', ui-monospace, monospace;
```

### Drag-and-drop de fotos
El archivo `image-slot.js` es un web component de referencia. **No lo lleves a producción**. En su lugar, construye `<PhotoSlot>` con:
- `react-dropzone` (o equivalente) para arrastrar/soltar y click-to-pick
- Subida directa a storage con URL pre-firmada
- Estado de carga (spinner / barra de progreso) y manejo de error
- Reencuadre opcional con `react-easy-crop` o similar
- Botón "x" en hover para eliminar
- Tamaño: aspect-ratio 4/3, border-radius 6px, borde dashed cuando vacío + solid cuando lleno
- Caption corto debajo con el `label` del slot

### Generación de PDF
Recomendación: **Puppeteer + plantilla Next.js dedicada a impresión** (ruta `/print/work-orders/[id]`). Pasos:
1. Endpoint `POST /api/work-orders/[id]/close` valida y genera el PDF.
2. Lanza headless Chrome, navega a la ruta de impresión con sesión interna, espera `networkidle`.
3. `page.pdf({ format: 'Letter', printBackground: true, margin: 0 })`.
4. Sube a storage, guarda el `pdfUrl` en el registro, cambia status a `closed`.
5. Devuelve URL al cliente.

Alternativa si el equipo prefiere: **React-PDF** (renderiza sin browser, más rápido, pero requiere reescribir el layout en componentes de `@react-pdf/renderer`).

### Qué NO hacer
- No copiar el HTML tal cual al codebase. Es referencia de diseño, no código.
- No usar el filtro CSS sobre el logo en producción — pedir SVG vectorial a HYDRA. Mientras tanto, deja el `filter: brightness(0)` con un comentario `// TODO: replace with HYDRA SVG`.
- No inventar campos del modelo que no estén en el `README.md` sin preguntarme.
- No agregar emojis, iconos decorativos, gradientes, ni "AI slop". El documento es técnico-formal.

### Entregable
Pull request con:
- Branch `feat/work-order-format`
- Commits granulares siguiendo el orden del plan
- Storybook (o playground) con cada componente atómico
- README de la feature con cómo correr y cómo generar un PDF de prueba
- 1 captura del PDF generado adjunta al PR

Cuando termines cada paso, párate y muéstrame el resultado antes de continuar. Empecemos por el paso 1 — léete el `README.md` y resume.
