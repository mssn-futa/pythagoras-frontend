import { cardClass } from "../components/common.jsx";
import SafePreviewFrame from "../editor/SafePreviewFrame.jsx";
import { formatLagos } from "../model.js";
import { CATEGORIES, formatWindow, reasonText } from "./automationModel.js";

const categoryLabel = (token) => CATEGORIES.find(([key]) => key === token)?.[1] ?? token;

/** Non-sending preview: source summary, advisory audience count, sandboxed email and plain-text fallback. */
export default function RulePreview({ preview }) {
  const { source } = preview;
  return (
    <section aria-labelledby="rule-preview-heading" className={cardClass}>
      <h2 id="rule-preview-heading" className="text-lg font-semibold text-[#1F2937] dark:text-white">Preview (nothing is sent)</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {preview.audienceCount == null
          ? "Recipient estimate unavailable."
          : `About ${preview.audienceCount} ${preview.audienceCount === 1 ? "recipient" : "recipients"} would match today. This is an estimate; the real recipient list is fixed only when an occurrence is created.`}
      </p>
      {preview.skipReasonCode && (
        <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          With today's data this occurrence would be recorded as skipped and no email would be created.{" "}
          {reasonText(preview.skipReasonCode) ?? `Reason code: ${preview.skipReasonCode}`}
        </p>
      )}
      {source && (
        <div className="mt-4" data-testid="preview-source">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Source</p>
          {source.windowStart && source.windowEnd && <p className="text-sm">Window: {formatWindow(source.windowStart, source.windowEnd)}</p>}
          {source.events.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">No qualifying events in the source.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {source.events.map((event, index) => (
                <li key={event.id ?? index}>
                  {event.title || `Event #${event.id}`}
                  {event.category ? ` (${categoryLabel(event.category)})` : ""}
                  {event.startsAt ? `, ${formatLagos(event.startsAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Subject</p>
      <p data-testid="preview-subject" className="break-words text-[#1F2937] dark:text-white">{preview.subject}</p>
      {preview.renderedHtml && (
        <>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Email (as it would be sent)</p>
          <p className="mt-1 text-xs text-gray-500">Shown in an isolated frame: scripts, forms and external content are blocked.</p>
          <SafePreviewFrame html={preview.renderedHtml} title="Automation email preview (sandboxed)" className="mt-2" />
        </>
      )}
      {preview.renderedText != null && (
        <>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Plain-text version (fallback)</p>
          <pre data-testid="preview-body" className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-sans text-sm text-[#1F2937] dark:bg-gray-900 dark:text-gray-100">{preview.renderedText}</pre>
        </>
      )}
    </section>
  );
}
