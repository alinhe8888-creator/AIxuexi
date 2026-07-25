import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverPath = path.join(root, 'src/server.ts')
let source = await readFile(serverPath, 'utf8')
if (!source.includes("from './familyRoutes.js'")) source = `import { registerFamilyRoutes } from './familyRoutes.js'\n${source}`
if (!source.includes('registerFamilyRoutes(app)')) {
  const markers = ['app.use((_req, res) => res.status(404)', 'app.use((_req, res)', 'app.listen(']
  const marker = markers.find((candidate) => source.includes(candidate))
  if (!marker) throw new Error('无法定位 server.ts 的路由结束位置')
  source = source.replace(marker, `registerFamilyRoutes(app)\n${marker}`)
}
await writeFile(serverPath, source)
console.log('Family routes ready')
