// PLAT-08 test helper (not a spec): intercepts every Google tag/analytics host. The gtag script is a local stub
// that turns gtag('event', ...) commands into GA4-style /g/collect hits (dl/dt/dr/en/ep.method), so specs can
// assert exactly what would be sent. It proves consent gating and payload sanitization, NOT receipt by GA4.
export const GA_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net)\//

// Like gtag.js it: processes the queued and later commands; keeps `set` page context; writes the first-party
// cookies `_ga` and `_ga_<container>` when configured (so withdrawal must really expire them); and, like enhanced
// measurement's "page changes based on browser history events", wraps history.pushState/replaceState and listens to
// popstate AFTER loading, sending `en=history_probe` with whatever page_location is set at that moment.
export const GTAG_STUB = `(function () {
  var id = new URL(document.currentScript.src).searchParams.get('id');
  var dl = window.dataLayer = window.dataLayer || [];
  var ctx = {};
  function send(en, p) {
    if (window['ga-disable-' + id]) return;
    var q = new URLSearchParams({ v: '2', tid: id, en: en, dl: p.page_location || '', dt: p.page_title || '', dr: p.page_referrer || '' });
    if (p.method) q.set('ep.method', p.method);
    fetch('https://region1.google-analytics.com/g/collect?' + q.toString(), { method: 'POST', mode: 'no-cors', keepalive: true }).catch(function () {});
  }
  function command(entry) {
    var args = Array.prototype.slice.call(entry);
    if (args[0] === 'set' && args[1] && typeof args[1] === 'object') Object.assign(ctx, args[1]);
    if (args[0] === 'config' && !window['ga-disable-' + id]) {
      document.cookie = '_ga=GA1.1.1111.2222; path=/; max-age=63072000';
      document.cookie = '_ga_' + id.slice(2) + '=GS1.1.3333; path=/; max-age=63072000';
    }
    if (args[0] === 'event') send(args[1], Object.assign({}, ctx, args[2] || {}));
  }
  dl.forEach(command);
  var push = dl.push.bind(dl);
  dl.push = function () { for (var i = 0; i < arguments.length; i += 1) command(arguments[i]); return push.apply(null, arguments); };
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      setTimeout(function () { send('history_probe', { page_location: ctx.page_location || location.href, page_title: ctx.page_title || document.title }); }, 0);
      return result;
    };
  });
  window.addEventListener('popstate', function () { send('history_probe', { page_location: ctx.page_location || location.href, page_title: ctx.page_title || document.title }); });
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
  return {
    requests,
    hits,
    scripts: () => requests.filter((url) => url.includes('/gtag/js')),
    views: () => hits.filter((hit) => hit.en === 'page_view'),
    probes: () => hits.filter((hit) => hit.en === 'history_probe'),
  }
}
