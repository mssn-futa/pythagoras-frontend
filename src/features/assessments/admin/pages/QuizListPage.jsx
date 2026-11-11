import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { listQuizzes } from "../adminQuizService.js";
import { formatLagos } from "../dates.js";
import { describeAssessmentError } from "../errors.js";
import { primaryButton, secondaryButton } from "../components/styles.js";
import { Alert, LoadingBlock, Pager, StatusBadge } from "../components/ui.jsx";
import { STATUSES } from "../quizRules.js";

const PAGE_SIZE = 20;

export default function QuizListPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const status = STATUSES.includes(params.get("status")) ? params.get("status") : "";
  const page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const latest = useRef(0);
  const load = useCallback(async () => {
    const token = ++latest.current; // only the newest request may update the screen
    setLoading(true);
    setError(null);
    try {
      const loaded = await listQuizzes({ status, page, pageSize: PAGE_SIZE });
      if (token === latest.current) setData(loaded);
    } catch (failure) {
      if (token === latest.current) setError(describeAssessmentError(failure).message);
    } finally {
      if (token === latest.current) setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (next) => {
    const merged = { status, page: String(page), ...next };
    const search = {};
    if (merged.status) search.status = merged.status;
    if (Number(merged.page) > 1) search.page = String(merged.page);
    setParams(search);
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6 lg:p-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold text-gray-800 lg:text-3xl">Quizzes</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Status
            <select
              value={status}
              onChange={(event) => update({ status: event.target.value, page: 1 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A742F] sm:w-auto"
            >
              <option value="">All</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <Link to="/admin/quizzes/new" className={`${primaryButton} text-center`}>
            New quiz
          </Link>
        </div>
      </div>

      {location.state?.notice && <Alert tone="success">{location.state.notice}</Alert>}
      {error && (
        <Alert>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" className={secondaryButton} onClick={load}>
              Try again
            </button>
          </div>
        </Alert>
      )}

      {loading && <LoadingBlock label="Loading quizzes..." />}

      {!loading && !error && data && data.results.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          {status ? `No ${status} quizzes.` : "No quizzes yet. Create the first one."}
        </p>
      )}

      {!loading && !error && data && data.results.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.results.map((quiz) => (
              <li key={quiz.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-800">{quiz.title}</h2>
                  <StatusBadge status={quiz.status} />
                </div>
                <dl className="space-y-1 text-sm text-gray-600">
                  <div>
                    <dt className="inline font-medium">Time limit: </dt>
                    <dd className="inline">{quiz.timeLimit ? `${quiz.timeLimit} min` : "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Deadline: </dt>
                    <dd className="inline">{quiz.deadline ? formatLagos(quiz.deadline) : "Not set"}</dd>
                  </div>
                  {quiz.questionCount !== null && (
                    <div>
                      <dt className="inline font-medium">Questions: </dt>
                      <dd className="inline">{quiz.questionCount}</dd>
                    </div>
                  )}
                  {quiz.totalPoints !== null && (
                    <div>
                      <dt className="inline font-medium">Total points: </dt>
                      <dd className="inline">{quiz.totalPoints}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link to={`/admin/quizzes/${quiz.id}`} className={`${secondaryButton} flex-1 text-center`} aria-label={`${quiz.status === "draft" ? "Edit" : "Open"} ${quiz.title}`}>
                    {quiz.status === "draft" ? "Edit" : "Open"}
                  </Link>
                  {quiz.status !== "draft" && (
                    <Link to={`/admin/quizzes/${quiz.id}/results`} className={`${primaryButton} flex-1 text-center`} aria-label={`Results for ${quiz.title}`}>
                      Results
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={(next) => update({ page: next })} />
        </>
      )}
    </section>
  );
}
