# Panel de control + limpieza del Header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el Header principal a `Órdenes · Flota · Fallas · Productos · ⚙ Panel` agregando una página `/panel` que actúa como índice de tarjetas hacia Formatos, Usuarios, Modelos y Categorías de falla. Sin schema, sin endpoints nuevos, sin refactor de las páginas hijo.

**Architecture:** Una página React nueva (`PanelControlPage`) que solo enlista 4 tarjetas con `<Card hoverable onClick>` apuntando a rutas existentes. Una ruta nueva en `App.jsx`. Una edición quirúrgica a `Header.jsx`: tres enlaces fuera, uno nuevo (`⚙ Panel`) con su propio gate `puedePanel = esSuper || rol === 'gerente_soporte'`. La página valida rol al montar y redirige a `/dashboard` si no cumple, copiando el patrón de `UsuariosPage.jsx:25-29`.

**Tech Stack:** React 18 + react-router-dom v6 + zustand (`useAuthStore`) + design tokens (`T`, `ROL_LABELS`) + componentes `Header`, `Hdr`, `Card` de `components/ui.jsx`. Sin librerías nuevas. Sin tests automatizados (el frontend no tiene framework de tests instalado; verificación = `npm run build` + smoke manual por rol).

**Spec:** `docs/superpowers/specs/2026-05-29-panel-control-design.md`

---

## File Structure

- **Crear:** `aeromx/frontend/src/pages/PanelControlPage.jsx` — página índice de 4 tarjetas. Responsabilidad: render del hub admin + gate de rol.
- **Modificar:** `aeromx/frontend/src/App.jsx` — agregar `<Route path="/panel" ...>` antes del catch-all `/`.
- **Modificar:** `aeromx/frontend/src/components/Header.jsx` — agregar `puedePanel`, agregar entrada `⚙ Panel`, quitar entradas `Modelos`, `Formatos`, `Usuarios`.

Las 4 páginas hijo (`FormatosPage`, `UsuariosPage`, `ModelosPage`, `CategoriasFallaPage`) y todo el backend **no se tocan**.

---

## Task 1: Crear PanelControlPage

**Files:**
- Create: `aeromx/frontend/src/pages/PanelControlPage.jsx`

- [ ] **Step 1: Crear el archivo con el componente completo**

Contenido exacto (escribir tal cual):

```jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import { Card, Hdr } from '../components/ui'

const TARJETAS = [
  {
    slug: 'formatos',
    icono: '📋',
    titulo: 'Formatos',
    descripcion: 'Plantillas de mantenimiento y falla por tipo de producto',
    to: '/formatos',
  },
  {
    slug: 'usuarios',
    icono: '👥',
    titulo: 'Usuarios',
    descripcion: 'Alta y edición del personal del sistema',
    to: '/usuarios',
  },
  {
    slug: 'modelos',
    icono: '🛩',
    titulo: 'Modelos',
    descripcion: 'Catálogo de modelos por tipo de producto',
    to: '/modelos',
  },
  {
    slug: 'categorias-falla',
    icono: '⚠',
    titulo: 'Categorías de falla',
    descripcion: 'Taxonomía de fallas para reportes',
    to: '/categorias-falla',
  },
]

export default function PanelControlPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSuper = user?.superusuario === true
  const puedePanel = esSuper || user?.rol === 'gerente_soporte'

  useEffect(() => {
    if (!puedePanel) {
      navigate('/dashboard', { replace: true })
    }
  }, [puedePanel, navigate])

  if (!puedePanel) return null

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Panel de control"
          sub="Administración del sistema"
          back={() => navigate('/dashboard')}
        />
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 24 }}>
          Catálogos y configuración del sistema. Selecciona una sección.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {TARJETAS.map((t) => (
            <Card
              key={t.slug}
              hoverable
              onClick={() => navigate(t.to)}
              padding={20}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140 }}
            >
              <div style={{ fontSize: 32, lineHeight: 1 }}>{t.icono}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{t.titulo}</div>
              <div style={{ fontSize: 13, color: T.sub, flex: 1 }}>{t.descripcion}</div>
              <div style={{ fontSize: 12, color: T.cyan, fontWeight: 600, marginTop: 4 }}>
                Abrir →
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build (sin ruta aún, solo que compila)**

Run: `cd aeromx/frontend && npm run build`
Expected: build PASS. El componente queda en el bundle aunque aún no esté rutado.
Si falla por import inexistente, revisar que `Card`, `Hdr`, `Header`, `useAuthStore`, `T` existan en las rutas indicadas (verificación de spec: ya existen).

- [ ] **Step 3: Commit**

```bash
git add aeromx/frontend/src/pages/PanelControlPage.jsx
git commit -m "feat(panel): nueva PanelControlPage (hub admin con 4 tarjetas)"
```

---

## Task 2: Registrar la ruta `/panel` en `App.jsx`

**Files:**
- Modify: `aeromx/frontend/src/App.jsx`

- [ ] **Step 1: Agregar el import al bloque de imports de páginas**

Justo después de la línea `import FallasDashboardPage from './pages/FallasDashboardPage'` (línea 20), agregar:

```jsx
import PanelControlPage from './pages/PanelControlPage'
```

- [ ] **Step 2: Registrar la ruta antes del catch-all `/`**

Justo antes del bloque `<Route path="/" element={<Navigate to="/dashboard" replace />} />` (línea 145), insertar:

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

- [ ] **Step 3: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build PASS sin warnings de rutas duplicadas.

- [ ] **Step 4: Smoke manual de la ruta (dev server)**

Si el dev server no está corriendo: `cd aeromx/frontend && npm run dev` (puerto 5173).
Login con `dev@aeromx.com` / `aeromx123` y visitar `http://localhost:5173/panel`.
Expected: se ve la página con 4 tarjetas (clicar una navega a su página respectiva).

