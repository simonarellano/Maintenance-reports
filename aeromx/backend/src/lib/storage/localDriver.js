// Driver de almacenamiento en disco local (backend/uploads/).
// Es el comportamiento histórico y el fallback cuando no hay MinIO/S3.
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { generarKey, contentTypeDesdeKey } from './helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.resolve(__dirname, '../../../uploads')

function rutaDe(key) {
  const abs = path.resolve(uploadsDir, key)
  // Defensa contra path traversal: la ruta debe quedar dentro de uploadsDir.
  if (!abs.startsWith(uploadsDir)) return null
  return abs
}

export function createLocalDriver() {
  return {
    nombre: 'local',

    async ensureReady() {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    },

    async put({ buffer, originalName }) {
      const key = generarKey(originalName)
      const abs = rutaDe(key)
      await fs.promises.writeFile(abs, buffer)
      return { key, size: buffer.length }
    },

    // Persiste con una key dada (sin generarla). Usado por la migración.
    async putRaw({ key, buffer }) {
      const abs = rutaDe(key)
      if (!abs) throw new Error(`key inválida: ${key}`)
      await fs.promises.writeFile(abs, buffer)
      return { key, size: buffer.length }
    },

    async getBuffer(key) {
      const abs = rutaDe(key)
      if (!abs || !fs.existsSync(abs)) return null
      return fs.promises.readFile(abs)
    },

    async getStream(key) {
      const abs = rutaDe(key)
      if (!abs || !fs.existsSync(abs)) return null
      const { size } = await fs.promises.stat(abs)
      return {
        stream: fs.createReadStream(abs),
        contentType: contentTypeDesdeKey(key),
        contentLength: size,
      }
    },

    async delete(key) {
      const abs = rutaDe(key)
      if (!abs) return
      try {
        await fs.promises.unlink(abs)
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    },
  }
}
