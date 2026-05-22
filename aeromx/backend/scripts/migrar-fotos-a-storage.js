// Migra las fotos que viven en disco (backend/uploads/) al almacenamiento
// activo (MinIO/S3). Conserva la key original (= nombre de archivo) para que
// los `url_archivo` ya guardados en la BD sigan resolviendo.
//
// Idempotente: omite los objetos que ya existen en el bucket.
// Si STORAGE_PROVIDER=local no hace nada (los archivos ya están en disco).
//
// Uso:  node scripts/migrar-fotos-a-storage.js
import dotenv from 'dotenv'
dotenv.config()

import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { storage, storageProvider, contentTypeDesdeKey } from '../src/lib/storage/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.resolve(__dirname, '../uploads')

async function main() {
  const provider = storageProvider()
  console.log(`[migración] proveedor activo: ${provider}`)

  if (provider === 'local') {
    console.log('[migración] STORAGE_PROVIDER=local — los archivos ya están en disco. Nada que migrar.')
    return
  }

  if (!fs.existsSync(uploadsDir)) {
    console.log('[migración] no existe backend/uploads/ — nada que migrar.')
    return
  }

  await storage.ensureReady()

  const archivos = fs.readdirSync(uploadsDir).filter((f) => {
    const abs = path.join(uploadsDir, f)
    return fs.statSync(abs).isFile()
  })
  console.log(`[migración] ${archivos.length} archivo(s) en disco`)

  let subidos = 0, omitidos = 0, errores = 0
  for (const key of archivos) {
    try {
      const yaExiste = (await storage.getBuffer(key)) !== null
      if (yaExiste) { omitidos++; continue }
      const buffer = fs.readFileSync(path.join(uploadsDir, key))
      await storage.putRaw({ key, buffer, contentType: contentTypeDesdeKey(key) })
      subidos++
      console.log(`  ✔ ${key} (${buffer.length} bytes)`)
    } catch (e) {
      errores++
      console.error(`  [ERR] ${key}: ${e.message}`)
    }
  }

  console.log(`[migración] listo — subidos: ${subidos}, ya existían: ${omitidos}, errores: ${errores}`)
  if (errores > 0) process.exit(1)
}

main().catch((e) => { console.error('[migración] falló:', e); process.exit(1) })
