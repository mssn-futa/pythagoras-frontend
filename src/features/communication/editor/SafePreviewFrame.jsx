/*
 * Sandboxed email preview. Server-rendered HTML (rendered_html) is the ONLY thing
 * shown here, and only inside an iframe with sandbox="" (no scripts, forms, popups,
 * top navigation or same-origin access) whose srcdoc carries a CSP that forbids
 * scripts and every subresource. The HTML is never inserted into the app document.
 * Reusable by the automation UI (COMM-07).
 */
import { buildPreviewDocument } from "./previewDocument.js";

export default function SafePreviewFrame({ html, title = "Email preview", className = "" }) {
  return (
    <div className={className}>
      {/* The sandbox gives the parent no way to measure the email, so the frame is tall (up to 56rem / 80% of the
          viewport) and the email scrolls inside it when longer. */}
      <iframe
        title={title}
        data-testid="preview-frame"
        sandbox=""
        referrerPolicy="no-referrer"
        loading="eager"
        srcDoc={buildPreviewDocument(html)}
        className="h-[min(80vh,56rem)] min-h-96 w-full rounded-lg border border-gray-200 bg-white dark:border-gray-600"
      />
      <p className="mt-1 text-xs text-gray-500">Longer emails scroll inside this frame.</p>
    </div>
  );
}
