import { api } from "../../../../services/api";

/**
 * Student assessment service (D3 "API Contracts"). Every mapper is a WHITELIST:
 * only the fields below are copied from a response, so a stray answer-key field
 * (`is_correct`, `correct_option`, ...) can never reach a component (A12).
 *
 * ASSUMPTIONS not literal in D3 are marked ASSUMPTION.
 */

const numberOrNull = (value) => (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const byOrderThenId = (a, b) => a.order - b.order || a.id - b.id;

function mapOption(raw) {
  return { id: Number(raw.id), text: String(raw.text ?? ""), order: numberOrNull(raw.order) ?? 0 };
}

function mapQuestion(raw) {
  return {
    id: Number(raw.id),
    text: String(raw.text ?? ""),
    points: numberOrNull(raw.points) ?? 1,
    order: numberOrNull(raw.order) ?? 0,
    options: (raw.options ?? []).map(mapOption).sort(byOrderThenId),
  };
}

/** ASSUMPTION: student list/detail items carry id/title/description/time_limit/deadline; total_points/question_count optional. */
export function mapQuiz(raw) {
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    description: raw.description ? String(raw.description) : "",
    timeLimit: numberOrNull(raw.time_limit),
    deadline: raw.deadline ?? null,
    status: raw.status ?? null,
    totalPoints: numberOrNull(raw.total_points),
    questionCount: numberOrNull(raw.question_count),
  };
}

export function mapAttempt(raw) {
  return {
    id: Number(raw.id),
    quizId: Number(raw.quiz_id),
    quizTitle: raw.quiz_title ? String(raw.quiz_title) : null, // ASSUMPTION: optional, not in the D3 example
    status: raw.status,
    startedAt: raw.started_at ?? null,
    expiresAt: raw.expires_at ?? null,
    serverTime: raw.server_time ?? null,
    questions: (raw.questions ?? []).map(mapQuestion).sort(byOrderThenId),
  };
}

export function mapResult(raw) {
  return {
    id: Number(raw.id),
    attemptId: numberOrNull(raw.attempt_id), // legacy rows may lack it
    quizId: numberOrNull(raw.quiz_id),
    quizTitle: raw.quiz_title ? String(raw.quiz_title) : "",
    status: raw.status ?? "submitted",
    score: numberOrNull(raw.score),
    totalPoints: numberOrNull(raw.total_points), // legacy rows may be null
    submittedAt: raw.submitted_at ?? null,
    gradedAt: raw.graded_at ?? null,
  };
}

function mapPage(data, mapItem) {
  // ASSUMPTION: bare arrays are tolerated, though D0 specifies the paginated shape.
  if (Array.isArray(data)) return { count: data.length, next: null, previous: null, results: data.map(mapItem) };
  return {
    count: Number(data?.count ?? 0),
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: (data?.results ?? []).map(mapItem),
  };
}

/** Submit body: decimal question-ID string -> numeric option ID; unanswered questions are omitted. */
export function buildSubmitPayload(attemptId, questions, answers) {
  const body = {};
  for (const question of questions) {
    const optionId = answers[question.id];
    if (optionId !== undefined && optionId !== null && question.options.some((option) => option.id === optionId)) {
      body[String(question.id)] = Number(optionId);
    }
  }
  return { attempt_id: Number(attemptId), answers: body };
}

export async function listAvailableQuizzes({ page = 1, pageSize = 20 } = {}) {
  return mapPage(await api.get("/quiz/quizzes/", { params: { page, page_size: pageSize } }), mapQuiz);
}

export async function getQuiz(quizId) {
  return mapQuiz(await api.get(`/quiz/quizzes/${quizId}/`));
}

/** Idempotent: D3 returns the existing attempt unchanged on repeated start, so retrying is safe. */
export async function startAttempt(quizId) {
  return mapAttempt(await api.post(`/quiz/quizzes/${quizId}/attempts/`, {}));
}

export async function getAttempt(attemptId) {
  return mapAttempt(await api.get(`/quiz/attempts/${attemptId}/`));
}

/** Sends exactly the payload given (the caller retains it for replay). */
export async function submitAttempt(payload) {
  return mapResult(await api.post("/quiz/submissions/", payload));
}

export async function getResult(submissionId) {
  return mapResult(await api.get(`/quiz/submissions/${submissionId}/`));
}

export async function listHistory({ page = 1, pageSize = 20 } = {}) {
  return mapPage(await api.get("/quiz/submissions/", { params: { page, page_size: pageSize } }), mapResult);
}

/**
 * ASSUMPTION: D3 gives no attempt -> submission pointer, so a submitted attempt's
 * result is found by scanning the student's own history for its attempt_id.
 */
export async function findResultForAttempt(attemptId, { pageSize = 100, maxPages = 10 } = {}) {
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await listHistory({ page, pageSize });
    const match = data.results.find((row) => row.attemptId === Number(attemptId));
    if (match) return match;
    if (!data.next) return null;
  }
  return null;
}

/** Retryable transport/availability failures: the outcome of a submit may be unknown. */
export function isUncertainOutcome(error) {
  return error?.status === 0 || error?.status === 429 || error?.status >= 500;
}
