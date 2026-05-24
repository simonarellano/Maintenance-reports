# Handoff — Orden de Trabajo de Mantenimiento (HYDRA)

## Resumen
Rediseño del formato impreso/digital de **Orden de Trabajo de Mantenimiento Aeronáutico** de HYDRA. El objetivo es una versión limpia, moderna, escaneable y funcional que sirve tanto como:

1. **PDF imprimible** (tamaño Carta — Letter, 8.5" × 11"), generado al cerrar una orden.
2. **Vista web/app** durante la captura, donde el técnico arrastra fotos de evidencia, firma, y se guarda el progreso.

Sustituye el formato antiguo que está en `referencia-original.pdf` (PDF de 2 páginas, tablas anidadas, etiquetas en mayúsculas, sin jerarquía clara).

---

## Sobre los archivos de este paquete

Los archivos HTML/JS de este bundle son **referencias de diseño** — prototipos que muestran intención visual y comportamiento. **No son código de producción** que deba copiarse tal cual.

La tarea es **recrear estos diseños en el entorno del codebase existente** (React/Next.js, Vue, SwiftUI, etc.) usando sus patrones, sistema de componentes, librerías de formularios y de PDF establecidas. Si no existe codebase aún, elegir el stack apropiado para la naturaleza del producto:

- **App de captura (técnico en planta)** → SPA web responsive o mobile (React + TanStack Form, o React Native).
- **Generación de PDF** → librería server-side (Puppeteer, React-PDF, WeasyPrint) — **no** depender del HTML para imprimir desde el navegador del cliente.

---

## Fidelidad

**Alta fidelidad (hi-fi)**: colores, tipografía, espaciado, jerarquía y micro-interacciones están definidos. Recrea pixel-perfect adaptando al sistema de componentes existente. Los nombres, folios y datos son ejemplos — el contenido viene del backend.

---

## Pantallas / Vistas

El documento tiene **2 páginas** (tamaño Carta). En la app, equivale a **una sola vista scrolleable** con secciones ancladas.

### Página 1 — Identificación y contexto

#### 1. Header (cabecera del documento)
- **Logo HYDRA** (44px de alto, alineado a la izquierda) + nombre comercial y línea de contacto.
- **Meta** a la derecha: tipo de documento (`O/T`), timestamp de generación, versión de formato.
- Separador inferior: línea sólida 1px en tinta (`#111110`).

#### 2. Título del documento
- **Kicker** en mono uppercase pequeño: "ORDEN DE TRABAJO DE MANTENIMIENTO".
- **Título principal**: nombre del servicio (ej. "Calibración y verificación de sensor LiDAR"), 36px, weight 500, letter-spacing -0.025em.
- **Folio**: `N.º   OT-20260521-0012` en mono.
- **Status pill** a la derecha: pill con punto de color + estado (Cerrada / En proceso / Abierta).

#### 3. Timeline de 4 pasos
Strip horizontal con borde superior e inferior, dividida en 4 columnas iguales con separadores verticales tenues. Cada paso muestra:
- Número en círculo negro (22×22, mono 11px)
- Etiqueta en mono uppercase pequeño
- Valor: fecha + hora (la hora en mono)

Pasos: **1.** Creación · **2.** Recepción · **3.** Inicio mantenimiento · **4.** Cierre / firma.

#### 4. §01 Datos generales del servicio
Grid de **4 columnas** con borde redondeado y celdas internas separadas por líneas tenues. Campos:
- N.º Orden (mono)
- Tipo de producto
- Formato + versión
- Cliente (ID mono)
- Orden de servicio (mono)
- Lugar de mantenimiento
- Duración total
- Estado actual (color del status)

Cada celda: label en mono uppercase 10.5px gris + valor 14px tinta peso 500.

#### 5. §02 Datos del sensor (o producto)
Grid de **3 columnas**, mismo estilo. Campos:
- N.º de serie (mono, prominente)
- Modelo (prominente)
- Fabricante (prominente)
- Firmware (mono)
- Última calibración
- N.º interno (mono)

#### 6. §03 Personal responsable
**3 cards** lado a lado. Cada card:
- Header: categoría (Soporte/Mantenimiento/Aprobación) + pill de rol (Técnico/Mecánico/Gerente)
- Nombre grande (16px, weight 600)
- Pie con borde punteado superior: Rol + Licencia (esta última en mono)

### Página 2 — Trabajo, dictamen y firma

#### 7. §04 Trabajos realizados
**Tabla con galería de evidencia por renglón**, dentro de un contenedor con borde redondeado.

- **Header** (fondo `#F6F4ED`, mono uppercase): columnas `# | Componente | Descripción | Condición | Firma | Fotos`.
- **Group head** (subgrupo): banda fina con nombre del grupo (ej. "Funcional") + contador `N de M ejecutados`.
- **Work row** (1 por trabajo): índice mono, componente en negrita, descripción en gris, **condition pill** (Bueno verde / Malo rojo / N/A gris) con punto de color, columna de firma, contador de fotos `N/M`.
- **Evidence panel** (debajo de cada work row, fondo `#FDFCF7`, borde punteado superior): galería de **4 slots** de imagen (drag-and-drop) en grid de 4 columnas con aspect-ratio 4:3 y caption corto (Antes / Evidencia / Detalle / Después).

