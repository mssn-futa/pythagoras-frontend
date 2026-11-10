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
    <iframe
      title={title}
      data-testid="preview-frame"
      sandbox=""
      referrerPolicy="no-referrer"
      loading="eager"
      srcDoc={buildPreviewDocument(html)}
      className={`h-80 w-full rounded-lg border border-gray-200 bg-white dark:border-gray-600 ${className}`}
    />
  );
}
