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
    NODE_ENV: 'test',
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
      const health = await request('GET', '/api/health')
      assert.equal(health.version, '6.0.0-production')
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
    version: 6,
    profile: {
      id: studentLogin.user.id,
      name: '接口测试学生',
      grade: '高二',
      selectedSubjects: ['数学'],
      onboarded: true,
    },
    questions: [],
    mistakes: [{
      id: 'snapshot-mistake',
      subject: '数学',
      chapter: '导数',
      knowledgePointName: '导数的应用',
      primaryCause: '解题思路错误',
      wrongAt: new Date().toISOString(),
      wrongCount: 1,
      mastery: 55,
      correction: {
        status: '已验证',
        transferPassed: true,
        triedMethodIds: ['method-guided'],
        attempts: [{ id: 'attempt-1', correct: true }],
      },
    }],
    papers: [],
    knowledgePoints: [{
      id: 'kp-dashboard',
      subject: '数学',
      chapter: '导数',
      name: '导数的应用',
      mastery: 65,
      accuracy: 70,
      errorCount: 1,
      mainCause: '解题思路错误',
      forgettingRisk: '中',
      trend: [55, 65],
    }],
    reviewTasks: [],
    dailyPlans: [{ id: 'smoke-plan', date: today, tasks: [] }],
    quizzes: [],
    cards: [],
    knowledgeItems: [],
    activityLogs: [],
    strategyPreferences: [{
      style: '启发提问',
      methodName: '先问关键条件',
      subject: '数学',
      usedCount: 2,
      successCount: 2,
      totalScore: 180,
      lastUsedAt: new Date().toISOString(),
    }],
    settings: { answerRevealAttempts: 2, adaptiveExplanation: true },
    workspace: {
      studySessions: [{ id: 'smoke-session', mode: 'preview', duration: 25, createdAt: new Date().toISOString() }],
      dailyCompletions: { 'session:smoke-session': true },
    },
  }

  await request('PUT', '/api/student/snapshot', {
    token: studentToken,
    body: { snapshot },
  })

  await request('GET', '/api/student/snapshot', { token: parentToken, expected: 403 })
  await request('GET', '/api/parent/children', { token: studentToken, expected: 403 })
  await request('GET', '/api/materials/imports', { expected: 401 })
  await request('DELETE', '/api/materials', { token: studentToken, expected: 405 })

  const childrenPayload = await request('GET', '/api/parent/children', { token: parentToken })
  const children = asArray(childrenPayload, ['children'])
  assert.ok(children.length >= 1, '家长端没有自动连接固定学生')

  const child = children[0]
  const studentId = child.id ?? studentLogin.user.id
  const dashboardPayload = await request('GET', `/api/parent/children/${studentId}/dashboard`, { token: parentToken })
  const dashboard = dashboardPayload.dashboard
  assert.ok(Array.isArray(dashboard.reviewStatus), '家长端缺少错题订正状态图表')
  assert.ok(dashboard.reviewStatus.some((item) => item.label === '已验证' && item.value >= 1), '家长端未统计已验证错题')
  assert.ok(Array.isArray(dashboard.strategyMethods) && dashboard.strategyMethods.length >= 1, '家长端缺少有效讲法图表')
  assert.equal(dashboard.today?.completed, 1, '家长端未同步学生端学习周期完成状态')
  assert.equal(dashboard.today?.completedMinutes, 25, '家长端未同步学生端真实学习时长')
  assert.ok(Date.parse(dashboard.student?.lastSyncedAt) > 0, '家长端缺少真实快照更新时间')

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
    `✅ API smoke test passed: 正式账号、固定家长绑定、真实工作区同步、自适应订正图表、快照和 ${recordTypes.length} 类学习记录均正常。`,
  )
} finally {
  server.kill('SIGTERM')
}
