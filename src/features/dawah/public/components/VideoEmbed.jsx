import { safePlayback } from '../lib/youtube.js'

const HELP =
  'If the video does not play, it may be private, removed, have embedding disabled, or be blocked by your browser or network. Use “Watch on YouTube” to open it directly.'

/**
 * Reusable typed-video viewer (DAWAH-06; also for document/learning UI).
 * `playback` is the raw server object. The iframe src comes only from a
 * validated privacy-enhanced embed URL; the watch link only from a validated
 * canonical watch URL. Playback success is never inferred from the iframe.
 */
export default function VideoEmbed({ playback, title }) {
  const safe = safePlayback(playback)
  const label = title ? `${title} (YouTube video)` : 'YouTube video'
  return (
    <div className="space-y-3" data-testid="video-embed">
      {safe?.embedUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            src={safe.embedUrl}
            title={label}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            allow="fullscreen; picture-in-picture; encrypted-media"
          />
        </div>
      ) : (
        <p role="status" className="text-sm text-[#6B7280] dark:text-gray-300">
          This video is not available to play here right now.
        </p>
      )}
      {safe?.watchUrl && (
        <p>
          <a
            href={safe.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-[#2A742F] px-4 py-2 text-sm font-medium text-[#2A742F] hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-gray-700"
          >
            Watch on YouTube
          </a>
        </p>
      )}
      <p className="text-xs text-[#6B7280] dark:text-gray-400">{HELP}</p>
    </div>
  )
}