- [ ] **Step 5: Commit**

```bash
git add aeromx/frontend/src/App.jsx
git commit -m "feat(panel): registrar ruta /panel en App.jsx"
```

---

## Task 3: Actualizar `Header.jsx` (quitar 3 links, agregar `⚙ Panel`)

**Files:**
- Modify: `aeromx/frontend/src/components/Header.jsx`

- [ ] **Step 1: Agregar el gate `puedePanel`**

En el cuerpo del componente, justo después de las líneas existentes (Header.jsx:28-31):

```jsx
  // Catálogos (productos, modelos, formatos): gerente o ingeniero de soporte.
  const puedeCatalogos = esSuper || user?.rol === 'gerente_soporte' || user?.rol === 'ingeniero_soporte'
  // Usuarios: solo gerente de soporte.
  const puedeUsuarios = esSuper || user?.rol === 'gerente_soporte'
```

…agregar una línea más (queda como nueva línea 32 aproximadamente):

```jsx
  // Panel de control (catálogos admin agrupados): solo gerente o super.
  const puedePanel = esSuper || user?.rol === 'gerente_soporte'
```

Nota: `puedeUsuarios` queda en el código aunque ya no se use en `links` (se borra en Step 2). Eliminarlo también para no dejar binding muerto.

- [ ] **Step 2: Reescribir el arreglo `links`**

Localizar el arreglo `links` (Header.jsx:52-60):

```jsx
  const links = [
    { to: '/dashboard',  label: 'Órdenes',    show: true },
    { to: '/flota',      label: 'Flota',      show: true },
    { to: '/fallas',     label: 'Fallas',     show: true },
    { to: '/productos',  label: 'Productos',  show: puedeCatalogos },
    { to: '/modelos',    label: 'Modelos',    show: puedeCatalogos },
    { to: '/formatos',   label: 'Formatos',   show: puedeCatalogos },
    { to: '/usuarios',   label: 'Usuarios',   show: puedeUsuarios },
  ].filter((l) => l.show)
```

…y reemplazarlo por:

```jsx
  const links = [
    { to: '/dashboard',  label: 'Órdenes',    show: true },
    { to: '/flota',      label: 'Flota',      show: true },
    { to: '/fallas',     label: 'Fallas',     show: true },
    { to: '/productos',  label: 'Productos',  show: puedeCatalogos },
    { to: '/panel',      label: '⚙ Panel',    show: puedePanel },
  ].filter((l) => l.show)
```

- [ ] **Step 3: Eliminar `puedeUsuarios` (binding muerto)**

Borrar las dos líneas (después de Step 1 quedaban consecutivas):

```jsx
  // Usuarios: solo gerente de soporte.
  const puedeUsuarios = esSuper || user?.rol === 'gerente_soporte'
```

(Equivalente a `puedePanel` pero ya no se referencia.)

- [ ] **Step 4: Verificar build**

Run: `cd aeromx/frontend && npm run build`
Expected: build PASS, sin warnings de variables sin usar.

- [ ] **Step 5: Smoke manual — desktop**

