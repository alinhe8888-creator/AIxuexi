import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const port = 11000 + Math.floor(Math.random() * 1000)
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['dist/server.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    DB_MODE: 'memory',
    DATABASE_URL: '',
    JWT_SECRET: 'smoke-test-secret-at-least-32-characters',
    CORS_ORIGIN: 'https://student.example,https://parent.example',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.on('data', (chunk) => process.stdout.write(chunk))
server.stderr.on('data', (chunk) => process.stderr.write(chunk))

async function request(method, path, { token, body, expected = 200, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': `smoke-${Date.now()}-${Math.random()}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  assert.equal(response.status, expected, `${method} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`)
  assert.ok(response.headers.get('x-request-id'), `${method} ${path} did not return x-request-id`)
  return payload
}

try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await request('GET', '/api/health')
      break
    } catch (error) {
      if (attempt === 39) throw error
      await delay(100)
    }
  }

  await request('GET', '/api/health', { headers: { Origin: 'https://student.example' } })
  const deniedCors = await request('GET', '/api/health', { expected: 403, headers: { Origin: 'https://evil.example' } })
  assert.equal(deniedCors.code, 'CORS_DENIED')

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const studentEmail = `student-${suffix}@test.local`
  const parentEmail = `parent-${suffix}@test.local`
  const password = 'password123'

  const student = await request('POST', '/api/auth/student/register', {
    expected: 201,
    body: { email: studentEmail, password, displayName: '接口测试学生' },
  })
  const parent = await request('POST', '/api/auth/parent/register', {
    expected: 201,
    body: { email: parentEmail, password, displayName: '接口测试家长' },
  })
  assert.equal(student.user.role, 'student')
  assert.equal(parent.user.role, 'parent')

  await request('POST', '/api/auth/student/register', {
    expected: 409,
    body: { email: studentEmail, password, displayName: '重复账号' },
  })
  const studentLogin = await request('POST', '/api/auth/student/login', { body: { email: studentEmail, password } })
  const parentLogin = await request('POST', '/api/auth/parent/login', { body: { email: parentEmail, password } })
  assert.equal(studentLogin.user.id, student.user.id)
  assert.equal(parentLogin.user.id, parent.user.id)
  await request('POST', '/api/auth/parent/login', { expected: 403, body: { email: studentEmail, password } })
  await request('GET', '/api/auth/me', { token: student.token })
  await request('GET', '/api/auth/me', { expected: 401 })

  const snapshot = {
    version: 2,
    profile: { name: '接口测试学生', grade: '高二', selectedSubjects: ['数学'], onboarded: true },
    questions: [],
    mistakes: [{ id: 'snapshot-m1', subject: '数学', primaryCause: '计算错误', mastery: 45, wrongAt: '2026-07-17' }],
    papers: [],
    knowledgePoints: [{ id: 'kp-1', subject: '数学', name: '导数', chapter: '导数', mastery: 45, accuracy: 50, forgettingRisk: '高' }],
    reviewTasks: [],
    dailyPlans: [{ id: 'plan-1', date: new Date().toISOString().slice(0, 10), tasks: [] }],
    quizzes: [],
    cards: [],
    knowledgeItems: [],
    activityLogs: [],
    settings: {},
  }
  await request('PUT', '/api/student/snapshot', { token: student.token, body: { snapshot } })
  const storedSnapshot = await request('GET', '/api/student/snapshot', { token: student.token })
  assert.equal(storedSnapshot.snapshot.profile.name, '接口测试学生')
  await request('POST', '/api/sync/snapshot', { token: student.token, body: { snapshot } })
  await request('POST', '/api/sync/snapshot', { token: parent.token, expected: 403, body: { snapshot } })
  const report = await request('GET', '/api/reports/summary', { token: student.token })
  assert.ok(report.summary)

  const image = `data:image/png;base64,${'a'.repeat(256)}`
  const question = await request('POST', '/api/ocr/question', { token: student.token, body: { subject: '数学', imageDataUrl: image, fileName: 'question.png' } })
  assert.ok(question.content)
  assert.ok(question.knowledgePointName)
  await request('POST', '/api/ocr/question', { token: parent.token, expected: 403, body: { subject: '数学', imageDataUrl: image } })

  const paper = await request('POST', '/api/ocr/paper', { token: student.token, body: { subject: '数学', imageDataUrls: [image, image] } })
  assert.ok(Array.isArray(paper) && paper.length >= 1, 'Paper OCR returned no questions')
  await request('POST', '/api/ocr/paper', { token: student.token, expected: 400, body: { subject: '数学', imageDataUrls: [] } })

  const explanation = await request('POST', '/api/ai/explain', { token: student.token, body: { subject: '数学', content: '求函数在某点的切线方程' } })
  assert.ok(Array.isArray(explanation.steps) && explanation.steps.length > 0, 'AI explanation is invalid')
  assert.ok(explanation.instantCheck)

  const simulation = await request('POST', '/api/ai/simulation', { token: student.token, body: { subject: '数学', points: [{ id: 'kp-1', name: '导数' }], count: 3 } })
  assert.equal(simulation.length, 3, 'Simulation count is invalid')

  const knowledge = await request('GET', '/api/knowledge?subject=数学&keyword=导数', { token: student.token })
  assert.ok(Array.isArray(knowledge))

  const recordTypes = ['questions', 'mistakes', 'papers', 'knowledge-points', 'review-tasks', 'daily-plans', 'quizzes', 'cards', 'activity-logs', 'profile', 'settings']
  for (const type of recordTypes) {
    const id = `${type}-smoke-id`
    const created = await request('POST', `/api/student/records/${type}`, {
      token: student.token,
      expected: 201,
      body: { id, payload: { id, type, value: 1 } },
    })
    assert.equal(created.record.id, id)
    const listed = await request('GET', `/api/student/records/${type}`, { token: student.token })
    assert.ok(listed.records.some((record) => record.id === id), `${type} list did not include created record`)
    const single = await request('GET', `/api/student/records/${type}/${id}`, { token: student.token })
    assert.equal(single.record.payload.value, 1)
    const updated = await request('PUT', `/api/student/records/${type}/${id}`, { token: student.token, body: { payload: { id, type, value: 2 } } })
    assert.equal(updated.record.payload.value, 2)
    await request('DELETE', `/api/student/records/${type}/${id}`, { token: student.token })
    await request('GET', `/api/student/records/${type}/${id}`, { token: student.token, expected: 404 })
  }
  await request('GET', '/api/student/records/not-supported', { token: student.token, expected: 400 })

  const aliases = ['mistakes', 'papers', 'plans', 'quizzes', 'cards', 'profile']
  for (const alias of aliases) {
    const id = `alias-${alias}`
    await request('POST', `/api/${alias}`, { token: student.token, expected: 201, body: { id, payload: { id, alias } } })
    const listed = await request('GET', `/api/${alias}`, { token: student.token })
    assert.ok(listed.records.some((record) => record.id === id), `${alias} alias did not persist`)
  }

  await request('GET', '/api/parent/children', { token: student.token, expected: 403 })
  const pair = await request('POST', '/api/student/pair-code', { token: student.token, body: {} })
  assert.match(pair.code, /^\d{6}$/)
  const linked = await request('POST', '/api/parent/link', { token: parent.token, body: { code: pair.code } })
  assert.equal(linked.studentId, student.user.id)
  await request('POST', '/api/parent/link', { token: parent.token, expected: 404, body: { code: pair.code } })

  const children = await request('GET', '/api/parent/children', { token: parent.token })
  assert.ok(children.children.some((child) => child.id === student.user.id))
  const dashboard = await request('GET', `/api/parent/children/${student.user.id}/dashboard`, { token: parent.token })
  assert.equal(dashboard.dashboard.student.userId, student.user.id)
  await request('GET', `/api/parent/children/${student.user.id}/dashboard`, { token: student.token, expected: 403 })

  const stranger = await request('POST', '/api/auth/parent/register', {
    expected: 201,
    body: { email: `stranger-${suffix}@test.local`, password, displayName: '未绑定家长' },
  })
  await request('GET', `/api/parent/children/${student.user.id}/dashboard`, { token: stranger.token, expected: 404 })

  await request('DELETE', `/api/parent/children/${student.user.id}`, { token: parent.token })
  await request('GET', `/api/parent/children/${student.user.id}/dashboard`, { token: parent.token, expected: 404 })

  await request('GET', '/api/not-a-real-endpoint', { expected: 404 })

  console.log(`API smoke test passed: ${recordTypes.length} record types, ${aliases.length} aliases, auth, snapshot, OCR, AI, knowledge, reports, role guards and parent linkage are operational.`)
} finally {
  server.kill('SIGTERM')
}
