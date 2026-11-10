import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getQuiz, getResult, listQuizResults } from "../adminQuizService.js";
import { formatLagos } from "../dates.js";
import { describeAssessmentError } from "../errors.js";
import { primaryButton, secondaryButton } from "../components/styles.js";
import { Alert, LoadingBlock, Pager, StatusBadge } from "../components/ui.jsx";
import { scoreText } from "../quizRules.js";

const PAGE_SIZE = 20;

function ResultDetail({ submissionId, onClose }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getResult(submissionId)
      .then((loaded) => active && setResult(loaded))
      .catch((failure) => active && setError(describeAssessmentError(failure).message));
    return () => {
      active = false;
    };
  }, [submissionId]);

  return (
    <aside aria-label="Result detail" className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Result detail</h2>
        <button type="button" className={secondaryButton} onClick={onClose}>
          Close
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {!result && !error && <LoadingBlock label="Loading result..." />}
      {result && (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Item label="Student" value={result.studentName || "—"} />
          <Item label="Email" value={result.studentEmail || "—"} />
          <Item label="Quiz at submission" value={result.quizTitle || "—"} />
          <Item label="Score" value={scoreText(result)} />
          <Item label="Submitted" value={formatLagos(result.submittedAt)} />
          <Item label="Graded" value={formatLagos(result.gradedAt)} />
          <Item label="Attempt" value={result.attemptId ?? "Legacy (no attempt record)"} />
        </dl>
      )}
      <p className="text-xs text-gray-500">Answer keys and per-question answers are not shown; grading is final and cannot be edited.</p>
    </aside>
  );
}

const Item = ({ label, value }) => (
  <div>
    <dt className="font-medium text-gray-500">{label}</dt>
    <dd className="text-gray-800">{value}</dd>
  </div>
);

export default function QuizResultsPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);

  const [quiz, setQuiz] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedQuiz, results] = await Promise.all([getQuiz(id), listQuizResults(id, { page, pageSize: PAGE_SIZE })]);
      setQuiz(loadedQuiz);
      setData(results);
    } catch (failure) {
      setError(describeAssessmentError(failure).message);
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-800 lg:text-3xl">Results{quiz ? `: ${quiz.title}` : ""}</h1>
          {quiz && <StatusBadge status={quiz.status} />}
        </div>
        <div className="flex gap-3">
          <Link to="/admin/quizzes" className={secondaryButton}>
            All quizzes
          </Link>
          <Link to={`/admin/quizzes/${id}`} className={primaryButton}>
            Open quiz
          </Link>
        </div>
      </div>

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
      {loading && <LoadingBlock label="Loading results..." />}

      {!loading && !error && data && data.results.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">No submissions yet.</p>
      )}

      {!loading && !error && data && data.results.length > 0 && (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Student</th>
                  <th scope="col" className="px-4 py-3 font-medium">Score (points)</th>
                  <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.results.map((result) => (
                  <tr key={result.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{result.studentName || `Student ${result.studentId ?? ""}`}</div>
                      <div className="text-xs text-gray-500">{result.studentEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{scoreText(result)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatLagos(result.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className={secondaryButton} onClick={() => setSelected(result.id)} aria-label={`View result for ${result.studentName || result.studentEmail}`}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={(next) => { setSelected(null); setParams(next > 1 ? { page: String(next) } : {}); }} />
        </>
      )}

      {selected !== null && <ResultDetail key={selected} submissionId={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
