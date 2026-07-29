import assert from 'node:assert/strict'
import fs from 'node:fs'
import { textbookBooks, matchAnyBook } from '../backend/src/curriculum.ts'
import { TEXTBOOK_BOOKS, matchBookFromText } from '../src/config/curriculum.ts'
import { buildParentDashboard } from '../backend/src/summary.ts'

assert.equal(textbookBooks.length, 34, '后端固定教材目录必须为 34 册')
assert.equal(TEXTBOOK_BOOKS.length, 34, '前端固定教材目录必须为 34 册')
assert.deepEqual(
  TEXTBOOK_BOOKS.map((book) => book.id).sort(),
  textbookBooks.map((book) => book.id).sort(),
  '前后端教材目录 ID 不一致',
)

for (const book of textbookBooks) {
  assert.equal(matchAnyBook(book.title)?.id, book.id, `后端未识别正式书名：${book.title}`)
  const commonTitle = book.title.replace(/^普通高中教科书·/, '')
  assert.equal(matchAnyBook(commonTitle)?.id, book.id, `后端未识别常见文件名：${commonTitle}`)
  for (const alias of book.aliases) {
    assert.equal(
      matchAnyBook(`${book.subject} ${alias}`)?.id,
      book.id,
      `后端未识别书册别名：${book.subject} ${alias}`,
    )
  }
}

for (const book of TEXTBOOK_BOOKS) {
  assert.equal(matchBookFromText(book.subject, book.title)?.id, book.id, `前端未识别正式书名：${book.title}`)
  const commonTitle = book.title.replace(/^普通高中教科书·/, '')
  assert.equal(matchBookFromText(book.subject, commonTitle)?.id, book.id, `前端未识别常见文件名：${commonTitle}`)
  for (const alias of book.aliases) {
    assert.equal(
      matchBookFromText(book.subject, `${book.subject} ${alias}`)?.id,
      book.id,
      `前端未识别书册别名：${book.subject} ${alias}`,
    )
  }
}

for (const ambiguous of ['选择性必修第一册', '必修第二册']) {
  assert.equal(matchAnyBook(ambiguous), undefined, `无学科通用书名不应跨学科误绑定：${ambiguous}`)
}

const commonBookNames = new Map([
  ['外研版高中英语选择性必修第二册.pdf', 'english-selective-2'],
  ['人教A版数学选择性必修第二册', 'math-selective-2'],
  ['高中地理选择性必修2区域发展', 'geography-selective-2'],
  ['思想政治选择性必修2法律与生活', 'politics-selective-2'],
  ['历史选择性必修2经济与社会生活', 'history-selective-2'],
  ['语文选择性必修中册', 'chinese-selective-2'],
  ['中外历史纲要下册', 'history-required-down'],
])
for (const [fileName, expectedBookId] of commonBookNames) {
  assert.equal(matchAnyBook(fileName)?.id, expectedBookId, `后端常见文件名误识别：${fileName}`)
}

const now = new Date().toISOString()
const localDate = (timeZone) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
  const value = (type) => parts.find((item) => item.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}
const studentTimeZone = 'Asia/Tokyo'
const today = localDate(studentTimeZone)
const dashboard = buildParentDashboard({
  profile: { id: 'student-1', name: '正式学生', grade: '高二' },
  dailyPlans: [{
    date: today,
    tasks: [
      { id: 'plan-1', status: 'pending', estimatedMinutes: 20, type: 'review' },
      { id: 'plan-2', status: 'pending', estimatedMinutes: 10, type: 'quiz' },
    ],
  }],
  knowledgePoints: [],
  mistakes: [],
  quizzes: [],
  activityLogs: [],
  reviewTasks: [],
  strategyPreferences: [],
  workspace: {
    timeZone: studentTimeZone,
    studySessions: [
      { id: 'session-1', mode: 'preview', duration: 25, createdAt: now },
      { id: 'session-2', mode: 'review', duration: 15, createdAt: now },
    ],
    dailyCompletions: {
      'existing:plan-1': true,
      'session:session-1': true,
    },
  },
}, {
  id: 'student-1',
  displayName: '账号姓名',
  email: 'student@example.test',
  lastSyncedAt: now,
})

