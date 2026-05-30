# Spec — Panel de control + limpieza del Header

**Fecha:** 2026-05-29
**Origen:** `docs/PENDIENTES.md` #1
**Tipo:** Reorganización de UI (sin schema, sin endpoints nuevos)
**Riesgo:** Bajo

## 1. Propósito

Descongestionar el Header principal sacando los catálogos administrativos (Formatos, Usuarios, Modelos, Categorías de falla) y agrupándolos detrás de un único acceso "⚙ Panel". El Panel es un índice que enlaza a las páginas existentes; no se modifica la lógica de esas páginas ni sus rutas.

## 2. Estado actual (referencia)

Header (`aeromx/frontend/src/components/Header.jsx`) hoy expone 7 enlaces para el rol más privilegiado:

```
Órdenes · Flota · Fallas · Productos · Modelos · Formatos · Usuarios
```

Gates actuales:
- `puedeCatalogos = esSuper || rol === 'gerente_soporte' || rol === 'ingeniero_soporte'` → controla Productos, Modelos, Formatos.
- `puedeUsuarios = esSuper || rol === 'gerente_soporte'` → controla Usuarios.
- Categorías de falla (`/categorias-falla`) ya existe como ruta, pero **no está en el Header**.

## 3. Alcance

### 3.1 Header — qué cambia

**Después:**
```
Órdenes · Flota · Fallas · Productos · ⚙ Panel
```

Cambios concretos en `Header.jsx`:
- **Quitar** del arreglo `links` las entradas: `Modelos`, `Formatos`, `Usuarios`.
- **Conservar** `Productos` con el gate `puedeCatalogos` actual (sin cambio).
- **Agregar** entrada `⚙ Panel` → `to: '/panel'`, con gate **`puedePanel = esSuper || rol === 'gerente_soporte'`**.
- El drawer mobile usa el mismo arreglo `links` → cambia automáticamente.
- Estilo del botón `⚙ Panel`: idéntico al resto (`navButton`); el ícono `⚙` va como prefijo del `label` (string `'⚙ Panel'`), sin componente nuevo.

### 3.2 Página nueva `PanelControlPage`

Archivo: `aeromx/frontend/src/pages/PanelControlPage.jsx`. Ruta: `/panel`.

**Estructura:**
- `<Header />` arriba (reuso).
- Contenedor `maxWidth: 1280, padding 24px`.
- Título "Panel de control" + subtítulo "Administración del sistema".
- Grid 2 columnas (desktop ≥ 700px) / 1 columna (mobile) con 4 tarjetas.

**Tarjetas (estáticas, sin conteos vivos):**

| Slug | Ícono | Título | Descripción | Destino |
|---|---|---|---|---|
| `formatos` | 📋 | Formatos | Plantillas de mantenimiento y falla por tipo de producto | `/formatos` |
| `usuarios` | 👥 | Usuarios | Alta y edición del personal del sistema | `/usuarios` |
| `modelos` | 🛩 | Modelos | Catálogo de modelos por tipo de producto | `/modelos` |
| `categorias-falla` | ⚠ | Categorías de falla | Taxonomía de fallas para reportes | `/categorias-falla` |

**Estilo:** mismo lenguaje visual que `FlotaPage` / `DashboardPage`. Cada tarjeta:
- background `T.s1`, borde `T.border`, `borderRadius: 14`, padding `20px`.
- Layout: ícono grande (32px) arriba-izquierda, título 16px semibold, descripción 13px `T.sub`, flecha sutil `→` abajo-derecha.
- Hover: borde `T.cyan + '35'`, fondo `T.cD`, transición `.15s`.
- Click navega a su destino (React Router `useNavigate`).

**Permiso de la página:** `gerente_soporte || superusuario`.
- `ProtectedRoute` valida login (igual que el resto).
- `PanelControlPage` valida rol al montar: si no cumple, `navigate('/dashboard', { replace: true })`. Patrón ya usado por otras páginas (chequeo fino con `useAuthStore`).
- Las 4 tarjetas se renderizan **todas** (no se ocultan individualmente) porque si el usuario llegó al Panel ya cumple `gerente_soporte || super`, y ese rol tiene acceso a las 4 secciones por el `puedeCatalogos`/`puedeUsuarios` actual.

