import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listBroadcasts } from "../api/broadcastsApi.js";
import { cardClass, EmptyState, LoadingLine, PageError, Pager } from "../components/common.jsx";
import { audienceLabel, formatLagos } from "../model.js";

const PAGE_SIZE = 20;

/** Saved drafts; open one to edit. */
export default function DraftsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    listBroadcasts({ page, pageSize: PAGE_SIZE, states: ["draft"] }).then(
      (next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      },
      (caught) => !cancelled && setError(caught),
    );
    return () => {
      cancelled = true;
    };
  }, [page, attempt]);

  if (error) return <PageError error={error} onRetry={load} />;
  if (!data) return <LoadingLine>Loading drafts…</LoadingLine>;
  if (!data.results.length) return <EmptyState>No drafts yet. Compose a broadcast and save it to see it here.</EmptyState>;

  return (
    <section aria-label="Drafts">
      <ul className="space-y-3">
        {data.results.map((draft) => (
          <li key={draft.id} className={cardClass}>
            <Link to={`/admin/communication/drafts/${draft.id}`} className="break-words font-medium text-[#2A742F] underline">
              {draft.subject || "(no subject)"}
            </Link>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {audienceLabel(draft.audience)} · Last saved {formatLagos(draft.updatedAt)}
            </p>
          </li>
        ))}
      </ul>
      <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} label="Drafts pagination" />
    </section>
  );
}
