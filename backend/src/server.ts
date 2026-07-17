import { randomInt, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { requireAuth, requireRole, signToken, type AuthenticatedRequest, type AuthUser } from './auth.js'
import { config } from './config.js'
import { explainQuestion, generateSimulation, recognizePaper, recognizeQuestion, searchKnowledge, subjects } from './learning.js'
import { store } from './store.js'
import { buildParentDashboard } from './summary.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use((req, res, next) => {
  const requestId = req.header('x-request-id') || randomUUID()
  res.setHeader('x-request-id', requestId)
  res.setHeader('cache-control', 'no-store')
  const started = Date.now()
  res.on('finish', () => console.log(JSON.stringify({ requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started })))
  next()
})

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    const normalized = origin.replace(/\/$/, '')
    if (config.corsOrigins.includes('*') || config.corsOrigins.includes(normalized)) return callback(null, true)
    return callback(new Error(`CORS origin is not allowed: ${normalized}`))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: false,
  maxAge: 86400,
}))
app.use(express.json({ limit: `${config.maxJsonMb}mb` }))

app.get('/api/health', async (_req, res) => {
  await store.health()
  res.json({
    ok: true,
    service: 'aixuexi-api',
    version: '1.4.0',
    database: config.useMemoryDb ? 'memory' : 'postgres',
    aiProviderConfigured: Boolean(config.aiApiKey && config.aiApiBaseUrl),
    time: new Date().toISOString(),
  })
})

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(40),
})
const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
})
const subjectSchema = z.enum(subjects)

function publicUser(user: { id: string; email: string; displayName: string; role: 'student' | 'parent' }): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role }
}

function registerForRole(role: 'student' | 'parent') {
  return async (req: express.Request, res: express.Response) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '注册信息不完整', issues: parsed.error.flatten() })
    const { email, password, displayName } = parsed.data
    if (await store.findUserByEmail(email)) return res.status(409).json({ message: '该邮箱已经注册' })
    const created = await store.createUser({ email, passwordHash: await bcrypt.hash(password, 12), displayName, role })
    const user = publicUser(created)
    return res.status(201).json({ token: signToken(user), user })
  }
}

function loginForRole(expectedRole: 'student' | 'parent') {
  return async (req: express.Request, res: express.Response) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '请输入正确的邮箱和密码' })
    const stored = await store.findUserByEmail(parsed.data.email)
    if (!stored || !(await bcrypt.compare(parsed.data.password, stored.passwordHash))) return res.status(401).json({ message: '邮箱或密码错误' })
    if (stored.role !== expectedRole) return res.status(403).json({ message: '该账号不属于当前登录入口' })
    const user = publicUser(stored)
    return res.json({ token: signToken(user), user })
  }
}

app.post('/api/auth/student/register', registerForRole('student'))
app.post('/api/auth/student/login', loginForRole('student'))
app.post('/api/auth/parent/register', registerForRole('parent'))
app.post('/api/auth/parent/login', loginForRole('parent'))
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => res.json({ user: req.user }))

const studentOnly = [requireAuth, requireRole('student')] as const
const parentOnly = [requireAuth, requireRole('parent')] as const

app.get('/api/student/snapshot', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const row = await store.getSnapshot(req.user!.id)
  res.json({ snapshot: row?.snapshot ?? null, updatedAt: row?.updatedAt ?? null })
})

async function saveSnapshot(req: AuthenticatedRequest, res: express.Response) {
  const snapshot = req.body?.snapshot ?? req.body
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return res.status(400).json({ message: '学习快照格式无效' })
  const result = await store.saveSnapshot(req.user!.id, snapshot)
  return res.json({ ok: true, updatedAt: result.updatedAt })
}
app.put('/api/student/snapshot', ...studentOnly, saveSnapshot)
app.post('/api/sync/snapshot', ...studentOnly, saveSnapshot)

app.post('/api/student/pair-code', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  let code = ''
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = String(randomInt(100000, 1000000))
    if (await store.isPairCodeAvailable(candidate)) { code = candidate; break }
  }
  if (!code) return res.status(503).json({ message: '暂时无法生成绑定码，请稍后重试' })
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await store.issuePairCode(req.user!.id, code, expiresAt)
  res.json({ code, expiresAt })
})

const ocrQuestionSchema = z.object({ subject: subjectSchema, imageDataUrl: z.string().min(20), fileName: z.string().optional() })
const ocrPaperSchema = z.object({ subject: subjectSchema, imageDataUrls: z.array(z.string().min(20)).min(1).max(6) })
const explainSchema = z.object({ subject: subjectSchema, content: z.string().min(1).max(20000), correctAnswer: z.string().optional() })
const simulationSchema = z.object({ subject: subjectSchema, points: z.array(z.object({ id: z.string(), name: z.string() })).default([]), count: z.number().int().min(1).max(20).default(5) })

app.post('/api/ocr/question', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = ocrQuestionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '题目图片或科目信息无效', issues: parsed.error.flatten() })
  res.json(await recognizeQuestion(parsed.data))
})
app.post('/api/ocr/paper', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = ocrPaperSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '请上传 1—6 张有效试卷图片', issues: parsed.error.flatten() })
  res.json(await recognizePaper(parsed.data))
})
app.post('/api/ai/explain', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = explainSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '题目内容不完整', issues: parsed.error.flatten() })
  res.json(await explainQuestion(parsed.data))
})
app.post('/api/ai/simulation', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = simulationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '模拟训练参数无效', issues: parsed.error.flatten() })
  res.json(await generateSimulation(parsed.data))
})
app.get('/api/knowledge', ...studentOnly, (req, res) => {
  const filters = Object.fromEntries(Object.entries(req.query).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]))
  res.json(searchKnowledge(filters))
})