**Número de fotos por trabajo es variable** — depende del tipo de producto y del formato base. En el ejemplo se muestran 4; el sistema debe soportar de 1 a N.

**Las fotos son obligatorias** para cerrar la orden. La UI debe bloquear el cierre si faltan slots por llenar.

#### 8. §05 Dictamen y observaciones
**Bloque de 3 columnas** en borde redondeado:
- Puntos ejecutados (`N / M` con barra de progreso verde)
- ¿Se encontró defecto? (Sí/No grande, color según valor)
- Documento correctivo (referencia o "—")

Debajo: **bloque de observaciones generales** (fondo `#FCFBF6`, borde redondeado, texto libre o estado vacío en cursiva).

#### 9. §06 Firmas de conformidad
**2 cards lado a lado** (Soporte + Aprobación). Cada card:
- Categoría + status "Firmado" con check verde
- Línea de firma con la rúbrica encima (italic Geist Mono, 22px)
- Nombre + rol + licencia
- Pie con timestamp de la firma (mono, borde punteado superior)

---

## Interacciones y comportamiento

### Captura (vista web/app)
- **Estado por defecto**: orden "Abierta" (status pill ámbar).
- **Edit-in-place** en cada campo: click → input inline, validación al blur.
- **Timeline**: las 4 fechas se llenan automáticamente al ejecutar la acción correspondiente (botón "Marcar recepción", "Iniciar mantenimiento", etc.).
- **Trabajos**:
  - Botón "Añadir trabajo" al final de cada grupo.
  - Condition pill = dropdown de 3 opciones (Bueno/Malo/N/A).
  - **Subir foto**: drag-and-drop directo sobre el slot, o click → file picker. Se guarda en object storage; sólo la URL/ID se persiste en el registro de la orden.
  - **Reencuadrar**: doble-click sobre foto colocada → modo pan/zoom.
  - **Eliminar foto**: hover → botón "x" arriba a la derecha del slot.
- **Firmas**: el técnico/gerente firma con touch/mouse en un canvas, o autentica con biometría y se imprime una rúbrica generada del nombre.

### PDF (al cerrar la orden)
- **Botón "Cerrar y generar PDF"** al pie de la vista. Bloqueado si:
  - Hay campos obligatorios vacíos
  - Algún trabajo no tiene foto en sus slots obligatorios
  - Falta alguna firma
- Al cerrar, se genera el PDF server-side y se adjunta al registro.

### Estados visuales
- **Cerrada** → status verde, todas las firmas presentes
- **En proceso** → status ámbar, parcialmente lleno
- **Rechazada** → status rojo (necesita firma de revisión adicional)

---

## State management (cliente)

```ts
type WorkOrder = {
  id: string;                    // "OT-20260521-0012"
  status: 'open' | 'in_progress' | 'closed' | 'rejected';
  service: {
    name: string;
    format: { name: string; version: string };
    productType: 'sensor' | 'motor' | 'avionics' | string;
    clientId: string;
    serviceOrderId: string;
    location: string;
    duration: number;            // segundos
  };
  timeline: {
    createdAt: string;
    receivedAt?: string;
    startedAt?: string;
    closedAt?: string;
  };
  product: {                     // datos del sensor/equipo
    serial: string;
    model: string;
    manufacturer: string;
    firmware?: string;
    lastCalibration?: string;
    internalId?: string;
  };
  personnel: Array<{
    role: 'support' | 'mechanic' | 'manager';
    name: string;
    title: string;
    license: string;
  }>;
  works: Array<{
    id: string;
    group: string;               // "Funcional", "Estructural", etc.
    component: string;
    description: string;
    condition: 'good' | 'bad' | 'na';
    isCritical: boolean;         // requiere firma individual
    photoSlots: Array<{
      id: string;
      label: string;             // "Antes", "Evidencia", etc.
      required: boolean;
      photoUrl?: string;
      reframe?: { x: number; y: number; scale: number };
    }>;
    signature?: { signedBy: string; signedAt: string; data: string };
  }>;
  dictum: {
    defectFound: boolean;
    correctiveDocRef?: string;
    observations: string;
  };
  signatures: Array<{
    role: 'support' | 'manager';
    name: string;
    title: string;
    license: string;
    signedAt: string;
    data: string;                // SVG path o base64
  }>;
};
```

---

## Design tokens

