/**
 * Client-side mirror of the D3 authoring rules. The server is authoritative;
 * these checks only save a round trip and point at the field to fix.
 */
export const OPTION_COUNT = 4;
export const DEFAULT_POINTS = 1;
export const TIME_LIMIT_MIN = 1;
export const TIME_LIMIT_MAX = 180;
export const STATUSES = ["draft", "published", "closed"];

/** Normalized form used to detect duplicate options (assumption: trim, collapse spaces, case-fold). */
export function normalizeOptionText(text) {
  return String(text ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

/** Parses a points input; returns NaN for anything that is not a plain positive integer string. */
export function parsePoints(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

export function blankQuestionDraft() {
  return {
    text: "",
    points: String(DEFAULT_POINTS),
    options: Array.from({ length: OPTION_COUNT }, () => ({ id: null, text: "" })),
    correctIndex: null,
  };
}

/**
 * @param draft {{text:string, points:string|number, options:{text:string}[], correctIndex:number|null}}
 * @returns {{ text?:string, points?:string, options?:string, correct?:string, optionTexts:(string|undefined)[] }} empty when valid
 */
export function validateQuestionDraft(draft) {
  const errors = { optionTexts: [] };
  if (!String(draft.text ?? "").trim()) errors.text = "Enter the question text.";

  if (!isPositiveInteger(parsePoints(draft.points))) errors.points = "Points must be a whole number greater than 0.";

  const options = draft.options ?? [];
  if (options.length !== OPTION_COUNT) {
    errors.options = `A question needs exactly ${OPTION_COUNT} options.`;
  } else {
    const seen = new Map();
    options.forEach((option, index) => {
      const normalized = normalizeOptionText(option.text);
      if (!normalized) {
        errors.optionTexts[index] = "Enter the option text.";
      } else if (seen.has(normalized)) {
        errors.optionTexts[index] = `Same as option ${String.fromCharCode(65 + seen.get(normalized))}. Options must be different.`;
      } else {
        seen.set(normalized, index);
      }
    });
  }

  if (!Number.isInteger(draft.correctIndex) || draft.correctIndex < 0 || draft.correctIndex >= OPTION_COUNT) {
    errors.correct = "Mark exactly one option as the correct answer.";
  }

  const hasOptionError = errors.optionTexts.some(Boolean);
  if (!hasOptionError) errors.optionTexts = [];
  return errors;
}

export const hasErrors = (errors) =>
  Object.entries(errors).some(([key, value]) => (key === "optionTexts" ? value.some(Boolean) : Boolean(value)));

/** Validates the quiz details form (draft save). */
export function validateQuizDetails(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Enter a title.";
  const limit = String(form.time_limit ?? "").trim();
  if (limit) {
    const value = /^\d+$/.test(limit) ? Number(limit) : Number.NaN;
    if (!Number.isInteger(value) || value < TIME_LIMIT_MIN || value > TIME_LIMIT_MAX) {
      errors.time_limit = `Duration must be a whole number of minutes from ${TIME_LIMIT_MIN} to ${TIME_LIMIT_MAX}.`;
    }
  }
  return errors;
}

/** Why a saved draft cannot be published yet (shown as a checklist; the server re-validates). */
export function publishBlockers(quiz, { now = Date.now() } = {}) {
  const blockers = [];
  if (!quiz.questions.length) blockers.push("Add at least one question.");
  if (!isPositiveInteger(quiz.timeLimit)) blockers.push("Set a time limit in minutes.");
  if (!quiz.deadline) blockers.push("Set a deadline.");
  else if (Date.parse(quiz.deadline) <= now) blockers.push("The deadline must be in the future.");
  return blockers;
}

export const totalPoints = (questions) => questions.reduce((sum, question) => sum + question.points, 0);

/** Editor draft from a persisted question (keeps option IDs and order). */
export function draftFromQuestion(question) {
  const ordered = [...question.options];
  return {
    text: question.text,
    points: String(question.points),
    options: ordered.map((option) => ({ id: option.id, text: option.text })),
    correctIndex: ordered.findIndex((option) => option.isCorrect),
  };
}

/** Weighted score text: points earned over the persisted denominator, never a question count. */
export function scoreText(result) {
  if (result.score === null) return "—";
  return result.totalPoints === null ? `${result.score} (total unavailable)` : `${result.score} / ${result.totalPoints}`;
}
