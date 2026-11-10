import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { findResultForAttempt, getAttempt, getQuiz } from "../api/studentAssessmentsApi.js";
import QuizTaker from "../components/QuizTaker.jsx";
import ResultSummary from "../components/ResultSummary.jsx";
import { EmptyState, ErrorPanel, Loading, Page } from "../components/StateBlocks.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { cardClass, headingClass, mutedClass, secondaryButton } from "../lib/ui.js";

function ExpiredPanel() {
  return (
    <section className={cardClass} role="alert">
      <h1 className={headingClass}>Time is up</h1>
      <p className="mt-2 text-sm text-[#4B5563] dark:text-gray-300">
        This attempt expired before a submission was accepted, so it has no grade. Late submissions are not accepted and there are no retakes.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/dawah/quizzes" className={secondaryButton}>
          Back to quizzes
        </Link>
        <Link to="/profile/results" className={secondaryButton}>
          My results
        </Link>
      </div>
    </section>
  );
}

function SavedResult({ attemptId }) {
  const { loading, data, error, reload } = useLoad(() => findResultForAttempt(attemptId), attemptId);
  if (loading) return <Loading label="Loading your saved result…" />;
  if (error) return <ErrorPanel error={error} onRetry={reload} title="We couldn't load your result" />;
  if (!data) {
    return (
      <EmptyState title="Your attempt was submitted">
        We couldn't find the saved result yet. <Link className="underline" to="/profile/results">Check your results</Link> shortly.
      </EmptyState>
    );
  }
  return <ResultSummary result={data} />;
}

function InProgress({ attempt }) {
  const navigate = useNavigate();
  const [expired, setExpired] = useState(false);
  // The title is cosmetic: failing to fetch it never blocks the attempt.
  const quiz = useLoad(() => getQuiz(attempt.quizId).catch(() => null), attempt.quizId);
  if (expired) return <ExpiredPanel />;
  return (
    <QuizTaker
      attempt={attempt}
      quizTitle={attempt.quizTitle ?? quiz.data?.title ?? "Quiz"}
      onSubmitted={(result) => navigate(`/profile/results/${result.id}`, { replace: true })}
      onExpired={() => setExpired(true)}
    />
  );
}

/** /dawah/attempts/:id — always driven by the server's copy of the attempt, so reload resumes it. */
export default function AttemptPage() {
  const { id } = useParams();
  const { loading, data: attempt, error, reload } = useLoad(() => getAttempt(id), id);

  let body;
  if (loading) body = <Loading label="Loading your attempt…" />;
  else if (error) body = <ErrorPanel error={error} onRetry={error.status === 404 || error.status === 403 ? undefined : reload} title="We couldn't load this attempt" />;
  else if (attempt.status === "submitted") body = <SavedResult attemptId={attempt.id} />;
  else if (attempt.status === "expired" || !(Date.parse(attempt.expiresAt) > Date.parse(attempt.serverTime))) body = <ExpiredPanel />;
  else if (attempt.status === "in_progress") body = <InProgress attempt={attempt} />;
  else
    body = (
      <section className={cardClass}>
        <h1 className={headingClass}>Attempt unavailable</h1>
        <p className={`${mutedClass} mt-2`}>This attempt is in a state that can't be shown.</p>
      </section>
    );
  return <Page>{body}</Page>;
}
