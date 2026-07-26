import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { z } from 'zod'
import { buildKnowledgeFromText, extractRemoteDocumentText, modelStatus, type KnowledgeItemPayload } from './materialAi.js'
import {
  assertOwnedMaterialKey,
  createExtractedFileKey,
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

const router = Router()
const auth = [requireAuth, requireRole('student')] as const
const activeJobs = new Set<string>()
const initializedStudents = new Set<string>()
const subjectValues = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'] as const
const gradeValues = ['高一', '高二', '高三'] as const

const asyncRoute = (handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(180).refine((name: string) => name.toLowerCase().endsWith('.zip'), '只支持 ZIP 压缩包'),
  size: z.number().int().positive(),
  contentType: z.string().trim().max(100).optional(),
})

const importSchema = z.object({
  key: z.string().trim().min(10).max(600),
  fileName: z.string().trim().min(1).max(180),
  subject: z.enum(subjectValues).optional(),
  grade: z.enum(gradeValues).optional(),
  textbookVersion: z.string().trim().max(80).optional(),
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

async function ensureInitialKnowledgeReset(studentId: string) {
  if (initializedStudents.has(studentId)) return
  const flagId = 'zip-knowledge-v1-initialized'
  const flag = await store.getRecord(studentId, 'system-flags', flagId)
  if (!flag) {
    const imports = await store.listRecords(studentId, 'material-imports')
    const knowledge = await store.listRecords(studentId, 'knowledge-items')
    await Promise.all([
      ...imports.map((record) => store.deleteRecord(studentId, 'material-imports', record.id)),
      ...knowledge.map((record) => store.deleteRecord(studentId, 'knowledge-items', record.id)),
    ])
    await Promise.all(imports.map(async (record) => {
      const payload = record.payload as Partial<ImportPayload>
      if (payload.key) try { await deleteObject(payload.key) } catch { /* legacy cleanup should continue */ }
      const childKeys = Array.isArray(payload.extractedKeys) ? payload.extractedKeys : []
      await Promise.all(childKeys.map(async (key) => { try { await deleteObject(key) } catch { /* continue */ } }))
    }))
    await store.upsertRecord(studentId, 'system-flags', flagId, { initializedAt: new Date().toISOString(), clearedImports: imports.length, clearedKnowledge: knowledge.length })
  }
  initializedStudents.add(studentId)
}

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
    job.stage = '正在读取 ZIP'
    job.progress = 3
    await saveImport(studentId, importId, job)

    const zipBuffer = await fetchObjectBuffer(job.key)
    const entries = extractZipEntries(zipBuffer)
    const supported = entries.filter((entry) => extractLocalText(entry.path, entry.buffer) !== null || isRemoteDocument(entry.path))
    job.totalFiles = supported.length
    job.skippedFiles = entries.filter((entry) => !supported.includes(entry)).map((entry) => entry.path).slice(0, 100)
    if (!supported.length) throw new Error('ZIP 中没有可处理的 PDF、图片、DOCX、PPTX、XLSX、EPUB、TXT、MD、HTML、CSV 或 JSON 文件')
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
          const extractedKey = createExtractedFileKey(studentId, importId, entry.path.split('/').pop() || 'document')
          const contentType = contentTypeForPath(entry.path)
          await putObjectBuffer(extractedKey, entry.buffer, contentType)
          job.extractedKeys.push(extractedKey)
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

    if (!knowledgeCount) throw new Error(job.errors[0] || '资料已解压，但没有生成有效知识条目')
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

router.use(...auth)

router.get('/materials/status', asyncRoute(async (req, res) => {
  await ensureInitialKnowledgeReset(req.user!.id)
  res.json({
    r2Configured: isR2Ready(),
    maxZipMb: Math.round(getMaterialMaxZipBytes() / 1024 / 1024),
    models: modelStatus(),
    supported: ['zip', 'pdf', 'docx', 'pptx', 'xlsx', 'epub', 'txt', 'md', 'html', 'csv', 'json', 'png', 'jpg', 'webp'],
  })
}))

router.post('/materials/presign', asyncRoute(async (req, res) => {
  if (!isR2Ready()) { res.status(503).json({ message: 'Render 中的 R2 环境变量尚未配置完整' }); return }
  const input = presignSchema.parse(req.body)
  if (input.size > getMaterialMaxZipBytes()) { res.status(413).json({ message: `ZIP 不能超过 ${Math.round(getMaterialMaxZipBytes() / 1024 / 1024)} MB` }); return }
  const userId = req.user!.id
  const key = createMaterialZipKey(userId, input.fileName)
  res.json({ key, uploadUrl: createUploadUrl(key), headers: { 'Content-Type': input.contentType || 'application/zip' } })
}))

router.post('/materials/imports', asyncRoute(async (req, res) => {
  const input = importSchema.parse(req.body)
  const studentId = req.user!.id
  assertOwnedMaterialKey(studentId, input.key)
  const head = await headObject(input.key)
  if (!head.size || head.size > getMaterialMaxZipBytes()) { res.status(400).json({ message: 'ZIP 上传不完整或超过大小限制' }); return }
  const id = randomUUID()
  const now = new Date().toISOString()
  const job: ImportPayload = {
    id,
    key: input.key,
    fileName: input.fileName,
    subject: input.subject,
    grade: input.grade,
    textbookVersion: input.textbookVersion,
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
  await store.upsertRecord(studentId, 'material-imports', id, job)
  void processImport(studentId, id)
  res.status(202).json({ import: job })
}))

router.get('/materials/imports', asyncRoute(async (req, res) => {
  await ensureInitialKnowledgeReset(req.user!.id)
  const records = await store.listRecords(req.user!.id, 'material-imports')
  res.json({ imports: records.map((record) => toPayload<ImportPayload>(record)) })
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
  try { await deleteObject(job.key) } catch (error) { console.warn('Delete source ZIP from R2 failed.', error) }
  await Promise.all(job.extractedKeys.map(async (key) => { try { await deleteObject(key) } catch { /* continue cleanup */ } }))
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
    const key = String((record.payload as Partial<ImportPayload>)?.key || '')
    if (key) try { await deleteObject(key) } catch { /* R2 cleanup should not block database reset. */ }
    const extractedKeys = Array.isArray((record.payload as Partial<ImportPayload>)?.extractedKeys) ? (record.payload as Partial<ImportPayload>).extractedKeys! : []
    await Promise.all(extractedKeys.map(async (childKey) => { try { await deleteObject(childKey) } catch { /* continue cleanup */ } }))
  }))
  res.json({ ok: true, removedImports: imports.length, removedKnowledge: knowledge.length })
}))

router.get('/knowledge', asyncRoute(async (req, res) => {
  await ensureInitialKnowledgeReset(req.user!.id)
  const subject = typeof req.query.subject === 'string' ? req.query.subject : ''
  const grade = typeof req.query.grade === 'string' ? req.query.grade : ''
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim().toLowerCase() : ''
  const items = (await listKnowledge(req.user!.id)).filter((item) => {
    if (subject && item.subject !== subject) return false
    if (grade && item.grade !== grade) return false
    if (keyword && !`${item.title}${item.chapter}${item.knowledgePoint}${item.content}${item.tags.join('')}`.toLowerCase().includes(keyword)) return false
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
