import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRules } from "../api/automationsApi.js";
import { audienceLabel } from "../model.js";
import { cardClass, EmptyState, LoadingLine, PageError, Pager, primaryButton } from "../components/common.jsx";
import { KIND_LABELS, ruleStatus, scheduleSummary } from "../automations/automationModel.js";

const PAGE_SIZE = 20;
const TONES = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  green: "bg-green-50 text-[#2A742F] dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export function RuleStatusBadge({ rule }) {
  const { label, tone } = ruleStatus(rule);
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.gray}`}>{label}</span>;
}

/** Automations tab: every rule with its real status. A saved or enabled rule is not shown as proof of a run. */
export default function AutomationsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    listRules({ page, pageSize: PAGE_SIZE }).then(
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Weekly summaries and event reminders. New rules start disabled. A rule being saved or enabled does not mean any email was sent; open a rule to see its real run history.
        </p>
        <Link to="/admin/communication/automations/new" className={primaryButton}>New rule</Link>
      </div>
      {error && <PageError error={error} onRetry={reload} />}
      {!data && !error && <LoadingLine>Loading rules…</LoadingLine>}
      {data && data.results.length === 0 && <EmptyState>No automation rules yet. Create one; it will start disabled.</EmptyState>}
      {data && data.results.length > 0 && (
        <ul className="space-y-3" aria-label="Automation rules">
          {data.results.map((rule) => (
            <li key={rule.id} className={`${cardClass} space-y-2`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/admin/communication/automations/${rule.id}`} className="break-words text-base font-semibold text-[#2A742F] underline">
                  {KIND_LABELS[rule.kind] ?? "Unknown rule type"}: {rule.template.subject || `rule #${rule.id}`}
                </Link>
                <RuleStatusBadge rule={rule} />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200">{scheduleSummary(rule)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">Audience: {audienceLabel(rule.audience)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{ruleStatus(rule).help}</p>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} label="Rules pagination" />}
    </div>
  );
}
