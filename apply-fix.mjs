#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const targetRoot = path.resolve(process.argv[2] || process.cwd())
const patchRoot = path.join(packageDir, 'patch')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupRoot = path.join(targetRoot, `.patch-backup-v1.6-${stamp}`)

const required = [
  'package.json',
  'src/ParentPortal.tsx',
  'src/StudentPortal.tsx',
  'src/auth/AuthContext.tsx',
  'src/services/authApi.ts',
  'src/pages/ParentAuthPage.tsx',
  'src/pages/StudentAuthPage.tsx',
]

for (const relative of required) {
  if (!fs.existsSync(path.join(targetRoot, relative))) {
    console.error(`❌ 目标目录不是当前 AIxuexi 仓库根目录，缺少：${relative}`)
    process.exit(1)
  }
}

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
  if (!fs.existsSync(source)) throw new Error(`补丁缺少 patch/${relative}`)
  write(relative, fs.readFileSync(source))
}

let parentPortal = fs.readFileSync(path.join(targetRoot, 'src/ParentPortal.tsx'), 'utf8')
let studentPortal = fs.readFileSync(path.join(targetRoot, 'src/StudentPortal.tsx'), 'utf8')

// 根因修复：旧代码在认证恢复期间直接 return null，Render 冷启动时整页会保持纯白。
if (parentPortal.includes("if (status === 'loading') return null")) {
  parentPortal = parentPortal.replace(
    "if (status === 'loading') return null",
    "if (status === 'loading') return children",
  )
} else if (!parentPortal.includes("if (status === 'loading') return children")) {
  throw new Error('未找到家长端 PublicOnly 的 loading 逻辑，停止修改以避免误伤。')
}

// 家庭自用：/register 统一跳到登录，不再保留注册入口。
parentPortal = parentPortal.replace(
  /\s*<Route path="\/register" element=\{<PublicOnly><ParentAuthPage \/><\/PublicOnly>\} \/>\s*/,
  '\n      <Route path="/register" element={<Navigate to="/login" replace />} />\n',
)

studentPortal = studentPortal.replace(
  /\s*<Route path="\/register" element=\{<PublicOnly><StudentAuthPage \/><\/PublicOnly>\} \/>\s*/,
  '\n          <Route path="/register" element={<Navigate to="/login" replace />} />\n',
)

if (!parentPortal.includes('path="/register" element={<Navigate to="/login" replace />}')) {
  throw new Error('家长端注册路由替换失败。')
}
if (!studentPortal.includes('path="/register" element={<Navigate to="/login" replace />}')) {
  throw new Error('学生端注册路由替换失败。')
}

fs.mkdirSync(backupRoot, { recursive: true })
write('src/ParentPortal.tsx', parentPortal)
write('src/StudentPortal.tsx', studentPortal)
for (const relative of [
  'src/auth/AuthContext.tsx',
  'src/services/authApi.ts',
  'src/pages/ParentAuthPage.tsx',
  'src/pages/StudentAuthPage.tsx',
]) copyPatchFile(relative)

console.log(`\n🎉 V1.6 修复已应用。备份目录：${path.relative(targetRoot, backupRoot)}`)
console.log('修复内容：家长登录页不再因认证恢复而白屏；认证超时缩短；缓存身份恢复；学生/家长注册入口关闭。')
