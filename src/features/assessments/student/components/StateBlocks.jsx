import Spinner from "../../../auth/components/Spinner.jsx";
import { cardClass, describeAssessmentError, headingClass, secondaryButton } from "../lib/ui.js";

/** Page container matching the other student pages (fixed navbar offset). */
export function Page({ children }) {
  return <div className="space-y-6 pt-22 max-w-3xl mx-auto w-full">{children}</div>;
}

export function Loading({ label = "Loading…" }) {
  return (
    <section className={cardClass}>
      <div role="status" className="flex items-center gap-3 text-[#4B5563] dark:text-gray-300">
        <Spinner className="h-5 w-5 text-[#2A742F] dark:text-white" />
        <span>{label}</span>
      </div>
    </section>
  );
}

/** `message` overrides the quiz-oriented default wording; `children` renders extra actions (e.g. a link). */
export function ErrorPanel({ error, onRetry, title = "We couldn't load this", message, children }) {
  return (
    <section className={cardClass}>
      <h1 className={headingClass}>{title}</h1>
      <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
        {message ?? describeAssessmentError(error)}
      </p>
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${secondaryButton} mt-4`}>
          Try again
        </button>
      )}
    </section>
  );
}

export function EmptyState({ title, children }) {
  return (
    <section className={`${cardClass} text-center`}>
      <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white">{title}</h2>
      <div className="mt-2 text-sm text-[#4B5563] dark:text-gray-300">{children}</div>
    </section>
  );
}
