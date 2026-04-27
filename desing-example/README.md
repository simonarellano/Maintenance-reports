# Handoff: AeroMX — Sistema de Mantenimiento de Drones

## Overview
Prototipo hi-fi interactivo para la app móvil PWA de gestión de mantenimiento aeronáutico **AeroMX**. Cubre el flujo completo desde login hasta cierre y firma digital de órdenes de trabajo (O/T). La app es usada por técnicos en campo (rampa/hangar) con celular o tablet.

## Sobre los archivos de diseño
Los archivos en este paquete son **referencias de diseño creadas en HTML** — prototipos que muestran la apariencia e interacciones deseadas. **No son código de producción para copiar directamente.**

La tarea es **recrear estos diseños en el stack existente del proyecto**: React + Vite + TailwindCSS (PWA), usando los patrones establecidos en el repositorio `simonarellano/Maintenance-reports`. El prototipo sirve como especificación visual y de comportamiento.

## Fidelidad
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciado e interacciones son finales. El desarrollador debe recrear la UI con la mayor fidelidad posible usando el design system descrito en este documento.

---

## Design Tokens

### Colores
```
Background principal:  #090b12   (negro azul marino profundo)
Surface 1:             #12151e   (cards, inputs de fondo)
Surface 2:             #1b1f2e   (inputs, elementos secundarios)
Surface 3:             #242840   (hover states)
Border sutil:          rgba(100,130,255,0.10)

Acento cian (primario): #00d0e8
Acento cian dim:        rgba(0,208,232,0.13)

Ámbar (advertencia):    #f0a030
Ámbar dim:              rgba(240,160,48,0.13)

Verde (éxito/OK):       #28d980
Verde dim:              rgba(40,217,128,0.13)

Rojo (error/crítico):   #ff4545
Rojo dim:               rgba(255,69,69,0.13)

Texto principal:        #dde8f8
Texto secundario:       #6070a0  (subtítulos, labels)
Texto apagado:          #2a3050  (separadores, placeholders)
```

### Tipografía
```
Fuente UI:      "Space Grotesk" (Google Fonts) — pesos 400, 500, 600, 700
Fuente Mono:    "JetBrains Mono" (Google Fonts) — pesos 400, 500
                → Usar para: matrículas, números de O/T, horas, seriales, timestamps
```

### Espaciado y Radios
```
Border radius cards grandes:    16px
Border radius cards medianas:   12px
Border radius botones:          14px
Border radius inputs:           10px
Border radius badges:           999px (pill)
Border radius avatares:         22px

Padding lateral pantalla:       16px
Padding vertical secciones:     20px
Gap entre cards:                10px
```

### Sombras
```
Card elevada:   0 8px 32px rgba(0,0,0,0.5)
Glow cian:      0 0 48px rgba(0,208,232,0.14)
Glow verde:     0 0 40px rgba(40,217,128,0.15)
```

---

## Pantallas y Componentes

### 1. Login
**Propósito:** Autenticación de usuario con JWT.

**Layout:** Flex column, centrado vertical. Padding horizontal 28px.

**Elementos:**
- **Logo mark** (ícono de drone: 4 brazos diagonales + círculos en extremos + cuerpo cuadrado): 84×84px, border-radius 24px, bg `#12151e`, borde `1px solid rgba(100,130,255,0.10)`, glow cian
- **"AeroMX"**: 34px, font-weight 700, color `#dde8f8`, letter-spacing -0.03em
- **Subtítulo "Sistema de Mantenimiento"**: 12px, uppercase, letter-spacing 0.1em, color `#6070a0`
- **Campo Email**: input full-width, bg `#1b1f2e`, border, radius 10px, padding 11px 13px, font-size 15px
- **Campo Contraseña**: igual, type="password"
- **Botón "Iniciar Sesión"**: full-width, height 50px, bg `#00d0e8`, color `#090b12`, font-weight 600, radius 14px
- **Hint card** (credenciales de prueba): bg `#12151e`, border, radius 10px, texto en JetBrains Mono 11px
- **Versión**: `AeroMX v1.0 · 2026`, JetBrains Mono 11px, color `#2a3050`, absolute bottom 20px

**Estado loading:** botón muestra "Verificando…" y se deshabilita (opacity 0.45)

---

### 2. Dashboard
**Propósito:** Vista principal — estado de flota y lista de órdenes recientes.

**Layout:** Scroll vertical. Padding 16px lateral, sin tab bar encima del contenido.