### Colores

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#FAFAF7` | Fondo de pantalla |
| `--paper` | `#FFFFFF` | Fondo del documento |
| `--ink` | `#111110` | Texto principal |
| `--ink-2` | `#3A3A36` | Texto secundario |
| `--muted` | `#76746B` | Labels, metadatos |
| `--line` | `#E7E5DD` | Bordes principales |
| `--line-2` | `#F0EEE7` | Bordes internos / separadores |
| `--accent` | `oklch(0.48 0.12 248)` | Acento azul (pills de rol) |
| `--accent-soft` | `oklch(0.95 0.025 248)` | Fondo de pills azul |
| `--ok` | `oklch(0.55 0.13 150)` | Verde (status cerrado, condición buena) |
| `--ok-soft` | `oklch(0.95 0.04 150)` | Fondo verde tenue |
| `--warn` | `oklch(0.65 0.16 70)` | Ámbar (en proceso) |
| `--critical` | `oklch(0.58 0.20 25)` | Rojo (defecto, punto crítico) |

### Tipografía

- **Sans**: **Geist** (300/400/500/600/700) — texto general, títulos, valores.
- **Mono**: **Geist Mono** (400/500/600) — folios, IDs, números de serie, timestamps, labels uppercase.
- Activar: `font-feature-settings: 'ss01', 'cv11'` en sans; `'zero', 'ss02'` en mono.

Escala:

| Token | Tamaño | Uso |
|---|---|---|
| `--fs-mono-xs` | 10.5px | Labels uppercase |
| `--fs-mono-sm` | 11.5px | Meta secundaria |
| `--fs-xs` | 11px | Captions |
| `--fs-sm` | 12.5px | Descripciones tabla |
| `--fs-base` | 14px | Cuerpo |
| `--fs-md` | 16px | Section titles, nombres |
| `--fs-lg` | 20px | — |
| `--fs-xl` | 28px | — |
| `--fs-2xl` | 36px | Título del documento |

Letter-spacing del título: `-0.025em`. Labels mono uppercase: `0.10em`–`0.14em`.

### Espaciado y radios

- **Radios**: `4px` (sm) · `8px` (lg)
- **Padding documento**: `0.55in 0.6in 0.5in` (top right/left bottom)
- **Gap entre secciones**: `26px`
- **Gap entre cards de personal**: `10px`

### Sombras

Sólo una, en la vista de pantalla (no en PDF):
```css
box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 10px 30px -10px rgba(0,0,0,0.10);
```

---

## Componentes a construir (mapeo a librerías comunes)

| Pieza diseño | Componente React sugerido | Librerías comunes |
|---|---|---|
| Status pill | `<StatusPill status="closed">` | propio + tokens |
| Timeline 4 pasos | `<Timeline steps={[…]}>` | propio |
| KV Grid (datos generales/sensor) | `<KVGrid cols={4}>` + `<KV label value>` | propio |
| Person card | `<PersonCard role>` | propio |
| Works table + evidence | `<WorksTable>` + `<WorkRow>` + `<EvidenceGallery>` | TanStack Table + custom |
| Photo slot (drag/drop, reframe) | `<PhotoSlot id required label>` | react-dropzone + crop |
| Condition pill | `<ConditionPill value="good">` | propio |
| Progress bar | `<Progress value={1.0}>` | Radix / shadcn |
| Signature canvas | `<SignaturePad>` | `react-signature-canvas` o similar |
| PDF render | server-side | Puppeteer / React-PDF |

---

## Assets

- **`hydra-logo.png`** — logo extraído del PDF original. Es PNG con transparencia, gris claro. En el HTML se aplica `filter: brightness(0) saturate(100%)` para convertirlo en negro sólido. **Recomendación**: pedir al equipo de HYDRA el logo en SVG original para evitar el filtro y permitir versiones en color.
- Fuentes: Geist y Geist Mono se cargan desde Google Fonts.

---

## Archivos en este bundle

- `Orden de Trabajo.html` — prototipo principal (2 páginas, vista impresa)
- `image-slot.js` — componente web nativo de drag-and-drop con persistencia (sólo referencia de UX; **no llevar a producción**, reemplazar por componente del codebase)
- `hydra-logo.png` — logo extraído del PDF original
- `referencia-original.pdf` — formato actual que se está sustituyendo
- `CLAUDE_CODE_PROMPT.md` — prompt detallado para implementar con Claude Code

---

## Notas finales para el desarrollador

1. **El HTML está pensado como referencia visual**, no como base de código. Recrear con el sistema de componentes existente.
2. **Fotos obligatorias**: la lógica de validación de cierre debe verificar que todos los slots marcados `required: true` estén llenos.
3. **El PDF se genera server-side**, no desde el navegador del técnico (consistencia tipográfica + no depende de fuentes locales + firmable digitalmente).
4. **Número de fotos por trabajo es variable** — viene del catálogo de formatos por tipo de producto. La galería se adapta al `length` del array `photoSlots`.
5. **Internacionalización**: el formato está en español. Si se requiere bilingüe, todos los strings deben pasar por i18n.
6. **Impresión**: respetar `@page { size: Letter; margin: 0 }` y márgenes internos del documento. El componente debe imprimirse 1 orden = 2 páginas (o más si los trabajos exceden el espacio).
