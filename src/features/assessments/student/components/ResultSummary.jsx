import { Link } from "react-router-dom";
import { describeScore, formatLagos } from "../lib/format.js";
import { cardClass, headingClass, mutedClass, secondaryButton } from "../lib/ui.js";

/** Persisted result: score over the weighted total plus saved timestamps. No keys, no pass/fail. */
export default function ResultSummary({ result, heading = "Your result" }) {
  return (
    <section className={cardClass} aria-labelledby="result-heading">
      <p className={mutedClass}>{heading}</p>
      <h1 id="result-heading" className={`${headingClass} break-words`}>
        {result.quizTitle || "Quiz"}
      </h1>
      <p className="mt-4 text-3xl font-semibold text-[#2A742F] dark:text-green-300" data-testid="result-score">
        {describeScore(result)}
      </p>
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className={mutedClass}>Submitted</dt>
          <dd className="font-medium text-[#1F2937] dark:text-white">{formatLagos(result.submittedAt)}</dd>
        </div>
        <div>
          <dt className={mutedClass}>Graded</dt>
          <dd className="font-medium text-[#1F2937] dark:text-white">{formatLagos(result.gradedAt)}</dd>
        </div>
      </dl>
      <p className={`${mutedClass} mt-4`}>Your score is the sum of the points for the questions you answered correctly. Correct answers are not shown.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/profile/results" className={secondaryButton}>
          All my results
        </Link>
        <Link to="/dawah/quizzes" className={secondaryButton}>
          Available quizzes
        </Link>
      </div>
    </section>
  );
}
