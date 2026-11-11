import { isCanonicalCategory } from '../../categories.js'
import { useMemo } from 'react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listArchive, listUpcomingEvents, PAGE_SIZE } from '../api/dawahPublicService.js'
import ArchiveFilters from '../components/ArchiveFilters.jsx'
import Pagination from '../components/Pagination.jsx'
import ResourceCard from '../components/ResourceCard.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx'
import EventImage from '../components/EventImage.jsx'
import { formatDateTime } from '../lib/format.js'
import { useRemote } from '../lib/useRemote.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
// Absent `type` means audio (the established default); `all` lists every visible type.
const ARCHIVE_TYPES = ['all', 'vid', 'doc']
const EMPTY = { search: '', speaker: '', category: '', dateFrom: '', dateTo: '', type: 'aud' }

/** URL query is the filter state, so reload/back/deep links keep it. */
function readFilters(params) {
  const date = (name) => (ISO_DATE.test(params.get(name) ?? '') ? params.get(name) : '')
  const page = Number.parseInt(params.get('page') ?? '1', 10)
  return {
    search: (params.get('q') ?? '').trim(),
    speaker: (params.get('speaker') ?? '').trim(),
    category: isCanonicalCategory((params.get('category') ?? '').trim()) ? params.get('category').trim() : '',
    dateFrom: date('from'),
    dateTo: date('to'),
    type: ARCHIVE_TYPES.includes(params.get('type')) ? params.get('type') : 'aud',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function toParams({ search, speaker, category, dateFrom, dateTo, type, page }) {
  const entries = { q: search, speaker, category, from: dateFrom, to: dateTo, type: ARCHIVE_TYPES.includes(type) ? type : '', page: page > 1 ? String(page) : '' }
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value))
}

function UpcomingEvents() {
  const { loading, data, error, reload } = useRemote(() => listUpcomingEvents(), 'upcoming')
  if (loading) return null
  if (error) return <ErrorState error={error} onRetry={reload} title="Upcoming events could not be loaded" />
  if (!data.results.length) return null
  return (
    <section aria-labelledby="upcoming-heading" className="rounded-xl bg-white p-4 dark:bg-gray-800">
      <h2 id="upcoming-heading" className="mb-3 text-xl font-bold text-[#1F2937] dark:text-white">
        Upcoming events
      </h2>
      <ul className="space-y-2">
        {data.results.map((event) => (
          <li key={event.id} className="space-y-2">
            <EventImage event={event} className="max-h-40 sm:max-w-sm" />
            <Link to={`/dawah/events/${event.id}`} className="font-medium text-[#2A742F] hover:underline dark:text-green-400">
              {event.title}
            </Link>
            <span className="block text-sm text-[#6B7280] dark:text-gray-400">
              {[formatDateTime(event.startTime), event.location].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ArchivePage() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const key = JSON.stringify(filters)
  const { loading, data, error, reload } = useRemote(() => listArchive(filters), key)
  // Out-of-range page is a 404 from the API: fall back to page 1 instead of a dead end.
  const pageOutOfRange = error?.status === 404 && filters.page > 1
  useEffect(() => {
    if (pageOutOfRange) setParams(toParams({ ...filters, page: 1 }), { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOutOfRange])
  const filtered = Boolean(filters.search || filters.speaker || filters.category || filters.dateFrom || filters.dateTo || filters.type !== 'aud')

  const apply = (next) => setParams(toParams({ ...next, page: 1 }))
  const goToPage = (page) => {
    setParams(toParams({ ...filters, page }))
    window.scrollTo?.({ top: 0 })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-20">
      <header>
        <h1 className="text-2xl font-bold text-[#1F2937] dark:text-white">Da’wah archive</h1>
        <p className="text-sm text-[#6B7280] dark:text-gray-300">Published khutbahs, lectures and documents. Anyone can listen, watch or read.</p>
      </header>

      <UpcomingEvents />

      <ArchiveFilters key={key} values={{ ...EMPTY, ...filters }} onApply={apply} onClear={() => setParams({})} />

      <section aria-label="Archive results">
        {(loading || pageOutOfRange) && <LoadingState label="Loading archive…" />}
        {error && !pageOutOfRange && <ErrorState error={error} onRetry={reload} title="The archive could not be loaded" />}
        {data && data.results.length === 0 && (
          <EmptyState title={filtered ? 'No matching recordings' : 'No recordings published yet'}>
            {filtered ? 'Try different filters or clear them.' : 'Check back soon.'}
          </EmptyState>
        )}
        {data && data.results.length > 0 && (
          <>
            <p className="mb-3 text-sm text-[#6B7280] dark:text-gray-300" role="status">
              {data.count} {data.count === 1 ? 'recording' : 'recordings'}
            </p>
            <ul className="space-y-4">
              {data.results.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </ul>
            <Pagination page={filters.page} count={data.count} pageSize={PAGE_SIZE} onPage={goToPage} />
          </>
        )}
      </section>
    </div>
  )
}
