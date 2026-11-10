import { Link } from 'react-router-dom'
import { formatDate, formatDurationLabel } from '../lib/format.js'

export default function ResourceCard({ resource }) {
  const { event } = resource
  const meta = [event?.speakers, formatDate(event?.startTime), formatDurationLabel(resource.duration)].filter(Boolean)
  return (
    <li className="rounded-xl bg-white p-4 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-[#1F2937] dark:text-white">
        <Link to={`/dawah/content/${resource.id}`} className="hover:underline">
          {resource.title}
        </Link>
      </h3>
      {event?.title && <p className="text-sm text-[#6B7280] dark:text-gray-300">{event.title}</p>}
      {meta.length > 0 && <p className="mt-1 text-sm text-[#6B7280] dark:text-gray-400">{meta.join(' · ')}</p>}
      {event?.summary && <p className="mt-2 text-sm text-[#374151] dark:text-gray-200">{event.summary}</p>}
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-[#2A742F] dark:text-green-400">
        <Link to={`/dawah/content/${resource.id}`} className="underline">
          {resource.type === 'vid' ? 'Watch' : 'Listen'}
        </Link>
        {resource.eventId != null && (
          <Link to={`/dawah/events/${resource.eventId}`} className="underline">
            Event details
          </Link>
        )}
      </div>
    </li>
  )
}
