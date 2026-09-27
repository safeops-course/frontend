import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Local dev mirrors the cluster: the browser calls /api on its own origin and this proxy
    // forwards to the backend (nginx does the same in the image). The backend sends no CORS
    // headers, so a direct cross-origin call to :8080 would be blocked by the browser.
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
