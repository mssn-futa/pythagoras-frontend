// PLAT-08 test helper (not a spec): intercepts every Google tag/analytics host. The gtag script is a local stub
// that turns gtag('event', ...) commands into GA4-style /g/collect hits (dl/dt/dr/en/ep.method), so specs can
// assert exactly what would be sent. It proves consent gating and payload sanitization, NOT receipt by GA4.
export const GA_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net)\//

export const GTAG_STUB = `(function () {
  var id = new URL(document.currentScript.src).searchParams.get('id');
  var dl = window.dataLayer = window.dataLayer || [];
  function hit(entry) {
    var args = Array.prototype.slice.call(entry);
    if (args[0] !== 'event' || window['ga-disable-' + id]) return;
    var p = args[2] || {};
    var q = new URLSearchParams({ v: '2', tid: id, en: args[1], dl: p.page_location || '', dt: p.page_title || '', dr: p.page_referrer || '' });
    if (p.method) q.set('ep.method', p.method);
    fetch('https://region1.google-analytics.com/g/collect?' + q.toString(), { method: 'POST', mode: 'no-cors', keepalive: true }).catch(function () {});
  }
  dl.forEach(hit);
  var push = dl.push.bind(dl);
  dl.push = function () { for (var i = 0; i < arguments.length; i += 1) hit(arguments[i]); return push.apply(null, arguments); };
})();`

/** Records every Google request; serves (or blocks) the stub tag and answers collect hits with 204. */
export async function mockGoogle(page, { blockScript = false } = {}) {
  const requests = []
  const hits = []
  page.on('request', (request) => GA_HOSTS.test(request.url()) && requests.push(request.url()))
  await page.route(GA_HOSTS, (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
      return blockScript ? route.abort('blockedbyclient') : route.fulfill({ contentType: 'text/javascript', body: GTAG_STUB })
    }
    if (url.pathname === '/g/collect') {
      hits.push(Object.fromEntries(url.searchParams))
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404 })
  })
  return { requests, hits, scripts: () => requests.filter((url) => url.includes('/gtag/js')) }
}
