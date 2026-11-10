import { Link } from "react-router-dom";
import { cardClass, secondaryButton } from "../../lib/ui.js";

const COPY = {
  not_enrolled: ["You are not enrolled in this class", "Enroll to read its modules; linked quizzes are listed in each module."],
  withdrawn: ["You have withdrawn from this class", "Re-enroll to read its modules again. Your earlier quiz results stay available under My results."],
  closed: ["This class is closed", "Closed classes no longer accept enrollment and their modules are not available. Your quiz results stay available under My results."],
  unavailable: ["This class is not available", "It has not been published yet."],
};

/** Explains why module content is not shown. Never rendered together with module content. */
export default function AccessNotice({ state, classId, showClassLink = false }) {
  const copy = COPY[state];
  if (!copy) return null;
  return (
    <section className={cardClass} data-testid="access-notice">
      <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white">{copy[0]}</h2>
      <p className="mt-2 text-sm text-[#4B5563] dark:text-gray-300">{copy[1]}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {showClassLink && (
          <Link to={`/dawah/classes/${classId}`} className={secondaryButton}>
            Go to the class page
          </Link>
        )}
        <Link to="/profile/results" className={secondaryButton}>
          My results
        </Link>
      </div>
    </section>
  );
}
