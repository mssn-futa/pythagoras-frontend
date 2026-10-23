import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: false,
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 4179,
    strictPort: true,
    hmr: false,
    open: false,
  },
})
