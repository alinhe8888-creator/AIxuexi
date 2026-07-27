import { randomUUID } from 'node:crypto'
import { Router, raw, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { z } from 'zod'
import { buildKnowledgeFromText, extractRemoteDocumentText, modelStatus, type KnowledgeItemPayload } from './materialAi.js'
import {
  assertOwnedMaterialKey,
  createExtractedFileKey,
  createMaterialSourceKey,
  createMaterialZipKey,
  createReadUrl,
  createUploadUrl,
  deleteObject,
  fetchObjectBuffer,
  getMaterialMaxZipBytes,
  headObject,
  isR2Ready,
  putObjectBuffer,
} from './r2Native.js'
import { contentTypeForPath, extractLocalText, extractZipEntries, isRemoteDocument } from './zipText.js'
import { requireAuth, requireRole, type AuthenticatedRequest } from './auth.js'
import { store, type StoredRecord } from './store.js'
import { fixedTextbookVersions, getBookById, isSupportedSubject, subjectValues } from './curriculum.js'

const router = Router()
const auth = [requireAuth, requireRole('student')] as const
const activeJobs = new Set<string>()
const gradeValues = ['高一', '高二', '高三'] as const
const resourceKindValues = ['textbook', 'workbook', 'exam', 'question-bank', 'notes', 'custom'] as const
const maxMaterialBytes = getMaterialMaxZipBytes()

const asyncRoute = (handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(180).refine((name: string) => name.toLowerCase().endsWith('.zip'), '只支持 ZIP 压缩包'),
  size: z.number().int().positive(),
  contentType: z.string().trim().max(100).optional(),
})

const importMetadataSchema = z.object({
  subject: z.enum(subjectValues).optional(),
  grade: z.enum(gradeValues).optional(),
  textbookVersion: z.string().trim().max(100).optional(),
  bookId: z.string().trim().max(100).optional(),
  bookTitle: z.string().trim().max(220).optional(),
  resourceKind: z.enum(resourceKindValues).default('textbook'),
  sourceName: z.string().trim().max(160).optional(),
})

const importSchema = importMetadataSchema.extend({
  key: z.string().trim().min(10).max(600),
  fileName: z.string().trim().min(1).max(180),
})

const remoteImportSchema = importMetadataSchema.extend({
  url: z.string().url().max(2_000),
  fileName: z.string().trim().min(1).max(180).optional(),
})

const directUploadQuerySchema = z.object({
  fileName: z.string().trim().min(1).max(180).refine((name: string) => name.toLowerCase().endsWith('.zip'), '只支持 ZIP 压缩包'),
  subject: z.string().trim().optional(),
  grade: z.enum(gradeValues).optional(),
  bookId: z.string().trim().max(100).optional(),
  resourceKind: z.enum(resourceKindValues).optional(),
})

const idSchema = z.string().uuid()

type ImportStatus = 'queued' | 'extracting' | 'analyzing' | 'ready' | 'failed'
type ImportPayload = {
  id: string
  key: string
  fileName: string
  subject?: string
  grade?: string
  textbookVersion?: string
  bookId?: string
  bookTitle?: string
  resourceKind: (typeof resourceKindValues)[number]
  sourceName: string
  sourceUrl?: string
  sourceType: 'user_upload' | 'open_resource'
  containerType: 'zip' | 'document'
  contentType: string
  status: ImportStatus
  stage: string
  progress: number
  totalFiles: number
  processedFiles: number
  knowledgeCount: number
  skippedFiles: string[]
  extractedKeys: string[]
  errors: string[]
  createdAt: string
  updatedAt: string
}

const toPayload = <T extends Record<string, unknown>>(record: StoredRecord) => ({
  ...(record.payload as T),
  id: record.id,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
})

async function saveImport(studentId: string, id: string, payload: ImportPayload) {
  payload.updatedAt = new Date().toISOString()
  return store.upsertRecord(studentId, 'material-imports', id, payload)
}

async function listKnowledge(studentId: string) {
  const records = await store.listRecords(studentId, 'knowledge-items')
  return records.map((record) => toPayload<KnowledgeItemPayload>(record))
}

