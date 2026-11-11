import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FormAlert, FormNotice, inputClass } from "../../auth/components/FormControls.jsx";
import { getBroadcast, listDeliveries, retryDeliveries } from "../api/broadcastsApi.js";
import {
  BroadcastStateBadge, cardClass, CountsLine, DeliveryStateBadge, EmptyState, LoadingLine, PageError, Pager, primaryButton, secondaryButton,
} from "../components/common.jsx";
import { ACCEPTANCE_DISCLAIMER, audienceLabel, broadcastStateText, canRetryDelivery, DELIVERY_STATES, deliveryStateText, formatLagos, isOutstanding } from "../model.js";
import { usePolling } from "../usePolling.js";

const PAGE_SIZE = 20;

function ArrivalNotice({ locationState }) {
  if (locationState?.queued) {
    return <FormNotice>Queued. Delivery is pending: nothing has been sent yet, and queued content can no longer be changed.</FormNotice>;
  }
  if (locationState?.alreadyQueued) return <FormNotice>This broadcast was already queued, so it cannot be queued or edited again.</FormNotice>;
  return null;
}

function DeliveryRow({ delivery, selected, onToggle }) {
  const eligible = canRetryDelivery(delivery);
  const recipient = delivery.recipient ?? `Student #${delivery.studentId}`;
  return (
    <tr className="border-t border-gray-200 align-top dark:border-gray-700">
      <td className="py-2 pr-2">
        {eligible ? (
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#2A742F]"
            checked={selected}
            onChange={() => onToggle(delivery.id)}
            aria-label={`Select ${recipient} for retry`}
          />
        ) : null}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-sm">{recipient}</td>
      <td className="py-2 pr-3"><DeliveryStateBadge state={delivery.state} /></td>
      <td className="py-2 pr-3 text-sm">{delivery.attemptCount}</td>
      <td className="break-all py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">
        {delivery.providerEmailId ? <span className="block">Resend ID: {delivery.providerEmailId}</span> : null}
        {delivery.errorCode ? <span className="block">Error code: {delivery.errorCode}</span> : null}
        {delivery.sentAt ? <span className="block">Accepted {formatLagos(delivery.sentAt)}</span> : null}
      </td>
    </tr>
  );
}

