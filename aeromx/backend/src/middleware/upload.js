import multer from 'multer'

// Guardamos el archivo en memoria (buffer) y dejamos que la capa de
// almacenamiento (local/MinIO/S3) decida dónde persistirlo. El límite de
// 10 MB mantiene el uso de memoria acotado.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true)
    cb(new Error('Solo se permiten archivos de imagen'))
  },
})
