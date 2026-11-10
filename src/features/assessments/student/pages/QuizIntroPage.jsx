import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getQuiz, startAttempt } from "../api/studentAssessmentsApi.js";
import { ErrorPanel, Loading, Page } from "../components/StateBlocks.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { formatLagos, pluralize } from "../lib/format.js";
import { cardClass, describeAssessmentError, headingClass, mutedClass, primaryButton, secondaryButton } from "../lib/ui.js";

/** /dawah/quizzes/:id — instructions and consequences before the attempt starts. */
export default function QuizIntroPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, data: quiz, error, reload } = useLoad(() => getQuiz(id), id);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  if (loading) return <Page><Loading label="Loading quiz…" /></Page>;
  if (error) return <Page><ErrorPanel error={error} onRetry={error.status === 404 || error.status === 403 ? undefined : reload} title="We couldn't load this quiz" /></Page>;

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      // Starting twice (or retrying after a lost response) returns the same attempt.
      const attempt = await startAttempt(quiz.id);
      navigate(`/dawah/attempts/${attempt.id}`);
    } catch (caught) {
      setStartError(caught);
      setStarting(false);
    }
  };

  return (
    <Page>
      <section className={cardClass}>
        <p className={mutedClass}>Quiz instructions</p>
        <h1 className={`${headingClass} break-words`}>{quiz.title}</h1>
        {quiz.description && <p className="mt-2 text-sm text-[#4B5563] dark:text-gray-300 break-words">{quiz.description}</p>}
        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {quiz.timeLimit !== null && <Fact label="Time allowed" value={`${quiz.timeLimit} minutes`} />}
          <Fact label="Deadline" value={formatLagos(quiz.deadline)} />
          {quiz.questionCount !== null && <Fact label="Questions" value={String(quiz.questionCount)} />}
          {quiz.totalPoints !== null && <Fact label="Total points" value={pluralize(quiz.totalPoints, "point")} />}
          <Fact label="Attempts" value="One attempt only" />
        </dl>
        <h2 className="mt-6 text-base font-semibold text-[#1F2937] dark:text-white">Before you start</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-[#4B5563] dark:text-gray-300">
          <li>The timer starts the moment you press start and is kept by the server. Reloading or leaving the page does not reset or pause it.</li>
          <li>You can start only once. If you come back to a started quiz you continue the same attempt with the same end time.</li>
          <li>You answer one question at a time and confirm on a final review screen. Unanswered questions score zero.</li>
          <li>Your answers are not saved until you submit. Submit before time runs out: a submission that arrives after the end time is rejected and not graded.</li>
          <li>Questions carry different points. Your score is shown as points earned out of the total. Correct answers are not shown.</li>
        </ul>
        {startError && (
          <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
            {describeAssessmentError(startError)}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={primaryButton} onClick={start} disabled={starting}>
            {starting ? "Starting…" : startError ? "Try starting again" : "Start or continue quiz"}
          </button>
          <Link to="/dawah/quizzes" className={secondaryButton}>
            Back to quizzes
          </Link>
        </div>
      </section>
    </Page>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className={mutedClass}>{label}</dt>
      <dd className="font-medium text-[#1F2937] dark:text-white">{value}</dd>
    </div>
  );
}
