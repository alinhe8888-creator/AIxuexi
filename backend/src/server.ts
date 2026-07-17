import { randomInt, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { requireAuth, requireRole, signToken, type AuthenticatedRequest, type AuthUser } from './auth.js'
import { config } from './config.js'
import { pool, query } from './db.js'
import { buildParentDashboard } from './summary.js'

const app = express()
app.disable('x-powered-by')
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('CORS origin is not allowed'))
  },
  credentials: false,
}))
app.use(express.json({ limit: '8mb' }))

app.get('/api/health', async (_req, res) => {
  await query('SELECT 1')
  res.json({ ok: true, service: 'aixuexi-api', time: new Date().toISOString() })
})

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(40),
  role: z.enum(['student', 'parent']),
})

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '注册信息不完整', issues: parsed.error.flatten() })
  const { email, password, displayName, role } = parsed.data
  const exists = await query('SELECT id FROM users WHERE email = $1', [email])
  if (exists.rowCount) return res.status(409).json({ message: '该邮箱已经注册' })
  const id = randomUUID()
  const passwordHash = await bcrypt.hash(password, 12)
  await query('INSERT INTO users(id, email, password_hash, display_name, role) VALUES($1,$2,$3,$4,$5)', [id, email, passwordHash, displayName, role])
  const user: AuthUser = { id, email, displayName, role }
  res.status(201).json({ token: signToken(user), user })
})

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
})

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '请输入正确的邮箱和密码' })
  const result = await query<{ id: string; email: string; password_hash: string; display_name: string; role: 'student' | 'parent' }>(
    'SELECT id,email,password_hash,display_name,role FROM users WHERE email=$1', [parsed.data.email],
  )
  const row = result.rows[0]
  if (!row || !(await bcrypt.compare(parsed.data.password, row.password_hash))) return res.status(401).json({ message: '邮箱或密码错误' })
  const user: AuthUser = { id: row.id, email: row.email, displayName: row.display_name, role: row.role }
  res.json({ token: signToken(user), user })
})

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => res.json({ user: req.user }))

app.get('/api/student/snapshot', requireAuth, requireRole('student'), async (req: AuthenticatedRequest, res) => {
  const result = await query<{ snapshot: unknown; updated_at: string }>('SELECT snapshot,updated_at FROM student_snapshots WHERE student_user_id=$1', [req.user!.id])
  const row = result.rows[0]
  res.json({ snapshot: row?.snapshot ?? null, updatedAt: row?.updated_at ?? null })
})

app.put('/api/student/snapshot', requireAuth, requireRole('student'), async (req: AuthenticatedRequest, res) => {
  const snapshot = req.body?.snapshot ?? req.body
  if (!snapshot || typeof snapshot !== 'object') return res.status(400).json({ message: '学习快照格式无效' })
  await query(
    `INSERT INTO student_snapshots(student_user_id,snapshot,updated_at)
     VALUES($1,$2::jsonb,NOW())
     ON CONFLICT(student_user_id) DO UPDATE SET snapshot=EXCLUDED.snapshot, updated_at=NOW()`,
    [req.user!.id, JSON.stringify(snapshot)],
  )
  res.json({ ok: true, updatedAt: new Date().toISOString() })
})

app.post('/api/student/pair-code', requireAuth, requireRole('student'), async (req: AuthenticatedRequest, res) => {
  await query('DELETE FROM pair_codes WHERE student_user_id=$1 AND used_at IS NULL', [req.user!.id])
  let code = ''
  for (let attempt = 0; attempt < 8; attempt += 1) {
    code = String(randomInt(100000, 1000000))
    const exists = await query('SELECT id FROM pair_codes WHERE code=$1 AND expires_at>NOW() AND used_at IS NULL', [code])
    if (!exists.rowCount) break
  }
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  await query('INSERT INTO pair_codes(id,student_user_id,code,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), req.user!.id, code, expiresAt.toISOString()])
  res.json({ code, expiresAt: expiresAt.toISOString() })
})

app.post('/api/parent/link', requireAuth, requireRole('parent'), async (req: AuthenticatedRequest, res) => {
  const code = String(req.body?.code || '').trim()
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: '请输入学生生成的 6 位绑定码' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const codeResult = await client.query<{ id: string; student_user_id: string }>(
      `SELECT id,student_user_id FROM pair_codes
       WHERE code=$1 AND used_at IS NULL AND expires_at>NOW()
       FOR UPDATE`, [code],
    )
    const row = codeResult.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: '绑定码无效或已过期' })
    }
    await client.query(
      `INSERT INTO parent_student_links(parent_user_id,student_user_id)
       VALUES($1,$2) ON CONFLICT(parent_user_id,student_user_id) DO NOTHING`,
      [req.user!.id, row.student_user_id],
    )
    await client.query('UPDATE pair_codes SET used_at=NOW() WHERE id=$1', [row.id])
    await client.query('COMMIT')
    return res.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

app.get('/api/parent/children', requireAuth, requireRole('parent'), async (req: AuthenticatedRequest, res) => {
  const result = await query<{ id: string; email: string; display_name: string; linked_at: string; snapshot_updated_at: string | null }>(
    `SELECT u.id,u.email,u.display_name,l.linked_at,s.updated_at AS snapshot_updated_at
     FROM parent_student_links l
     JOIN users u ON u.id=l.student_user_id
     LEFT JOIN student_snapshots s ON s.student_user_id=u.id
     WHERE l.parent_user_id=$1
     ORDER BY l.linked_at DESC`, [req.user!.id],
  )
  res.json({ children: result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    linkedAt: row.linked_at,
    lastSyncedAt: row.snapshot_updated_at,
  })) })
})

app.get('/api/parent/children/:studentId/dashboard', requireAuth, requireRole('parent'), async (req: AuthenticatedRequest, res) => {
  const result = await query<{ id: string; email: string; display_name: string; snapshot: unknown }>(
    `SELECT u.id,u.email,u.display_name,s.snapshot
     FROM parent_student_links l
     JOIN users u ON u.id=l.student_user_id
     LEFT JOIN student_snapshots s ON s.student_user_id=u.id
     WHERE l.parent_user_id=$1 AND l.student_user_id=$2`, [req.user!.id, req.params.studentId],
  )
  const row = result.rows[0]
  if (!row) return res.status(404).json({ message: '未找到已绑定学生' })
  if (!row.snapshot) return res.status(409).json({ message: '学生尚未同步学习数据' })
  res.json({ dashboard: buildParentDashboard(row.snapshot as Record<string, unknown>, { id: row.id, email: row.email, displayName: row.display_name }) })
})

app.delete('/api/parent/children/:studentId', requireAuth, requireRole('parent'), async (req: AuthenticatedRequest, res) => {
  await query('DELETE FROM parent_student_links WHERE parent_user_id=$1 AND student_user_id=$2', [req.user!.id, req.params.studentId])
  res.json({ ok: true })
})

app.use((_req, res) => res.status(404).json({ message: '接口不存在' }))
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  const message = error instanceof Error ? error.message : '服务器内部错误'
  res.status(500).json({ message: config.nodeEnv === 'production' ? '服务器内部错误' : message })
})

app.listen(config.port, '0.0.0.0', () => {
  console.log(`AIxuexi API listening on port ${config.port}`)
})
