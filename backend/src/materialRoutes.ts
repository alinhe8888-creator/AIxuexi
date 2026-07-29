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
import { fixedTextbookVersions, getBookById, isSupportedSubject, matchAnyBook, subjectValues } from './curriculum.js'

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
const bindingSchema = z.object({ bookId: z.string().trim().min(1).max(100) })


function requestError(message: string, status = 400) {
  return Object.assign(new Error(message), { status, expose: true })
}

function selectedBookForMetadata(input: { bookId?: string; subject?: string; grade?: string }) {
  if (!input.bookId) return undefined
  const book = getBookById(input.bookId)
  if (!book) throw requestError('书册不存在')
  if (input.subject && input.subject !== book.subject) throw requestError('科目与所选书册不一致')
  if (input.grade && book.grade !== '跨年级' && input.grade !== book.grade) throw requestError('年级与所选书册不一致')
  return book
}

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

async function knowledgeRecordsForImport(studentId: string, importId: string) {
  const records = await store.listRecords(studentId, 'knowledge-items')
  return records.filter((record) => (record.payload as Partial<KnowledgeItemPayload>)?.materialId === importId)
}

async function deleteKnowledgeForImport(studentId: string, importId: string) {
  const targets = await knowledgeRecordsForImport(studentId, importId)
  await Promise.all(targets.map((record) => store.deleteRecord(studentId, 'knowledge-items', record.id)))
}

function normalizeImportPayload(job: ImportPayload) {
  job.totalFiles = Math.max(0, Number(job.totalFiles || 0))
  job.processedFiles = Math.max(0, Number(job.processedFiles || 0))
  job.knowledgeCount = Math.max(0, Number(job.knowledgeCount || 0))
  job.progress = Math.max(0, Math.min(100, Number(job.progress || 0)))
  job.skippedFiles = Array.isArray(job.skippedFiles) ? job.skippedFiles : []
  job.extractedKeys = Array.isArray(job.extractedKeys) ? job.extractedKeys : []
  job.errors = Array.isArray(job.errors) ? job.errors : []
  const configuredBook = job.bookId ? getBookById(job.bookId) : undefined
  if (job.bookId && !configuredBook) {
    job.bookId = undefined
    job.bookTitle = undefined
  }
  const inferredBook = configuredBook || matchAnyBook(`${job.fileName} ${job.bookTitle || ''}`)
  if (inferredBook) {
    job.bookId = inferredBook.id
    job.bookTitle = inferredBook.title
    job.subject = inferredBook.subject
    if (inferredBook.grade !== '跨年级') job.grade = inferredBook.grade
    job.textbookVersion = fixedTextbookVersions[inferredBook.subject]
  }
  return job
}