const recordTypes = ['questions', 'mistakes', 'papers', 'knowledge-points', 'review-tasks', 'daily-plans', 'quizzes', 'cards', 'activity-logs', 'profile', 'settings'] as const
const recordTypeSchema = z.enum(recordTypes)

app.get('/api/student/records/:type', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) return res.status(400).json({ message: '不支持的记录类型' })
  res.json({ records: await store.listRecords(req.user!.id, parsed.data) })
})
app.post('/api/student/records/:type', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) return res.status(400).json({ message: '不支持的记录类型' })
  const payload = req.body?.payload ?? req.body
  if (!payload || typeof payload !== 'object') return res.status(400).json({ message: '记录内容无效' })
  const id = String(req.body?.id || (payload as { id?: string }).id || randomUUID())
  res.status(201).json({ record: await store.upsertRecord(req.user!.id, parsed.data, id, payload) })
})
app.get('/api/student/records/:type/:id', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) return res.status(400).json({ message: '不支持的记录类型' })
  const record = await store.getRecord(req.user!.id, parsed.data, String(req.params.id))
  if (!record) return res.status(404).json({ message: '记录不存在' })
  res.json({ record })
})
app.put('/api/student/records/:type/:id', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) return res.status(400).json({ message: '不支持的记录类型' })
  const payload = req.body?.payload ?? req.body
  if (!payload || typeof payload !== 'object') return res.status(400).json({ message: '记录内容无效' })
  res.json({ record: await store.upsertRecord(req.user!.id, parsed.data, String(req.params.id), payload) })
})
app.delete('/api/student/records/:type/:id', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) return res.status(400).json({ message: '不支持的记录类型' })
  await store.deleteRecord(req.user!.id, parsed.data, String(req.params.id))
  res.json({ ok: true })
})

const aliases: Array<[string, typeof recordTypes[number]]> = [
  ['mistakes', 'mistakes'], ['papers', 'papers'], ['plans', 'daily-plans'], ['quizzes', 'quizzes'], ['cards', 'cards'], ['profile', 'profile'],
]
for (const [path, type] of aliases) {
  app.get(`/api/${path}`, ...studentOnly, async (req: AuthenticatedRequest, res) => res.json({ records: await store.listRecords(req.user!.id, type) }))
  app.post(`/api/${path}`, ...studentOnly, async (req: AuthenticatedRequest, res) => {
    const payload = req.body?.payload ?? req.body
    const id = String(req.body?.id || (payload as { id?: string })?.id || randomUUID())
    res.status(201).json({ record: await store.upsertRecord(req.user!.id, type, id, payload) })
  })
}

app.get('/api/reports/summary', ...studentOnly, async (req: AuthenticatedRequest, res) => {
  const snapshot = (await store.getSnapshot(req.user!.id))?.snapshot as Record<string, unknown> | undefined
  if (!snapshot) return res.json({ summary: null, message: '尚无学习数据' })
  res.json({ summary: buildParentDashboard(snapshot, { id: req.user!.id, email: req.user!.email, displayName: req.user!.displayName }) })
})

app.post('/api/parent/link', ...parentOnly, async (req: AuthenticatedRequest, res) => {
  const code = String(req.body?.code || '').trim()
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: '请输入学生生成的 6 位绑定码' })
  const studentId = await store.consumePairCode(req.user!.id, code)
  if (!studentId) return res.status(404).json({ message: '绑定码无效或已过期' })
  res.json({ ok: true, studentId })
})
app.get('/api/parent/children', ...parentOnly, async (req: AuthenticatedRequest, res) => res.json({ children: await store.listChildren(req.user!.id) }))
app.get('/api/parent/children/:studentId/dashboard', ...parentOnly, async (req: AuthenticatedRequest, res) => {
  const row = await store.getLinkedStudent(req.user!.id, String(req.params.studentId))
  if (!row) return res.status(404).json({ message: '未找到已绑定学生' })
  if (!row.snapshot) return res.status(409).json({ message: '学生尚未同步学习数据' })
  res.json({ dashboard: buildParentDashboard(row.snapshot as Record<string, unknown>, { id: row.id, email: row.email, displayName: row.displayName }) })
})
app.delete('/api/parent/children/:studentId', ...parentOnly, async (req: AuthenticatedRequest, res) => {
  await store.unlinkChild(req.user!.id, String(req.params.studentId))
  res.json({ ok: true })
})

app.use((_req, res) => res.status(404).json({ message: '接口不存在', code: 'NOT_FOUND' }))
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError) return res.status(400).json({ message: '请求 JSON 格式错误', code: 'INVALID_JSON' })
  const message = error instanceof Error ? error.message : '服务器内部错误'
  const isCors = message.startsWith('CORS origin is not allowed')
  if (isCors) console.warn(JSON.stringify({ code: 'CORS_DENIED', message }))
  else console.error(error)
  res.status(isCors ? 403 : 500).json({ message: config.nodeEnv === 'production' && !isCors ? '服务器内部错误' : message, code: isCors ? 'CORS_DENIED' : 'INTERNAL_ERROR' })
})

app.listen(config.port, '0.0.0.0', () => console.log(`AIxuexi API v1.4.0 listening on port ${config.port}`))
