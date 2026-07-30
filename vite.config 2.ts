import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function portalEntryPlugin(entry: string, title: string): Plugin {
  return {
    name: 'aixuexi-portal-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace('<title>知航 AI</title>', `<title>${title}</title>`)
          .replace('</body>', `    <script type="module" src="${entry}"></script>\n  </body>`)
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isParent = env.VITE_PORTAL_ROLE === 'parent'
  return {
    plugins: [
      portalEntryPlugin(isParent ? '/src/parent-main.tsx' : '/src/student-main.tsx', isParent ? '知航家长 · 家庭学习观察台' : '知航 AI · 高中学习助手'),
      react(),
    ],
    base: '/',
    build: {
      outDir: isParent ? 'dist-parent' : 'dist-student',
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 900,
    },
  }
})