async function deleteKnowledgeForImport(studentId: string, importId: string) {
  const records = await store.listRecords(studentId, 'knowledge-items')
  const targets = records.filter((record) => (record.payload as Partial<KnowledgeItemPayload>)?.materialId === importId)
  await Promise.all(targets.map((record) => store.deleteRecord(studentId, 'knowledge-items', record.id)))
}

function buildJob(input: {
  key: string
  fileName: string
  subject?: (typeof subjectValues)[number]
  grade?: (typeof gradeValues)[number]
  textbookVersion?: string
  bookId?: string
  bookTitle?: string
  resourceKind?: (typeof resourceKindValues)[number]
  sourceName?: string
  sourceUrl?: string
  sourceType?: 'user_upload' | 'open_resource'
  containerType?: 'zip' | 'document'
  contentType?: string
}): ImportPayload {
  const book = input.bookId ? getBookById(input.bookId) : undefined
  const subject = input.subject || book?.subject
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    key: input.key,
    fileName: input.fileName,
    subject,
    grade: input.grade || (book?.grade === '跨年级' ? undefined : book?.grade),
    textbookVersion: input.textbookVersion || (subject ? fixedTextbookVersions[subject] : undefined),
    bookId: input.bookId || book?.id,
    bookTitle: input.bookTitle || book?.title,
    resourceKind: input.resourceKind || 'textbook',
    sourceName: input.sourceName || (input.sourceType === 'open_resource' ? '公开学习资源' : '家庭上传资料'),
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType || 'user_upload',
    containerType: input.containerType || 'zip',
    contentType: input.contentType || 'application/zip',
    status: 'queued',
    stage: '等待处理',
    progress: 0,
    totalFiles: 0,
    processedFiles: 0,
    knowledgeCount: 0,
    skippedFiles: [],
    extractedKeys: [],
    errors: [],
    createdAt: now,
    updatedAt: now,
  }
}

async function processImport(studentId: string, importId: string) {
  const token = `${studentId}:${importId}`
  if (activeJobs.has(token)) return
  activeJobs.add(token)
  try {
    const record = await store.getRecord(studentId, 'material-imports', importId)
    if (!record) return
    const job = toPayload<ImportPayload>(record)
    assertOwnedMaterialKey(studentId, job.key)
    await deleteKnowledgeForImport(studentId, importId)

    job.status = 'extracting'
    job.stage = job.containerType === 'zip' ? '正在读取 ZIP' : '正在读取资料文件'
    job.progress = 3
    await saveImport(studentId, importId, job)

    const sourceBuffer = await fetchObjectBuffer(job.key)
    const entries = job.containerType === 'zip'
      ? extractZipEntries(sourceBuffer)
      : [{ path: job.fileName, buffer: sourceBuffer }]
    const supported = entries.filter((entry) => extractLocalText(entry.path, entry.buffer) !== null || isRemoteDocument(entry.path))
    job.totalFiles = supported.length
    job.skippedFiles = entries.filter((entry) => !supported.includes(entry)).map((entry) => entry.path).slice(0, 100)
    if (!supported.length) throw new Error('资料中没有可处理的 PDF、图片、DOCX、PPTX、XLSX、EPUB、TXT、MD、HTML、CSV 或 JSON 文件')
    await saveImport(studentId, importId, job)

    let knowledgeCount = 0
    for (let index = 0; index < supported.length; index += 1) {
      const entry = supported[index]!
      job.status = 'analyzing'
      job.stage = `正在分析 ${entry.path}`
      job.processedFiles = index
      job.progress = Math.max(5, Math.round((index / supported.length) * 90))
      await saveImport(studentId, importId, job)

      try {
        let text = extractLocalText(entry.path, entry.buffer)
        if (text === null && isRemoteDocument(entry.path)) {
          const shouldReuseSource = job.containerType === 'document' && entry.path === job.fileName
          const extractedKey = shouldReuseSource
            ? job.key
            : createExtractedFileKey(studentId, importId, entry.path.split('/').pop() || 'document')
          const contentType = shouldReuseSource ? job.contentType : contentTypeForPath(entry.path)
          if (!shouldReuseSource) {
            await putObjectBuffer(extractedKey, entry.buffer, contentType)
            job.extractedKeys.push(extractedKey)
          }
          const readUrl = createReadUrl(extractedKey, 1800)
          text = await extractRemoteDocumentText(readUrl, contentType, entry.path)
        }
        if (!text || text.trim().length < 20) {
          job.skippedFiles.push(entry.path)
          continue
        }
        const items = await buildKnowledgeFromText(text, {
          materialId: importId,
          fileName: job.fileName,
          sourcePath: entry.path,
          subjectHint: job.subject,
          gradeHint: job.grade,
          bookId: job.bookId,
          bookTitle: job.bookTitle,
          resourceKind: job.resourceKind,
          sourceName: job.sourceName,
          sourceType: job.sourceType,
        })
        for (const item of items) await store.upsertRecord(studentId, 'knowledge-items', item.id, item)
        knowledgeCount += items.length
      } catch (error) {
        const message = `${entry.path}: ${error instanceof Error ? error.message : '分析失败'}`
        job.errors.push(message.slice(0, 500))
      }
      job.processedFiles = index + 1
      job.knowledgeCount = knowledgeCount
      job.progress = Math.min(95, Math.round(((index + 1) / supported.length) * 90) + 5)
      await saveImport(studentId, importId, job)
    }

    if (!knowledgeCount) throw new Error(job.errors[0] || '资料已读取，但没有生成有效知识条目')
    job.status = 'ready'
    job.stage = '知识库已生成'
    job.progress = 100
    job.knowledgeCount = knowledgeCount
    await saveImport(studentId, importId, job)
  } catch (error) {
    const record = await store.getRecord(studentId, 'material-imports', importId)
    if (record) {
      const job = toPayload<ImportPayload>(record)
      job.status = 'failed'
      job.stage = '导入失败'
      job.errors = [...job.errors, error instanceof Error ? error.message : '导入失败'].slice(-50)
      await saveImport(studentId, importId, job)
    }
  } finally {
    activeJobs.delete(token)
  }
}

