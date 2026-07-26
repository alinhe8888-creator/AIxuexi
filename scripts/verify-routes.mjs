import fs from 'node:fs'

const requiredFiles = [
  'dist-student/index.html',
  'dist-parent/index.html',
  'src/StudentPortal.tsx',
  'src/ParentPortal.tsx',
  'src/pages/KnowledgeBasePage.tsx',
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

for (const route of [
  '/photo-explain',
  '/paper-analysis',
  '/mistakes',
  '/simulation',
  '/daily-plan',
  '/profile',
  '/knowledge',
  '/settings',
]) {
  if (!student.includes(route)) throw new Error(`学生路由缺失：${route}`)
}

if (student.includes('HomePage')) throw new Error('学生首页仍被引用')
if (student.includes('OnboardingPage')) throw new Error('引导页仍被引用')

for (const route of ['/', '/progress', '/mistakes', '/reports', '/settings']) {
  if (!parent.includes(`path="${route}"`)) throw new Error(`查看路由缺失：${route}`)
}

for (const route of [
  '/materials/status',
  '/materials/upload',
  '/materials/imports',
  '/knowledge',
]) {
  if (!material.includes(route)) throw new Error(`资料接口缺失：${route}`)
}

for (const route of ['/ocr/question', '/ocr/paper', '/ai/explain', '/ai/simulation']) {
  if (!qwen.includes(route)) throw new Error(`Qwen 接口缺失：${route}`)
}

for (const output of ['dist-student', 'dist-parent']) {
  const assets = fs.readdirSync(`${output}/assets`).filter((name) => name.endsWith('.js'))
  if (!assets.length) throw new Error(`${output} 没有 JS 构建产物`)
}

console.log('✅ 路由、资料接口、Qwen 接口和双端构建产物检查通过')
