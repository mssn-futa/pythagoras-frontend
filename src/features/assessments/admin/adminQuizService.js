import { api, ApiError } from "../../../services/api";
import { STATUSES } from "./quizRules.js";

/*
 * Admin assessment service. Endpoint paths and bodies follow D3 "Backend
 * Design" / "API Contracts". Everything the design doc does not spell out is
 * an assumption, flagged ASSUMPTION below, and isolated in this file.
 */

const toInt = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

export function mapOption(raw) {
  return {
    id: raw.id,
    text: raw.text ?? "",
    order: toInt(raw.order) ?? 0,
    isCorrect: Boolean(raw.is_correct),
  };
}

const contractError = (what) =>
  new ApiError({ status: 200, code: "CONTRACT_ERROR", message: `The server sent an unexpected response (${what}). Reload the page; if it persists, contact the developers.` });

export function mapQuestion(raw) {
  const type = raw.type ?? "mcq";
  const options = (raw.options ?? []).map(mapOption).sort((a, b) => a.order - b.order || a.id - b.id);
  return {
    id: raw.id,
    type,
    text: raw.text ?? "",
    points: toInt(raw.points) ?? 1,
    order: toInt(raw.order) ?? 0,
    options,
    // Persisted data this release cannot edit or publish: not MCQ, or not exactly 4 options with 1 correct.
    legacy: type !== "mcq" || options.length !== 4 || options.filter((option) => option.isCorrect).length !== 1,
  };
}

/** Quiz list item or detail. ASSUMPTION: admin detail nests `questions` with `is_correct` options. */
export function mapQuiz(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw contractError("quiz");
  const questions = (raw.questions ?? []).map(mapQuestion).sort((a, b) => a.order - b.order || a.id - b.id);
  const summedPoints = questions.reduce((sum, question) => sum + question.points, 0);
  return {
    id: raw.id,
    title: raw.title ?? "",
    description: raw.description ?? "",
    // Unknown or missing status never defaults to draft (fail closed): null means read-only.
    status: STATUSES.includes(raw.status) ? raw.status : null,
    // Server-authoritative lock: false once published OR once the quiz has any attempt/submission.
    // Missing flag fails safe: locked unless the quiz is a draft (so an older backend is not broken).
    contentEditable: typeof raw.content_editable === "boolean" ? raw.content_editable : raw.status === "draft",
    type: raw.type ?? "arabic",
    timeLimit: toInt(raw.time_limit),
    deadline: raw.deadline ?? null,
    publishedAt: raw.published_at ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    relatedEvent: Number.isInteger(raw.related_event) ? raw.related_event : null, // integer pk
    // ASSUMPTION: related_course is an integer pk like related_event (an expanded {id} object is tolerated).
    relatedCourse: Number.isInteger(raw.related_course) ? raw.related_course : Number.isInteger(raw.related_course?.id) ? raw.related_course.id : null,
    questions,
    // ASSUMPTION: list items may carry question_count/total_points; detail falls back to a local sum.
    questionCount: toInt(raw.question_count) ?? (raw.questions ? questions.length : null),
    totalPoints: toInt(raw.total_points) ?? (raw.questions ? summedPoints : null),
  };
}

export function mapPage(raw, mapItem) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.results) || !Number.isInteger(raw.count)) throw contractError("expected a paginated list");
  return { count: raw.count, next: raw.next ?? null, previous: raw.previous ?? null, results: raw.results.map(mapItem) };
}

/** Admin result row / detail. Contract: flat student_id, student_name, student_email, quiz_id (D3: "additionally contain student ID/name/email"). */
export function mapResult(raw) {
  if (!raw || typeof raw !== "object") throw contractError("result");
  return {
    id: raw.id,
    attemptId: raw.attempt_id ?? null,
    quizId: raw.quiz_id ?? null,
    quizTitle: raw.quiz_title ?? "",
    status: raw.status ?? "submitted",
    score: toInt(raw.score),
    totalPoints: toInt(raw.total_points), // null for legacy rows without a reconstructible denominator
    submittedAt: raw.submitted_at ?? null,
    gradedAt: raw.graded_at ?? null,
    studentId: raw.student_id ?? null,
    studentName: raw.student_name ?? "",
    studentEmail: raw.student_email ?? "",
  };
}

/** Request body for a draft create/edit. Dates are already UTC ISO strings. */
export function buildQuizPayload({ title, description, timeLimit, deadline, relatedEvent, relatedCourse }) {
  return {
    title: title.trim(),
    description: description.trim(),
    time_limit: timeLimit,
    deadline,
    // related_event is an integer pk. Edits omit it (no UI for it) so a PATCH never clears the association.
    ...(relatedEvent === undefined ? {} : { related_event: relatedEvent }),
    // Sent only when the admin chose/changed a class, so a PATCH never clears an association by omission.
    ...(relatedCourse === undefined ? {} : { related_course: relatedCourse }),
  };
}

/**
 * Question body per D3: {type:"mcq", text, points, order, options:[{text, order, is_correct}]}.
 * Option ids are never sent (lead contract decision): the D3 question body only.
 */
export function buildQuestionPayload({ text, points, order, options, correctIndex }) {
  return {
    type: "mcq",
    text: text.trim(),
    points,
    order,
    options: options.map((option, index) => ({
      text: option.text.trim(),
      order: index + 1,
      is_correct: index === correctIndex,
    })),
  };
}

export const listQuizzes = async ({ status, page, pageSize } = {}) => {
  // ASSUMPTION: query params `status`, `page`, `page_size` (D0 pagination; D3 says "admin status filters").
  const params = {};
  if (status) params.status = status;
  if (page) params.page = page;
  if (pageSize) params.page_size = pageSize;
  return mapPage(await api.get("/quiz/quizzes/", { params }), mapQuiz);
};

export const getQuiz = async (id) => mapQuiz(await api.get(`/quiz/quizzes/${id}/`));

export const createQuiz = async (payload) => mapQuiz(await api.post("/quiz/quizzes/", payload));

/** Draft: full payload. Published/closed: only {title, description} (D3 metadata corrections). */
export const updateQuiz = async (id, payload) => mapQuiz(await api.patch(`/quiz/quizzes/${id}/`, payload));

export const deleteQuiz = (id) => api.delete(`/quiz/quizzes/${id}/`);

export const createQuestion = async (quizId, payload) => mapQuestion(await api.post(`/quiz/quizzes/${quizId}/questions/`, payload));

export const updateQuestion = async (id, payload) => mapQuestion(await api.patch(`/quiz/question/${id}/`, payload));

export const deleteQuestion = (id) => api.delete(`/quiz/question/${id}/`);

// Lifecycle actions: no request body. ASSUMPTION: the caller reloads the quiz afterwards rather than trusting the response shape.
export const publishQuiz = (id) => api.post(`/quiz/quizzes/${id}/publish/`);
export const closeQuiz = (id) => api.post(`/quiz/quizzes/${id}/close/`);

export const listQuizResults = async (quizId, { page, pageSize } = {}) => {
  const params = {};
  if (page) params.page = page;
  if (pageSize) params.page_size = pageSize;
  return mapPage(await api.get(`/quiz/quizzes/${quizId}/submissions/`, { params }), mapResult);
};

export const getResult = async (submissionId) => mapResult(await api.get(`/quiz/submissions/${submissionId}/`));
