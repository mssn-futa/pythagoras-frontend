/**
 * Assessments student route slot (D3: student quizzes, attempts, classes/modules).
 *
 * Owned by the domain work packages; PLAT-04 owns where it is mounted (src/App.jsx).
 * Mounted at: /* inside the student Layout, behind RequireAuth.
 * Entries are react-router route objects with RELATIVE paths, e.g.
 *   { path: "events", element: <EventsPage /> }
 *   { path: "events/:id", element: <EventDetail /> }
 *   { path: "content", children: [{ index: true, element: <ContentList /> }] }
 * Import only pages that exist in this repository. Keep the list empty until
 * a feature is really available (D0: unavailable features stay unmounted).
 * `public: true` on a top-level entry mounts it without RequireAuth; assessments
 * require authentication (A03), so do not use it here without a design change.
 */
export const assessmentStudentRoutes = [];

export default assessmentStudentRoutes;
