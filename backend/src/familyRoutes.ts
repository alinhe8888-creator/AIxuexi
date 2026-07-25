import { randomInt, randomUUID } from 'node:crypto'
import type { Express, Response } from 'express'
import { requireAuth, requireRole, type AuthenticatedRequest } from './auth.js'
import { config } from './config.js'
import { query } from './db.js'
import { createR2SignedUrl, isR2Configured } from './r2.js'
import { store } from './store.js'

type JsonObject = Record<string, unknown>
interface MaterialAnalysis { summary: string; topics: string[]; keyPoints: string[]; questions: string[]; suggestions: string[] }
interface MaterialRecord {
  id: string; studentId: string; objectKey: string; fileName: string; title: string; subject: string; mimeType: string; sizeBytes: number; textContent: string; analysis: MaterialAnalysis | null; analysisStatus: 'pending' | 'running' | 'done' | 'failed'; createdAt: string; updatedAt: string
}
const memoryMaterials = new Map<string, MaterialRecord>()
let tablePromise: Promise<unknown> | null = null
const studentOnly = [requireAuth, requireRole('student')] as const
const parentOnly = [requireAuth, requireRole('parent')] as const
const asObject = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
const asArray = (value: unknown) => Array.isArray(value) ? value : []
const asNumber = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const safeName = (value: string) => value.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'file'
const publicMaterial = (item: MaterialRecord) => ({ id: item.id, title: item.title, subject: item.subject, fileName: item.fileName, mimeType: item.mimeType, sizeBytes: item.sizeBytes, analysis: item.analysis, analysisStatus: item.analysisStatus, createdAt: item.createdAt, updatedAt: item.updatedAt })

