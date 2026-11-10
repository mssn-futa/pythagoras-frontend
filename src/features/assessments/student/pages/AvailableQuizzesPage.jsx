import { Link, useSearchParams } from "react-router-dom";
import { listAvailableQuizzes } from "../api/studentAssessmentsApi.js";
import Pager from "../components/Pager.jsx";
import { EmptyState, ErrorPanel, Loading, Page } from "../components/StateBlocks.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { formatLagos, pluralize } from "../lib/format.js";
import { cardClass, headingClass, mutedClass, pageFromParams, primaryButton } from "../lib/ui.js";

/** /dawah/quizzes — quizzes the server says are open to this student. */
export default function AvailableQuizzesPage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParams(params);
  const { loading, data, error, reload } = useLoad(() => listAvailableQuizzes({ page }), `page-${page}`);

  if (loading) return <Page><Loading label="Loading quizzes…" /></Page>;
  if (error) return <Page><ErrorPanel error={error} onRetry={reload} title="We couldn't load quizzes" /></Page>;

  return (
    <Page>
      <section className={cardClass}>
        <h1 className={headingClass}>Quizzes</h1>
        <p className={`${mutedClass} mt-1`}>Timed quizzes open to you. Each quiz can be attempted once.</p>
        <p className="mt-2 text-sm">
          <Link className="underline text-[#2A742F] dark:text-green-300" to="/profile/results">
            View my results
          </Link>
        </p>
      </section>
      {data.results.length === 0 ? (
        <EmptyState title="No quizzes are open right now">Check back later. Quizzes that are closed or past their deadline are not listed.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.results.map((quiz) => (
            <li key={quiz.id} className={`${cardClass} !py-5`}>
              <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white break-words">{quiz.title}</h2>
              {quiz.description && <p className={`${mutedClass} mt-1 break-words`}>{quiz.description}</p>}
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#4B5563] dark:text-gray-300">
                {quiz.timeLimit !== null && <div>{quiz.timeLimit} minutes</div>}
                {quiz.totalPoints !== null && <div>{pluralize(quiz.totalPoints, "point")}</div>}
                <div>Closes {formatLagos(quiz.deadline)}</div>
              </dl>
              <Link to={`/dawah/quizzes/${quiz.id}`} className={`${primaryButton} mt-4`} aria-label={`View ${quiz.title}`}>
                View quiz
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
