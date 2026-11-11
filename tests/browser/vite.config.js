import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PLAT-08: navigations under /ga-harness/* load the analytics harness page (the real app with a synthetic
// GA4 measurement ID); every other path keeps the default app, where analytics stays off.
const analyticsHarness = {
  name: 'pythagoras-analytics-harness',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const path = request.url?.split('?')[0] ?? ''
      if ((path === '/ga-harness' || path.startsWith('/ga-harness/')) && request.headers.accept?.includes('text/html')) {
        request.url = '/tests/browser/analytics.html'
      }
      next()
    })
  },
}

export default defineConfig({
  // Tailwind matches the production build so responsive layouts behave the same.
  plugins: [react(), tailwindcss(), analyticsHarness],
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
