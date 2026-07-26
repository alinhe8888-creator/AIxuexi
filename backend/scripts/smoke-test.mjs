import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const port = 11000 + Math.floor(Math.random() * 1000)
const base = `http://127.0.0.1:${port}`
const studentEmail = 'student@test.local'
const parentEmail = 'parent@test.local'
const password = 'password123'

const server = spawn(process.execPath, ['dist/server.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    DB_MODE: 'memory',
    DATABASE_URL: '',
    JWT_SECRET: 'smoke-test-secret-at-least-32-characters',
    CORS_ORIGIN: 'https://student.example,https://parent.example',
    FAMILY_STUDENT_EMAIL: studentEmail,
    PRIVATE_STUDENT_EMAIL: studentEmail,
    PRIVATE_STUDENT_PASSWORD: password,
    PRIVATE_STUDENT_NAME: '测试学生',
    PRIVATE_PARENT_EMAIL: parentEmail,
    PRIVATE_PARENT_PASSWORD: password,
    PRIVATE_PARENT_NAME: '测试家长',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.on('data', (chunk) => process.stdout.write(chunk))
server.stderr.on('data', (chunk) => process.stderr.write(chunk))

async function request(method, route, { token, body, expected = 200, headers = {} } = {}) {
  const response = await fetch(`${base}${route}`, {
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
  assert.equal(
    response.status,
    expected,
    `${method} ${route} expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`,
  )
  assert.ok(response.headers.get('x-request-id'))
  return payload
}

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await request('GET', '/api/health')
      break
    } catch (error) {
      if (attempt === 59) throw error
      await delay(100)
    }
  }

  await request('POST', '/api/auth/student/register', {
    expected: 403,
    body: { email: 'new@test.local', password, displayName: '禁止注册' },
  })

  const student = await request('POST', '/api/auth/student/login', {
    body: { email: studentEmail, password },
  })
  const parent = await request('POST', '/api/auth/parent/login', {
    body: { email: parentEmail, password },
  })

  const snapshot = {
    version: 3,
    profile: { name: '测试学生', grade: '高二', selectedSubjects: ['数学'], onboarded: true },
    questions: [],
    mistakes: [],
    papers: [],
    knowledgePoints: [],
    reviewTasks: [],
    dailyPlans: [],
    quizzes: [],
    cards: [],
    knowledgeItems: [],
    activityLogs: [],
    settings: {},
  }
  await request('PUT', '/api/student/snapshot', {
    token: student.token,
    body: { snapshot },
  })

  const children = await request('GET', '/api/parent/children', { token: parent.token })
  assert.equal(children.children.length, 1)
  assert.equal(children.children[0].email, studentEmail)

  const dashboard = await request(
    'GET',
    `/api/parent/children/${children.children[0].id}/dashboard`,
    { token: parent.token },
  )
  assert.equal(dashboard.dashboard.student.displayName, '测试学生')

  await request('POST', '/api/student/pair-code', { token: student.token, expected: 404 })

  const created = await request('POST', '/api/student/records/mistakes', {
    token: student.token,
    expected: 201,
    body: { id: 'smoke-mistake', payload: { id: 'smoke-mistake', value: 1 } },
  })
  assert.equal(created.record.id, 'smoke-mistake')

  const materialStatus = await request('GET', '/api/materials/status', { token: student.token })
  assert.equal(materialStatus.r2, false)

  const analysis = await request('GET', '/api/ai/student-analysis', { token: student.token })
  assert.equal(analysis.analysis, null)

  await request('GET', '/api/not-a-real-endpoint', { expected: 404 })
  console.log('Private-family API smoke test passed.')
} finally {
  server.kill('SIGTERM')
}
