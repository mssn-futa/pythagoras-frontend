import { matchRoutes } from "react-router-dom";

/*
 * Sanitized page identity for analytics (D0/D1): a location becomes its ROUTE TEMPLATE
 * (e.g. /dawah/events/:id) and a generic title. Concrete IDs, query strings, fragments,
 * names and page content never leave this module. Unknown paths become /not-found.
 */

export const NOT_FOUND_TEMPLATE = "/not-found";
export const FALLBACK_TITLE = "Pythagoras";

/** Generic titles per template. A template without an entry is reported as "Pythagoras". */
export const PAGE_TITLES = Object.freeze({
  "/": "Home",
  "/sign-in": "Sign in",
  "/sign-up": "Sign up",
  "/privacy": "Privacy settings",
  "/profile": "Profile",
  "/profile/results": "Quiz results",
  "/profile/results/:id": "Quiz result",
  [NOT_FOUND_TEMPLATE]: "Page not found",
  "/dawah": "Da'wah archive",
  "/dawah/events/:id": "Event details",
  "/dawah/content/:id": "Content details",
  "/dawah/classes": "Arabic classes",
  "/dawah/classes/:id": "Class details",
  "/dawah/classes/:id/modules/:moduleId": "Class module",
  "/dawah/quizzes": "Quizzes",
  "/dawah/quizzes/:id": "Quiz introduction",
  "/dawah/attempts/:id": "Quiz attempt",
  "/admin": "Admin dashboard",
  "/admin/students": "Admin students",
  "/admin/events": "Admin events",
  "/admin/events/new": "Admin new event",
  "/admin/events/:eventId": "Admin event",
  "/admin/events/:eventId/resources/new": "Admin new event resource",
  "/admin/events/:eventId/resources/:resourceId": "Admin event resource",
  "/admin/content": "Admin content",
  "/admin/quizzes": "Admin quizzes",
  "/admin/quizzes/new": "Admin new quiz",
  "/admin/quizzes/:id": "Admin quiz",
  "/admin/quizzes/:id/results": "Admin quiz results",
  "/admin/classes": "Admin classes",
  "/admin/classes/new": "Admin new class",
  "/admin/classes/:id": "Admin class",
  "/admin/classes/:id/modules": "Admin class modules",
  "/admin/classes/:id/modules/new": "Admin new class module",
  "/admin/classes/:id/modules/:moduleId": "Admin class module",
  "/admin/classes/:id/roster": "Admin class roster",
  "/admin/communication": "Admin compose broadcast",
  "/admin/communication/drafts": "Admin broadcast drafts",
  "/admin/communication/drafts/:id": "Admin broadcast draft",
  "/admin/communication/history": "Admin broadcast history",
  "/admin/communication/history/:id": "Admin broadcast",
  "/admin/communication/automations": "Admin automations",
  "/admin/communication/automations/new": "Admin new automation",
  "/admin/communication/automations/:id": "Admin automation",
});

/** Pages App mounts outside the preload tree (it only mirrors the two layouts). */
const STANDALONE_ROUTES = [{ path: "/sign-in" }, { path: "/sign-up" }, { path: "/privacy" }];

/** Route tree for template matching: App's layouts (preload tree) plus its standalone pages. */
export const analyticsRouteTree = (preloadTree) => [...STANDALONE_ROUTES, ...(preloadTree ?? [])];

/** Joins matched route paths: ["/", "dawah/events/:id"] → "/dawah/events/:id". */
function templateOf(matches) {
  const segments = matches
    .map((match) => match.route.path)
    .filter((path) => typeof path === "string" && path !== "")
    .flatMap((path) => path.split("/"))
    .filter(Boolean)
    // Only route-definition segments survive: literals and :params. A splat would echo the raw path.
    .map((segment) => (segment === "*" ? ":rest" : segment));
  return `/${segments.join("/")}`;
}

/** { template, title } for a pathname. Never echoes the concrete pathname. */
export function describeRoute(tree, pathname) {
  let matches = null;
  try {
    matches = matchRoutes(tree ?? [], String(pathname ?? "/"));
  } catch {
    matches = null;
  }
  const template = matches?.length ? templateOf(matches) : NOT_FOUND_TEMPLATE;
  return { template, title: PAGE_TITLES[template] ?? FALLBACK_TITLE };
}
