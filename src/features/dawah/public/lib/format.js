const LAGOS = 'Africa/Lagos'
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/

function format(value, options) {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return ''
  const date = new Date(value) // ISO-8601 from the API only; never DD-MM-YYYY
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-NG', { timeZone: LAGOS, ...options }).format(date)
}

export const formatDateTime = (iso) => format(iso, { dateStyle: 'medium', timeStyle: 'short' })
export const formatDate = (iso) => format(iso, { dateStyle: 'medium' })

/** Seconds -> m:ss or h:mm:ss. Unknown/invalid -> '--:--'. */
export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function formatDurationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `${minutes} min`
}

/** Bytes -> "840 KiB" / "1.2 MiB". Unknown/invalid -> ''. */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Human label for a document, from its validated content type, else its extension. */
export function documentKindLabel(contentType, fileName) {
  if (contentType === PDF) return 'PDF document'
  if (contentType === DOCX) return 'Word document'
  const extension = /\.([A-Za-z0-9]+)$/.exec(fileName ?? '')?.[1]?.toLowerCase()
  if (extension === 'pdf') return 'PDF document'
  if (extension === 'docx') return 'Word document'
  return 'Document'
}
