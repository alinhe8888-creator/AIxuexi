import { existsSync, readFileSync } from 'node:fs'

const required = [
  'dist/index.html',
  'dist/404.html',
  'dist/.nojekyll',
  'dist/assets',
  '.github/workflows/deploy-pages.yml',
]

const missing = required.filter((path) => !existsSync(path))
if (missing.length) {
  console.error(`Missing required deployment files:\n${missing.join('\n')}`)
  process.exit(1)
}

const html = readFileSync('dist/index.html', 'utf8')
if (!html.includes('/AIxuexi/assets/')) {
  console.error('dist/index.html does not use the /AIxuexi/ GitHub Pages base path.')
  process.exit(1)
}

console.log('Prebuilt GitHub Pages package verified successfully.')