assert.deepEqual(dashboard.today, {
  completed: 2,
  total: 4,
  completionRate: 50,
  plannedMinutes: 70,
  completedMinutes: 45,
}, '家长端今日进度未按真实计划和学习周期同步')
assert.equal(dashboard.student.lastSyncedAt, now, '家长端未使用真实快照时间')
assert.equal(dashboard.dailyActivity.at(-1)?.date, today, '家长端日期趋势未使用学生端时区')
assert.equal(dashboard.overview.mastery, 0, '空数据不应生成虚构掌握度')
assert.deepEqual(dashboard.trend, [], '空数据不应生成虚构趋势')

const strongDashboard = buildParentDashboard({
  profile: { id: 'student-1', name: '正式学生', grade: '高二' },
  knowledgePoints: [{ id: 'strong-1', subject: '数学', chapter: '函数', name: '单调性', mastery: 92, accuracy: 95, errorCount: 0, forgettingRisk: '低' }],
  mistakes: [], dailyPlans: [], quizzes: [], activityLogs: [], reviewTasks: [], strategyPreferences: [],
}, { id: 'student-1', displayName: '正式学生', email: 'student@example.test', lastSyncedAt: now })
assert.deepEqual(strongDashboard.weakPoints, [], '已掌握知识点不应被列为薄弱点')
assert.deepEqual(strongDashboard.alerts, [], '已掌握知识点不应生成风险提醒')
assert.deepEqual(strongDashboard.recommendations, [], '已掌握知识点不应生成薄弱点复习建议')

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const allSource = [
  'src/services/apiClient.ts',
  'src/services/authApi.ts',
  'src/services/studentApi.ts',
  'src/services/learningApi.ts',
  'src/store/AppStore.tsx',
  'backend/src/materialRoutes.ts',
].map(read).join('\n')

for (const forbidden of ['USE_MOCK_API', 'ALLOW_API_FALLBACK', "from './mockApi'", 'mockResponse(']) {
  assert.ok(!allSource.includes(forbidden), `正式版仍包含 Mock/回退标记：${forbidden}`)
}
assert.ok(!fs.existsSync(new URL('../src/services/mockApi.ts', import.meta.url)), 'Mock 服务文件仍存在')

const materialRoutes = read('backend/src/materialRoutes.ts')
for (const required of [
  "router.patch('/materials/imports/:id/binding'",
  "router.post('/materials/imports/:id/retry'",
  "router.delete('/materials/imports/:id'",
  "router.delete('/materials'",
]) {
  assert.ok(materialRoutes.includes(required), `教材正式接口缺失：${required}`)
}
assert.ok(materialRoutes.includes('res.status(405)'), '一键清空教材接口未关闭')
assert.ok(materialRoutes.includes("throw requestError('科目与所选书册不一致')"), '教材接口未拒绝科目与书册冲突')
assert.ok(materialRoutes.includes("throw requestError('年级与所选书册不一致')"), '教材接口未拒绝年级与书册冲突')
assert.ok(materialRoutes.includes('inferredCandidate.subject === input.subject'), '文件名自动识别未校验用户选择的科目')
assert.ok(materialRoutes.includes("inferredCandidate.grade === '跨年级' || inferredCandidate.grade === input.grade"), '文件名自动识别未校验用户选择的年级')
assert.ok(!read('src/services/materialApi.ts').includes('clearAll'), '前端仍暴露一键清空教材')

const migration = read('backend/src/migrate.ts')
assert.ok(migration.includes("record_type NOT IN ('material-imports','knowledge-items')"), '清理迁移未保留教材记录')
for (const protectedTable of ['users', 'parent_student_links']) {
  assert.ok(!new RegExp(`DELETE\\s+FROM\\s+${protectedTable}`, 'i').test(migration), `清理迁移会删除 ${protectedTable}`)
}
assert.ok(!/deleteObject|R2/i.test(migration), '数据库清理迁移不应删除 R2 原文件')

