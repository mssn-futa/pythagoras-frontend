import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listBroadcasts } from "../api/broadcastsApi.js";
import { BroadcastStateBadge, cardClass, CountsLine, EmptyState, LoadingLine, PageError, Pager, secondaryButton } from "../components/common.jsx";
import { inputClass } from "../../auth/components/FormControls.jsx";
import { ACCEPTANCE_DISCLAIMER, audienceLabel, BROADCAST_STATES, broadcastStateText, formatLagos, isOutstanding } from "../model.js";
import { usePolling } from "../usePolling.js";

const PAGE_SIZE = 20;

/** Queued and finished broadcasts with outcome counts. Polls while work is outstanding. */
export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // History never lists drafts; an unfiltered view asks for every non-draft state.
  const fetchPage = useCallback(
    () => listBroadcasts({ page, pageSize: PAGE_SIZE, states: state ? [state] : BROADCAST_STATES }),
    [page, state],
  );

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchPage().then(
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
  }, [fetchPage, attempt]);

  const refresh = async () => {
    setData(await fetchPage());
  };
  const outstanding = Boolean(data?.results.some(isOutstanding));
  const { paused, restart } = usePolling(refresh, { active: outstanding });

  return (
    <section aria-label="History" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-64">
          <label htmlFor="history-state" className="mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300">
            State
          </label>
          <select
            id="history-state"
            className={inputClass}
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {BROADCAST_STATES.map((value) => (
              <option key={value} value={value}>
                {broadcastStateText(value).label}
              </option>
            ))}
          </select>
        </div>
        {outstanding && !paused && <p className="text-xs text-gray-500">Updating automatically while messages are outstanding.</p>}
      </div>
      <p className="text-xs text-gray-500">{ACCEPTANCE_DISCLAIMER}</p>
      {paused && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Automatic updates paused.</span>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              restart();
              load();
            }}
          >
            Refresh
          </button>
        </div>
      )}
      {error && <PageError error={error} onRetry={load} />}
      {!data && !error && <LoadingLine>Loading history…</LoadingLine>}
      {data && !data.results.length && <EmptyState>No broadcasts match. Queued broadcasts appear here.</EmptyState>}
      {data && data.results.length > 0 && (
        <ul className="space-y-3">
          {data.results.map((broadcast) => (
            <li key={broadcast.id} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/admin/communication/history/${broadcast.id}`} className="break-words font-medium text-[#2A742F] underline">
                  {broadcast.subject || "(no subject)"}
                </Link>
                <BroadcastStateBadge state={broadcast.state} />
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {audienceLabel(broadcast.audience)} · Queued {formatLagos(broadcast.queuedAt)}
              </p>
              <div className="mt-2">
                <CountsLine broadcast={broadcast} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} label="History pagination" />}
    </section>
  );
}
