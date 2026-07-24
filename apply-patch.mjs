#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const targetRoot = path.resolve(process.argv[2] || process.cwd())
const patchRoot = path.join(packageDir, 'patch')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupRoot = path.join(targetRoot, `.patch-backup-v1.5-${stamp}`)

const required = [
  'package.json',
  'backend/package.json',
  'backend/src/server.ts',
  'backend/src/learning.ts',
  'src/services/learningApi.ts',
]

for (const relative of required) {
  if (!fs.existsSync(path.join(targetRoot, relative))) {
    console.error(`❌ 目标目录不是 AIxuexi 仓库根目录，缺少：${relative}`)
    console.error('用法：node apply-patch.mjs /你的/AIxuexi目录')
    process.exit(1)
  }
}

const read = (relative) => fs.readFileSync(path.join(targetRoot, relative), 'utf8')
const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true })
const backup = (relative) => {
  const source = path.join(targetRoot, relative)
  if (!fs.existsSync(source)) return
  const destination = path.join(backupRoot, relative)
  ensureDir(destination)
  fs.copyFileSync(source, destination)
}
const write = (relative, content) => {
  backup(relative)
  const destination = path.join(targetRoot, relative)
  ensureDir(destination)
  fs.writeFileSync(destination, content)
  console.log(`✅ ${relative}`)
}
const copyPatchFile = (relative) => {
  const source = path.join(patchRoot, relative)
  if (!fs.existsSync(source)) throw new Error(`补丁包缺少文件：patch/${relative}`)
  write(relative, fs.readFileSync(source))
}

// 先在内存完成关键补丁校验，避免匹配失败时写入半套代码。
let server = read('backend/src/server.ts')
let learning = read('backend/src/learning.ts')
const backendPackage = JSON.parse(read('backend/package.json'))

if (!server.includes("./r2Routes.js")) {
  server = `import { mountR2Routes } from './r2Routes.js'\n${server}`
}

if (!server.includes('mountR2Routes(app, auth)')) {
  const marker = 'const ocrQuestionSchema'
  const index = server.indexOf(marker)
  if (index < 0) throw new Error('无法在 backend/src/server.ts 找到 OCR 路由位置，请确认仓库仍为 v1.4.x main。')
  server = `${server.slice(0, index)}// R2 私有文件上传、签名读取与删除\nmountR2Routes(app, auth)\n\n${server.slice(index)}`
}

if (!server.includes('REGISTRATION_DISABLED_FAMILY_ONLY')) {
  const match = server.match(/app\.post\(\s*['"]\/api\/auth\/student\/register['"]/)
  if (!match || match.index === undefined) throw new Error('无法找到学生注册路由，未能安全关闭公开注册。')
  const disabled = `// REGISTRATION_DISABLED_FAMILY_ONLY\napp.post(['/api/auth/student/register', '/api/auth/parent/register'], (_req, res) => {\n  res.status(403).json({ error: 'REGISTRATION_DISABLED', message: '本系统为家庭自用，已关闭公开注册' })\n})\n\n`
  server = `${server.slice(0, match.index)}${disabled}${server.slice(match.index)}`
}

if (!learning.includes("./aiGateway.js")) {
  if (learning.includes("import { config } from './config.js'")) {
    learning = learning.replace("import { config } from './config.js'", "import { callStructuredModel } from './aiGateway.js'")
  } else {
    learning = `import { callStructuredModel } from './aiGateway.js'\n${learning}`
  }
}

const callModelPattern = /async function callModel\([\s\S]*?export function fallbackQuestion/
if (!callModelPattern.test(learning)) {
  throw new Error('无法定位 backend/src/learning.ts 的旧模型调用函数，补丁未写入。')
}
learning = learning.replace(
  callModelPattern,
  `async function callModel(messages: unknown[], vision = false): Promise<unknown | null> {\n  return callStructuredModel(messages, vision)\n}\n\nexport function fallbackQuestion`,
)

backendPackage.dependencies ||= {}
backendPackage.dependencies['@aws-sdk/client-s3'] = '^3.862.0'
backendPackage.dependencies['@aws-sdk/s3-request-presigner'] = '^3.862.0'

fs.mkdirSync(backupRoot, { recursive: true })
write('backend/src/server.ts', server)
write('backend/src/learning.ts', learning)
write('backend/package.json', `${JSON.stringify(backendPackage, null, 2)}\n`)

for (const relative of [
  'backend/src/r2Routes.ts',
  'backend/src/aiGateway.ts',
  'src/services/storageApi.ts',
  'src/services/learningApi.ts',
  'src/services/authApi.ts',
  'src/auth/AuthContext.tsx',
  'src/parent/ParentDataContext.tsx',
  'src/pages/StudentAuthPage.tsx',
  'src/pages/ParentAuthPage.tsx',
]) copyPatchFile(relative)

const envTarget = path.join(targetRoot, 'backend/.env.r2-ai.example')
backup('backend/.env.r2-ai.example')
fs.copyFileSync(path.join(packageDir, 'backend-env.example'), envTarget)
console.log('✅ backend/.env.r2-ai.example')

console.log(`\n🎉 补丁已应用。原文件备份：${path.relative(targetRoot, backupRoot)}`)
console.log('\n下一步执行：')
console.log('  npm install')
console.log('  npm --prefix backend install')
console.log('  npm run check')
console.log('\n确认通过后再提交并推送 GitHub。')
