import { api, ApiError } from "../../../../services/api";
import { mapPage } from "../adminQuizService.js";

/*
 * Admin Arabic class / module / roster service. Paths follow D3 "Arabic
 * classes enrollment and modules". Anything D3 does not spell out (query
 * parameter names, response field names beyond the literal examples, the
 * roster POST body) is an assumption, flagged ASSUMPTION and isolated here.
 */

export const CLASS_STATUSES = ["draft", "published", "closed"];
export const MODULE_STATUSES = ["draft", "published"];
export const ENROLLMENT_STATUSES = ["active", "withdrawn"];

const toInt = (value) => (value === null || value === undefined || value === "" ? null : Number(value));
const contractError = (what) =>
  new ApiError({ status: 200, code: "CONTRACT_ERROR", message: `The server sent an unexpected response (${what}). Reload the page; if it persists, contact the developers.` });
const isObject = (raw) => raw && typeof raw === "object" && !Array.isArray(raw);

/**
 * Class (Course) record. ASSUMPTION: fields id, code, title, description, kind, status, created_at,
 * updated_at; optional module_count / enrollment_count when the server supplies them.
 * `legacy` marks a record that is not an Arabic class (D3: legacy/general courses are not Phase 1
 * learning) or has an unknown status; such a record is shown read-only with no actions (fail closed).
 */
export function mapClass(raw) {
  if (!isObject(raw)) throw contractError("class");
  const kind = raw.kind ?? null; // a missing kind is not assumed Arabic (fail closed)
  const status = CLASS_STATUSES.includes(raw.status) ? raw.status : null;
  return {
    id: raw.id,
    code: raw.code ?? "",
    title: raw.title ?? "",
    description: raw.description ?? "",
    kind,
    status,
    legacy: kind !== "arabic" || status === null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    moduleCount: toInt(raw.module_count),
    enrollmentCount: toInt(raw.enrollment_count),
  };
}

/** ASSUMPTION: a safe resource payload carries id, title, type (aud|vid|doc) and optional status/event summary. */
export function mapResourceRef(raw) {
  if (!isObject(raw) || !Number.isInteger(raw.id)) throw contractError("resource");
  return {
    id: raw.id,
    title: raw.title ?? `Resource ${raw.id}`,
    type: raw.type ?? null,
    eventTitle: raw.event?.title ?? raw.event_title ?? null,
  };
}

/**
 * Module. D3: ID/course/title/body/order, "safe visible typed resource payloads", associated published
 * quiz metadata. Lead decision (frontend-requests-for-backend.md): `resources` holds the visible
 * attachments and `hidden_resource_ids` the attached-but-not-visible ones (offered for "Detach").
 * ASSUMPTION: `quizzes` holds {id,title,status}.
 */
