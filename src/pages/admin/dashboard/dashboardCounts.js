import { api, ApiError } from "../../../services/api";
import { STUDENT_PATHS } from "../../../services/api/studentService.js";
import { AUTOMATION_PATH } from "../../../features/communication/api/automationsApi.js";
import { BROADCAST_PATH } from "../../../features/communication/api/broadcastsApi.js";

/*
 * Admin dashboard counts (D1: "Dashboards consume paginated counts ... not new
 * analytics models"). Each number is the D0 paginated `count` of an existing
 * admin list endpoint, requested with page_size=1, through the shared client.
 *
 * The feature list services map a missing `count` to 0, which on a dashboard
 * would present a made-up number, so the count is read here and validated:
 * anything other than a non-negative integer is a contract error and the card
 * shows an error instead. Paths and filters are the ones the feature services
 * and pages already use:
 *   students       GET /accounts/students/            (studentService, D1)
 *   events         GET /dawah/events/?status=published (dawahAdminService.listEvents)
 *   quizzes        GET /quiz/quizzes/?status=...       (adminQuizService.listQuizzes)
 *   classes        GET /quiz/classes/                  (classService.listClasses)
 *   broadcasts     GET /dawah/broadcasts/?kind=history&state=... (HistoryPage)
 *   automations    GET /dawah/automations/             (automationsApi.listRules)
 */

const contractError = () =>
  new ApiError({ status: 200, code: "CONTRACT_ERROR", message: "The server sent an unexpected response (no list count)." });

const isCount = (value) => Number.isInteger(value) && value >= 0;

export async function fetchCount(path, filters = {}) {
  const data = await api.get(path, { params: { ...filters, page_size: 1 } });
  if (!isCount(data?.count)) throw contractError();
  return data.count;
}

export const countStudents = () => fetchCount(STUDENT_PATHS.list);
export const countActiveStudents = () => fetchCount(STUDENT_PATHS.list, { is_active: true });
export const countPublishedEvents = () => fetchCount("/dawah/events/", { status: "published" });
export const countQuizzes = (status) => fetchCount("/quiz/quizzes/", { status });
export const countClasses = () => fetchCount("/quiz/classes/");
export const countBroadcasts = (state) => fetchCount(BROADCAST_PATH, { kind: "history", state });

/** queued + processing: broadcasts whose delivery work is still outstanding. */
export async function countBroadcastsInProgress() {
  const [queued, processing] = await Promise.all([countBroadcasts("queued"), countBroadcasts("processing")]);
  return queued + processing;
}

export const AUTOMATION_PAGE_MAX = 100; // D0 maximum page size

/**
 * D4 documents no `enabled` list filter, so the enabled number is counted from
 * the rules themselves, and only when one page holds every rule (`count` fits);
 * otherwise `enabled` is null and the card shows the total rule count only.
 */
export async function countAutomations() {
  const data = await api.get(AUTOMATION_PATH, { params: { page: 1, page_size: AUTOMATION_PAGE_MAX } });
  if (!isCount(data?.count) || !Array.isArray(data?.results)) throw contractError();
  const complete = data.results.length === data.count && !data.next;
  return { total: data.count, enabled: complete ? data.results.filter((rule) => rule?.enabled === true).length : null };
}