function normalizeRemoteUrl(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw Object.assign(new Error('只允许 HTTPS 地址'), { status: 400 })
  const hostname = url.hostname.toLowerCase()
  const allowed = hostname === 'github.com'
    || hostname === 'raw.githubusercontent.com'
    || hostname === 'objects.githubusercontent.com'
    || hostname === 'basic.smartedu.cn'
    || hostname.endsWith('.smartedu.cn')
  if (!allowed) throw Object.assign(new Error('仅允许 GitHub、ChinaTextbook 或国家智慧教育平台的公开资料地址'), { status: 400 })
  if (hostname === 'github.com' && url.pathname.includes('/blob/')) {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 5) {
      const [owner, repo, , branch, ...pathParts] = parts
      return new URL(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathParts.join('/')}`)
    }
  }
  return url
}

function fileNameFromUrl(url: URL) {
  const raw = decodeURIComponent(url.pathname.split('/').pop() || 'remote-material.pdf')
  return raw.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 180) || 'remote-material.pdf'
}

async function downloadRemoteMaterial(url: URL) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'AIxuexi-family-learning/4.0' },
    signal: AbortSignal.timeout(240_000),
  })
  if (!response.ok) throw Object.assign(new Error(`远程资料下载失败（${response.status}）`), { status: 400 })
  const length = Number(response.headers.get('content-length') || 0)
  if (length > maxMaterialBytes) throw Object.assign(new Error(`远程文件不能超过 ${Math.round(maxMaterialBytes / 1024 / 1024)} MB`), { status: 413 })
  const arrayBuffer = await response.arrayBuffer()
  if (!arrayBuffer.byteLength) throw Object.assign(new Error('远程资料内容为空'), { status: 400 })
  if (arrayBuffer.byteLength > maxMaterialBytes) throw Object.assign(new Error(`远程文件不能超过 ${Math.round(maxMaterialBytes / 1024 / 1024)} MB`), { status: 413 })
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
  }
}

router.use('/materials', ...auth)
router.use('/knowledge', ...auth)

router.get('/materials/status', asyncRoute(async (_req, res) => {
  res.json({
    r2Configured: isR2Ready(),
    maxZipMb: Math.round(maxMaterialBytes / 1024 / 1024),
    models: modelStatus(),
    remoteImport: true,
    supported: ['zip', 'pdf', 'docx', 'pptx', 'xlsx', 'epub', 'txt', 'md', 'html', 'csv', 'json', 'png', 'jpg', 'webp'],
  })
}))

router.post('/materials/upload', raw({
  type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
  limit: `${Math.round(maxMaterialBytes / 1024 / 1024)}mb`,
}), asyncRoute(async (req, res) => {
  if (!isR2Ready()) { res.status(503).json({ message: 'Render 中的 R2 环境变量尚未配置完整' }); return }
  const input = directUploadQuerySchema.parse(req.query)
  if (!Buffer.isBuffer(req.body) || req.body.length < 4) { res.status(400).json({ message: 'ZIP 内容为空' }); return }
  if (req.body.length > maxMaterialBytes) { res.status(413).json({ message: `ZIP 不能超过 ${Math.round(maxMaterialBytes / 1024 / 1024)} MB` }); return }
  if (req.body.subarray(0, 2).toString('hex') !== '504b') { res.status(400).json({ message: '文件不是有效 ZIP' }); return }
  const subject = input.subject && isSupportedSubject(input.subject) ? input.subject : undefined
  if (input.subject && !subject) { res.status(400).json({ message: '只允许语文、数学、英语、历史、地理和思想政治' }); return }
  const studentId = req.user!.id
  const key = createMaterialZipKey(studentId, input.fileName)
  await putObjectBuffer(key, req.body, 'application/zip')
  const job = buildJob({ key, fileName: input.fileName, subject, grade: input.grade, bookId: input.bookId, resourceKind: input.resourceKind })
  await store.upsertRecord(studentId, 'material-imports', job.id, job)
  void processImport(studentId, job.id)
  res.status(202).json({ import: job })
}))

router.post('/materials/presign', asyncRoute(async (req, res) => {
  if (!isR2Ready()) { res.status(503).json({ message: 'Render 中的 R2 环境变量尚未配置完整' }); return }
  const input = presignSchema.parse(req.body)
  if (input.size > maxMaterialBytes) { res.status(413).json({ message: `ZIP 不能超过 ${Math.round(maxMaterialBytes / 1024 / 1024)} MB` }); return }
  const key = createMaterialZipKey(req.user!.id, input.fileName)
  res.json({ key, uploadUrl: createUploadUrl(key), headers: { 'Content-Type': input.contentType || 'application/zip' } })
}))

router.post('/materials/imports', asyncRoute(async (req, res) => {
  const input = importSchema.parse(req.body)
  const studentId = req.user!.id
  assertOwnedMaterialKey(studentId, input.key)
  const head = await headObject(input.key)
  if (!head.size || head.size > maxMaterialBytes) { res.status(400).json({ message: 'ZIP 上传不完整或超过大小限制' }); return }
  const job = buildJob({ ...input, containerType: 'zip', contentType: head.contentType || 'application/zip' })
  await store.upsertRecord(studentId, 'material-imports', job.id, job)
  void processImport(studentId, job.id)
  res.status(202).json({ import: job })
}))

router.post('/materials/remote-imports', asyncRoute(async (req, res) => {
  if (!isR2Ready()) { res.status(503).json({ message: 'Render 中的 R2 环境变量尚未配置完整' }); return }
  const input = remoteImportSchema.parse(req.body)
  const url = normalizeRemoteUrl(input.url)
  const downloaded = await downloadRemoteMaterial(url)
  const fileName = input.fileName || fileNameFromUrl(url)
  const extension = fileName.toLowerCase().split('.').pop() || ''
  const isZip = extension === 'zip' || downloaded.buffer.subarray(0, 2).toString('hex') === '504b'
  if (!isZip && extractLocalText(fileName, downloaded.buffer) === null && !isRemoteDocument(fileName)) {
    res.status(400).json({ message: '远程地址必须指向 ZIP、PDF、Office 文档、文本或图片文件，不能是网页目录' })
    return
  }
  const key = isZip ? createMaterialZipKey(req.user!.id, fileName) : createMaterialSourceKey(req.user!.id, fileName)
  const contentType = isZip ? 'application/zip' : (downloaded.contentType || contentTypeForPath(fileName))
  await putObjectBuffer(key, downloaded.buffer, contentType)
  const job = buildJob({
    ...input,
    key,
    fileName,
    sourceUrl: url.toString(),
    sourceType: 'open_resource',
    sourceName: input.sourceName || (url.hostname.includes('github') ? 'ChinaTextbook / GitHub' : '国家中小学智慧教育平台'),
    containerType: isZip ? 'zip' : 'document',
    contentType,
  })
  await store.upsertRecord(req.user!.id, 'material-imports', job.id, job)
  void processImport(req.user!.id, job.id)
  res.status(202).json({ import: job })
}))

router.get('/materials/imports', asyncRoute(async (req, res) => {
  const records = await store.listRecords(req.user!.id, 'material-imports')
  const imports = records.map((record) => toPayload<ImportPayload>(record))
  for (const job of imports) {
    if (job.status === 'queued' || job.status === 'extracting' || job.status === 'analyzing') void processImport(req.user!.id, job.id)
  }
  res.json({ imports })
}))

router.get('/materials/imports/:id', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  res.json({ import: toPayload<ImportPayload>(record) })
}))

router.post('/materials/imports/:id/retry', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  const job = toPayload<ImportPayload>(record)
  job.status = 'queued'
  job.stage = '等待重新处理'
  job.progress = 0
  job.processedFiles = 0
  job.knowledgeCount = 0
  job.errors = []
  await saveImport(req.user!.id, id, job)
  void processImport(req.user!.id, id)
  res.status(202).json({ import: job })
}))

router.delete('/materials/imports/:id', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  const job = toPayload<ImportPayload>(record)
  await deleteKnowledgeForImport(req.user!.id, id)
  try { await deleteObject(job.key) } catch (error) { console.warn('Delete material source from R2 failed.', error) }
  await Promise.all((job.extractedKeys || []).map(async (key) => { try { await deleteObject(key) } catch { /* continue cleanup */ } }))
  await store.deleteRecord(req.user!.id, 'material-imports', id)
  res.json({ ok: true })
}))

router.delete('/materials', asyncRoute(async (req, res) => {
  const studentId = req.user!.id
  const imports = await store.listRecords(studentId, 'material-imports')
  const knowledge = await store.listRecords(studentId, 'knowledge-items')
  await Promise.all([
    ...imports.map((record) => store.deleteRecord(studentId, 'material-imports', record.id)),
    ...knowledge.map((record) => store.deleteRecord(studentId, 'knowledge-items', record.id)),
  ])
  await Promise.all(imports.map(async (record) => {
    const payload = record.payload as Partial<ImportPayload>
    if (payload.key) try { await deleteObject(payload.key) } catch { /* cleanup should not block reset */ }
    await Promise.all((payload.extractedKeys || []).map(async (childKey) => { try { await deleteObject(childKey) } catch { /* continue */ } }))
  }))
  res.json({ ok: true, removedImports: imports.length, removedKnowledge: knowledge.length })
}))

router.get('/knowledge', asyncRoute(async (req, res) => {
  const subject = typeof req.query.subject === 'string' ? req.query.subject : ''
  const grade = typeof req.query.grade === 'string' ? req.query.grade : ''
  const chapter = typeof req.query.chapter === 'string' ? req.query.chapter.trim().toLowerCase() : ''
  const bookId = typeof req.query.bookId === 'string' ? req.query.bookId : ''
  const resourceKind = typeof req.query.resourceKind === 'string' ? req.query.resourceKind : ''
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim().toLowerCase() : ''
  const items = (await listKnowledge(req.user!.id)).filter((item) => {
    if (subject && item.subject !== subject) return false
    if (grade && item.grade !== grade) return false
    if (bookId && item.bookId !== bookId) return false
    if (resourceKind && item.resourceKind !== resourceKind) return false
    if (chapter && !item.chapter.toLowerCase().includes(chapter)) return false
    if (keyword && !`${item.title}${item.bookTitle || ''}${item.chapter}${item.knowledgePoint}${item.content}${item.tags.join('')}`.toLowerCase().includes(keyword)) return false
    return true
  })
  res.json(items)
}))

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (typeof error === 'object' && error && 'issues' in error && 'flatten' in error && typeof (error as { flatten?: unknown }).flatten === 'function') {
    res.status(400).json({ message: '资料请求参数无效', issues: (error as { flatten: () => unknown }).flatten() })
    return
  }
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 0
  if (status >= 400 && status < 600) {
    res.status(status).json({ message: error instanceof Error ? error.message : '资料请求失败' })
    return
  }
  next(error)
})

export const materialKnowledgeRouter: RequestHandler = router
