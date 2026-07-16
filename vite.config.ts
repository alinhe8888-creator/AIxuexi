import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserSite = repositoryName?.toLowerCase().endsWith('.github.io')
const base = process.env.GITHUB_ACTIONS && repositoryName && !isUserSite ? `/${repositoryName}/` : '/'

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
})
