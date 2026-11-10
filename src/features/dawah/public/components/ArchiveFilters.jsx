import { useState } from 'react'

const EMPTY_FILTERS = { search: '', speaker: '', category: '', dateFrom: '', dateTo: '' }
const input =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2A742F] dark:border-gray-500 dark:bg-gray-700 dark:text-white'

/** Draft values are local; `onApply` receives them on submit (URL becomes the source of truth). */
export default function ArchiveFilters({ values, onApply, onClear }) {
  const [draft, setDraft] = useState(values)
  const set = (name) => (event) => setDraft((prev) => ({ ...prev, [name]: event.target.value }))
  const invalidRange = draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo // ISO dates compare lexically

  return (
    <form
      role="search"
      aria-label="Filter archive"
      className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!invalidRange) onApply(draft)
      }}
    >
      <label className="text-sm font-medium text-[#1F2937] dark:text-white lg:col-span-2">
        Search
        <input type="search" className={`${input} mt-1`} value={draft.search} onChange={set('search')} placeholder="Title, summary or tag" />
      </label>
      <label className="text-sm font-medium text-[#1F2937] dark:text-white">
        Speaker
        <input type="text" className={`${input} mt-1`} value={draft.speaker} onChange={set('speaker')} />
      </label>
      <label className="text-sm font-medium text-[#1F2937] dark:text-white">
        Category
        <input type="text" className={`${input} mt-1`} value={draft.category} onChange={set('category')} placeholder="e.g. jumuah" />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
        <label className="text-sm font-medium text-[#1F2937] dark:text-white">
          From
          <input type="date" className={`${input} mt-1`} value={draft.dateFrom} onChange={set('dateFrom')} />
        </label>
        <label className="text-sm font-medium text-[#1F2937] dark:text-white">
          To
          <input type="date" className={`${input} mt-1`} value={draft.dateTo} onChange={set('dateTo')} />
        </label>
      </div>
      {invalidRange && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400 sm:col-span-2 lg:col-span-5">
          “From” must be on or before “To”.
        </p>
      )}
      <div className="flex gap-3 sm:col-span-2 lg:col-span-5">
        <button type="submit" className="rounded-lg bg-[#2A742F] px-4 py-2 text-sm font-medium text-white hover:bg-[#225c26]">
          Apply filters
        </button>
        <button
          type="button"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-500 dark:text-white"
          onClick={() => {
            setDraft(EMPTY_FILTERS)
            onClear()
          }}
        >
          Clear
        </button>
      </div>
    </form>
  )
}
