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

const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Best-effort video ID of a pasted link (watch?v=, youtu.be/, /embed/, /shorts/),
 * used only to check that a draft recovered after a lost response is the one
 * just submitted. Returns null when no ID can be read.
 */
export function guessVideoId(value) {
  let parsed;
  try {
    parsed = new URL((value ?? "").trim());
  } catch {
    return null;
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  const candidate = parsed.hostname === "youtu.be" ? parts[0] : parts[0] === "watch" ? parsed.searchParams.get("v") : ["embed", "shorts"].includes(parts[0]) ? parts[1] : null;
  return ID.test(candidate ?? "") ? candidate : null;
}
