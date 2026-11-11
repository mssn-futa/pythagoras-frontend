export default function Pagination({ page, count, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  const style =
    'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-gray-500 dark:text-white'
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <button type="button" className={style} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-sm text-[#6B7280] dark:text-gray-300">
        Page {page} of {pages}
      </span>
      <button type="button" className={style} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  )
}
