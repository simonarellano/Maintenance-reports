// Helpers puros de almacenamiento (sin estado ni dependencias de driver).

// Genera una key única conservando la extensión del archivo original.
export function generarKey(originalName = '') {
  const ext = (originalName.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
}

const MIME_POR_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export function contentTypeDesdeKey(key = '') {
  const ext = (key.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()
  return MIME_POR_EXT[ext] || 'application/octet-stream'
}

// Extrae la key de almacenamiento desde el urlArchivo guardado (`/uploads/<key>`).
export function keyDesdeUrl(urlArchivo = '') {
  if (!urlArchivo) return null
  return urlArchivo.split('/').pop() || null
}
