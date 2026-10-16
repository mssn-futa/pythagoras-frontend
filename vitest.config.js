import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: false,
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://127.0.0.1:4179/' } },
    include: ['src/**/*.test.{js,jsx}', 'tests/behavior/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    isolate: true,
  },
})
