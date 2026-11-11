import { Link, useSearchParams } from "react-router-dom";
import { listHistory } from "../api/studentAssessmentsApi.js";
import Pager from "../components/Pager.jsx";
import { EmptyState, ErrorPanel, Loading, Page } from "../components/StateBlocks.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { describeScore, formatLagos } from "../lib/format.js";
import { cardClass, headingClass, mutedClass, pageFromParams } from "../lib/ui.js";

/** /profile/results — the student's own saved results, in server ordering. */
export default function ResultsHistoryPage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParams(params);
  const { loading, data, error, reload } = useLoad(() => listHistory({ page }), `page-${page}`);

  if (loading) return <Page><Loading label="Loading your results…" /></Page>;
  if (error) return <Page><ErrorPanel error={error} onRetry={reload} title="We couldn't load your results" /></Page>;

  return (
    <Page>
      <section className={cardClass}>
        <h1 className={headingClass}>My quiz results</h1>
        <p className={`${mutedClass} mt-1`}>Saved scores from quizzes you submitted. Correct answers are not shown.</p>
      </section>
      {data.results.length === 0 ? (
        <EmptyState title="No results yet">
          You haven't submitted a quiz. <Link className="underline" to="/dawah/quizzes">See available quizzes</Link>.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.results.map((row) => (
            <li key={row.id} className={`${cardClass} !py-5`}>
              <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white break-words">{row.quizTitle || "Quiz"}</h2>
              <p className="mt-1 font-medium text-[#2A742F] dark:text-green-300">{describeScore(row)}</p>
              <p className={`${mutedClass} mt-1`}>Submitted {formatLagos(row.submittedAt)}</p>
              <Link to={`/profile/results/${row.id}`} className="mt-2 inline-block text-sm underline text-[#2A742F] dark:text-green-300" aria-label={`Open result for ${row.quizTitle || "quiz"}`}>
                Open result
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        hasNext={Boolean(data.next)}
        hasPrevious={Boolean(data.previous) || page > 1}
        onPage={(next) => setParams(next > 1 ? { page: String(next) } : {})}
      />
    </Page>
  );
}
