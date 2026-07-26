#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repo = path.resolve(process.argv[2] || '.')
const bundle = path.dirname(new URL(import.meta.url).pathname)
const patchRoot = path.join(bundle, 'patch')

const required = (relative) => {
  const target = path.join(repo, relative)
  if (!fs.existsSync(target)) throw new Error(`缺少仓库文件：${relative}`)
  return target
}

required('package.json')
required('backend/package.json')
required('backend/src/server.ts')
required('src/pages/KnowledgeBasePage.tsx')

function copyTree(source, relative = '') {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const targetRelative = path.join(relative, entry.name)
    if (entry.isDirectory()) copyTree(sourcePath, targetRelative)
    else {
      const target = path.join(repo, targetRelative)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(sourcePath, target)
      console.log(`覆盖：${targetRelative}`)
    }
  }
}
copyTree(patchRoot)

const serverPath = required('backend/src/server.ts')
let server = fs.readFileSync(serverPath, 'utf8')
const importLine = "import { materialKnowledgeRouter } from './materialRoutes.js'"
if (!server.includes(importLine)) server = `${importLine}\n${server}`

const mountLine = "app.use('/api', materialKnowledgeRouter)"
if (!server.includes(mountLine)) {
  const anchor = "const studentOnly = [requireAuth, requireRole('student')] as const"
  if (!server.includes(anchor)) throw new Error('无法定位 backend/src/server.ts 中的 studentOnly')
  server = server.replace(anchor, `${anchor}\n${mountLine}`)
}
fs.writeFileSync(serverPath, server)
console.log('修改：backend/src/server.ts（挂载 ZIP 资料与知识库接口）')

console.log('\n✅ 源码已覆盖。')
console.log('请执行 npm install、npm --prefix backend install、npm run build:all、npm --prefix backend run build。')
