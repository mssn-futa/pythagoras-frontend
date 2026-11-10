import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildSubmitPayload, findResultForAttempt, isUncertainOutcome, submitAttempt } from "../api/studentAssessmentsApi.js";
import { createServerClock } from "../lib/serverClock.js";
import { pluralize } from "../lib/format.js";
import { cardClass, describeAssessmentError, headingClass, mutedClass, primaryButton, secondaryButton } from "../lib/ui.js";
import Countdown from "./Countdown.jsx";

/**
 * Separate read/taking component (not the admin question editor). Answers live
 * in memory only; the final payload is frozen at the first submit so a transport
 * retry replays the identical request instead of whatever is on screen.
 */
export default function QuizTaker({ attempt, quizTitle, onSubmitted, onExpired }) {
  const { questions } = attempt;
  const [clock] = useState(() => createServerClock(attempt.serverTime, attempt.expiresAt));
  const [remaining, setRemaining] = useState(() => clock.remainingMs());
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0); // 0..n-1 questions, n = review/confirm
  const [phase, setPhase] = useState({ name: "idle" });
  const frozen = useRef(null);
  const reviewStep = questions.length;
  const locked = phase.name === "submitting" || phase.name === "uncertain" || phase.name === "conflict";

  const send = async (payload) => {
    setPhase({ name: "submitting" });
    try {
      onSubmitted(await submitAttempt(payload));
    } catch (error) {
      if (error.code === "ATTEMPT_EXPIRED") {
        onExpired();
      } else if (error.code === "SUBMISSION_CONFLICT") {
        setPhase({ name: "conflict", error });
      } else if (isUncertainOutcome(error)) {
        setPhase({ name: "uncertain", error });
      } else {
        frozen.current = null; // rejected outright: nothing was saved, answers may be edited
        setPhase({ name: "failed", error });
      }
    }
  };

  const submitNow = () => {
    if (!frozen.current) frozen.current = buildSubmitPayload(attempt.id, questions, answers);
    send(frozen.current);
  };

  // Best effort at expiry (D3): the server decides; a late request gets ATTEMPT_EXPIRED.
  const autoSubmit = useEffectEvent(() => {
    if (phase.name === "idle" || phase.name === "failed") submitNow();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const ms = clock.remainingMs();
      setRemaining(ms);
      if (ms <= 0) {
        clearInterval(timer);
        autoSubmit();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [clock]);

  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;
  const unanswered = questions.length - answeredCount;
  const question = questions[step];

  if (questions.length === 0) {
    return (
      <section className={cardClass}>
        <h1 className={headingClass}>{quizTitle}</h1>
        <p className={`${mutedClass} mt-2`}>This attempt has no questions to answer.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#1F2937] dark:text-white break-words">{quizTitle}</h1>
          <p className={mutedClass}>
            {step === reviewStep ? "Review and submit" : `Question ${step + 1} of ${questions.length}`}
            {" · "}
            {pluralize(answeredCount, "answer")} selected
          </p>
        </div>
        <Countdown remainingMs={remaining} />
      </section>

      <p className={mutedClass}>
        Answers are kept only on this page until you submit. The timer is set by the server and keeps running if you reload.
      </p>

      <SubmitStatus phase={phase} attemptId={attempt.id} onRetry={() => send(frozen.current)} onSavedResult={onSubmitted} />

      <nav aria-label="Questions" className="flex flex-wrap gap-2">
        {questions.map((item, position) => (
          <button
            key={item.id}
            type="button"
            disabled={locked}
            onClick={() => setStep(position)}
            aria-current={position === step ? "step" : undefined}
            aria-label={`Question ${position + 1}, ${answers[item.id] !== undefined ? "answered" : "not answered"}`}
            className={`h-10 w-10 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2A742F] ${
              position === step ? "border-[#2A742F] ring-2 ring-[#2A742F]" : "border-gray-300 dark:border-gray-600"
            } ${answers[item.id] !== undefined ? "bg-[#2A742F] text-white" : "bg-white text-[#1F2937] dark:bg-gray-800 dark:text-white"}`}
          >
            {position + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={locked}
          onClick={() => setStep(reviewStep)}
          className={`h-10 rounded-lg border px-3 text-sm font-medium border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#1F2937] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2A742F] ${
            step === reviewStep ? "ring-2 ring-[#2A742F]" : ""
          }`}
        >
          Review
        </button>
      </nav>

      {step < reviewStep ? (
        <section className={cardClass}>
          <fieldset disabled={locked}>
            <legend className="text-base font-medium text-[#1F2937] dark:text-white whitespace-pre-wrap break-words">
              {question.text}
            </legend>
            <p className={`${mutedClass} mt-1`}>{pluralize(question.points, "point")}</p>
            <div className="mt-4 space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-[#1F2937] dark:text-white cursor-pointer has-[:checked]:border-[#2A742F] has-[:checked]:bg-green-50 dark:has-[:checked]:bg-gray-800"
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                    className="mt-0.5 accent-[#2A742F]"
                  />
                  <span className="break-words">{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex justify-between gap-3">
            <button type="button" className={secondaryButton} disabled={step === 0 || locked} onClick={() => setStep(step - 1)}>
              Previous
            </button>
            <button type="button" className={primaryButton} disabled={locked} onClick={() => setStep(step + 1)}>
              {step === reviewStep - 1 ? "Review answers" : "Next"}
            </button>
          </div>
        </section>
      ) : (
        <section className={cardClass}>
          <h2 className={headingClass}>Review your answers</h2>
          {unanswered > 0 ? (
            <p role="alert" className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              {pluralize(unanswered, "question")} not answered. Unanswered questions score zero.
            </p>
          ) : (
            <p className={`${mutedClass} mt-2`}>All questions have an answer.</p>
          )}
          <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
            {questions.map((item, position) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0 break-words text-[#1F2937] dark:text-white">
                  {position + 1}. {item.text}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={answers[item.id] !== undefined ? "text-[#2A742F] dark:text-green-300" : "text-amber-800 dark:text-amber-300"}>
                    {answers[item.id] !== undefined ? "Answered" : "Not answered"}
                  </span>
                  <button type="button" disabled={locked} onClick={() => setStep(position)} className="underline text-[#2A742F] dark:text-green-300 disabled:opacity-50">
                    Go to question {position + 1}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className={`${mutedClass} mt-4`}>
            You have one attempt. Once submitted, answers cannot be changed. A submission that reaches the server after time is up is not accepted.
          </p>
          <div className="mt-4 flex justify-between gap-3">
            <button type="button" className={secondaryButton} disabled={locked} onClick={() => setStep(reviewStep - 1)}>
              Previous
            </button>
            <button type="button" className={primaryButton} disabled={locked} onClick={submitNow}>
              {phase.name === "submitting" ? "Submitting…" : "Confirm and submit"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function SubmitStatus({ phase, attemptId, onRetry, onSavedResult }) {
  const [lookup, setLookup] = useState({ state: "idle" });

  if (phase.name === "submitting") {
    return (
      <p role="status" className={mutedClass}>
        Submitting your answers…
      </p>
    );
  }
  if (phase.name === "uncertain") {
    return (
      <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:bg-gray-900 dark:text-amber-200">
        <p className="font-medium">We couldn't confirm your submission.</p>
        <p className="mt-1">
          {phase.error.message} Your answers may or may not have been saved. Retry sends the same answers again: it will never start a new attempt or
          grade twice. If you reload, we check the server for your saved result.
        </p>
        <button type="button" className={`${primaryButton} mt-3`} onClick={onRetry}>
          Retry submission
        </button>
      </section>
    );
  }
  if (phase.name === "conflict") {
    const viewSaved = async () => {
      setLookup({ state: "loading" });
      try {
        const found = await findResultForAttempt(attemptId);
        if (found) onSavedResult(found);
        else setLookup({ state: "missing" });
      } catch (error) {
        setLookup({ state: "error", error });
      }
    };
    return (
      <section role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900 dark:bg-gray-900 dark:text-red-300">
        <p className="font-medium">A different set of answers was already saved for this attempt.</p>
        <p className="mt-1">Your first saved submission stands and cannot be overwritten. Nothing you chose here was saved.</p>
        <button type="button" className={`${secondaryButton} mt-3`} onClick={viewSaved} disabled={lookup.state === "loading"}>
          View saved result
        </button>
        {lookup.state === "missing" && (
          <p className="mt-2">
            We couldn't find the saved result yet. Check{" "}
            <Link className="underline" to="/profile/results">
              your results
            </Link>
            .
          </p>
        )}
        {lookup.state === "error" && <p className="mt-2">{describeAssessmentError(lookup.error)}</p>}
      </section>
    );
  }
  if (phase.name === "failed") {
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        {describeAssessmentError(phase.error)} Nothing was saved. You can adjust your answers and submit again.
      </p>
    );
  }
  return null;
}
