// Capa de abstracción de almacenamiento de fotos.
// Selecciona el driver según STORAGE_PROVIDER: 'local' | 'minio' | 's3'.
// 'minio' y 's3' comparten el mismo driver S3 (MinIO es S3-compatible);
// solo cambia la configuración de endpoint/credenciales.
//
// Interfaz común que exponen los drivers:
//   ensureReady()                              → prepara el destino (crea bucket/dir si falta)
//   put({ buffer, contentType, originalName }) → { key, size }
//   getBuffer(key)                             → Buffer | null  (para embeber en el PDF)
//   getStream(key)                             → { stream, contentType, contentLength } | null
//   delete(key)                                → void
//
// El driver se construye de forma perezosa (en el primer uso) para que
// process.env ya esté poblado por dotenv.config() antes de leer la config.
import { createLocalDriver } from './localDriver.js'
import { createS3Driver } from './s3Driver.js'

let _driver = null

export function storageProvider() {
  // Toma el primer token: tolera comentarios en línea ("minio   # minio | s3").
  return (process.env.STORAGE_PROVIDER || 'local').trim().split(/\s+/)[0].toLowerCase()
}

function getDriver() {
  if (_driver) return _driver
  const provider = storageProvider()
  switch (provider) {
    case 's3':
    case 'minio':
      _driver = createS3Driver(provider)
      break
    case 'local':
      _driver = createLocalDriver()
      break
    default:
      console.warn(`[storage] STORAGE_PROVIDER="${provider}" desconocido — usando 'local'`)
      _driver = createLocalDriver()
  }
  return _driver
}

// Fachada que delega en el driver activo (resuelto al primer uso).
export const storage = {
  get nombre() { return getDriver().nombre },
  ensureReady: () => getDriver().ensureReady(),
  put: (args) => getDriver().put(args),
  putRaw: (args) => getDriver().putRaw(args),
  getBuffer: (key) => getDriver().getBuffer(key),
  getStream: (key) => getDriver().getStream(key),
  delete: (key) => getDriver().delete(key),
}

export { generarKey, contentTypeDesdeKey, keyDesdeUrl } from './helpers.js'
