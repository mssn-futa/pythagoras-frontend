import { useState } from 'react'

/**
 * Event featured image: public https URL only (validated in the service), real
 * alt text, lazy-loaded inside a fixed-ratio box so it never shifts the layout.
 * A failed load removes the image rather than showing a broken icon.
 */
export default function EventImage({ event, className = '' }) {
  const src = event?.featuredImageUrl
  const [failed, setFailed] = useState(null)
  if (!src || failed === src) return null
  const alt = event.featuredImageAlt || `Featured image for ${event.title || 'this event'}`
  return (
    <div className={`aspect-[16/9] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 ${className}`} data-testid="event-image">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setFailed(src)}
      />
    </div>
  )
}
