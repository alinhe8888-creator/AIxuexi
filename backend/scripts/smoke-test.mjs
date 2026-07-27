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

    // 家庭私有模式：同时提供常见变量名，兼容当前 legacy 后端。
    FAMILY_STUDENT_EMAIL: studentEmail,
    FAMILY_STUDENT_PASSWORD: password,
    FAMILY_STUDENT_NAME: '接口测试学生',
    FAMILY_PARENT_EMAIL: parentEmail,
    FAMILY_PARENT_PASSWORD: password,
    FAMILY_PARENT_NAME: '接口测试家长',
    PRIVATE_STUDENT_EMAIL: studentEmail,
    PRIVATE_STUDENT_PASSWORD: password,
    PRIVATE_PARENT_EMAIL: parentEmail,
    PRIVATE_PARENT_PASSWORD: password,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

server.stdout.on('data', (chunk) => process.stdout.write(chunk))
server.stderr.on('data', (chunk) => process.stderr.write(chunk))

async function rawRequest(method, path, { token, body, headers = {} } = {}) {
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
  assert.ok(response.headers.get('x-request-id'), `${method} ${path} 未返回 x-request-id`)
  return { status: response.status, payload }
}

async function request(method, path, { token, body, expected = 200, headers = {} } = {}) {
  const result = await rawRequest(method, path, { token, body, headers })
  assert.equal(
    result.status,
    expected,
    `${method} ${path} 预期 ${expected}，实际 ${result.status}: ${JSON.stringify(result.payload)}`,
  )
  return result.payload
}

async function requestFirst(method, paths, options = {}) {
  let last = null
  for (const path of paths) {
    const result = await rawRequest(method, path, options)
    last = { ...result, path }
    if (result.status !== 404) return last
  }
  return last
}

function asArray(payload, keys) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await request('GET', '/api/health')
      break
    } catch (error) {
      if (attempt === 49) throw error
      await delay(100)
    }
  }

  // 私人家庭系统不允许公开注册。
  await request('POST', '/api/auth/student/register', {
    expected: 403,
    body: { email: 'new-student@test.local', password, displayName: '不应注册' },
  })

  const studentLogin = await request('POST', '/api/auth/student/login', {
    body: { email: studentEmail, password },
  })
  const parentLogin = await request('POST', '/api/auth/parent/login', {
    body: { email: parentEmail, password },
  })

  assert.equal(studentLogin.user?.role, 'student')
  assert.equal(parentLogin.user?.role, 'parent')
  assert.ok(studentLogin.token)
  assert.ok(parentLogin.token)

  const studentToken = studentLogin.token
  const parentToken = parentLogin.token
  const today = new Date().toISOString().slice(0, 10)

  const snapshot = {
    version: 2,
    profile: {
      id: studentLogin.user.id,
      name: '接口测试学生',
      grade: '高二',
      selectedSubjects: ['数学'],
      onboarded: true,
    },
    questions: [],
    mistakes: [],
    papers: [],
    knowledgePoints: [],
    reviewTasks: [],
    dailyPlans: [{ id: 'smoke-plan', date: today, tasks: [] }],
    quizzes: [],
    cards: [],
    knowledgeItems: [],
    activityLogs: [],
    settings: {},
  }

  await request('PUT', '/api/student/snapshot', {
    token: studentToken,
    body: { snapshot },
  })

  // 家长端兼容 legacy 的 /parent/... 和新版 /api/parent/... 路径。
  const childrenResult = await requestFirst(
    'GET',
    ['/parent/children', '/api/parent/children'],
    { token: parentToken },
  )
  assert.equal(childrenResult.status, 200, `家长学生列表失败: ${JSON.stringify(childrenResult.payload)}`)
  const children = asArray(childrenResult.payload, ['children', 'students'])
  assert.ok(children.length >= 1, '家长端没有自动连接固定学生')

  const child = children[0]
  const studentId = child.id ?? child.studentId ?? child.userId ?? studentLogin.user.id
  const dashboardResult = await requestFirst(
    'GET',
    [
      `/parent/children/${studentId}/dashboard`,
      `/api/parent/children/${studentId}/dashboard`,
    ],
    { token: parentToken },
  )
  assert.equal(dashboardResult.status, 200, `家长仪表盘失败: ${JSON.stringify(dashboardResult.payload)}`)

  // 私人固定绑定模式已删除 6 位绑定码，404 属于正确行为。
  await request('POST', '/api/student/pair-code', {
    token: studentToken,
    expected: 404,
    body: {},
  })

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
  ]

  for (const type of recordTypes) {
    const id = `smoke-${type}`
    const payload = type === 'mistakes'
      ? {
          id,
          questionId: 'smoke-question',
          subject: '数学',
          chapter: '导数',
          knowledgePointId: 'kp-smoke',
          knowledgePointName: '导数',
          originalQuestion: '求函数在某点的切线方程',
          studentAnswer: '',
          correctAnswer: '测试答案',
          wrongAt: today,
          wrongCount: 1,
          primaryCause: '计算错误',
          mastery: 40,
          masteryLevel: '薄弱',
          nextReviewAt: today,
          sourceType: 'user_upload',
          archived: false,
        }
      : { id, type, value: 1 }

    const created = await request('POST', `/api/student/records/${type}`, {
      token: studentToken,
      expected: 201,
      body: { id, payload },
    })
    assert.equal(created.record?.id, id)

    // archived 在前端类型中本来就是可选字段；未返回时等价于 false。
    if (type === 'mistakes') {
      assert.equal(created.record?.payload?.archived ?? false, false)
    }

    const listed = await request('GET', `/api/student/records/${type}`, {
      token: studentToken,
    })
    const records = asArray(listed, ['records', 'items'])
    assert.ok(records.some((record) => record.id === id), `${type} 列表未包含刚创建的记录`)

    const single = await request('GET', `/api/student/records/${type}/${id}`, {
      token: studentToken,
    })
    assert.equal(single.record?.id, id)

    const updatedPayload = { ...payload, value: 2 }
    const updated = await request('PUT', `/api/student/records/${type}/${id}`, {
      token: studentToken,
      body: { payload: updatedPayload },
    })
    assert.equal(updated.record?.id, id)

    await request('DELETE', `/api/student/records/${type}/${id}`, {
      token: studentToken,
    })
    await request('GET', `/api/student/records/${type}/${id}`, {
      token: studentToken,
      expected: 404,
    })
  }

  await request('GET', '/api/student/records/not-supported', {
    token: studentToken,
    expected: 400,
  })
  await request('GET', '/api/not-a-real-endpoint', { expected: 404 })

  console.log(
    `✅ API smoke test passed: 私人账号、固定家长绑定、快照和 ${recordTypes.length} 类学习记录均正常。`,
  )
} finally {
  server.kill('SIGTERM')
}
