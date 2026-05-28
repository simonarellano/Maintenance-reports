# Evidencia fotográfica de falla por etapa — Diseño (spec)

> ✅ **FINALIZADO (Sesión 24).** Implementado, verificado y pusheado: enum `EtapaFotoFalla`, dos galerías (reporte/resolución), PDF separado por etapa.

**Fecha:** 2026-05-26 · **Rama:** `development` · **Autor:** Simón Arellano + Claude

> Mejora del registro de fallas (construido en Fases 1–2). Hoy `FotoFalla` es una lista plana sin
> distinguir en qué momento del ciclo de la falla se capturó la evidencia. Esta spec agrega una
> **etapa** a cada foto para separar la evidencia **al reportar** (detección) de la evidencia
> **al resolver** (corrección), en la UI y en el PDF.

---

## 1. Objetivo y alcance

En `FallaDetallePage` existe una sola sección "Evidencia fotográfica" con un botón "+ Foto". No se
distingue si una foto documenta el defecto detectado o la corrección aplicada. El usuario necesita
capturar y ver ambas por separado.

**En alcance:**
- Discriminador `etapa` en `fotos_falla` (`reporte | resolucion`).
- Subida de fotos etiquetada por etapa (backend + frontend).
- Dos galerías separadas en `FallaDetallePage`, con permisos por estado.
- Dos galerías separadas en el PDF del reporte de falla (estética HYDRA).

**Fuera de alcance:**
- No se agrega subida de fotos dentro del modal de resolución (se usan las galerías de la página).
- No se agregan nuevas restricciones de permiso en los endpoints de foto del backend (siguen
  permisivos como hoy; el gate por etapa/estado vive en la UI, consistente con el comportamiento
  actual de las fotos de falla).
- No se migran/“re-etiquetan” fotos existentes a `resolucion`: todas quedan en `reporte` (default).

---

## 2. Decisiones de diseño (cerradas en brainstorming)

| Tema | Decisión |
|---|---|
| Modelo | **Una sola columna discriminadora** `etapa` (enum) en `fotos_falla`, no dos relaciones separadas. Una galería filtra por etapa; el default `reporte` cubre todo lo existente. |
| Etapas | Dos: `reporte` (al detectar/reportar) y `resolucion` (al corregir). |
| Permisos "Al reportar" | Subir/eliminar mientras la falla **NO** esté resuelta (`estado != resuelta`); se bloquea al resolverse. Sin gate de rol (cualquier autenticado, como hoy). |
| Permisos "Al resolver" | Subir/eliminar si el usuario **puede resolver** (`superusuario`, soporte —técnico/ingeniero/gerente—, o el responsable asignado), **incluso después** de que la falla esté resuelta. |
| Fotos heredadas (Fase 2) | Las copiadas de un punto de mantenimiento → `etapa = reporte`. |
| Backend de fotos | Permisivo (solo `verifyToken`), igual que hoy. El backend valida el valor de `etapa` y lo persiste; no enforce de etapa/estado/rol. |
| PDF | Dos bloques etiquetados "Evidencia al reportar" / "Evidencia al resolver"; se omite el bloque de una etapa si no tiene fotos. |

**Por qué una columna y no dos relaciones:** mínima superficie de cambio, `obtenerFalla` ya trae
`fotos: true` (incluye la columna nueva sin tocar el include), y filtrar por `etapa` en el cliente
es trivial. Dos relaciones (`fotosReporte`/`fotosResolucion`) duplicarían includes, controllers y
endpoints sin beneficio.

---

## 3. Modelo de datos

### 3.1 Enum nuevo

```prisma
enum EtapaFotoFalla {
  reporte
  resolucion
}
```

### 3.2 Cambio a `FotoFalla`

```prisma
model FotoFalla {
  // ... campos actuales ...
  etapa EtapaFotoFalla @default(reporte) @map("etapa")
}
```

- Todas las filas existentes quedan en `reporte` (default de la migración).

### 3.3 Migración (aditiva, a mano)

```sql
CREATE TYPE "EtapaFotoFalla" AS ENUM ('reporte', 'resolucion');
ALTER TABLE "fotos_falla" ADD COLUMN "etapa" "EtapaFotoFalla" NOT NULL DEFAULT 'reporte';
```

- Carpeta `prisma/migrations/<timestamp>_foto_falla_etapa/migration.sql`.
- Respaldo `pg_dump` previo a `backend/backups/`. Aplicar con `migrate deploy`. **Nunca**
  `migrate reset` ni `db:seed` (la BD de dev tiene formatos reales). Detener el backend antes de
  `prisma generate` (EPERM con la DLL bloqueada). `prisma/migrations/` está en `.gitignore` (no se
  versiona, igual que las migraciones anteriores).

