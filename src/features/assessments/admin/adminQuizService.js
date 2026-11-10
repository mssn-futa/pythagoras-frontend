import { api } from "../../../services/api";

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

export function mapQuestion(raw) {
  return {
    id: raw.id,
    type: raw.type ?? "mcq",
    text: raw.text ?? "",
    points: toInt(raw.points) ?? 1,
    order: toInt(raw.order) ?? 0,
    options: (raw.options ?? []).map(mapOption).sort((a, b) => a.order - b.order || a.id - b.id),
  };
}

/** Quiz list item or detail. ASSUMPTION: admin detail nests `questions` with `is_correct` options. */
export function mapQuiz(raw) {
  const questions = (raw.questions ?? []).map(mapQuestion).sort((a, b) => a.order - b.order || a.id - b.id);
  const summedPoints = questions.reduce((sum, question) => sum + question.points, 0);
  return {
    id: raw.id,
    title: raw.title ?? "",
    description: raw.description ?? "",
    status: raw.status ?? "draft",
    type: raw.type ?? "arabic",
    timeLimit: toInt(raw.time_limit),
    deadline: raw.deadline ?? null,
    publishedAt: raw.published_at ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    relatedEvent: raw.related_event ?? null,
    relatedCourse: raw.related_course ?? null,
    questions,
    // ASSUMPTION: list items may carry question_count/total_points; detail falls back to a local sum.
    questionCount: toInt(raw.question_count) ?? (raw.questions ? questions.length : null),
    totalPoints: toInt(raw.total_points) ?? (raw.questions ? summedPoints : null),
  };
}

export function mapPage(raw, mapItem) {
  return {
    count: raw?.count ?? 0,
    next: raw?.next ?? null,
    previous: raw?.previous ?? null,
    results: (raw?.results ?? []).map(mapItem),
  };
}

/** Admin result row / detail. D3: student rows plus student ID/name/email. */
export function mapResult(raw) {
  // ASSUMPTION: student fields are flat (student_id/student_name/student_email); a nested `student` object is tolerated.
  const nested = raw.student && typeof raw.student === "object" ? raw.student : {};
  const first = nested.first_name ?? "";
  const last = nested.last_name ?? "";
  const nestedName = nested.name ?? [first, last].filter(Boolean).join(" ");
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
    studentId: raw.student_id ?? nested.id ?? null,
    studentName: raw.student_name ?? nestedName ?? "",
    studentEmail: raw.student_email ?? nested.email ?? "",
  };
}

/** Request body for a draft create/edit. Dates are already UTC ISO strings. */
export function buildQuizPayload({ title, description, timeLimit, deadline, relatedEvent = null }) {
  return {
    title: title.trim(),
    description: description.trim(),
    time_limit: timeLimit,
    deadline,
    related_event: relatedEvent,
  };
}

/**
 * Question body per D3: {type:"mcq", text, points, order, options:[{text, order, is_correct}]}.
 * ASSUMPTION: when editing, existing option `id`s are sent so the server keeps persisted IDs.
 */
export function buildQuestionPayload({ text, points, order, options, correctIndex }) {
  return {
    type: "mcq",
    text: text.trim(),
    points,
    order,
    options: options.map((option, index) => ({
      ...(option.id ? { id: option.id } : {}),
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
