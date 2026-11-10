import { useRef, useState } from 'react'
import { formatClock } from '../lib/format.js'

const MEDIA_ERRORS = {
  1: 'Playback was interrupted.',
  2: 'The audio could not be loaded because of a network problem.',
  3: 'The audio file could not be decoded.',
  4: 'This audio is unavailable or its format is not supported.',
}

const SKIP_SECONDS = 15
const btn =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F] focus-visible:ring-offset-2 disabled:opacity-40'

/**
 * Accessible controller around a real HTML5 audio element. Every displayed
 * value comes from media events. Seeking assigns currentTime and relies on the
 * server answering Range requests (D2 R2 delivery); a rejected seek/playback
 * surfaces as an error instead of pretending to play.
 * Mount with key={src} so a new source starts from a clean state.
 */
export default function AudioPlayer({ src, title, durationHint = null }) {
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [seeking, setSeeking] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(null)
  const [error, setError] = useState(null)

  const media = () => audio.current
  const knownDuration = Number.isFinite(duration) ? duration : null
  const shownDuration = knownDuration ?? durationHint

  function syncDuration() {
    const value = media().duration
    if (Number.isFinite(value) && value > 0) setDuration(value)
  }

  function toggle() {
    const el = media()
    if (!el) return
    if (el.paused || el.ended) {
      setError(null)
      const attempt = el.play()
      attempt?.catch?.((reason) => {
        if (reason?.name === 'AbortError') return
        setPlaying(false)
        setError(
          reason?.name === 'NotAllowedError'
            ? 'Your browser blocked playback. Press play again.'
            : reason?.name === 'NotSupportedError'
              ? MEDIA_ERRORS[4]
              : MEDIA_ERRORS[2],
        )
      })
    } else {
      el.pause()
    }
  }

  function seekTo(seconds) {
    const el = media()
    if (!el || knownDuration === null) return
    const next = Math.min(Math.max(0, seconds), knownDuration)
    el.currentTime = next
    setCurrent(next)
  }

  function retry() {
    const el = media()
    setError(null)
    setLoading(true)
    el.load()
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4" aria-label={`Audio player: ${title}`} role="group">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadStart={() => setLoading(true)}
        onLoadedMetadata={() => {
          syncDuration()
          setLoading(false)
        }}
        onDurationChange={syncDuration}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setPlaying(true)
          setLoading(false)
          setError(null)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(media().currentTime)}
        onSeeking={() => setSeeking(true)}
        onSeeked={() => {
          setSeeking(false)
          setCurrent(media().currentTime)
        }}
        onError={() => {
          setPlaying(false)
          setLoading(false)
          setSeeking(false)
          setError(MEDIA_ERRORS[media().error?.code] ?? MEDIA_ERRORS[4])
        }}
      />

      <div className="flex items-center gap-2">
        <button type="button" className={`${btn} border border-gray-300 dark:border-gray-500 dark:text-white`} onClick={() => seekTo(current - SKIP_SECONDS)} disabled={knownDuration === null || !!error} aria-label={`Back ${SKIP_SECONDS} seconds`}>
          -{SKIP_SECONDS}s
        </button>
        <button type="button" className={`${btn} bg-[#2A742F] text-white hover:bg-[#225c26] min-w-20`} onClick={toggle} disabled={!!error} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={`${btn} border border-gray-300 dark:border-gray-500 dark:text-white`} onClick={() => seekTo(current + SKIP_SECONDS)} disabled={knownDuration === null || !!error} aria-label={`Forward ${SKIP_SECONDS} seconds`}>
          +{SKIP_SECONDS}s
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="w-14 text-right text-xs tabular-nums text-gray-600 dark:text-gray-300" aria-hidden="true">
          {formatClock(current)}
        </span>
        <input
          type="range"
          aria-label="Seek"
          className="h-6 flex-1 accent-[#2A742F]"
          min={0}
          max={knownDuration ?? 0}
          step={1}
          value={Math.min(Math.floor(current), Math.floor(knownDuration ?? 0))}
          disabled={knownDuration === null || !!error}
          aria-valuetext={`${formatClock(current)} of ${formatClock(shownDuration)}`}
          onChange={(event) => seekTo(Number(event.target.value))}
        />
        <span className="w-14 text-xs tabular-nums text-gray-600 dark:text-gray-300" aria-hidden="true">
          {formatClock(shownDuration)}
        </span>
      </div>

      <p role="status" className="mt-2 min-h-5 text-xs text-gray-600 dark:text-gray-300">
        {error ? '' : seeking ? 'Seeking…' : loading ? 'Loading audio…' : ''}
      </p>

      {error && (
        <div role="alert" className="mt-1 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          <p>{error}</p>
          <button type="button" onClick={retry} className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 dark:hover:bg-red-900">
            Retry
          </button>
        </div>
      )}

      <a href={src} download className="mt-3 inline-block text-sm font-medium text-[#2A742F] underline dark:text-green-400">
        Download audio
      </a>
    </div>
  )
}
