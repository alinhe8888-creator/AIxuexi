import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireRole,
  signToken,
  type AuthenticatedRequest,
  type AuthUser,
  type UserRole,
} from './auth.js'
import { config } from './config.js'
import { materialKnowledgeRouter } from './materialRoutes.js'
import { privateModeRouter } from './privateModeRoutes.js'
import { qwenLearningRouter } from './qwenLearningRoutes.js'
import { isR2Ready } from './r2Native.js'
import { store } from './store.js'
import { studentAnalysisRouter } from './studentAnalysisRoutes.js'
import { buildParentDashboard } from './summary.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use((req, res, next) => {
  const requestId = req.header('x-request-id') || randomUUID()
  res.setHeader('x-request-id', requestId)
  res.setHeader('cache-control', 'no-store')
  const started = Date.now()
  res.on('finish', () => {
    console.log(JSON.stringify({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
    }))
  })
  next()
})

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    const normalized = origin.replace(/\/$/, '')
    if (config.corsOrigins.includes('*') || config.corsOrigins.includes(normalized)) {
      return callback(null, true)
    }
    return callback(new Error(`CORS origin is not allowed: ${normalized}`))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: false,
  maxAge: 86400,
}))

app.use(express.json({ limit: `${config.maxJsonMb}mb` }))

const asyncRoute = (
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>,
): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await store.health()
    res.json({
      ok: true,
      service: 'aixuexi-api',
      version: '6.0.0-production',
      database: config.useMemoryDb ? 'memory' : 'postgres',
      r2Configured: isR2Ready(),
      qwenConfigured: Boolean(process.env.QWEN_API_KEY || process.env.AI_API_KEY),
      deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      familyStudentConfigured: Boolean(process.env.FAMILY_STUDENT_EMAIL || process.env.PRIVATE_STUDENT_EMAIL),
      familyParentConfigured: Boolean(process.env.FAMILY_PARENT_EMAIL || process.env.PRIVATE_PARENT_EMAIL),
      time: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

const loginSchema = z.object({
  email: z.string().email().transform((value: string) => value.toLowerCase().trim()),
  password: z.string().min(1).max(128),
})

function publicUser(user: {
  id: string
  email: string
  displayName: string
  role: UserRole
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }
}

function loginForRole(expectedRole: UserRole): RequestHandler {
  return async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ message: '请输入正确的邮箱和密码' })
        return
      }
      const stored = await store.findUserByEmail(parsed.data.email)
      if (!stored || !(await bcrypt.compare(parsed.data.password, stored.passwordHash))) {
        res.status(401).json({ message: '邮箱或密码错误' })
        return
      }
      if (stored.role !== expectedRole) {
        res.status(403).json({ message: '该账号不属于当前登录入口' })
        return
      }
      const user = publicUser(stored)
      res.json({ token: signToken(user), user })
    } catch (error) {
      next(error)
    }
  }
}

app.post('/api/auth/student/register', (_req, res) => {
  res.status(403).json({ message: '家庭自用系统已关闭注册' })
})
app.post('/api/auth/parent/register', (_req, res) => {
  res.status(403).json({ message: '家庭自用系统已关闭注册' })
})
app.post('/api/auth/student/login', loginForRole('student'))
app.post('/api/auth/parent/login', loginForRole('parent'))
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user })
})

const studentOnly = [requireAuth, requireRole('student')] as const

app.get('/api/student/snapshot', ...studentOnly, asyncRoute(async (req, res) => {
  const row = await store.getSnapshot(req.user!.id)
  res.json({ snapshot: row?.snapshot ?? null, updatedAt: row?.updatedAt ?? null })
}))

const saveSnapshot = asyncRoute(async (req, res) => {
  const snapshot = req.body?.snapshot ?? req.body
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    res.status(400).json({ message: '学习快照格式无效' })
    return
  }
  const result = await store.saveSnapshot(req.user!.id, snapshot)
  res.json({ ok: true, updatedAt: result.updatedAt })
})

