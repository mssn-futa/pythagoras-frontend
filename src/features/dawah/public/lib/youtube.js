/**
 * Defensive client-side validation of server-supplied YouTube playback metadata
 * (D0 A04, D2 "YouTube links and playback"). The server already constructs the
 * canonical URLs; the browser still refuses anything that is not exactly that
 * shape, so a bad payload can never become an arbitrary iframe src or link.
 */

export const EMBED_HOST = 'www.youtube-nocookie.com'
export const WATCH_HOST = 'www.youtube.com'
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

function parseHttps(value, host) {
  if (typeof value !== 'string') return null
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  const clean = parsed.protocol === 'https:' && parsed.hostname === host && !parsed.username && !parsed.password && !parsed.port && !parsed.hash
  return clean ? parsed : null
}

export const isVideoId = (value) => typeof value === 'string' && VIDEO_ID.test(value)

/** Returns the embed URL only for https://www.youtube-nocookie.com/embed/<id> (no query) matching `videoId`, else null. */
export function safeEmbedUrl(value, videoId) {
  const parsed = parseHttps(value, EMBED_HOST)
  if (!parsed || !isVideoId(videoId) || parsed.search) return null
  return parsed.pathname === `/embed/${videoId}` ? parsed.href : null
}

/** Returns the watch URL only for https://www.youtube.com/watch?v=<id> matching `videoId`, else null. */
export function safeWatchUrl(value, videoId) {
  const parsed = parseHttps(value, WATCH_HOST)
  if (!parsed || !isVideoId(videoId) || parsed.pathname !== '/watch') return null
  const keys = [...parsed.searchParams.keys()]
  return keys.length === 1 && parsed.searchParams.get('v') === videoId ? parsed.href : null
}

/**
 * Validates raw `playback` ({provider, video_id, watch_url, embed_url}).
 * Returns { videoId, embedUrl, watchUrl } where each URL is null when unsafe,
 * or null when there is no valid YouTube video ID at all.
 */
export function safePlayback(playback) {
  if (!playback || typeof playback !== 'object' || playback.provider !== 'youtube') return null
  const videoId = playback.video_id
  if (!isVideoId(videoId)) return null
  return {
    videoId,
    embedUrl: safeEmbedUrl(playback.embed_url, videoId),
    watchUrl: safeWatchUrl(playback.watch_url, videoId),
  }
}
