import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy: { '/api': `http://127.0.0.1:${loadEnv(mode, '..', 'PORT').PORT || '3000'}` } },
}))
