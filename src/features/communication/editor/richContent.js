/*
 * Pure helpers for rich content (no editor dependency, safe to import anywhere).
 *
 * The server sanitizer is authoritative (D4 "Rich text and preview contract").
 * Nothing here sanitizes HTML for rendering: client HTML is only ever fed to the
 * editor's schema, and server HTML is only ever shown inside SafePreviewFrame.
 */

/** Mirrors the server allowlist: p/br/strong/em/h2/h3/ul/ol/li/blockquote/a. */
export const ALLOWED_TAGS = Object.freeze(["p", "br", "strong", "em", "h2", "h3", "ul", "ol", "li", "blockquote", "a"]);
export const LINK_PROTOCOLS = Object.freeze(["http", "https"]);
export const MAX_LINK_LENGTH = 2000;

const hasWhitespaceOrControl = (text) => [...text].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127);

/** Link policy: absolute http/https URLs only. Returns { ok, href } or { ok:false, message }. */
export function validateLinkUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, message: "Enter a link address." };
  if (value.length > MAX_LINK_LENGTH) return { ok: false, message: `Link must be ${MAX_LINK_LENGTH} characters or fewer.` };
  if (hasWhitespaceOrControl(value)) return { ok: false, message: "A link address cannot contain spaces." };
  if (!/^https?:\/\//i.test(value)) {
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
    return {
      ok: false,
      message: scheme && !/^https?$/i.test(scheme[1]) ? "Only http:// and https:// links are allowed." : "Enter a full address starting with http:// or https://",
    };
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "Enter a valid address, for example https://example.com/page" };
  }
  if (!parsed.hostname || parsed.username || parsed.password) return { ok: false, message: "Enter a valid address, for example https://example.com/page" };
  return { ok: true, href: value };
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeText = (text) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Plain text → editor input HTML (escaped; blank line = paragraph, newline = line break). */
export function plainToHtml(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeText(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** True when the editor HTML uses anything beyond plain paragraphs/breaks (used to warn before flattening). */
export const hasRichFormatting = (html) => /<(?!\/?(?:p|br)\b)[a-z]/i.test(String(html ?? ""));
