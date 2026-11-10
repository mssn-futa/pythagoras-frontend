/**
 * Non-authoritative pre-check for the pasted link. The server is the only
 * validator/normalizer (D2); this just avoids a round trip for obvious misses
 * such as empty input or pasted iframe markup.
 */
export function youtubeLinkProblem(value) {
  const text = (value ?? "").trim();
  if (!text) return "Paste a YouTube link.";
  if (text.startsWith("<")) return "Paste the video link, not embed code.";
  return null;
}
