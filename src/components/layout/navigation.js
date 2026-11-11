/*
 * Release navigation (PLAT-07). Every entry points at a route that App mounts
 * today (src/App.jsx + the feature slot modules). Deferred prototypes
 * (/academics, /empowerment, the verification flow, prayer/Hijri widgets,
 * sample-data quiz/dawah pages) are intentionally absent; their source is kept.
 *
 * `match(pathname)` decides active highlighting, so detail pages keep their
 * section highlighted (e.g. /dawah/events/3 → "Da'wah archive").
 */

export const STUDENT_MENU_ID = "student-navigation";
export const ADMIN_MENU_ID = "admin-navigation";

const exact = (path) => (pathname) => pathname === path || pathname === `${path}/`;
const within = (path) => (pathname) => pathname === path || pathname.startsWith(`${path}/`);

const isQuizArea = (pathname) => within("/dawah/quizzes")(pathname) || within("/dawah/attempts")(pathname);
const isArchiveArea = (pathname) => exact("/dawah")(pathname) || within("/dawah/events")(pathname) || within("/dawah/content")(pathname);

export const STUDENT_NAV = Object.freeze([
  { id: "home", label: "Home", to: "/", match: exact("/"), auth: true },
  { id: "dawah", label: "Da'wah archive", to: "/dawah", match: isArchiveArea },
  { id: "quizzes", label: "Quizzes", to: "/dawah/quizzes", match: isQuizArea, auth: true },
  { id: "classes", label: "Arabic classes", to: "/dawah/classes", match: within("/dawah/classes"), auth: true },
  { id: "results", label: "My results", to: "/profile/results", match: within("/profile/results"), auth: true },
  { id: "profile", label: "Profile", to: "/profile", match: exact("/profile"), auth: true },
  { id: "admin", label: "Admin panel", to: "/admin", match: within("/admin"), admin: true },
]);

/** Student/public sidebar entries for the current session. */
export function studentNavFor({ isAuthenticated, isAdmin }) {
  return STUDENT_NAV.filter((item) => (item.admin ? isAdmin : item.auth ? isAuthenticated : true));
}

export const ADMIN_NAV = Object.freeze([
  { id: "dashboard", label: "Dashboard", to: "/admin", match: exact("/admin") },
  { id: "students", label: "Students", to: "/admin/students", match: within("/admin/students") },
  { id: "events", label: "Events", to: "/admin/events", match: within("/admin/events") },
  { id: "content", label: "Content library", to: "/admin/content", match: within("/admin/content") },
  { id: "quizzes", label: "Quizzes", to: "/admin/quizzes", match: within("/admin/quizzes") },
  { id: "classes", label: "Arabic classes", to: "/admin/classes", match: within("/admin/classes") },
  // Compose, Drafts, History and Automations are tabs inside /admin/communication.
  { id: "communication", label: "Communication", to: "/admin/communication", match: within("/admin/communication") },
]);

/** Secondary admin links (leave the admin area). */
export const ADMIN_SECONDARY_NAV = Object.freeze([
  { id: "student-view", label: "Student view", to: "/", match: () => false },
  { id: "profile", label: "My profile", to: "/profile", match: () => false },
]);
