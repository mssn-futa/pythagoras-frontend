/**
 * Assessments admin route slot (D3: /admin/quizzes, /admin/quizzes/new, /admin/classes, ...).
 *
 * Owned by the domain work packages; PLAT-04 owns where it is mounted (src/App.jsx).
 * Mounted at: /admin/* inside AdminLayout, behind RequireAdmin.
 * Entries are react-router route objects with RELATIVE paths, e.g.
 *   { path: "events", element: <EventsPage /> }
 *   { path: "events/:id", element: <EventDetail /> }
 *   { path: "content", children: [{ index: true, element: <ContentList /> }] }
 * Import only pages that exist in this repository. Keep the list empty until
 * a feature is really available (D0: unavailable features stay unmounted).
 */
export const assessmentAdminRoutes = [];

export default assessmentAdminRoutes;