/** Broadcast detail: frozen content, snapshot summary and per-recipient outcomes. */
export default function BroadcastDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [broadcast, setBroadcast] = useState(null);
  const [deliveries, setDeliveries] = useState(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState("");
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  const [retryNotice, setRetryNotice] = useState(null);

  const latest = useRef(0);
  const fetchAll = useCallback(async () => {
    const token = (latest.current += 1);
    const [nextBroadcast, nextDeliveries] = await Promise.all([getBroadcast(id), listDeliveries(id, { page, pageSize: PAGE_SIZE, state: state || undefined })]);
    if (token !== latest.current) return; // a newer request (filter/page change) superseded this one
    setBroadcast(nextBroadcast);
    setDeliveries(nextDeliveries);
    // Drop selections that are no longer eligible (e.g. already retried).
    const eligible = new Set(nextDeliveries.results.filter(canRetryDelivery).map((delivery) => delivery.id));
    setSelected((current) => new Set([...current].filter((value) => eligible.has(value))));
  }, [id, page, state]);

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then(
      () => !cancelled && setError(null),
      (caught) => !cancelled && setError(caught),
    );
    return () => {
      cancelled = true;
    };
  }, [fetchAll, attempt]);

  const outstanding = isOutstanding(broadcast);
  const { paused, restart } = usePolling(fetchAll, { active: outstanding });

  const toggle = (deliveryId) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deliveryId)) next.delete(deliveryId);
      else next.add(deliveryId);
      return next;
    });

  const retry = async () => {
    setRetryError(null);
    setRetryNotice(null);
    setRetrying(true);
    try {
      await retryDeliveries(id, [...selected]);
      setSelected(new Set());
      setRetryNotice("Retry requested. Selected messages are queued again; their outcome is not known yet.");
      restart();
      load();
    } catch (caught) {
      setRetryError(caught.message);
    } finally {
      setRetrying(false);
    }
  };

  if (error && !broadcast) return <PageError error={error} onRetry={load} />;
  if (!broadcast || !deliveries) return <LoadingLine>Loading broadcast…</LoadingLine>;

  const stateText = broadcastStateText(broadcast.state);
  const anyEligible = deliveries.results.some(canRetryDelivery);

  return (
    <div className="space-y-6">
      <Link to="/admin/communication/history" className="text-sm font-medium text-[#2A742F] underline">
        Back to history
      </Link>
      <ArrivalNotice locationState={location.state} />

      <section aria-labelledby="detail-title" className={`${cardClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="detail-title" className="break-words text-lg font-semibold text-[#1F2937] dark:text-white">
            {broadcast.subject}
          </h2>
          <BroadcastStateBadge state={broadcast.state} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{stateText.help}</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-medium">Audience</dt><dd>{audienceLabel(broadcast.audience)}</dd></div>
          <div><dt className="font-medium">Queued</dt><dd>{formatLagos(broadcast.queuedAt)}</dd></div>
        </dl>
        <CountsLine broadcast={broadcast} />
        <p className="text-xs text-gray-500">{ACCEPTANCE_DISCLAIMER}</p>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Frozen content (plain text)</p>
          <pre data-testid="detail-body" className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-sans text-sm text-[#1F2937] dark:bg-gray-900 dark:text-gray-100">
            {broadcast.body}
          </pre>
        </div>
        {outstanding && !paused && <p className="text-xs text-gray-500">Updating automatically while messages are outstanding.</p>}
        {paused && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>Automatic updates paused.</span>
            <button type="button" className={secondaryButton} onClick={() => { restart(); load(); }}>
              Refresh
            </button>
          </div>
        )}
        {error && <PageError error={error} onRetry={load} />}
      </section>

      <section aria-labelledby="deliveries-title" className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="deliveries-title" className="text-lg font-semibold text-[#1F2937] dark:text-white">
            Delivery outcomes
          </h2>
          <div className="sm:w-64">
            <label htmlFor="delivery-state" className="mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300">
              Outcome
            </label>
            <select
              id="delivery-state"
              className={inputClass}
              value={state}
              onChange={(event) => {
                setState(event.target.value);
                setPage(1);
                setSelected(new Set());
              }}
            >
              <option value="">All</option>
              {DELIVERY_STATES.map((value) => (
                <option key={value} value={value}>
                  {deliveryStateText(value).label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <FormNotice>{retryNotice}</FormNotice>
          <FormAlert>{retryError}</FormAlert>
        </div>
        {deliveries.results.length === 0 ? (
          <div className="mt-4"><EmptyState>No deliveries match this outcome.</EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left">
              <caption className="sr-only">Per-recipient delivery outcomes</caption>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th scope="col" className="pb-2 pr-2"><span className="sr-only">Select for retry</span></th>
                  <th scope="col" className="pb-2 pr-3">Recipient</th>
                  <th scope="col" className="pb-2 pr-3">Outcome</th>
                  <th scope="col" className="pb-2 pr-3">Attempts</th>
                  <th scope="col" className="pb-2 pr-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.results.map((delivery) => (
                  <DeliveryRow key={delivery.id} delivery={delivery} selected={selected.has(delivery.id)} onToggle={toggle} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {anyEligible && (
          <div className="mt-4">
            <button type="button" className={primaryButton} disabled={!selected.size || retrying} onClick={retry}>
              {retrying ? "Requesting retry…" : `Retry selected (${selected.size})`}
            </button>
            <p className="mt-2 text-xs text-gray-500">Only messages Resend did not accept can be retried. Accepted and uncertain messages are never resent here.</p>
          </div>
        )}
        <Pager page={page} count={deliveries.count} pageSize={PAGE_SIZE} onPage={setPage} label="Deliveries pagination" />
      </section>
    </div>
  );
}