Con dev server corriendo, en navegador desktop:
- Login `dev@aeromx.com` (gerente+super) → Header lista: Órdenes, Flota, Fallas, Productos, ⚙ Panel. Click `⚙ Panel` → `/panel`. Click cualquier tarjeta → su página.
- Login `gerente@aeromx.com` → mismo Header que dev.
- Login `ingeniero@aeromx.com` → Header lista: Órdenes, Flota, Fallas, Productos. **Sin `⚙ Panel`**. Visitar `/panel` directo → redirect a `/dashboard`.
- Login `tecnico@aeromx.com` → Header lista solo: Órdenes, Flota, Fallas (sin cambio).

- [ ] **Step 6: Smoke manual — mobile (drawer)**

En DevTools, viewport < 900px. Login `dev@aeromx.com`. Abrir hamburguesa.
Expected: drawer muestra Órdenes, Flota, Fallas, Productos, ⚙ Panel (uno por fila). Tap `⚙ Panel` → `/panel` con grid 1 columna.

- [ ] **Step 7: Commit**

```bash
git add aeromx/frontend/src/components/Header.jsx
git commit -m "feat(panel): mover catalogos admin tras ⚙ Panel en el Header"
```

---

## Task 4: Cierre — actualizar PENDIENTES.md y CLAUDE.md

**Files:**
- Modify: `docs/PENDIENTES.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Marcar #1 como completado en `docs/PENDIENTES.md`**

Localizar la cabecera de la sección #1 (línea 13):

```markdown
## 1. Panel de control (hub de administración) + limpiar la interfaz
```

…y cambiarla por:

```markdown
## 1. Panel de control (hub de administración) + limpiar la interfaz ✅ COMPLETADO 2026-05-29
```

Al final de esa sección (antes del separador `---` de la línea 34), agregar una línea breve:

```markdown
**Implementado:** ⚙ Panel agrupa Formatos, Usuarios, Modelos, Categorías de falla en `/panel`. Productos sigue en Header. Spec `docs/superpowers/specs/2026-05-29-panel-control-design.md`, plan `docs/superpowers/plans/2026-05-29-panel-control.md`.
```

- [ ] **Step 2: Agregar entrada en `CLAUDE.md` (sección "Completado y verificado")**

Localizar la lista bullet de la sección **"Completado y verificado:"** y agregar al final un bullet:

```markdown
- **Panel de control** (Sesión 26): hub admin en `/panel` con 4 tarjetas (Formatos, Usuarios, Modelos, Categorías de falla). Header reducido a `Órdenes · Flota · Fallas · Productos · ⚙ Panel`. Visibilidad: `gerente_soporte` o superusuario. Sin schema, sin endpoints nuevos. Verificado por `npm run build` + smoke por rol.
```

- [ ] **Step 3: Verificar `npm run build` final**

Run: `cd aeromx/frontend && npm run build`
Expected: PASS limpio.

- [ ] **Step 4: Commit final**

```bash
git add docs/PENDIENTES.md CLAUDE.md
git commit -m "docs(panel): marcar #1 PENDIENTES como completado + nota en CLAUDE"
```

---

## Notas para el ejecutor

- **Sin TDD aquí:** el frontend no tiene framework de pruebas instalado (`package.json` solo trae ESLint). No agregues vitest/jest en este alcance — es un cambio de UI sin schema. La verificación está en `npm run build` + smoke por rol.
- **Sin tocar las 4 páginas hijo:** `FormatosPage`, `UsuariosPage`, `ModelosPage`, `CategoriasFallaPage` se quedan EXACTAMENTE como están. Si tienes la tentación de "limpiar de paso", no lo hagas (queda fuera de alcance).
- **Patrón de gate de rol:** copia idéntico al de `UsuariosPage.jsx:25-29`. No inventes uno nuevo.
- **Ícono `⚙` como prefijo del label:** se renderiza como texto Unicode dentro del mismo `navButton` que el resto. No agregar componente nuevo de ícono.
- **Productos NO se mueve:** queda en el Header con su gate `puedeCatalogos` actual. Ingeniero conserva acceso a Productos.
- **Backend intacto:** las rutas `/api/formatos`, `/api/modelos`, `/api/categorias-falla`, `/api/usuarios` no se endurecen. Si `ingeniero_soporte` teclea `/formatos` en la URL, el frontend lo deja entrar y el backend también (igual que hoy).
- **Commits pequeños:** uno por Task. Si necesitas dividir más, está bien — pero cada commit debe dejar el árbol compilando.