const seed = read('src/data/seed.ts')
assert.ok(seed.includes("name: ''"), '空数据仍会生成测试学生姓名')
assert.ok(seed.includes("id: ''"), '空数据仍包含固定测试画像 ID')
assert.ok(!seed.includes('private-student-profile'), '空数据仍包含测试画像标识')
assert.ok(seed.includes("grade: ''"), '空数据仍会生成测试年级画像')
assert.ok(seed.includes('onboarded: false'), '空数据仍被标记为已完成画像')
assert.ok(!read('src/pages/ParentAuthPage.tsx').includes('@gmail.com'), '家长登录页仍预填测试邮箱')
assert.ok(!read('src/store/AppStore.tsx').includes("grade: '高二'"), '新知识记录仍硬编码测试年级')
assert.ok(read('src/store/AppStore.tsx').includes('id: userId'), '学生画像 ID 未绑定真实账号')
const appStore = read('src/store/AppStore.tsx')
assert.ok(appStore.includes('applyAccountIdentity(normalizeState(remote), userId, user?.displayName)'), '云端快照回填未绑定真实学生账号 ID')
assert.ok(appStore.includes('skipNextCloudPush.current = false'), '首次建立云快照后仍会跳过下一次真实同步')
assert.ok(!read('backend/src/materialAi.ts').includes("|| '高二'"), '教材知识仍使用高二作为假年级回退')

const server = read('backend/src/server.ts')
const privateRoutes = read('backend/src/privateModeRoutes.ts')
const qwenRoutes = read('backend/src/qwenLearningRoutes.ts')
const analysisRoutes = read('backend/src/studentAnalysisRoutes.ts')
for (const [routeFile, routes] of [
  [server, ['/api/auth/student/login', '/api/auth/parent/login', '/api/auth/me', '/api/student/snapshot']],
  [privateRoutes, ['/parent/children', '/parent/children/:studentId/dashboard']],
  [qwenRoutes, ['/ocr/question', '/ocr/paper', '/ai/explain', '/ai/check-answer', '/ai/grade-simulation', '/ai/simulation', '/ai/study-cycle']],
  [analysisRoutes, ['/ai/student-analysis']],
  [materialRoutes, ['/materials/status', '/materials/presign', '/materials/imports', '/materials/remote-imports', '/knowledge']],
]) {
  for (const route of routes) assert.ok(routeFile.includes(route), `前端依赖的后端接口缺失：${route}`)
}
assert.ok(server.includes("res.status(403).json({ message: '家庭自用系统已关闭注册' })"), '后端注册入口未关闭')
assert.ok(server.includes('familyParentConfigured'), '健康检查未暴露家长账号配置状态')
const backendConfig = read('backend/src/config.ts')
assert.ok(backendConfig.includes("production && dbMode !== 'postgres'"), '生产环境仍允许内存数据库')
assert.ok(backendConfig.includes("Missing environment variable: CORS_ORIGIN"), '生产环境未强制配置 CORS_ORIGIN')
assert.ok(backendConfig.includes("boundedNumber('AI_TIMEOUT_MS'"), 'AI 超时未做数值边界校验')
assert.ok(!backendConfig.includes('officialPagesOrigins'), '后端仍硬编码旧部署域名')
const r2Native = read('backend/src/r2Native.ts')
assert.ok(r2Native.includes("boundedNumber('R2_PRESIGN_SECONDS'"), 'R2 签名有效期未做数值边界校验')
assert.ok(r2Native.includes("boundedNumber('MATERIAL_MAX_ZIP_MB'"), '教材 ZIP 上限未做数值边界校验')
assert.ok(r2Native.includes('R2_ENDPOINT_HOST must be an HTTPS hostname'), 'R2 端点未做安全格式校验')

console.log('✅ 源码验证通过：34/34 教材识别、真实家长同步、正式数据清理保护、Mock/假回退关闭、绑定与重解析接口齐全、空画像无测试默认值、核心接口路由完整。')

assert.match(appStore, /clearWorkspaceData\(false\)/, '账号切换和清空数据必须避免把旧工作区误同步到新账号')
