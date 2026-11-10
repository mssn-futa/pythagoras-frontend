import { Link, useParams } from 'react-router-dom'
import { getEvent } from '../api/dawahPublicService.js'
import PlayableResource from '../components/PlayableResource.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx'
import { formatDateTime } from '../lib/format.js'
import { useRemote } from '../lib/useRemote.js'

const missing = (error) => error?.status === 404

export default function EventDetailPage() {
  const { id } = useParams()
  const { loading, data, error, reload } = useRemote(
    async () => {
      const event = await getEvent(id)
      return { event, resources: event.resources.filter((resource) => resource.type === 'aud' || resource.type === 'vid') }
    },
    `event-${id}`,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-20">
      <Link to="/dawah" className="text-sm font-medium text-[#2A742F] underline dark:text-green-400">
        Back to archive
      </Link>
      {loading && <LoadingState label="Loading event…" />}
      {error &&
        (missing(error) ? (
          <EmptyState title="Event not found">It may not exist or is not published.</EmptyState>
        ) : (
          <ErrorState error={error} onRetry={reload} title="The event could not be loaded" />
        ))}
      {data && (
        <>
          <header className="rounded-xl bg-white p-5 dark:bg-gray-800">
            <h1 className="text-2xl font-bold text-[#1F2937] dark:text-white">{data.event.title}</h1>
            <p className="mt-1 text-sm text-[#6B7280] dark:text-gray-300">
              {[formatDateTime(data.event.startTime), data.event.location, data.event.speakers].filter(Boolean).join(' · ')}
            </p>
            {data.event.summary && <p className="mt-3 font-medium text-[#374151] dark:text-gray-200">{data.event.summary}</p>}
            {data.event.description && <p className="mt-2 whitespace-pre-line text-sm text-[#374151] dark:text-gray-200">{data.event.description}</p>}
          </header>
          <section aria-labelledby="recordings-heading" className="space-y-4">
            <h2 id="recordings-heading" className="text-xl font-bold text-[#1F2937] dark:text-white">
              Recordings
            </h2>
            {data.resources.length === 0 && <EmptyState title="No recordings for this event yet" />}
            {data.resources.map((resource) => (
              <article key={resource.id} className="space-y-3 rounded-xl bg-white p-4 dark:bg-gray-800">
                <h3 className="font-semibold text-[#1F2937] dark:text-white">
                  <Link to={`/dawah/content/${resource.id}`} className="hover:underline">
                    {resource.title}
                  </Link>
                </h3>
                <PlayableResource resource={resource} />
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
