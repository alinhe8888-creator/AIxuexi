#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const repo = path.resolve(process.argv[2] || process.cwd())

function read(relative) {
  return fs.readFileSync(path.join(repo, relative), 'utf8')
}

function write(relative, content) {
  fs.writeFileSync(path.join(repo, relative), content, 'utf8')
  console.log(`updated ${relative}`)
}

function replaceRequired(content, search, replacement, label) {
  if (content.includes(replacement)) return content
  if (!content.includes(search)) {
    throw new Error(`Cannot patch ${label}: expected source text was not found`)
  }
  return content.replace(search, replacement)
}

function replaceRegexRequired(content, pattern, replacement, label) {
  if (pattern.test(content)) {
    return content.replace(pattern, replacement)
  }
  if (content.includes(replacement)) return content
  throw new Error(`Cannot patch ${label}: expected source block was not found`)
}

// 1. Backend config: one fixed family student selected by Render env.
{
  const file = 'backend/src/config.ts'
  let content = read(file)

  if (!content.includes('familyStudentEmail:')) {
    content = replaceRequired(
      content,
      "  nodeEnv: optional('NODE_ENV', 'development'),",
      "  nodeEnv: optional('NODE_ENV', 'development'),\n  familyStudentEmail: optional('FAMILY_STUDENT_EMAIL').toLowerCase(),",
      file,
    )
  }

  write(file, content)
}

// 2. Store: reuse the existing parent_student_links table for automatic linking.
{
  const file = 'backend/src/store.ts'
  let content = read(file)

  if (!content.includes('async linkParentToStudent(')) {
    const method = `  async linkParentToStudent(parentId: string, studentId: string) {
    if (config.useMemoryDb) {
      const children = memory.links.get(parentId) ?? new Set<string>()
      children.add(studentId)
      memory.links.set(parentId, children)
      return
    }
    await query(
      \`INSERT INTO parent_student_links(parent_user_id,student_user_id)
       VALUES($1,$2)
       ON CONFLICT(parent_user_id,student_user_id) DO NOTHING\`,
      [parentId, studentId],
    )
  },
`
    content = replaceRequired(
      content,
      '  async getSnapshot(studentId: string) {',
      `${method}  async getSnapshot(studentId: string) {`,
      file,
    )
  }

  write(file, content)
}

// 3. Server: direct family linking and disabled pairing-code flows.
{
  const file = 'backend/src/server.ts'
  let content = read(file)

  const parentOnly = "const parentOnly = [requireAuth, requireRole('parent')] as const"
  if (!content.includes('async function ensureFamilyStudentLink(')) {
    content = replaceRequired(
      content,
      parentOnly,
      `${parentOnly} async function ensureFamilyStudentLink(parentId: string): Promise<string | null> { const email = config.familyStudentEmail if (!email) return null const student = await store.findUserByEmail(email) if (!student || student.role !== 'student') return null await store.linkParentToStudent(parentId, student.id) return student.id }`,
      file,
    )
  }

  const loginNeedle =
    "const user = publicUser(stored) return res.json({ token: signToken(user), user })"
  const loginReplacement =
    "const user = publicUser(stored) if (expectedRole === 'parent') { const studentId = await ensureFamilyStudentLink(user.id) if (!studentId) return res.status(503).json({ message: '家庭学习账号尚未配置，请在 Render 设置 FAMILY_STUDENT_EMAIL' }) } return res.json({ token: signToken(user), user })"
  content = replaceRequired(content, loginNeedle, loginReplacement, `${file} parent login`)

  const pairPattern =
    /app\.post\('\/api\/student\/pair-code'[\s\S]*?\}\) const ocrQuestionSchema/
  const pairReplacement =
    "app.post('/api/student/pair-code', ...studentOnly, (_req, res) => res.status(410).json({ message: '家庭账号已自动连接，不再使用绑定码' })) const ocrQuestionSchema"
  content = replaceRegexRequired(content, pairPattern, pairReplacement, `${file} pair-code route`)

  const parentRoutesPattern =
    /app\.post\('\/api\/parent\/link'[\s\S]*?app\.use\(\(_req, res\) =>/
  const parentRoutesReplacement =
    "app.post('/api/parent/link', ...parentOnly, async (req: AuthenticatedRequest, res) => { const studentId = await ensureFamilyStudentLink(req.user!.id) if (!studentId) return res.status(503).json({ message: '家庭学习账号尚未配置，请在 Render 设置 FAMILY_STUDENT_EMAIL' }) res.json({ ok: true, studentId, automatic: true }) }) app.get('/api/parent/children', ...parentOnly, async (req: AuthenticatedRequest, res) => { const studentId = await ensureFamilyStudentLink(req.user!.id) if (!studentId) return res.status(503).json({ message: '家庭学习账号尚未配置，请在 Render 设置 FAMILY_STUDENT_EMAIL' }) res.json({ children: await store.listChildren(req.user!.id) }) }) app.get('/api/parent/children/:studentId/dashboard', ...parentOnly, async (req: AuthenticatedRequest, res) => { const studentId = await ensureFamilyStudentLink(req.user!.id) if (!studentId) return res.status(503).json({ message: '家庭学习账号尚未配置，请在 Render 设置 FAMILY_STUDENT_EMAIL' }) const row = await store.getLinkedStudent(req.user!.id, studentId) if (!row) return res.status(404).json({ message: '未找到学习账号' }) if (!row.snapshot) return res.status(409).json({ message: '学习数据尚未同步' }) res.json({ dashboard: buildParentDashboard(row.snapshot as Record, { id: row.id, email: row.email, displayName: row.displayName }) }) }) app.delete('/api/parent/children/:studentId', ...parentOnly, (_req, res) => res.status(403).json({ message: '家庭学习账号为固定连接，不能解除' })) app.use((_req, res) =>"
  content = replaceRegexRequired(
    content,
    parentRoutesPattern,
    parentRoutesReplacement,
    `${file} parent routes`,
  )

  write(file, content)
}

// 4. Environment templates.
for (const file of ['.env.example', 'backend-env.example']) {
  const absolute = path.join(repo, file)
  if (!fs.existsSync(absolute)) continue

  let content = fs.readFileSync(absolute, 'utf8')
  if (!content.includes('FAMILY_STUDENT_EMAIL=')) {
    content = `${content.trimEnd()}\nFAMILY_STUDENT_EMAIL=student@example.com\n`
    fs.writeFileSync(absolute, content, 'utf8')
    console.log(`updated ${file}`)
  }
}

console.log('')
console.log('Direct family binding patch applied.')
console.log('Set FAMILY_STUDENT_EMAIL in Render to the exact student login email.')
console.log('Then build frontend and backend before committing.')
