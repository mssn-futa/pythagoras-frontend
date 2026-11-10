import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Tailwind matches the production build so responsive layouts behave the same.
  plugins: [react(), tailwindcss()],
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
