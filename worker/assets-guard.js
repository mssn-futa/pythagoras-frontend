// Static Assets guard (RELEASE-04). Runs only for /assets/* (run_worker_first). With SPA fallback enabled, a
// missing fingerprinted file would otherwise come back as index.html (200) under the immutable /assets/* cache
// rule. Real assets under /assets/ are never HTML, so an HTML answer means "not found": return a 404 instead.
// Deep links and every other path are served by Static Assets directly, without this Worker.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if ((response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      })
    }
    return response
  },
}