app.put('/api/student/snapshot', ...studentOnly, saveSnapshot)
app.post('/api/sync/snapshot', ...studentOnly, saveSnapshot)

const recordTypes = [
  'questions',
  'mistakes',
  'papers',
  'knowledge-points',
  'review-tasks',
  'daily-plans',
  'quizzes',
  'cards',
  'activity-logs',
  'profile',
  'settings',
] as const
const recordTypeSchema = z.enum(recordTypes)

app.get('/api/student/records/:type', ...studentOnly, asyncRoute(async (req, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) {
    res.status(400).json({ message: '不支持的记录类型' })
    return
  }
  res.json({ records: await store.listRecords(req.user!.id, parsed.data) })
}))

app.post('/api/student/records/:type', ...studentOnly, asyncRoute(async (req, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) {
    res.status(400).json({ message: '不支持的记录类型' })
    return
  }
  const payload = req.body?.payload ?? req.body
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    res.status(400).json({ message: '记录内容无效' })
    return
  }
  const id = String(req.body?.id || (payload as { id?: string }).id || randomUUID())
  const record = await store.upsertRecord(req.user!.id, parsed.data, id, payload)
  res.status(201).json({ record })
}))

app.get('/api/student/records/:type/:id', ...studentOnly, asyncRoute(async (req, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) {
    res.status(400).json({ message: '不支持的记录类型' })
    return
  }
  const record = await store.getRecord(req.user!.id, parsed.data, String(req.params.id))
  if (!record) {
    res.status(404).json({ message: '记录不存在' })
    return
  }
  res.json({ record })
}))

app.put('/api/student/records/:type/:id', ...studentOnly, asyncRoute(async (req, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) {
    res.status(400).json({ message: '不支持的记录类型' })
    return
  }
  const payload = req.body?.payload ?? req.body
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    res.status(400).json({ message: '记录内容无效' })
    return
  }
  const record = await store.upsertRecord(
    req.user!.id,
    parsed.data,
    String(req.params.id),
    payload,
  )
  res.json({ record })
}))

app.delete('/api/student/records/:type/:id', ...studentOnly, asyncRoute(async (req, res) => {
  const parsed = recordTypeSchema.safeParse(req.params.type)
  if (!parsed.success) {
    res.status(400).json({ message: '不支持的记录类型' })
    return
  }
  await store.deleteRecord(req.user!.id, parsed.data, String(req.params.id))
  res.json({ ok: true })
}))

const aliases: Array<[string, typeof recordTypes[number]]> = [
  ['mistakes', 'mistakes'],
  ['papers', 'papers'],
  ['plans', 'daily-plans'],
  ['quizzes', 'quizzes'],
  ['cards', 'cards'],
  ['profile', 'profile'],
]

for (const [routePath, type] of aliases) {
  app.get(`/api/${routePath}`, ...studentOnly, asyncRoute(async (req, res) => {
    res.json({ records: await store.listRecords(req.user!.id, type) })
  }))
  app.post(`/api/${routePath}`, ...studentOnly, asyncRoute(async (req, res) => {
    const payload = req.body?.payload ?? req.body
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ message: '记录内容无效' })
      return
    }
    const id = String(req.body?.id || (payload as { id?: string }).id || randomUUID())
    const record = await store.upsertRecord(req.user!.id, type, id, payload)
    res.status(201).json({ record })
  }))
}

app.get('/api/reports/summary', ...studentOnly, asyncRoute(async (req, res) => {
  const snapshotRow = await store.getSnapshot(req.user!.id)
  const snapshot = snapshotRow?.snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    res.json({ summary: null, message: '尚无学习数据' })
    return
  }
  res.json({
    summary: buildParentDashboard(
      snapshot as Record<string, unknown>,
      {
        id: req.user!.id,
        email: req.user!.email,
        displayName: req.user!.displayName,
        lastSyncedAt: snapshotRow.updatedAt,
      },
    ),
  })
}))

// Focused private-family modules. They replace the old static knowledge, pair-code,
// OCR-only and public registration implementations.
app.use('/api', privateModeRouter)
app.use('/api', materialKnowledgeRouter)
app.use('/api', qwenLearningRouter)
app.use('/api', studentAnalysisRouter)

