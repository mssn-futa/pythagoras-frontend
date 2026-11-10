import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildSubmitPayload, findResultForAttempt, getAttempt, isUncertainOutcome, submitAttempt } from "../api/studentAssessmentsApi.js";
import { createServerClock } from "../lib/serverClock.js";
import { pluralize } from "../lib/format.js";
import { cardClass, describeAssessmentError, headingClass, mutedClass, primaryButton, secondaryButton } from "../lib/ui.js";
import Countdown from "./Countdown.jsx";

/**
 * Separate read/taking component (not the admin question editor). Answers live
 * in memory only; the final payload is frozen at the first submit so a transport
 * retry replays the identical request instead of whatever is on screen.
 */
const AUTO_SUBMIT_MARGIN_MS = 3000;
const ANNOUNCE_AT = [
  [300_000, "5 minutes remaining."],
  [60_000, "1 minute remaining."],
  [10_000, "10 seconds remaining."],
];

const makeTiming = (attempt) => ({
  clock: createServerClock(attempt.serverTime, attempt.expiresAt, undefined, { anchorAt: attempt.receivedAt, rttMs: attempt.rttMs ?? 0 }),
  rttMs: attempt.rttMs ?? 0,
});

export default function QuizTaker({ attempt, quizTitle, onSubmitted, onExpired, onAttemptChanged }) {
  const { questions } = attempt;
  // Anchored at response arrival (not at mount) and discounting half the measured RTT.
  const [timing, setTiming] = useState(() => makeTiming(attempt));
  const [remaining, setRemaining] = useState(() => timing.clock.remainingMs());
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0); // 0..n-1 questions, n = review/confirm
  const [phase, setPhase] = useState({ name: "idle" });
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const [checkTick, setCheckTick] = useState(0);
  const frozen = useRef(null);
  const autoFired = useRef(false);
  const announced = useRef(new Set());
  const refreshing = useRef(false);
  const alive = useRef(true);
  const legendRef = useRef(null);
  const reviewRef = useRef(null);
  const firstStep = useRef(true);
  const reviewStep = questions.length;
  const locked = ["submitting", "uncertain", "conflict", "rejected"].includes(phase.name);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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
      } else if (error.status === 403 || error.status === 404 || error.status === 409) {
        setPhase({ name: "rejected", error }); // never re-sent automatically
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

  // Best effort before expiry (D3): the server decides; a late request gets ATTEMPT_EXPIRED.
  const autoSubmit = useEffectEvent(() => {
    if (phase.name === "idle" || phase.name === "failed") submitNow();
  });

  // Re-read the server's copy of the attempt and re-anchor the clock; answers stay in memory.
  const refresh = useEffectEvent(async ({ manual = false } = {}) => {
    if (refreshing.current || phase.name === "submitting") return;
    refreshing.current = true;
    try {
      const fresh = await getAttempt(attempt.id);
      if (!alive.current) return;
      const open = fresh.status === "in_progress" && Date.parse(fresh.expiresAt) > Date.parse(fresh.serverTime);
      if (open) {
        const next = makeTiming(fresh);
        setTiming(next);
        setRemaining(next.clock.remainingMs());
        if (manual && phase.name === "rejected") {
          frozen.current = null;
          setPhase({ name: "idle" });
        }
      } else {
        onAttemptChanged?.(fresh);
      }
    } catch {
      /* keep the current anchor; the next focus/online event tries again */
    } finally {
      refreshing.current = false;
    }
  });

  useEffect(() => {
    if (checkTick > 0) refresh({ manual: true });
  }, [checkTick]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, []);

  useEffect(() => {
    const margin = Math.max(AUTO_SUBMIT_MARGIN_MS, timing.rttMs);
    const timer = setInterval(() => {
      const ms = timing.clock.remainingMs();
      setRemaining(ms);
      for (const [threshold, text] of ANNOUNCE_AT) {
        if (ms <= threshold && !announced.current.has(threshold)) {
          announced.current.add(threshold);
          setPolite(text);
        }
      }
      if (ms <= margin && !autoFired.current) {
        autoFired.current = true;
        setAssertive("Time is almost up. Submitting your answers now.");
        autoSubmit();
      }
      if (ms <= 0) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [timing]);

  // Keyboard/screen-reader users land on the new question (or the review heading).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    (step < reviewStep ? legendRef : reviewRef).current?.focus();
  }, [step, reviewStep]);

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
      <div className="sr-only" aria-live="polite">{polite}</div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{assertive}</div>
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

      <SubmitStatus phase={phase} attemptId={attempt.id} onRetry={() => send(frozen.current)} onSavedResult={onSubmitted} onCheck={() => setCheckTick((count) => count + 1)} />

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
            <legend ref={legendRef} tabIndex={-1} className="text-base focus:outline-none font-medium text-[#1F2937] dark:text-white whitespace-pre-wrap break-words">
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
          <h2 ref={reviewRef} tabIndex={-1} className={`${headingClass} focus:outline-none`}>Review your answers</h2>
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

function SubmitStatus({ phase, attemptId, onRetry, onSavedResult, onCheck }) {
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
        const found = await findResultForAttempt(attemptId, null);
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
  if (phase.name === "rejected") {
    const { status } = phase.error;
    const text =
      status === 403
        ? "You no longer have access to this quiz, so your answers were not accepted."
        : status === 404
          ? "We couldn't find this attempt, so your answers were not accepted."
          : `The server did not accept this submission${phase.error.message ? `: ${phase.error.message}` : "."}`;
    return (
      <section role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900 dark:bg-gray-900 dark:text-red-300">
        <p className="font-medium">{text}</p>
        <p className="mt-1">Your answers were not re-sent. Check the state of your attempt before trying again.</p>
        <button type="button" className={`${secondaryButton} mt-3`} onClick={onCheck}>
          Check attempt status
        </button>
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
