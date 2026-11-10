import { Link, useParams } from 'react-router-dom'
import { getResource } from '../api/dawahPublicService.js'
import EventImage from '../components/EventImage.jsx'
import ResourceRenderer from '../components/ResourceRenderer.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx'
import { formatDateTime } from '../lib/format.js'
import { useRemote } from '../lib/useRemote.js'

export default function ContentDetailPage() {
  const { id } = useParams()
  const { loading, data: resource, error, reload } = useRemote(() => getResource(id), `content-${id}`)
  const event = resource?.event

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-20">
      <Link to="/dawah" className="text-sm font-medium text-[#2A742F] underline dark:text-green-400">
        Back to archive
      </Link>
      {loading && <LoadingState label="Loading recording…" />}
      {error &&
        (error.status === 404 ? (
          <EmptyState title="Recording not found">It may not exist or is not published.</EmptyState>
        ) : (
          <ErrorState error={error} onRetry={reload} title="The recording could not be loaded" />
        ))}
      {resource && (
        <article className="space-y-4 rounded-xl bg-white p-5 dark:bg-gray-800">
          <header>
            <EventImage event={event} className="mb-4 max-h-72" />
            <h1 className="text-2xl font-bold text-[#1F2937] dark:text-white">{resource.title}</h1>
            {event && (
              <p className="mt-1 text-sm text-[#6B7280] dark:text-gray-300">
                <Link to={`/dawah/events/${event.id ?? resource.eventId}`} className="underline">
                  {event.title}
                </Link>
                {[event.speakers, formatDateTime(event.startTime)].filter(Boolean).map((part) => ` · ${part}`)}
              </p>
            )}
            {event?.summary && <p className="mt-3 text-sm text-[#374151] dark:text-gray-200">{event.summary}</p>}
          </header>
          <ResourceRenderer resource={resource} />
        </article>
      )}
    </div>
  )
}
