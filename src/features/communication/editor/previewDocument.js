/* Builds the srcdoc for SafePreviewFrame: CSP forbidding scripts/subresources around server HTML. */
export const PREVIEW_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'";

const PREVIEW_STYLE =
  "html{color-scheme:light}body{margin:0;padding:16px;background:#fff;color:#1f2937;font:15px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;overflow-wrap:anywhere}" +
  "h2,h3{line-height:1.3;margin:1em 0 .4em}blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #d1d5db;color:#4b5563}a{color:#2a742f}";

const SECURITY_METAS =
  `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">` +
  `<meta name="referrer" content="no-referrer">` +
  `<base target="_blank">`;

/*
 * The complete document for srcdoc. `html` is server output and is placed verbatim in the sandbox.
 * A full email document (<!doctype ...>) is kept intact: the CSP/referrer/base metas go straight after
 * its opening <head> (CSP first) and the app preview style is not applied. Fragments are wrapped.
 */
export function buildPreviewDocument(html) {
  const source = String(html ?? "");
  if (/^\s*<!doctype/i.test(source)) {
    const head = /<head(?:\s[^>]*)?>/i.exec(source);
    if (head) {
      const at = head.index + head[0].length;
      return source.slice(0, at) + SECURITY_METAS + source.slice(at);
    }
    const root = /<html(?:\s[^>]*)?>/i.exec(source);
    if (root) {
      const at = root.index + root[0].length;
      return `${source.slice(0, at)}<head>${SECURITY_METAS}</head>${source.slice(at)}`;
    }
    const doctype = /^\s*<!doctype[^>]*>/i.exec(source)[0];
    return `${doctype}<html><head>${SECURITY_METAS}</head>${source.slice(doctype.length)}</html>`;
  }
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">` +
    `<style>${PREVIEW_STYLE}</style></head><body>${html}</body></html>`
  );
}