export function mapModule(raw) {
  if (!isObject(raw)) throw contractError("module");
  const resources = (raw.resources ?? []).map(mapResourceRef);
  return {
    id: raw.id,
    courseId: raw.course_id ?? raw.course ?? null,
    title: raw.title ?? "",
    body: raw.body ?? "",
    order: toInt(raw.order) ?? 0,
    status: MODULE_STATUSES.includes(raw.status) ? raw.status : null,
    resources,
    hiddenResourceIds: Array.isArray(raw.hidden_resource_ids) ? raw.hidden_resource_ids.filter(Number.isInteger) : [],
    quizzes: (raw.quizzes ?? []).map((quiz) => ({ id: quiz.id, title: quiz.title ?? `Quiz ${quiz.id}`, status: quiz.status ?? null })),
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

/**
 * Roster row. ASSUMPTION: flat student_id / student_name / student_email beside the literal D3
 * fields id, course_id, student_id, status; timestamps enrolled_at (created_at) / withdrawn_at / updated_at.
 */
export function mapEnrollment(raw) {
  if (!isObject(raw)) throw contractError("enrollment");
  return {
    id: raw.id,
    courseId: raw.course_id ?? null,
    studentId: raw.student_id ?? null,
    status: ENROLLMENT_STATUSES.includes(raw.status) ? raw.status : null,
    studentName: raw.student_name ?? "",
    studentEmail: raw.student_email ?? "",
    enrolledAt: raw.enrolled_at ?? raw.created_at ?? null,
    withdrawnAt: raw.withdrawn_at ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

/** ASSUMPTION: GET /accounts/students/ (D1) rows carry id, first_name, last_name, email, matric_number. */
export function mapStudent(raw) {
  if (!isObject(raw) || !Number.isInteger(raw.id)) throw contractError("student");
  return {
    id: raw.id,
    name: [raw.first_name, raw.last_name].filter(Boolean).join(" ") || raw.name || raw.email || `Student ${raw.id}`,
    email: raw.email ?? "",
    matric: raw.matric_number ?? "",
  };
}

/** Class create/edit body: code, title, description. ASSUMPTION (D3 names only code/title/description). */
export function buildClassPayload({ code, title, description }) {
  return { code: code.trim(), title: title.trim(), description: description.trim() };
}

/** D3 module create request: {"title","body","order","resource_ids"}. */
export function buildModulePayload({ title, body, order, resourceIds }) {
  return { title: title.trim(), body, order, resource_ids: resourceIds };
}

/**
 * Partial module PATCH: only fields that changed. `resource_ids` (which replaces the attachment set)
 * is sent only when the selection changed, so unrelated edits never revalidate attachments.
 */
export function buildModulePatch(saved, { title, body, order, resourceIds }) {
  const patch = {};
  if (title.trim() !== saved.title) patch.title = title.trim();
  if (body !== saved.body) patch.body = body;
  if (order !== saved.order) patch.order = order;
  const before = [...saved.resources.map((r) => r.id), ...saved.hiddenResourceIds];
  const same = before.length === resourceIds.length && before.every((id, index) => id === resourceIds[index]);
  if (!same) patch.resource_ids = resourceIds;
  return patch;
}

const pageParams = ({ page, pageSize }) => ({ ...(page ? { page } : {}), ...(pageSize ? { page_size: pageSize } : {}) });

// --- classes -----------------------------------------------------------------------------------
export const listClasses = async ({ status, page, pageSize } = {}) =>
  // ASSUMPTION: admin catalog accepts `status` (D3: "admin drafts"; mirrors the quiz list), `page`, `page_size`.
  mapPage(await api.get("/quiz/classes/", { params: { ...(status ? { status } : {}), ...pageParams({ page, pageSize }) } }), mapClass);
export const getClass = async (id) => mapClass(await api.get(`/quiz/classes/${id}/`));
export const createClass = async (payload) => mapClass(await api.post("/quiz/classes/", payload));
export const updateClass = async (id, payload) => mapClass(await api.patch(`/quiz/classes/${id}/`, payload));
export const deleteClass = (id) => api.delete(`/quiz/classes/${id}/`);
// Lifecycle actions: no body. The caller reloads rather than trusting the response shape.
export const publishClass = (id) => api.post(`/quiz/classes/${id}/publish/`);
export const closeClass = (id) => api.post(`/quiz/classes/${id}/close/`);

// --- modules -----------------------------------------------------------------------------------
/**
 * ASSUMPTION: the module list may be a paginated envelope or a bare array; every page is read (cap 20)
 * because ordering needs the complete set.
 */
export async function listModules(classId) {
  const modules = [];
  for (let page = 1; page <= 20; page += 1) {
    const raw = await api.get(`/quiz/classes/${classId}/modules/`, { params: { page, page_size: 100 } });
    if (Array.isArray(raw)) return raw.map(mapModule).sort(byOrder);
    const loaded = mapPage(raw, mapModule);
    modules.push(...loaded.results);
    if (!loaded.next) break;
  }
  return modules.sort(byOrder);
}
const byOrder = (a, b) => a.order - b.order || a.id - b.id;
export const getModule = async (classId, moduleId) => mapModule(await api.get(`/quiz/classes/${classId}/modules/${moduleId}/`));
export const createModule = async (classId, payload) => mapModule(await api.post(`/quiz/classes/${classId}/modules/`, payload));
export const updateModule = async (classId, moduleId, payload) => mapModule(await api.patch(`/quiz/classes/${classId}/modules/${moduleId}/`, payload));
export const deleteModule = (classId, moduleId) => api.delete(`/quiz/classes/${classId}/modules/${moduleId}/`);
export const publishModule = (classId, moduleId) => api.post(`/quiz/classes/${classId}/modules/${moduleId}/publish/`);
export const unpublishModule = (classId, moduleId) => api.post(`/quiz/classes/${classId}/modules/${moduleId}/unpublish/`);

/** Atomic reorder (lead decision): POST .../modules/reorder/ {module_ids:[all ids in the new order]}. */
export const reorderModules = (classId, moduleIds) => api.post(`/quiz/classes/${classId}/modules/reorder/`, { module_ids: moduleIds });

// --- resource picker (D2 archive: published, locally visible, ready resources only) ---------------
export const searchResources = async ({ search, type, page, pageSize = 20 } = {}) =>
  // ASSUMPTION: GET /dawah/archive/ (D2) items carry the resource id, title, type and parent event summary.
  mapPage(await api.get("/dawah/archive/", { params: { ...(search ? { search } : {}), ...(type ? { type } : {}), ...pageParams({ page, pageSize }) } }), mapResourceRef);

// --- roster ------------------------------------------------------------------------------------
export const listEnrollments = async (classId, { status, search, page, pageSize } = {}) =>
  // ASSUMPTION: roster accepts `status` (active|withdrawn), `search` (name/email) and page/page_size.
  mapPage(
    await api.get(`/quiz/classes/${classId}/enrollments/`, { params: { ...(status ? { status } : {}), ...(search ? { search } : {}), ...pageParams({ page, pageSize }) } }),
    mapEnrollment,
  );
/**
 * D3: POST admin enrollment/status management. ASSUMPTION: body {student_id, status:"active"|"withdrawn"}
 * enrolls a new student, withdraws, or reinstates (re-enrollment reactivates the same record).
 */
export const setEnrollment = async (classId, { studentId, status }) =>
  mapEnrollment(await api.post(`/quiz/classes/${classId}/enrollments/`, { student_id: studentId, status }));

export const searchStudents = async ({ search, pageSize = 8 }) =>
  mapPage(await api.get("/accounts/students/", { params: { search, page_size: pageSize } }), mapStudent);
