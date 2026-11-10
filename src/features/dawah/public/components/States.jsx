const card = 'bg-white dark:bg-gray-800 rounded-xl p-6 text-center'

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div role="status" className={`${card} text-gray-600 dark:text-gray-300`}>
      {label}
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className={card}>
      <h3 className="text-lg font-semibold text-[#1F2937] dark:text-white">{title}</h3>
      {children && <p className="mt-1 text-sm text-[#6B7280] dark:text-gray-400">{children}</p>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div role="alert" className={card}>
      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">{title}</h3>
      <p className="mt-1 text-sm text-[#6B7280] dark:text-gray-400">
        {error?.status === 0 ? 'We could not reach the server. Check your connection and try again.' : error?.message || 'Please try again.'}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-[#2A742F] px-4 py-2 text-sm font-medium text-white hover:bg-[#225c26]">
          Try again
        </button>
      )}
    </div>
  )
}