**Elementos:**
- **Saludo**: "Bienvenido de vuelta" (13px, `#6070a0`) + nombre (26px, bold, `#dde8f8`)
- **Ícono campana** con badge rojo: 40×40px, bg `#12151e`, radius 12px
- **Chips de flota** (3 columnas): bg dim del color, borde sutil, radius 14px, padding 10px. Número en JetBrains Mono 24px bold, label 10px uppercase
  - "En Vuelo" → verde, n=4
  - "En Manto." → ámbar, n=2
  - "Disponibles" → cian, n=4
- **Label sección** "Órdenes Recientes": 11px, uppercase, letter-spacing 0.07em + link "Ver todas" cian derecha
- **Cards de O/T**: ver componente OTCard abajo

**OTCard:**
```
bg: #12151e
border: 1px solid rgba(100,130,255,0.10)
border-left: 3px solid <color del estado>
border-radius: 16px
padding: 14px
margin-bottom: 10px
cursor: pointer

Contenido:
  - Número O/T: JetBrains Mono 11px, color #6070a0
  - Badge estado: pill small (10px uppercase)
  - Modelo drone: 16px, font-weight 600, #dde8f8
  - Formato · Fecha: 12px, #6070a0
  - Barra de progreso: height 3px, bg #2a3050, fill según estado
    (en_proceso → cian, cerrada → verde)
  - Porcentaje: JetBrains Mono 11px derecha
```

**Estados O/T:**
| Estado | Label | Color | Bg |
|--------|-------|-------|-----|
| `borrador` | Borrador | `#6070a0` | `rgba(96,112,160,0.15)` |
| `en_proceso` | En Proceso | `#00d0e8` | `rgba(0,208,232,0.13)` |
| `pendiente_firma` | Pend. Firma | `#f0a030` | `rgba(240,160,48,0.13)` |
| `cerrada` | Cerrada | `#28d980` | `rgba(40,217,128,0.13)` |

---

### 3. Bottom Tab Bar
**Propósito:** Navegación principal entre secciones.

**Layout:** Posición fixed/absolute al fondo. Height 82px.

```
bg: rgba(9,11,18,0.94)
backdrop-filter: blur(24px)
border-top: 1px solid rgba(100,130,255,0.10)
padding-bottom: 16px (safe area)

3 tabs: "Órdenes" | "Nueva" | "Perfil"
Ícono activo: #00d0e8
Ícono inactivo: #6070a0
Label: 10px, uppercase, letter-spacing 0.04em
Indicador activo: línea 2px #00d0e8, width 20px, en top del tab
```

---

### 4. Detalle de O/T
**Propósito:** Ver detalles de una orden, estado, secciones y acciones disponibles.

**Elementos:**
- **Header**: título formato + número O/T (mono, sub) + badge estado
- **Card Drone**: ícono drone 36×36 en bg cian dim, modelo, matrícula en cian mono; row con horas, serie, técnico en texto pequeño
- **Flow de estados** (4 steps): círculos 22px con check SVG para completados, líneas conectoras 2px. Step actual tiene glow. Labels 8px bajo cada círculo.
- **Lista de secciones**: card 12px radius, barra de progreso coloreada según estado (ok=verde, warn=ámbar, partial=cian, pending=sub). Fracción `done/total` en mono.
- **CTAs**: "Continuar Inspección" (primary) + "Ir a Cierre y Firma" (ghost o primary si `pendiente_firma`)

---

### 5. Pantalla de Inspección (lista de puntos)
**Propósito:** Listar puntos de una sección con su estado.

**Elementos:**
- **Barra progreso resumen**: card con "X de Y completados" + count pendientes en ámbar
- **Cards de puntos**: border-left coloreado (verde=ok, ámbar=warn, dim=pendiente)
  - Badge "CRÍTICO" rojo si `es_critico: true`
  - Estado: círculo 28px con check
  - Si tiene observación: texto ámbar en cursiva con ⚠

---

### 6. Detalle de Punto
**Propósito:** Registrar el estado de un punto de inspección individual.

**Elementos:**
- **Banner crítico** (si aplica): bg rojo dim, ícono triángulo, texto rojo 12px bold
- **Card descripción**: bg surface, label uppercase, texto 14px line-height 1.55
- **Grid de estado** (2×2): cada opción es una card 13px padding, border 2px. Al seleccionar → border y text cambian al color de la opción
  - Bueno → verde
  - No Aplica → sub
  - Con Daños → ámbar
  - Req. Atención → rojo