async function reconcileImport(studentId: string, job: ImportPayload) {
  const before = JSON.stringify(job)
  normalizeImportPayload(job)
  const actualKnowledgeCount = (await knowledgeRecordsForImport(studentId, job.id)).length
  if (job.status === 'ready') {
    job.knowledgeCount = actualKnowledgeCount
    job.progress = 100
    if (job.totalFiles > 0) job.processedFiles = job.totalFiles
    if (!actualKnowledgeCount) {
      job.status = 'failed'
      job.stage = '未找到已生成的知识条目，请重新解析'
      job.progress = 0
    }
  } else if (actualKnowledgeCount > 0 && job.knowledgeCount !== actualKnowledgeCount) {
    job.knowledgeCount = actualKnowledgeCount
  }
  if (JSON.stringify(job) !== before) await saveImport(studentId, job.id, job)
  return job
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
  const selectedBook = selectedBookForMetadata(input)
  const inferredCandidate = selectedBook || matchAnyBook(`${input.fileName} ${input.bookTitle || ''}`)
  const inferredBook = inferredCandidate
    && (!input.subject || inferredCandidate.subject === input.subject)
    && (!input.grade || inferredCandidate.grade === '跨年级' || inferredCandidate.grade === input.grade)
    ? inferredCandidate
    : undefined
  const subject = selectedBook?.subject || input.subject || inferredBook?.subject
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    key: input.key,
    fileName: input.fileName,
    subject,
    grade: selectedBook?.grade === '跨年级'
      ? input.grade
      : selectedBook?.grade || input.grade || (inferredBook?.grade === '跨年级' ? undefined : inferredBook?.grade),
    textbookVersion: inferredBook ? fixedTextbookVersions[inferredBook.subject] : input.textbookVersion || (subject ? fixedTextbookVersions[subject] : undefined),
    bookId: inferredBook?.id,
    bookTitle: inferredBook?.title || input.bookTitle,
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
    const job = normalizeImportPayload(toPayload<ImportPayload>(record))
    assertOwnedMaterialKey(studentId, job.key)
    const preservedKnowledgeRecords = await knowledgeRecordsForImport(studentId, importId)
    const preservedKnowledgeCount = preservedKnowledgeRecords.length
    const stagedItems: KnowledgeItemPayload[] = []

    job.status = 'extracting'
    job.stage = job.containerType === 'zip' ? '正在读取 ZIP' : '正在读取资料文件'
    job.progress = 3
    job.processedFiles = 0
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
            if (!job.extractedKeys.includes(extractedKey)) job.extractedKeys.push(extractedKey)
          }
          const readUrl = createReadUrl(extractedKey, 1800)
          text = await extractRemoteDocumentText(readUrl, contentType, entry.path)
        }
        if (!text || text.trim().length < 20) {
          if (!job.skippedFiles.includes(entry.path)) job.skippedFiles.push(entry.path)
        } else {
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
          stagedItems.push(...items)
        }
      } catch (error) {
        const message = `${entry.path}: ${error instanceof Error ? error.message : '分析失败'}`
        job.errors.push(message.slice(0, 500))
      }
      job.processedFiles = index + 1
      job.knowledgeCount = stagedItems.length || preservedKnowledgeCount
      job.progress = Math.min(95, Math.round(((index + 1) / supported.length) * 90) + 5)
      await saveImport(studentId, importId, job)
    }

    if (!stagedItems.length) throw new Error(job.errors[0] || '资料已读取，但没有生成有效知识条目')

    if (!job.bookId) {
      const bookIds = [...new Set(stagedItems.map((item) => item.bookId).filter((value): value is string => Boolean(value)))]
      if (bookIds.length === 1) {
        const book = getBookById(bookIds[0]!)
        if (book) {
          job.bookId = book.id
          job.bookTitle = book.title
          job.subject = book.subject
          if (book.grade !== '跨年级') job.grade = book.grade
          job.textbookVersion = fixedTextbookVersions[book.subject]
        }
      }
    }
    if (!job.subject) {
      const subjects = [...new Set(stagedItems.map((item) => item.subject))]
      if (subjects.length === 1) job.subject = subjects[0]
    }

    const insertedIds: string[] = []
    try {
      for (const item of stagedItems) {
        await store.upsertRecord(studentId, 'knowledge-items', item.id, item)
        insertedIds.push(item.id)
      }
    } catch (error) {
      await Promise.all(insertedIds.map(async (id) => {
        try { await store.deleteRecord(studentId, 'knowledge-items', id) } catch { /* keep original error */ }
      }))
      throw error
    }

    for (const oldRecord of preservedKnowledgeRecords) {
      try { await store.deleteRecord(studentId, 'knowledge-items', oldRecord.id) }
      catch (error) { job.errors.push(`旧知识清理失败：${error instanceof Error ? error.message : '未知错误'}`.slice(0, 500)) }
    }

    job.status = 'ready'
    job.stage = job.bookId ? '知识库已生成并匹配书册' : '知识库已生成，待手动绑定书册'
    job.progress = 100
    job.processedFiles = job.totalFiles
    job.knowledgeCount = stagedItems.length
    await saveImport(studentId, importId, job)
  } catch (error) {
    const record = await store.getRecord(studentId, 'material-imports', importId)
    if (record) {
      const job = normalizeImportPayload(toPayload<ImportPayload>(record))
      const preservedKnowledgeCount = (await knowledgeRecordsForImport(studentId, importId)).length
      job.status = 'failed'
      job.stage = preservedKnowledgeCount ? '重新解析失败，已保留原知识库' : '导入失败'
      job.knowledgeCount = preservedKnowledgeCount
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

async function fetchAllowedRemote(url: URL, redirectCount = 0): Promise<globalThis.Response> {
  if (redirectCount > 5) throw Object.assign(new Error('远程资料重定向次数过多'), { status: 400 })
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': 'AIxuexi-family-learning/6.0' },
    signal: AbortSignal.timeout(240_000),
  })
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location')
    if (!location) throw Object.assign(new Error('远程资料重定向地址无效'), { status: 400 })
    const nextUrl = normalizeRemoteUrl(new URL(location, url).toString())
    return fetchAllowedRemote(nextUrl, redirectCount + 1)
  }
  return response
}

