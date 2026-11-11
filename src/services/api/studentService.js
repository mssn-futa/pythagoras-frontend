import { api } from "./axiosConfig.js";

/** D1 admin student administration. Payload mapping only; transport lives in axiosConfig. */
export const STUDENT_PATHS = {
  list: "/accounts/students/",
  detail: (id) => `/accounts/students/${encodeURIComponent(id)}/`,
};

export const DEFAULT_PAGE_SIZE = 20;
export const LEVEL_OPTIONS = ["100", "200", "300", "400", "500"];

/** Fields an admin may change through student administration (D1). No role/permissions. */
export const STUDENT_EDITABLE_FIELDS = ["first_name", "last_name", "email", "matric_number", "department", "level", "is_active"];

const text = (value) => (typeof value === "string" ? value.trim() : value);

/**
 * Maps UI filters to the D1 query contract. Blank filters are omitted;
 * `isActive` is `true`/`false` (or the strings) and sent as `is_active`.
 */
export function buildListParams({ search, department, level, isActive, page, pageSize } = {}) {
  const params = {};
  if (text(search)) params.search = text(search);
  if (text(department)) params.department = text(department);
  if (level) params.level = String(level);
  if (isActive === true || isActive === "true") params.is_active = true;
  if (isActive === false || isActive === "false") params.is_active = false;
  if (Number(page) > 1) params.page = Number(page);
  if (pageSize) params.page_size = Number(pageSize);
  return params;
}

/** Resolves to { count, next, previous, results } (the envelope's data). */
export async function listStudents(filters, config) {
  const data = await api.get(STUDENT_PATHS.list, { ...config, params: buildListParams(filters) });
  return {
    count: Number(data?.count ?? 0),
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: Array.isArray(data?.results) ? data.results : [],
  };
}

export const getStudent = (id, config) => api.get(STUDENT_PATHS.detail(id), config);

/**
 * PATCH only whitelisted fields. Text is trimmed; a cleared matric number is
 * sent as null (unset), other cleared text/level as an empty string.
 */
export function buildStudentPatch(changes) {
  const payload = {};
  for (const field of STUDENT_EDITABLE_FIELDS) {
    if (!(field in changes)) continue;
    const value = changes[field];
    if (field === "is_active") payload[field] = Boolean(value);
    else if (field === "matric_number") payload[field] = text(value) || null;
    else payload[field] = text(value) ?? "";
  }
  return payload;
}

export const updateStudent = (id, changes, config) => api.patch(STUDENT_PATHS.detail(id), buildStudentPatch(changes), config);

export const setStudentActive = (id, isActive, config) => updateStudent(id, { is_active: isActive }, config);
