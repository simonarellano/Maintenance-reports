// Driver S3 — sirve tanto para MinIO (self-hosted) como para AWS S3.
// MinIO es S3-compatible: mismo SDK, solo cambia endpoint + forcePathStyle.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3'
import { generarKey } from './helpers.js'

// Construye cliente + bucket según el proveedor ('minio' | 's3').
function configurar(provider) {
  if (provider === 'minio') {
    const endpoint = `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}`
    return {
      bucket: process.env.MINIO_BUCKET || 'aeromx-fotos',
      client: new S3Client({
        region: process.env.AWS_REGION || 'us-east-1', // MinIO ignora la región pero el SDK la exige
        endpoint,
        forcePathStyle: true, // MinIO requiere path-style (bucket en la ruta, no en el host)
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        },
      }),
    }
  }
  // AWS S3
  return {
    bucket: process.env.S3_BUCKET || 'aeromx-fotos',
    client: new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined, // deja que el SDK use la cadena de credenciales por defecto (rol IAM, etc.)
    }),
  }
}

export function createS3Driver(provider) {
  const { client, bucket } = configurar(provider)

  return {
    nombre: provider,

    async ensureReady() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }))
      } catch (e) {
        const status = e?.$metadata?.httpStatusCode
        if (status === 404 || e?.name === 'NotFound' || e?.name === 'NoSuchBucket') {
          await client.send(new CreateBucketCommand({ Bucket: bucket }))
          console.log(`[storage:${provider}] bucket "${bucket}" creado`)
        } else {
          throw e
        }
      }
      console.log(`[storage:${provider}] listo — bucket "${bucket}"`)
    },

    async put({ buffer, contentType, originalName }) {
      const key = generarKey(originalName)
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream',
        }),
      )
      return { key, size: buffer.length }
    },

    // Persiste con una key dada (sin generarla). Usado por la migración.
    async putRaw({ key, buffer, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream',
        }),
      )
      return { key, size: buffer.length }
    },

    async getBuffer(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        const bytes = await out.Body.transformToByteArray()
        return Buffer.from(bytes)
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },

    async getStream(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        return {
          stream: out.Body, // Readable stream (Node.js)
          contentType: out.ContentType || 'application/octet-stream',
          contentLength: out.ContentLength,
        }
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}