app.use((_req, res) => {
  res.status(404).json({ message: '接口不存在', code: 'NOT_FOUND' })
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    res.status(400).json({ message: '请求 JSON 格式错误', code: 'INVALID_JSON' })
    return
  }
  if (typeof error === 'object' && error && 'issues' in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
    res.status(400).json({ message: '请求参数无效', code: 'INVALID_ARGUMENTS' })
    return
  }
  const message = error instanceof Error ? error.message : '服务器内部错误'
  const isCors = message.startsWith('CORS origin is not allowed')
  const suppliedStatus = typeof error === 'object' && error && 'status' in error
    ? Number((error as { status?: number }).status)
    : 0
  const safeStatus = suppliedStatus >= 400 && suppliedStatus < 600 ? suppliedStatus : 0
  if (isCors || safeStatus < 500) console.warn(JSON.stringify({ code: isCors ? 'CORS_DENIED' : 'REQUEST_FAILED', message, status: isCors ? 403 : safeStatus }))
  else console.error(error)
  const status = isCors ? 403 : safeStatus || 500
  const expose = typeof error === 'object' && error && 'expose' in error
    ? Boolean((error as { expose?: boolean }).expose)
    : false
  res.status(status).json({
    message: config.nodeEnv === 'production' && status >= 500 && !expose ? '服务器内部错误' : message,
    code: isCors ? 'CORS_DENIED' : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
  })
})

async function ensurePrivateAccount(input: {
  email: string
  password: string
  displayName: string
  role: UserRole
}) {
  if (!input.email && !input.password) return null
  if (!input.email || !input.password) {
    throw new Error(`Incomplete private ${input.role} account configuration`)
  }
  const normalizedEmail = input.email.toLowerCase().trim()
  const emailResult = z.string().email().safeParse(normalizedEmail)
  if (!emailResult.success) throw new Error(`Invalid private ${input.role} account email`)

  const existing = await store.findUserByEmail(normalizedEmail)
  if (existing) {
    if (existing.role !== input.role) {
      throw new Error(`Configured private ${input.role} email belongs to another role`)
    }
    if (!(await bcrypt.compare(input.password, existing.passwordHash))) {
      throw new Error(`Configured private ${input.role} password does not match the existing account`)
    }
    return existing
  }

  const created = await store.createUser({
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(input.password, 12),
    displayName: input.displayName || (input.role === 'student' ? '同学' : '家长'),
    role: input.role,
  })
  console.log(`Private ${input.role} account is ready.`)
  return created
}

async function start() {
  const student = await ensurePrivateAccount({
    email: (process.env.FAMILY_STUDENT_EMAIL || process.env.PRIVATE_STUDENT_EMAIL || '').trim(),
    password: (process.env.FAMILY_STUDENT_PASSWORD || process.env.PRIVATE_STUDENT_PASSWORD || '').trim(),
    displayName: (process.env.FAMILY_STUDENT_NAME || process.env.PRIVATE_STUDENT_NAME || '同学').trim(),
    role: 'student',
  })
  const parent = await ensurePrivateAccount({
    email: (process.env.FAMILY_PARENT_EMAIL || process.env.PRIVATE_PARENT_EMAIL || '').trim(),
    password: (process.env.FAMILY_PARENT_PASSWORD || process.env.PRIVATE_PARENT_PASSWORD || '').trim(),
    displayName: (process.env.FAMILY_PARENT_NAME || process.env.PRIVATE_PARENT_NAME || '家长').trim(),
    role: 'parent',
  })

  if (config.nodeEnv === 'production' && (!student || !parent)) {
    throw new Error('Production requires both family student and parent account credentials')
  }
  if (student && parent) await store.linkParentToStudent(parent.id, student.id)

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`AIxuexi API v6.0.0-production listening on port ${config.port}`)
  })
}

void start().catch((error) => {
  console.error('Failed to start AIxuexi API.', error)
  process.exit(1)
})
