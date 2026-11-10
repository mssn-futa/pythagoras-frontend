import { api } from "../../../../../services/api";
import { mapResource } from "../../../../dawah/public";

/**
 * Student Arabic class service (D3 "Arabic classes enrollment and modules").
 * Mappers are whitelists. ASSUMPTIONS beyond the literal D3 text are marked.
 *
 * Routes (all authenticated):
 *   GET    /quiz/classes/                       published Arabic catalog (D0 paginated)
 *   GET    /quiz/classes/{id}/                  role-safe class detail
 *   GET    /quiz/classes/{id}/enrollment/       own enrollment (ASSUMPTION: 404 or null data when never enrolled)
 *   POST   /quiz/classes/{id}/enrollment/       enroll / re-enroll (idempotent, no body)
 *   DELETE /quiz/classes/{id}/enrollment/       withdraw (idempotent)
 *   GET    /quiz/classes/{id}/modules/          published modules; active enrollment only
 *   GET    /quiz/classes/{id}/modules/{mid}/    module detail; active enrollment only
 */

const numberOrNull = (value) => (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const byOrderThenId = (a, b) => a.order - b.order || a.id - b.id;

export function mapClass(raw) {
  return {
    id: Number(raw.id),
    code: String(raw.code ?? ""),
    title: String(raw.title ?? ""),
    description: raw.description ? String(raw.description) : "",
    status: raw.status ?? null, // draft|published|closed
    moduleCount: numberOrNull(raw.module_count), // ASSUMPTION: optional
  };
}

export function mapEnrollment(raw) {
  if (!raw) return null;
  return {
    id: numberOrNull(raw.id),
    status: raw.status === "active" ? "active" : "withdrawn",
    enrolledAt: raw.enrolled_at ?? null, // ASSUMPTION: optional
    withdrawnAt: raw.withdrawn_at ?? null, // ASSUMPTION: optional
  };
}

/** ASSUMPTION: module quizzes[] is [{id, title, status}] with no answer keys (D3: "associated published quiz metadata"). */
function mapQuizRef(raw) {
  return { id: Number(raw.id), title: String(raw.title ?? ""), status: raw.status ?? "published" };
}

/** Module list items and details share one shape; `resources[]` are full public resource payloads (contract correction). */
export function mapModule(raw) {
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    body: String(raw.body ?? ""),
    order: numberOrNull(raw.order) ?? 0,
    resources: (Array.isArray(raw.resources) ? raw.resources : []).map(mapResource),
    quizzes: (Array.isArray(raw.quizzes) ? raw.quizzes : []).map(mapQuizRef),
  };
}

function mapPage(data, mapItem) {
  if (Array.isArray(data)) return { count: data.length, next: null, previous: null, results: data.map(mapItem) };
  return {
    count: Number(data?.count ?? 0),
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: (data?.results ?? []).map(mapItem),
  };
}

export async function listClasses({ page = 1, pageSize = 20 } = {}) {
  const data = mapPage(await api.get("/quiz/classes/", { params: { page, page_size: pageSize } }), mapClass);
  // Defensive: the student catalog is published-only; drop anything else a server might send.
  return { ...data, results: data.results.filter((item) => item.status === null || item.status === "published") };
}

export async function getClass(classId) {
  return mapClass(await api.get(`/quiz/classes/${classId}/`));
}

/** Own enrollment, or null when the student never enrolled. */
export async function getEnrollment(classId) {
  try {
    return mapEnrollment(await api.get(`/quiz/classes/${classId}/enrollment/`));
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

/** Idempotent: a repeat returns the same record; a withdrawn record is reactivated. */
export async function enroll(classId) {
  return mapEnrollment(await api.post(`/quiz/classes/${classId}/enrollment/`, {}));
}

/** Idempotent withdrawal. The response body (if any) is not relied on. */
export async function withdraw(classId) {
  await api.delete(`/quiz/classes/${classId}/enrollment/`);
}

const MAX_MODULE_PAGES = 50;

/** All published modules, following `next` until exhausted (bounded). */
export async function listModules(classId) {
  const all = [];
  for (let page = 1; page <= MAX_MODULE_PAGES; page += 1) {
    const data = mapPage(await api.get(`/quiz/classes/${classId}/modules/`, { params: { page, page_size: 100 } }), mapModule);
    all.push(...data.results);
    if (!data.next) break;
  }
  return all.sort(byOrderThenId);
}

export async function getModule(classId, moduleId) {
  return mapModule(await api.get(`/quiz/classes/${classId}/modules/${moduleId}/`));
}

/** Modules are readable only with an active enrollment in a published class. */
export const canReadModules = (klass, enrollment) => klass?.status === "published" && enrollment?.status === "active";

/**
 * What a student sees for a class: drives the call to action and explanation.
 *   open       published + active enrollment
 *   not_enrolled / withdrawn  published, no active enrollment
 *   closed     class closed (enrollment and modules blocked)
 *   unavailable draft/unknown
 */
export function accessState(klass, enrollment) {
  if (klass?.status === "closed") return "closed";
  if (klass?.status !== "published") return "unavailable";
  if (enrollment?.status === "active") return "open";
  return enrollment ? "withdrawn" : "not_enrolled";
}

/** Frozen contract: a module read without an active enrollment is refused with ENROLLMENT_REQUIRED. */
export const isEnrollmentRequired = (error) => error?.code === "ENROLLMENT_REQUIRED";

export function describeClassError(error) {
  if (!error) return "Something went wrong. Try again.";
  if (isEnrollmentRequired(error)) return "You need an active enrollment in this class to read its modules.";
  if (error.status === 403) return "You do not have access to this class.";
  if (error.status === 404) return "This class or module is not available. It may not be published or may have been closed.";
  return error.message || "Something went wrong. Try again.";
}
