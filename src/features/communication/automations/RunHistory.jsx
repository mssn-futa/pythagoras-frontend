import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listRuns } from "../api/automationsApi.js";
import { cardClass, EmptyState, LoadingLine, PageError, Pager, secondaryButton } from "../components/common.jsx";
import { ACCEPTANCE_DISCLAIMER, COUNT_LABELS, formatLagos } from "../model.js";
import { usePolling } from "../usePolling.js";
import { formatWindow, isRunOutstanding, reasonText, runStateText } from "./automationModel.js";

const PAGE_SIZE = 20;
const TONES = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-50 text-[#2A742F] dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function RunStateBadge({ state, reasonCode }) {
  const { label, tone } = runStateText(state, reasonCode);
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.gray}`}>{label}</span>;
}

function CountsText({ run }) {
  if (!run.counts) return null;
  const parts = COUNT_LABELS.filter(([key]) => key !== "cancelled" || run.counts.cancelled > 0).map(([key, label]) => `${run.counts[key]} ${label}`);
  const total = run.recipientCount == null ? "" : `${run.recipientCount} ${run.recipientCount === 1 ? "recipient" : "recipients"}: `;
  return <span className="block text-xs text-gray-600 dark:text-gray-300">{total}{parts.join(", ")}</span>;
}

function RunRow({ run }) {
  const help = runStateText(run.state, run.reasonCode).help;
  const reason = run.reasonCode ? reasonText(run.reasonCode) : null;
  return (
    <tr className="border-t border-gray-200 align-top dark:border-gray-700" data-testid="run-row">
      <td className="break-all py-2 pr-3 font-mono text-xs">{run.occurrenceKey}</td>
      <td className="whitespace-nowrap py-2 pr-3 text-sm">{formatLagos(run.scheduledAt)}</td>
      <td className="py-2 pr-3">
        <RunStateBadge state={run.state} reasonCode={run.reasonCode} />
        <span className="mt-1 block text-xs text-gray-600 dark:text-gray-300">{help}</span>
      </td>
      <td className="py-2 pr-3 text-xs text-gray-700 dark:text-gray-200">
        {run.reasonCode ? (
          <>
            <span className="block font-medium">Reason code: {run.reasonCode}</span>
            {reason && <span className="block text-gray-600 dark:text-gray-300">{reason}</span>}
          </>
        ) : (
          "—"
        )}
        {run.source?.windowStart && run.source?.windowEnd && <span className="mt-1 block">Window: {formatWindow(run.source.windowStart, run.source.windowEnd)}</span>}
        {run.source?.event && (
          <span className="mt-1 block">
            Event: {run.source.event.title || `#${run.source.event.id}`}
            {run.source.event.startsAt ? `, starts ${formatLagos(run.source.event.startsAt)}` : ""}
            {run.source.eventRevision != null ? ` (schedule revision ${run.source.eventRevision})` : ""}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-sm">
        {run.broadcastId != null ? (
          <>
            <Link className="font-medium text-[#2A742F] underline" to={`/admin/communication/history/${run.broadcastId}`}>
              Broadcast #{run.broadcastId}
            </Link>
            <CountsText run={run} />
          </>
        ) : (
          <span className="text-xs text-gray-600 dark:text-gray-300">No broadcast was created.</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Run history for one rule: real worker-created occurrences only. Polls (bounded) while any run on the page is
 * waiting on the worker or on delivery; stops on terminal states and on unmount. Nothing is invented for
 * occurrences that have not been materialized.
 */
export default function RunHistory({ ruleId, refreshKey = 0 }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const fetchRuns = useCallback(async () => {
    const token = (latest.current += 1);
    const next = await listRuns(ruleId, { page, pageSize: PAGE_SIZE });
    if (token === latest.current) {
      setData(next);
      setError(null);
    }
  }, [ruleId, page]);

  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await fetchRuns();
      } catch (caught) {
        if (!cancelled) setError(caught);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fetchRuns, attempt, refreshKey]);

  const outstanding = Boolean(data?.results.some(isRunOutstanding));
  const { paused, restart } = usePolling(fetchRuns, { active: outstanding });

  return (
    <section aria-labelledby="runs-title" className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="runs-title" className="text-lg font-semibold text-[#1F2937] dark:text-white">Run history</h2>
        <button type="button" className={secondaryButton} onClick={() => { restart(); reload(); }}>Refresh</button>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Occurrences the worker actually created, newest first. Scheduled times are shown in Africa/Lagos. A rule that is enabled but has no runs has not produced anything yet.
      </p>
      <p className="mt-1 text-xs text-gray-500">{ACCEPTANCE_DISCLAIMER}</p>
      <div className="mt-3 space-y-3">
        {error && <PageError error={error} onRetry={reload} />}
        {outstanding && !paused && <p className="text-xs text-gray-500">Updating automatically while runs are outstanding.</p>}
        {paused && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>Automatic updates paused.</span>
            <button type="button" className={secondaryButton} onClick={() => { restart(); reload(); }}>Refresh</button>
          </div>
        )}
      </div>
      {!data && !error && <LoadingLine>Loading run history…</LoadingLine>}
      {data && data.results.length === 0 && (
        <div className="mt-3">
          <EmptyState>No runs yet. Saving or enabling a rule does not create a run by itself; runs appear when the worker materializes a due occurrence.</EmptyState>
        </div>
      )}
      {data && data.results.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <caption className="sr-only">Automation run history</caption>
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th scope="col" className="pb-2 pr-3">Occurrence</th>
                <th scope="col" className="pb-2 pr-3">Scheduled</th>
                <th scope="col" className="pb-2 pr-3">State</th>
                <th scope="col" className="pb-2 pr-3">Reason and source</th>
                <th scope="col" className="pb-2 pr-3">Broadcast</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} label="Run history pagination" />}
    </section>
  );
}