- **Textarea observación**: full-width, minHeight 72px; borde rojo si es requerida y vacía; label con asterisco rojo
- **Galería fotos**: thumbnails 68×68px bg cian dim + botón "+" dashed
- **Botón "Firmar Punto Crítico"**: variant ghost, solo visible si punto crítico y estado seleccionado
- **Botón "Guardar Punto"**: deshabilitado si observación requerida y vacía

---

### 7. Cierre de O/T ⭐ (pantalla prioritaria)
**Propósito:** Registrar el cierre formal con defectos, observaciones y doble firma.

**Elementos:**
- **Banner "Todos los puntos completados"**: bg verde dim, círculo verde con check, texto verde bold + sub
- **Toggle defecto Sí/No**: 2 botones flex, height 46px, radius 12px; seleccionado cambia bg+border al color correspondiente
- **Campo "Ref. Documento Correctivo"**: aparece solo si defecto = "Sí"; campo mono, requerido
- **Textarea "Observaciones Generales"**: minHeight 80px
- **Cards de firma** (2): card con rol, nombre, y botón "Firmar →" en cian dim. Una vez firmado muestra check verde + "Firmado"
- **Botón "Cerrar Orden de Trabajo"**: deshabilitado hasta que `defecto !== null && (defecto !== 'Sí' || refDoc.length > 0)`

---

### 8. Firma Digital ⭐ (pantalla prioritaria)
**Propósito:** Captura de firma digital mediante canvas táctil.

**Elementos:**
- **Card firmante**: avatar 44×44 (iniciales, bg cian dim, radius 13px), nombre, licencia
- **Meta filas**: O/T, fecha/hora, aeronave — separados por borde sutil
- **Canvas de firma**: width 100% (330px base), height ~150px; bg `#1b1f2e`; grid de líneas muy tenues `rgba(100,130,255,0.07)` cada 18px; línea guía horizontal cian dim punteada al 68% de altura
  - **Border**: `2px solid <T.border>` → al tener trazo: `2px solid rgba(0,208,232,0.6)`
  - Trazo en cian `#00d0e8`, lineWidth 2.4, lineCap/lineJoin round
  - Touch events y mouse events para dibujar
  - Botón "Limpiar" (texto underline) a la derecha
- **Nota legal**: card surface, texto 11px sub, line-height 1.55
- **Botón "Confirmar Firma"**: deshabilitado hasta que haya trazos. Con trazo: label "Confirmar Firma ✓"

---

### 9. Nueva O/T (3 pasos)
**Propósito:** Wizard para crear una nueva orden de trabajo.

**Barra de progreso de paso**: full-width 4px, fill cian proporcional al paso actual.

**Paso 1 — Aeronave:** Lista de drones. Card seleccionada con `border: 2px solid #00d0e8`.

**Paso 2 — Formato:** Lista de formatos de mantenimiento. Mismo patrón.

**Paso 3 — Encabezado:** Chip resumen (matrícula + formato en cian mono), campos Cliente, Orden de Servicio, Horas al Momento (read-only, mono cian).

---

### 10. Perfil
**Elementos:**
- Avatar 76×76px, radius 22px, bg cian dim, iniciales 26px bold cian, glow cian
- Nombre 20px bold, email 13px sub, badge Pill de rol
- Lista de datos: padding 14px vertical, separadores 1px subtle
- Botón "Cerrar Sesión": variant ghost
- Versión: JetBrains Mono 11px color dim, centrado

---

## Componentes Compartidos

### Btn
```
height: 50px, border-radius: 14px, font-size: 15px, font-weight: 600

Variantes:
  primary → bg: #00d0e8, color: #090b12
  ghost   → bg: transparent, color: #6070a0, border: 1px solid rgba(100,130,255,0.10)
  danger  → bg: rgba(255,69,69,0.13), color: #ff4545, border: 1px solid rgba(255,69,69,0.40)
  surface → bg: #1b1f2e, color: #dde8f8, border: 1px solid rgba(100,130,255,0.10)

disabled: opacity 0.45, pointer-events none
```

### Pill / Badge
```
padding: 3px 10px (small: 2px 8px)
border-radius: 999px
font-size: 11px (small: 10px)
font-weight: 600
text-transform: uppercase
letter-spacing: 0.05em
```

### Field / Input
```
bg: #1b1f2e
border: 1px solid rgba(100,130,255,0.10)
border-radius: 10px
padding: 11px 13px
color: #dde8f8
font-size: 15px
outline: none
```

