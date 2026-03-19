import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_BACKEND_URL || 'http://127.0.0.1:8031'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/health': { target, changeOrigin: true },
        '/auth': { target, changeOrigin: true },
        '/admin': { target, changeOrigin: true },
        '/sync': { target, changeOrigin: true },
        '/recycle': { target, changeOrigin: true },
      },
    },
  }
})
