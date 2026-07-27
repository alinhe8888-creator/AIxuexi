import fs from 'node:fs'

const requiredFiles = [
  'dist-student/index.html',
  'dist-parent/index.html',
  'src/StudentPortal.tsx',
  'src/ParentPortal.tsx',
  'src/config/curriculum.ts',
  'src/pages/KnowledgeBasePage.tsx',
  'src/pages/StudyCyclePage.tsx',
  'src/pages/SimulationPage.tsx',
  'src/components/Charts.tsx',
  'src/pages/parent/ParentHomePage.tsx',
  'src/pages/parent/ParentProgressPage.tsx',
  'src/pages/parent/ParentReportsPage.tsx',
  'backend/src/curriculum.ts',
  'backend/src/materialRoutes.ts',
  'backend/src/qwenLearningRoutes.ts',
  'backend/src/studentAnalysisRoutes.ts',
]

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`缺少文件：${file}`)
}

const student = fs.readFileSync('src/StudentPortal.tsx', 'utf8')
const parent = fs.readFileSync('src/ParentPortal.tsx', 'utf8')
const material = fs.readFileSync('backend/src/materialRoutes.ts', 'utf8')
const qwen = fs.readFileSync('backend/src/qwenLearningRoutes.ts', 'utf8')
const simulation = fs.readFileSync('src/pages/SimulationPage.tsx', 'utf8')
const studyCycle = fs.readFileSync('src/pages/StudyCyclePage.tsx', 'utf8')
const charts = fs.readFileSync('src/components/Charts.tsx', 'utf8')

for (const route of [
  '/daily-plan',
  '/photo-explain',
  '/paper-analysis',
  '/mistakes',
  '/study-cycle',
  '/simulation',
  '/profile',
  '/knowledge',
  '/settings',
]) {
  if (!student.includes(route)) throw new Error(`学生路由缺失：${route}`)
}

if (student.includes('HomePage')) throw new Error('学生首页仍被引用')
if (student.includes('OnboardingPage')) throw new Error('引导页仍被引用')

for (const route of ['/', '/progress', '/mistakes', '/reports', '/settings']) {
  if (!parent.includes(`path="${route}"`)) throw new Error(`家长路由缺失：${route}`)
}

for (const route of [
  '/materials/status',
  '/materials/upload',
  '/materials/imports',
  '/materials/remote-imports',
  '/knowledge',
]) {
  if (!material.includes(route)) throw new Error(`资料接口缺失：${route}`)
}

for (const route of [
  '/ocr/question',
  '/ocr/paper',
  '/ai/explain',
  '/ai/simulation',
  '/ai/study-cycle',
]) {
  if (!qwen.includes(route)) throw new Error(`AI 接口缺失：${route}`)
}

for (const marker of ['mini', 'paper', 'sprint']) {
  if (!simulation.includes(`'${marker}'`)) throw new Error(`训练模式缺失：${marker}`)
}

for (const marker of ['bookId', 'chapter', 'customGoal']) {
  if (!studyCycle.includes(marker)) throw new Error(`教材两级选择缺失：${marker}`)
}

for (const chart of ['DonutBreakdown', 'GroupedBarChart', 'RadarChart', 'ActivityHeatmap']) {
  if (!charts.includes(`export function ${chart}`)) throw new Error(`家长图表组件缺失：${chart}`)
}

for (const output of ['dist-student', 'dist-parent']) {
  const assetsDir = `${output}/assets`
  if (!fs.existsSync(assetsDir)) throw new Error(`${output} 没有 assets 目录`)
  const assets = fs.readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
  if (!assets.length) throw new Error(`${output} 没有 JS 构建产物`)
}

console.log('✅ 双端路由、教材知识库、预习复习、三种训练、家长图表和构建产物检查通过')
