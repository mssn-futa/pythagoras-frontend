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
    quizTitle: raw.quiz_title ? String(raw.quiz_title) : null, // frozen ASSESS-04 contract; tolerated absent
    submissionId: numberOrNull(raw.submission_id), // null until finalized (frozen contract)
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
  return timedAttempt(() => api.post(`/quiz/quizzes/${quizId}/attempts/`, {}));
}

export async function getAttempt(attemptId) {
  return timedAttempt(() => api.get(`/quiz/attempts/${attemptId}/`));
}

/**
 * Maps an attempt response and records when it arrived (monotonic) and the
 * measured round trip, so the countdown can anchor at arrival and discount
 * the response's transit time.
 */
async function timedAttempt(request) {
  const sent = performance.now();
  const raw = await request();
  const arrived = performance.now();
  return { ...mapAttempt(raw), receivedAt: arrived, rttMs: Math.max(0, arrived - sent) };
}

/** Sends exactly the payload given (the caller retains it for replay). */
export async function submitAttempt(payload) {
  return mapResult(await api.post("/quiz/submissions/", payload));
}

export async function getResult(submissionId) {
  return mapResult(await api.get(`/quiz/submissions/${submissionId}/`));
}

/** Frozen contract: history is newest first and supports ?attempt= and ?quiz= filters. */
export async function listHistory({ page = 1, pageSize = 20, attempt, quiz } = {}) {
  const params = { page, page_size: pageSize };
  if (attempt !== undefined) params.attempt = attempt;
  if (quiz !== undefined) params.quiz = quiz;
  return mapPage(await api.get("/quiz/submissions/", { params }), mapResult);
}

/**
 * Result of a finalized attempt: one request. With the attempt's submission_id
 * it is a direct read; otherwise a single filtered history request (?attempt=).
 */
export async function findResultForAttempt(attemptId, submissionId = null) {
  if (submissionId) return getResult(submissionId);
  const data = await listHistory({ attempt: attemptId, pageSize: 5 });
  return data.results.find((row) => row.attemptId === Number(attemptId)) ?? null;
}

/** Retryable transport/availability failures: the outcome of a submit may be unknown. */
export function isUncertainOutcome(error) {
  return error?.status === 0 || error?.status === 429 || error?.status >= 500;
}