### 3.3 Ruta nueva en `App.jsx`

Insertar antes del `Route` catch-all `/`:

```jsx
<Route
  path="/panel"
  element={
    <ProtectedRoute>
      <PanelControlPage />
    </ProtectedRoute>
  }
/>
```

Rutas existentes de `/formatos`, `/modelos`, `/usuarios`, `/categorias-falla` **no se tocan**.

## 4. Permisos — cambio explícito de visibilidad

| Rol | Header antes | Header después |
|---|---|---|
| `superusuario` / `gerente_soporte` | Órdenes, Flota, Fallas, Productos, Modelos, Formatos, Usuarios | Órdenes, Flota, Fallas, Productos, **⚙ Panel** |
| `ingeniero_soporte` | Órdenes, Flota, Fallas, Productos, Modelos, Formatos | Órdenes, Flota, Fallas, Productos |
| `tecnico_soporte`, `mecanico`, `piloto`, `operador` | Órdenes, Flota, Fallas | Órdenes, Flota, Fallas (sin cambio) |

**Nota — ingeniero pierde descubrimiento, no pierde permiso:**
Los endpoints backend de `/api/formatos`, `/api/modelos`, `/api/categorias-falla` **no se endurecen** en este spec. Si un ingeniero teclea la URL directa, sigue entrando. Restricción = UI only. Endurecer backend es alcance futuro.

## 5. Mobile

- Drawer del Header lista: Órdenes, Flota, Fallas, Productos, ⚙ Panel (igual que desktop, sin items admin sueltos).
- `/panel` en mobile = grid 1 columna, tarjetas full-width con misma altura mínima.

## 6. Verificación

1. `cd aeromx/frontend && npm run build` → sin errores.
2. Login `dev@aeromx.com` (gerente+super):
   - Header muestra `⚙ Panel`, no muestra Modelos/Formatos/Usuarios.
   - Click `⚙ Panel` → `/panel` con 4 tarjetas.
   - Click en cada tarjeta → navega a la página respectiva, que se renderiza igual que antes.
3. Login `gerente@aeromx.com` (no super) → mismo comportamiento que dev.
4. Login `ingeniero@aeromx.com`:
   - Header muestra Productos pero **no** muestra `⚙ Panel`.
   - Visita directa a `/panel` → redirect a `/dashboard`.
5. Login `tecnico@aeromx.com`:
   - Header sin Productos, sin `⚙ Panel` (sin cambio respecto a hoy).
6. Mobile (DevTools < 900px): drawer abre, lista corta, `/panel` se ve bien.

## 7. Fuera de alcance

- Conteos vivos en tarjetas (V1 sin fetch extra).
- Endurecimiento backend para que `ingeniero_soporte` pierda acceso real a `/api/formatos`, `/api/modelos`, `/api/categorias-falla`.
- Mover Productos al Panel (se queda en Header).
- Embed/pestañas de páginas dentro del Panel (rechazado en brainstorming: requería refactor de las 4 páginas).
- Breadcrumbs o "regresar al Panel" desde las páginas hijo.
- Cambios en `CategoriasFallaPage`, `FormatosPage`, `ModelosPage`, `UsuariosPage`.
- Sub-secciones, tabs, o herramientas administrativas nuevas dentro del Panel.

## 8. Archivos tocados (resumen)

- `aeromx/frontend/src/components/Header.jsx` — quitar 3 links, agregar `⚙ Panel`, agregar `puedePanel`.
- `aeromx/frontend/src/pages/PanelControlPage.jsx` — **nuevo**.
- `aeromx/frontend/src/App.jsx` — agregar `Route /panel`.

Cero cambios en backend, schema, otras páginas, o tokens.
