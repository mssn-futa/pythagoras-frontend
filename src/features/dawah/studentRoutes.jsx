/**
 * Da'wah student/public route slot (D2: /dawah, /dawah/events/:id, /dawah/content/:id).
 *
 * Owned by the domain work packages; PLAT-04 owns where it is mounted (src/App.jsx).
 * Mounted at: /* inside the student Layout, behind RequireAuth.
 * Entries are react-router route objects with RELATIVE paths, e.g.
 *   { path: "events", element: <EventsPage /> }
 *   { path: "events/:id", element: <EventDetail /> }
 *   { path: "content", children: [{ index: true, element: <ContentList /> }] }
 * Import only pages that exist in this repository. Keep the list empty until
 * a feature is really available (D0: unavailable features stay unmounted).
 * Published content is public (A03): set `public: true` on a top-level entry to
 * mount it inside the student Layout WITHOUT RequireAuth (signed-out readers).
 */
export const dawahStudentRoutes = [];

export default dawahStudentRoutes;
