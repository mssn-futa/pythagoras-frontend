import { DEFAULT_PAGE_SIZE } from "../../../services/api/studentService.js";

export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Reads list filters from the URL; unknown/invalid values fall back to defaults. */
export function readQuery(searchParams) {
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const active = searchParams.get("is_active");
  return {
    search: searchParams.get("search") ?? "",
    department: searchParams.get("department") ?? "",
    level: searchParams.get("level") ?? "",
    isActive: active === "true" || active === "false" ? active : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    student: searchParams.get("student") ?? "",
  };
}

/** Writes non-default values only, so URLs stay short and shareable. */
export function writeQuery({ search, department, level, isActive, page, student }) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (department) params.set("department", department);
  if (level) params.set("level", level);
  if (isActive) params.set("is_active", isActive);
  if (page > 1) params.set("page", String(page));
  if (student) params.set("student", student);
  return params;
}

export const fullName = (student) => [student?.first_name, student?.last_name].filter(Boolean).join(" ") || student?.email || "Unnamed student";

const lagosDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });

/** ISO-8601 UTC from the API, shown in Africa/Lagos. */
export function formatJoined(iso) {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? lagosDate.format(date) : "";
}
