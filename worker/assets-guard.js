// Static Assets guard (RELEASE-04). Static Assets serve real files and SPA navigations without invoking this
// Worker; it only runs for requests that matched no asset and are not browser navigations (for example a stale
// <script src="/assets/old-hash.js">). With SPA fallback on, the binding would answer such a request with
// index.html (200), which the /assets/* rule would then cache as immutable. A real file under /assets/ is never
// HTML, so an HTML answer there means "not found": return 404 instead. Everything else passes through unchanged.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/assets/') && (response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      })
    }
    return response
  },
}
