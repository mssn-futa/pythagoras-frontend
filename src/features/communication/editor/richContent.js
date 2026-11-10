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

// Any whitespace, control, format (zero-width, bidi override/isolate) or other invisible character.
const HIDDEN_OR_SPACE = /[\p{C}\p{Z}\s]/u;
const INVALID = "Enter a valid address, for example https://example.com/page";

/** Link policy: absolute http/https URLs only. Returns { ok, href } or { ok:false, message }. */
export function validateLinkUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, message: "Enter a link address." };
  if (value.length > MAX_LINK_LENGTH) return { ok: false, message: `Link must be ${MAX_LINK_LENGTH} characters or fewer.` };
  if (HIDDEN_OR_SPACE.test(value)) return { ok: false, message: "A link address cannot contain spaces or hidden characters." };
  if (!/^https?:\/\//i.test(value)) {
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
    return {
      ok: false,
      message: scheme && !/^https?$/i.test(scheme[1]) ? "Only http:// and https:// links are allowed." : "Enter a full address starting with http:// or https://",
    };
  }
  if (!/^https?:\/\/[^/?#\\]+/i.test(value)) return { ok: false, message: INVALID };
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: INVALID };
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return { ok: false, message: INVALID };
  // The normalised href (host in punycode, escaped path) is what is stored.
  return { ok: true, href: parsed.href };
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

/** True when plain → rich conversion would collapse spacing (runs of spaces, indentation, 3+ newlines, edge whitespace). */
export const plainConversionCollapsesWhitespace = (text) => /[ \t]{2,}|^[ \t]+\S|\n[ \t]+\S|\n[ \t]*\n[ \t]*\n|\s$|^\s/.test(String(text ?? "").replace(/\r\n?/g, "\n"));

/*
 * Rich document (ProseMirror JSON) → plain text, mirroring the usual email text
 * fallback: blocks separated by a blank line, list items prefixed ("- " / "1. "),
 * links flattened to "text (href)". The server's own fallback stays authoritative.
 */
function inlineText(nodes = []) {
  let out = "";
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.type === "hardBreak") out += "\n";
    else if (node.type === "text") {
      const href = node.marks?.find((mark) => mark.type === "link")?.attrs?.href;
      if (!href) out += node.text;
      else {
        let run = node.text;
        while (nodes[i + 1]?.type === "text" && nodes[i + 1].marks?.find((mark) => mark.type === "link")?.attrs?.href === href) {
          i += 1;
          run += nodes[i].text;
        }
        out += run.trim() === href ? run : `${run} (${href})`;
      }
    }
  }
  return out;
}

function blockText(node) {
  switch (node.type) {
    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => `${node.type === "orderedList" ? `${index + 1}. ` : "- "}${(item.content ?? []).map(blockText).filter(Boolean).join("\n")}`)
        .join("\n");
    case "blockquote":
      return (node.content ?? []).map(blockText).filter(Boolean).join("\n\n");
    default:
      return inlineText(node.content);
  }
}

export const docToPlainText = (doc) => (doc?.content ?? []).map(blockText).filter((text) => text.trim()).join("\n\n").trim();