---

## 4. Backend

### 4.1 `controllers/fallas/fotosController.js` — `subir`

- Leer `etapa` de `req.body.etapa` (multer deja los campos de texto del multipart en `req.body`).
- Validar: si viene y no es `reporte` ni `resolucion` → 400 `"etapa inválida"`. Si no viene → `reporte`.
- Persistir `etapa` en `prisma.fotoFalla.create({ data: { ..., etapa } })`.

### 4.2 `services/fallasService.js` — `crearFalla`

- En el `createMany` de copia de fotos del punto, agregar `etapa: 'reporte'` a cada fila.

### 4.3 `obtenerFalla`

- Sin cambios: `fotos: true` ya devuelve la columna `etapa`. (Opcional: `orderBy` de fotos por
  `createdAt` — no requerido.)

---

## 5. Frontend

### 5.1 `api/fallasService.js`

- `subirFoto(id, file, etapa)`: agrega `etapa` al `FormData` (`fd.append('etapa', etapa)`).
  `etapa` por defecto `'reporte'` si no se pasa.

### 5.2 `pages/FallaDetallePage.jsx`

- `handleSubirFoto(e, etapa)`: pasa `etapa` a `subirFoto`.
- La sección "Evidencia fotográfica" se reemplaza por **dos subsecciones**:
  - **"📸 Al reportar"** — fotos con `etapa === 'reporte'` (o sin `etapa`, defensivo). Botón "+ Foto"
    visible cuando `!estaResuelta`. `FotoCard.puedeEliminar = !estaResuelta`.
  - **"🔧 Al resolver"** — fotos con `etapa === 'resolucion'`. Botón "+ Foto" y `puedeEliminar`
    visibles cuando `puedeEvidenciaResolucion`.
- Flags de permiso:
  - `puedeEvidenciaResolucion = esSuper || esSoporte || esResponsable` (sin candado por estado —
    cubre durante el trabajo y tras resuelta).
  - Reporte usa `!estaResuelta` (cualquier autenticado, como hoy).
- Cada subsección muestra su conteo y un estado vacío propio ("Sin fotografías…").
- `FotoCard` se reutiliza sin cambios (recibe `puedeEliminar` por subsección).

### 5.3 `tokens/design.js` (opcional, menor)

- Mapa de etiquetas de etapa para reuso (`ETAPA_FOTO = { reporte: 'Al reportar', resolucion: 'Al resolver' }`).
  Opcional; las etiquetas pueden vivir inline en la página/PDF si se prefiere no tocar tokens.

---

## 6. PDF — `controllers/fallas/pdfController.js`

- Donde hoy se dibuja la galería única de evidencia, separar en dos bloques por `etapa`:
  - "Evidencia al reportar" (fotos `reporte` o sin etapa).
  - "Evidencia al resolver" (fotos `resolucion`).
- Se omite el encabezado/bloque de una etapa si no tiene fotos.
- Reusa las primitivas/galería HYDRA existentes; no se forkean estilos.

---

## 7. API — contratos afectados

| Método | Ruta | Cambio |
|---|---|---|
| POST | `/api/fallas/:id/fotos` | Acepta campo multipart `etapa` (`reporte`\|`resolucion`, default `reporte`). 400 si inválida. |
| GET | `/api/fallas/:id` | Cada foto incluye `etapa` (sin cambio de include). |
| GET | `/api/fallas/:id/pdf` | El PDF separa galerías por etapa. |

Sin endpoints nuevos. Sin cambios en `listarFallas`.

---

## 8. Riesgos y notas

- **Migración sobre BD con datos reales**: `pg_dump`, SQL a mano, `migrate deploy`, nunca
  `reset`/`seed`. Detener backend antes de `prisma generate`.
- **Compatibilidad de fotos existentes**: todas quedan en `reporte`. El frontend y el PDF tratan
  `etapa` ausente/`null` como `reporte` (defensivo) por si alguna foto se serializa sin el campo.
- **Backend permisivo**: el gate por etapa/estado es de UI. Un cliente directo a la API podría subir
  una foto `resolucion` a una falla en cualquier estado. Aceptado (hereda el modelo permisivo actual
  de fotos de falla; el endpoint `/uploads/:key` ya es público — pendiente de hardening del proyecto).
- **`etapa` en multipart**: el campo de texto debe enviarse junto al archivo en el mismo `FormData`;
  multer lo expone en `req.body.etapa`.
