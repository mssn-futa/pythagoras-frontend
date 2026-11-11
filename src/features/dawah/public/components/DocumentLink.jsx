import { safePublicUrl } from '../lib/safeUrl.js'
import { documentKindLabel, formatFileSize } from '../lib/format.js'

/**
 * Safe document download/view link. The file is NEVER rendered inline (no iframe,
 * embed, object or HTML injection): readers open the validated public https URL in
 * a new tab. `rel="noopener noreferrer"` keeps the opened file from reaching this page.
 */
export default function DocumentLink({ resource }) {
  const href = safePublicUrl(resource.mediaUrl)
  if (!href) return null
  const name = resource.fileName || resource.title || 'Document'
  const meta = [documentKindLabel(resource.contentType, resource.fileName), formatFileSize(resource.sizeBytes)].filter(Boolean)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-600 sm:flex-row sm:items-center sm:justify-between" data-testid="document-resource">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-[#1F2937] dark:text-white">{name}</p>
        <p className="text-xs text-[#6B7280] dark:text-gray-400">{meta.join(' · ')}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block shrink-0 rounded-lg border border-[#2A742F] px-4 py-2 text-center text-sm font-medium text-[#2A742F] hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-gray-700"
      >
        Open document<span className="sr-only"> {name} (opens in a new tab)</span>
      </a>
    </div>
  )
}
