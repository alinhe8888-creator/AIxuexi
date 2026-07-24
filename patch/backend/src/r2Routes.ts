import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express'
import { z } from 'zod'

type AuthenticatedRequest = Request & {
  user?: { id: string; role: 'student' | 'parent' }
}

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const maxUploadBytes = Math.max(1, Number(env('R2_MAX_UPLOAD_MB', '20'))) * 1024 * 1024
const presignSeconds = Math.min(3600, Math.max(60, Number(env('R2_PRESIGN_SECONDS', '600'))))
const bucket = env('R2_BUCKET_NAME')

const allowedContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

const purposeSchema = z.enum(['question', 'paper', 'material', 'avatar', 'report'])
const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(3).max(100),
  size: z.number().int().positive(),
  purpose: purposeSchema.default('question'),
})
const keySchema = z.object({ key: z.string().trim().min(8).max(500) })

let client: S3Client | null = null

export const isR2Configured = () => Boolean(
  env('R2_ACCOUNT_ID')
  && env('R2_ACCESS_KEY_ID')
  && env('R2_SECRET_ACCESS_KEY')
  && bucket,
)

const getClient = () => {
  if (!isR2Configured()) throw new Error('R2 尚未配置，请先在 Render 添加 R2 环境变量')
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env('R2_ACCESS_KEY_ID'),
        secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return client
}

const getUserId = (req: AuthenticatedRequest) => {
  const userId = req.user?.id
  if (!userId) throw new Error('登录状态无效')
  return userId
}

const assertOwnedKey = (userId: string, key: string) => {
  const prefix = `users/${userId}/`
  if (!key.startsWith(prefix) || key.includes('..')) {
    const error = new Error('无权访问该文件') as Error & { status?: number }
    error.status = 403
    throw error
  }
}

const safeStem = (fileName: string) => {
  const stem = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return stem.slice(0, 48) || 'upload'
}

const asyncRoute = (handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

export function mountR2Routes(app: Express, auth: RequestHandler) {
  app.get('/api/storage/status', auth, (_req, res) => {
    res.json({ configured: isR2Configured(), maxUploadMb: maxUploadBytes / 1024 / 1024 })
  })

  app.post('/api/storage/presign', auth, asyncRoute(async (req, res) => {
    if (!isR2Configured()) {
      res.status(503).json({ error: 'R2_NOT_CONFIGURED', message: 'R2 尚未配置' })
      return
    }

    const input = presignSchema.parse(req.body)
    if (!allowedContentTypes.has(input.contentType)) {
      res.status(415).json({ error: 'UNSUPPORTED_FILE_TYPE', message: '仅支持 JPG、PNG、WEBP、HEIC 和 PDF' })
      return
    }
    if (input.size > maxUploadBytes) {
      res.status(413).json({ error: 'FILE_TOO_LARGE', message: `单个文件不能超过 ${maxUploadBytes / 1024 / 1024} MB` })
      return
    }

    const userId = getUserId(req)
    const now = new Date()
    const datePath = now.toISOString().slice(0, 10)
    const extension = extensionByType[input.contentType] || 'bin'
    const key = `users/${userId}/${input.purpose}/${datePath}/${Date.now()}-${randomUUID()}-${safeStem(input.fileName)}.${extension}`
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
    })
    const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: presignSeconds })

    res.json({
      key,
      uploadUrl,
      expiresIn: presignSeconds,
      headers: { 'Content-Type': input.contentType },
    })
  }))

  app.post('/api/storage/complete', auth, asyncRoute(async (req, res) => {
    const { key } = keySchema.parse(req.body)
    const userId = getUserId(req)
    assertOwnedKey(userId, key)

    const result = await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    if (!result.ContentLength || result.ContentLength > maxUploadBytes) {
      await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      res.status(400).json({ error: 'INVALID_UPLOAD', message: '文件上传不完整或大小异常' })
      return
    }

    res.json({
      ok: true,
      key,
      size: result.ContentLength,
      contentType: result.ContentType || 'application/octet-stream',
      etag: result.ETag?.replaceAll('"', '') || '',
    })
  }))

  app.get('/api/storage/url', auth, asyncRoute(async (req, res) => {
    const { key } = keySchema.parse({ key: req.query.key })
    const userId = getUserId(req)
    assertOwnedKey(userId, key)

    const url = await getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: presignSeconds },
    )
    res.json({ url, expiresIn: presignSeconds })
  }))

  app.delete('/api/storage/object', auth, asyncRoute(async (req, res) => {
    const { key } = keySchema.parse(req.body)
    const userId = getUserId(req)
    assertOwnedKey(userId, key)
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    res.json({ ok: true })
  }))
}
