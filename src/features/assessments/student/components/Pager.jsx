import { secondaryButton } from "../lib/ui.js";

export default function Pager({ page, hasNext, hasPrevious, onPage }) {
  if (!hasNext && !hasPrevious) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <button type="button" className={secondaryButton} disabled={!hasPrevious} onClick={() => onPage(page - 1)}>
        Previous page
      </button>
      <span className="text-sm text-[#6B7280] dark:text-gray-400">Page {page}</span>
      <button type="button" className={secondaryButton} disabled={!hasNext} onClick={() => onPage(page + 1)}>
        Next page
      </button>
    </nav>
  );
}
