import { readFileSync, existsSync, readdirSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const studentLayout = read('src/components/Layout.tsx')
const studentPortal = read('src/StudentPortal.tsx')
const parentLayout = read('src/components/ParentLayout.tsx')
const parentPortal = read('src/ParentPortal.tsx')

const navPaths = [...studentLayout.matchAll(/\{ to: '([^']+)'/g)].map((match) => match[1])
const routePaths = [...studentPortal.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1])
const parentNavPaths = [...parentLayout.matchAll(/to: '([^']+)'/g)].map((match) => match[1])
const parentRoutePaths = [...parentPortal.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1])

const missingStudent = navPaths.filter((path) => !routePaths.includes(path))
const missingParent = parentNavPaths.filter((path) => !parentRoutePaths.includes(path))
if (missingStudent.length || missingParent.length) {
  throw new Error(`Missing routes. student=${missingStudent.join(',')} parent=${missingParent.join(',')}`)
}

for (const dir of ['dist-student', 'dist-parent']) {
  if (!existsSync(`${dir}/index.html`)) throw new Error(`${dir}/index.html is missing`)
  if (!existsSync(`${dir}/_redirects`)) throw new Error(`${dir}/_redirects is missing`)
  if (!existsSync(`${dir}/_headers`)) throw new Error(`${dir}/_headers is missing`)
  const assets = readdirSync(`${dir}/assets`)
  if (!assets.some((name) => name.endsWith('.js'))) throw new Error(`${dir} has no JavaScript bundle`)
  if (!assets.some((name) => name.endsWith('.css'))) throw new Error(`${dir} has no CSS bundle`)
  const html = read(`${dir}/index.html`)
  if (!html.includes('/assets/') && !html.includes('./assets/')) throw new Error(`${dir}/index.html does not reference built assets`)
}

if (/key=\{location\.pathname\} className="route-view"/.test(studentPortal + parentPortal)) {
  throw new Error('Route view still forces full remount on every navigation')
}
if (/\.route-view\s*\{[^}]*animation/.test(read('src/App.css'))) {
  throw new Error('Route view still uses opacity animation that can leave content invisible')
}
const studentBundle = read(`dist-student/assets/${readdirSync('dist-student/assets').find((name) => name.endsWith('.js'))}`)
const parentBundle = read(`dist-parent/assets/${readdirSync('dist-parent/assets').find((name) => name.endsWith('.js'))}`)
for (const forbidden of ['家长登录', '创建家长账号', '家庭学习观察台', '绑定学生']) {
  if (studentBundle.includes(forbidden)) throw new Error(`Student bundle leaks parent content: ${forbidden}`)
}
for (const forbidden of ['拍题讲解', '试卷分析', '闯关学习', '模拟训练']) {
  if (parentBundle.includes(forbidden)) throw new Error(`Parent bundle leaks student tool: ${forbidden}`)
}

console.log(`Route verification passed: ${navPaths.length} student links, ${parentNavPaths.length} parent links, SPA assets and portal isolation are valid.`)