async function ensureTable() {
  if (config.useMemoryDb) return
  if (!tablePromise) tablePromise = (async () => {
    await query(`CREATE TABLE IF NOT EXISTS learning_materials(
      id UUID PRIMARY KEY, student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      object_key TEXT NOT NULL, file_name TEXT NOT NULL, title TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '其他',
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream', size_bytes BIGINT NOT NULL DEFAULT 0,
      text_content TEXT NOT NULL DEFAULT '', analysis JSONB, analysis_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await query('CREATE INDEX IF NOT EXISTS idx_learning_materials_student_updated ON learning_materials(student_user_id, updated_at DESC)')
  })()
  await tablePromise
}
function mapRow(row: JsonObject): MaterialRecord {
  return { id: asString(row.id), studentId: asString(row.student_user_id), objectKey: asString(row.object_key), fileName: asString(row.file_name), title: asString(row.title), subject: asString(row.subject, '其他'), mimeType: asString(row.mime_type, 'application/octet-stream'), sizeBytes: asNumber(row.size_bytes), textContent: asString(row.text_content), analysis: row.analysis ? asObject(row.analysis) as unknown as MaterialAnalysis : null, analysisStatus: asString(row.analysis_status, 'pending') as MaterialRecord['analysisStatus'], createdAt: new Date(asString(row.created_at)).toISOString(), updatedAt: new Date(asString(row.updated_at)).toISOString() }
}
async function listMaterials(studentId: string) {
  await ensureTable()
  if (config.useMemoryDb) return [...memoryMaterials.values()].filter((item) => item.studentId === studentId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const result = await query<JsonObject>('SELECT * FROM learning_materials WHERE student_user_id=$1 ORDER BY updated_at DESC', [studentId])
  return result.rows.map(mapRow)
}
async function getMaterial(studentId: string, id: string) {
  await ensureTable()
  if (config.useMemoryDb) { const item = memoryMaterials.get(id); return item?.studentId === studentId ? item : null }
  const result = await query<JsonObject>('SELECT * FROM learning_materials WHERE student_user_id=$1 AND id=$2', [studentId, id])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}
async function saveMaterial(item: MaterialRecord) {
  await ensureTable()
  if (config.useMemoryDb) { memoryMaterials.set(item.id, item); return item }
  const result = await query<JsonObject>(`INSERT INTO learning_materials(id,student_user_id,object_key,file_name,title,subject,mime_type,size_bytes,text_content,analysis,analysis_status,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)
    ON CONFLICT(id) DO UPDATE SET object_key=EXCLUDED.object_key,file_name=EXCLUDED.file_name,title=EXCLUDED.title,subject=EXCLUDED.subject,mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,text_content=EXCLUDED.text_content,analysis=EXCLUDED.analysis,analysis_status=EXCLUDED.analysis_status,updated_at=EXCLUDED.updated_at RETURNING *`,
    [item.id,item.studentId,item.objectKey,item.fileName,item.title,item.subject,item.mimeType,item.sizeBytes,item.textContent,item.analysis ? JSON.stringify(item.analysis) : null,item.analysisStatus,item.createdAt,item.updatedAt])
  return mapRow(result.rows[0])
}
async function deleteMaterial(studentId: string, id: string) {
  const item = await getMaterial(studentId, id)
  if (!item) return null
  if (config.useMemoryDb) memoryMaterials.delete(id)
  else await query('DELETE FROM learning_materials WHERE student_user_id=$1 AND id=$2', [studentId, id])
  return item
}
const words = (text: string) => text.match(/[\p{Script=Han}]{2,6}|[A-Za-z][A-Za-z0-9-]{2,}/gu) ?? []
function fallbackAnalysis(item: MaterialRecord): MaterialAnalysis {
  const clean = item.textContent.replace(/\s+/g, ' ').trim()
  const counts = new Map<string, number>()
  words(clean).forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1))
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word]) => word)
  return {
    summary: clean ? clean.slice(0, 280) : '资料已保存，但暂时没有提取到可分析文字。图片资料需要配置可用的视觉模型；扫描版 PDF 可以改为上传清晰页面图片。',
    topics,
    keyPoints: topics.slice(0, 5).map((topic) => `复习并确认：${topic}`),
    questions: topics.slice(0, 3).map((topic) => `请用自己的话解释“${topic}”。`),
    suggestions: clean ? ['先通读摘要，再逐个核对重点。', '把不理解的内容拍题或加入错题本。'] : ['尝试上传带可复制文字的 PDF，或上传清晰页面图片。'],
  }
}
function parseAnalysis(value: string, fallback: MaterialAnalysis): MaterialAnalysis {
  try {
    const match = value.match(/\{[\s\S]*\}/)
    const parsed = asObject(JSON.parse(match?.[0] || value))
    const list = (key: string) => asArray(parsed[key]).map((item) => asString(item)).filter(Boolean).slice(0, 10)
    return { summary: asString(parsed.summary, fallback.summary), topics: list('topics'), keyPoints: list('keyPoints'), questions: list('questions'), suggestions: list('suggestions') }
  } catch { return fallback }
}
async function analyzeMaterial(item: MaterialRecord) {
  const fallback = fallbackAnalysis(item)
  if (!config.aiApiBaseUrl || !config.aiApiKey) return fallback
  const prompt = `你在帮助一名高中生整理学习资料。请只依据资料内容输出严格 JSON，不要使用 Markdown。字段：summary（简洁摘要）、topics（主题数组）、keyPoints（重点数组）、questions（自测题数组）、suggestions（下一步建议数组）。科目：${item.subject}；资料名：${item.title}。`
  let content: unknown = `${prompt}\n\n资料文字：\n${item.textContent.slice(0, 55_000)}`
  if (!item.textContent.trim() && item.mimeType.startsWith('image/') && isR2Configured()) {
    content = [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: createR2SignedUrl('GET', item.objectKey, 900) } }]
  } else if (!item.textContent.trim()) return fallback
  try {
    const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: item.mimeType.startsWith('image/') ? config.aiVisionModel : config.aiModel, temperature: 0.2, messages: [{ role: 'user', content }] }) })
    if (!response.ok) return fallback
    const payload = asObject(await response.json())
    const choices = asArray(payload.choices)
    const message = asObject(asObject(choices[0]).message)
    return parseAnalysis(asString(message.content), fallback)
  } catch { return fallback }
}
async function materialCount(studentId: string) { return (await listMaterials(studentId)).length }
async function buildAnalytics(studentId: string) {
  const stored = await store.getSnapshot(studentId)
  const snapshot = asObject(stored?.snapshot)
  const mistakes = asArray(snapshot.mistakes).map(asObject)
  const activeMistakes = mistakes.filter((item) => !item.archived)
  const knowledge = asArray(snapshot.knowledgePoints).map(asObject)
  const quizzes = asArray(snapshot.quizzes).map(asObject).filter((item) => asString(item.status) === 'completed').sort((a, b) => asString(b.date).localeCompare(asString(a.date)))
  const plans = asArray(snapshot.dailyPlans).map(asObject)
  const today = new Date().toISOString().slice(0, 10)
  const tasks = asArray(plans.find((plan) => asString(plan.date) === today)?.tasks).map(asObject)
  const groups = new Map<string, { mastery: number[]; mistakes: number }>()
  knowledge.forEach((point) => { const subject = asString(point.subject, '其他'); const group = groups.get(subject) ?? { mastery: [], mistakes: 0 }; group.mastery.push(asNumber(point.mastery)); groups.set(subject, group) })
  activeMistakes.forEach((item) => { const subject = asString(item.subject, '其他'); const group = groups.get(subject) ?? { mastery: [], mistakes: 0 }; group.mistakes += 1; groups.set(subject, group) })
  const materials = await listMaterials(studentId)
  const activityDates = new Set(asArray(snapshot.activityLogs).map((item) => asString(asObject(item).createdAt || asObject(item).date).slice(0, 10)).filter(Boolean))
  const averageMastery = knowledge.length ? Math.round(knowledge.reduce((sum, item) => sum + asNumber(item.mastery), 0) / knowledge.length) : 0
  const latestAccuracy = quizzes.length ? asNumber(quizzes[0].correctRate) : knowledge.length ? Math.round(knowledge.reduce((sum, item) => sum + asNumber(item.accuracy), 0) / knowledge.length) : 0
  const weakSubjects = [...groups.entries()].map(([subject, group]) => ({ subject, mastery: group.mastery.length ? Math.round(group.mastery.reduce((a, b) => a + b, 0) / group.mastery.length) : 0, mistakeCount: group.mistakes })).sort((a, b) => a.mastery - b.mastery || b.mistakeCount - a.mistakeCount).slice(0, 6)
  const weakPoints = knowledge.sort((a, b) => asNumber(a.mastery) - asNumber(b.mastery)).slice(0, 8).map((item) => ({ subject: asString(item.subject, '其他'), name: asString(item.name || item.knowledgePointName, '待确认知识点'), mastery: asNumber(item.mastery), cause: asString(item.mainCause) }))
  const recommendations = weakPoints.slice(0, 3).map((item) => `先复习${item.subject}“${item.name}”，再做 3—5 道同类题。`)
  if (!recommendations.length) recommendations.push(materials.length ? '从最近上传的资料中选一份完成一次复习。' : '先上传资料或完成一次拍题，系统会逐步形成分析。')
  return {
    generatedAt: new Date().toISOString(),
    overview: { activeMistakes: activeMistakes.length, averageMastery, latestAccuracy: Math.round(latestAccuracy), completedTasks: tasks.filter((task) => asString(task.status) === 'completed').length, totalTasks: tasks.length, materialCount: await materialCount(studentId), studyDays: activityDates.size },
    weakSubjects,
    weakPoints,
    trend: quizzes.slice(0, 8).reverse().map((quiz) => ({ date: asString(quiz.date), accuracy: asNumber(quiz.correctRate) })),
    recommendations,
    recentMaterials: materials.slice(0, 8).map((item) => ({ id: item.id, title: item.title, subject: item.subject, updatedAt: item.updatedAt })),
  }
}
const userId = (req: AuthenticatedRequest, res: Response) => { if (!req.user) { res.status(401).json({ message: '请先登录' }); return '' } return req.user.id }

export function registerFamilyRoutes(app: Express) {
  app.post('/api/materials/upload-url', ...studentOnly, async (req: AuthenticatedRequest, res) => {
    const id = userId(req, res); if (!id) return
    if (!isR2Configured()) return res.status(503).json({ message: 'Render 中还没有完整配置 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 和 R2_BUCKET_NAME' })
    const body = asObject(req.body)
    const fileName = asString(body.fileName).slice(0, 180)
    const mimeType = asString(body.mimeType, 'application/octet-stream').slice(0, 120)
    const sizeBytes = asNumber(body.sizeBytes)
    if (!fileName || sizeBytes <= 0 || sizeBytes > 120 * 1024 * 1024) return res.status(400).json({ message: '文件无效或超过 120MB' })
    const key = `students/${id}/${new Date().toISOString().slice(0,10)}/${randomUUID()}-${safeName(fileName)}`
    return res.json({ key, uploadUrl: createR2SignedUrl('PUT', key, 900), headers: { 'Content-Type': mimeType } })
  })
  app.post('/api/materials', ...studentOnly, async (req: AuthenticatedRequest, res) => {
    const id = userId(req, res); if (!id) return
    const body = asObject(req.body); const now = new Date().toISOString()
    const item: MaterialRecord = { id: randomUUID(), studentId: id, objectKey: asString(body.key), fileName: asString(body.fileName).slice(0, 180), title: asString(body.title, asString(body.fileName)).slice(0, 120), subject: asString(body.subject, '其他').slice(0, 30), mimeType: asString(body.mimeType, 'application/octet-stream').slice(0, 120), sizeBytes: asNumber(body.sizeBytes), textContent: asString(body.textContent).slice(0, 180_000), analysis: null, analysisStatus: 'pending', createdAt: now, updatedAt: now }
    if (!item.objectKey.startsWith(`students/${id}/`) || !item.fileName) return res.status(400).json({ message: '资料信息不完整' })
    return res.status(201).json({ material: publicMaterial(await saveMaterial(item)) })
  })
  app.get('/api/materials', ...studentOnly, async (req: AuthenticatedRequest, res) => { const id = userId(req, res); if (!id) return; return res.json({ materials: (await listMaterials(id)).map(publicMaterial) }) })
  app.patch('/api/materials/:id', ...studentOnly, async (req: AuthenticatedRequest, res) => {
    const id = userId(req, res); if (!id) return
    const current = await getMaterial(id, req.params.id); if (!current) return res.status(404).json({ message: '资料不存在' })
    const body = asObject(req.body); const oldKey = current.objectKey
    const next: MaterialRecord = { ...current, objectKey: asString(body.key, current.objectKey), fileName: asString(body.fileName, current.fileName), title: asString(body.title, current.title), subject: asString(body.subject, current.subject), mimeType: asString(body.mimeType, current.mimeType), sizeBytes: asNumber(body.sizeBytes, current.sizeBytes), textContent: asString(body.textContent, current.textContent).slice(0,180_000), analysis: null, analysisStatus: 'pending', updatedAt: new Date().toISOString() }
    const saved = await saveMaterial(next)
    if (oldKey !== next.objectKey && isR2Configured()) fetch(createR2SignedUrl('DELETE', oldKey, 300), { method: 'DELETE' }).catch(() => undefined)
    return res.json({ material: publicMaterial(saved) })
  })
  app.post('/api/materials/:id/analyze', ...studentOnly, async (req: AuthenticatedRequest, res) => {
    const id = userId(req, res); if (!id) return
    const current = await getMaterial(id, req.params.id); if (!current) return res.status(404).json({ message: '资料不存在' })
    current.analysisStatus = 'running'; current.updatedAt = new Date().toISOString(); await saveMaterial(current)
    current.analysis = await analyzeMaterial(current); current.analysisStatus = 'done'; current.updatedAt = new Date().toISOString()
    return res.json({ material: publicMaterial(await saveMaterial(current)) })
  })
  app.get('/api/materials/:id/download-url', ...studentOnly, async (req: AuthenticatedRequest, res) => { const id = userId(req,res); if (!id) return; const item = await getMaterial(id, req.params.id); if (!item) return res.status(404).json({ message: '资料不存在' }); if (!isR2Configured()) return res.status(503).json({ message: 'R2 尚未配置完整' }); return res.json({ url: createR2SignedUrl('GET', item.objectKey, 900) }) })
  app.delete('/api/materials/:id', ...studentOnly, async (req: AuthenticatedRequest, res) => { const id = userId(req,res); if (!id) return; const item = await deleteMaterial(id, req.params.id); if (!item) return res.status(404).json({ message: '资料不存在' }); if (isR2Configured()) await fetch(createR2SignedUrl('DELETE', item.objectKey, 300), { method: 'DELETE' }).catch(() => undefined); return res.json({ ok: true }) })
  app.get('/api/analytics/student', ...studentOnly, async (req: AuthenticatedRequest, res) => { const id = userId(req,res); if (!id) return; return res.json({ analytics: await buildAnalytics(id) }) })
  app.post('/api/parent/link-direct', ...parentOnly, async (req: AuthenticatedRequest, res) => {
    const parentId = userId(req,res); if (!parentId) return
    const email = asString(asObject(req.body).email).trim().toLowerCase()
    if (!email || !email.includes('@')) return res.status(400).json({ message: '请输入学生邮箱' })
    const student = await store.findUserByEmail(email)
    if (!student || student.role !== 'student') return res.status(404).json({ message: '没有找到这个学生账号' })
    let code = ''
    for (let attempt = 0; attempt < 20; attempt += 1) { const candidate = String(randomInt(100000, 1000000)); if (await store.isPairCodeAvailable(candidate)) { code = candidate; break } }
    if (!code) return res.status(503).json({ message: '绑定失败，请重试' })
    await store.issuePairCode(student.id, code, new Date(Date.now() + 5 * 60_000).toISOString())
    const linked = await store.consumePairCode(parentId, code)
    if (!linked) return res.status(409).json({ message: '绑定失败，请重试' })
    return res.json({ ok: true, studentId: student.id })
  })
  app.get('/api/parent/children/:studentId/analytics', ...parentOnly, async (req: AuthenticatedRequest, res) => { const parentId = userId(req,res); if (!parentId) return; const linked = await store.getLinkedStudent(parentId, req.params.studentId); if (!linked) return res.status(404).json({ message: '未绑定该学生' }); return res.json({ analytics: await buildAnalytics(req.params.studentId) }) })
}