async function downloadRemoteMaterial(url: URL) {
  const response = await fetchAllowedRemote(url)
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
  const imports: ImportPayload[] = []
  for (const record of records) {
    const job = await reconcileImport(req.user!.id, toPayload<ImportPayload>(record))
    imports.push(job)
    if (job.status === 'queued' || job.status === 'extracting' || job.status === 'analyzing') void processImport(req.user!.id, job.id)
  }
  res.json({ imports })
}))

router.get('/materials/imports/:id', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  res.json({ import: await reconcileImport(req.user!.id, toPayload<ImportPayload>(record)) })
}))

router.patch('/materials/imports/:id/binding', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const input = bindingSchema.parse(req.body)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  const job = normalizeImportPayload(toPayload<ImportPayload>(record))
  const token = `${req.user!.id}:${id}`
  if (activeJobs.has(token) || job.status === 'queued' || job.status === 'extracting' || job.status === 'analyzing') {
    res.status(409).json({ message: '资料正在处理中，完成后再绑定书册' })
    return
  }
  const book = getBookById(input.bookId)
  if (!book) { res.status(400).json({ message: '书册不存在' }); return }

  job.bookId = book.id
  job.bookTitle = book.title
  job.subject = book.subject
  if (book.grade !== '跨年级') job.grade = book.grade
  job.textbookVersion = fixedTextbookVersions[book.subject]
  job.stage = job.status === 'ready' ? '知识库已绑定书册' : '已绑定书册，等待重新解析'
  await saveImport(req.user!.id, id, job)

  const knowledgeRecords = await knowledgeRecordsForImport(req.user!.id, id)
  for (const knowledgeRecord of knowledgeRecords) {
    const payload = knowledgeRecord.payload as KnowledgeItemPayload
    await store.upsertRecord(req.user!.id, 'knowledge-items', knowledgeRecord.id, {
      ...payload,
      subject: book.subject,
      grade: book.grade === '跨年级' ? payload.grade : book.grade,
      bookId: book.id,
      bookTitle: book.title,
    })
  }
  res.json({ import: job, updatedKnowledge: knowledgeRecords.length })
}))

router.post('/materials/imports/:id/retry', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  const job = normalizeImportPayload(toPayload<ImportPayload>(record))
  const token = `${req.user!.id}:${id}`
  if (activeJobs.has(token) || job.status === 'queued' || job.status === 'extracting' || job.status === 'analyzing') {
    res.status(409).json({ message: '资料已经在处理中，请勿重复提交' })
    return
  }
  job.status = 'queued'
  job.stage = '等待重新解析'
  job.progress = 0
  job.processedFiles = 0
  job.errors = []
  await saveImport(req.user!.id, id, job)
  void processImport(req.user!.id, id)
  res.status(202).json({ import: job })
}))

router.delete('/materials/imports/:id', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const record = await store.getRecord(req.user!.id, 'material-imports', id)
  if (!record) { res.status(404).json({ message: '导入任务不存在' }); return }
  const job = normalizeImportPayload(toPayload<ImportPayload>(record))
  if (activeJobs.has(`${req.user!.id}:${id}`) || job.status === 'queued' || job.status === 'extracting' || job.status === 'analyzing') {
    res.status(409).json({ message: '资料正在处理中，不能删除' })
    return
  }
  await deleteKnowledgeForImport(req.user!.id, id)
  try { await deleteObject(job.key) } catch (error) { console.warn('Delete material source from R2 failed.', error) }
  await Promise.all((job.extractedKeys || []).map(async (key) => { try { await deleteObject(key) } catch { /* continue cleanup */ } }))
  await store.deleteRecord(req.user!.id, 'material-imports', id)
  res.json({ ok: true })
}))

router.delete('/materials', (_req, res) => {
  res.status(405).json({ message: '正式版已关闭一键清空教材；请逐个确认删除，避免误删 R2 原文件' })
})

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