### Hdr (encabezado de pantalla)
```
Breadcrumb "← Atrás": color cian, 13px, font-weight 500
Sub-label: 11px, JetBrains Mono, uppercase, letter-spacing 0.08em, color sub
Título: 24px, font-weight 700, color texto
```

---

## Interacciones y Animaciones

| Elemento | Comportamiento |
|----------|---------------|
| Botones | `transition: opacity 150ms` |
| Cards de O/T | `cursor: pointer` |
| Selección de estado (punto) | `transition: border-color 150ms, background 150ms` |
| Barra de progreso | `transition: width 400ms` |
| Step flow activo | `box-shadow: 0 0 10px rgba(0,208,232,0.6)` |
| Canvas firma | Border cambia a cian al primer trazo |

---

## Flujo de Navegación

```
LOGIN → DASHBOARD
DASHBOARD → OT_DETAIL (tap card)
          → CREAR_OT (tab "Nueva")
          → PERFIL (tab "Perfil")

OT_DETAIL → INSPECTION (tap sección / "Continuar Inspección")
          → CIERRE ("Ir a Cierre y Firma")

INSPECTION → POINT_DETAIL (tap punto)
POINT_DETAIL → FIRMA ("Firmar Punto Crítico")

CIERRE → FIRMA ("Firmar →")
       → OT_CLOSED ("Cerrar Orden de Trabajo")

OT_CLOSED → DASHBOARD

PERFIL → LOGIN ("Cerrar Sesión")
```

Persistir pantalla actual en `localStorage` key `aeromx_s` para retomar al recargar.

---

## Estado Global (Zustand)

Variables de store sugeridas:
```ts
interface AppStore {
  user: User | null
  token: string | null
  currentOT: OrdenTrabajo | null
  ordenes: OrdenTrabajo[]
  setUser: (u: User, token: string) => void
  logout: () => void
  setCurrentOT: (ot: OrdenTrabajo) => void
}
```

---

## Reglas de Negocio en UI

1. **Observación obligatoria** si `estado === 'correcto_con_danos' || 'requiere_atencion'` — mostrar asterisco rojo + borde rojo en textarea
2. **Foto obligatoria** (mín. 1) si observación requerida
3. **"Cerrar O/T" deshabilitado** hasta que `defecto !== null && (defecto !== 'Sí' || refDoc.length > 0)`
4. **"Guardar Punto" deshabilitado** si observación requerida y textarea vacía
5. **"Confirmar Firma" deshabilitado** hasta que haya al menos un trazo en canvas
6. Badge "CRÍTICO" solo en puntos con `es_critico: true`

---

## Estructura de Archivos Sugerida (Frontend)

```
frontend/src/
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── OTDetail.tsx
│   ├── Inspection.tsx
│   ├── PointDetail.tsx
│   ├── Cierre.tsx
│   ├── Firma.tsx
│   ├── CrearOT.tsx
│   └── Perfil.tsx
├── components/
│   ├── ui/
│   │   ├── Btn.tsx
│   │   ├── Pill.tsx
│   │   ├── Field.tsx
│   │   ├── Hdr.tsx
│   │   └── TabBar.tsx
│   ├── OTCard.tsx
│   ├── SignatureCanvas.tsx
│   ├── StatusFlow.tsx
│   └── DroneMark.tsx  ← SVG logo
├── store/
│   └── appStore.ts
└── tokens/
    └── design.ts  ← todos los tokens de color/tipografía
```

---

## Assets

- **DroneMark SVG**: dibujado programáticamente. Ver implementación en el prototipo HTML — es un SVG inline con 4 líneas diagonales, 4 círculos en extremos y un rect central con agujero.
- No se usan imágenes externas. Todos los íconos son SVGs inline simples.
- Fuentes: importar desde Google Fonts (`Space Grotesk`, `JetBrains Mono`).

---

## Archivos en este paquete

| Archivo | Descripción |
|---------|-------------|
| `AeroMX Prototype.html` | Prototipo interactivo completo. Abrir en browser para navegar todas las pantallas. Incluye React + Babel inline — solo para referencia de diseño. |
| `README.md` | Este documento de especificación. |

---

## Cómo usar el prototipo

1. Abrir `AeroMX Prototype.html` en un browser moderno
2. Ingresar con `tecnico@aeromx.com / aeromx123`
3. Navegar el flujo completo tocando los elementos interactivos
4. Para saltar a cualquier pantalla: activar el panel **Tweaks** (botón en esquina inferior derecha) y usar el selector "Navegar a pantalla"

---

*Generado por Claude Design · AeroMX · Abril 2026*
