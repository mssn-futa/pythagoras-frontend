/**
 * Communication route slot (D4: /admin/communication compose/drafts/history, automation).
 *
 * Owned by the domain work packages; PLAT-04 owns where it is mounted (src/App.jsx).
 * Mounted at: /admin/* inside AdminLayout, behind RequireAdmin (every D4 route is admin-only).
 * Entries are react-router route objects with RELATIVE paths, e.g.
 *   { path: "events", element: <EventsPage /> }
 *   { path: "events/:id", element: <EventDetail /> }
 *   { path: "content", children: [{ index: true, element: <ContentList /> }] }
 * Import only pages that exist in this repository. Keep the list empty until
 * a feature is really available (D0: unavailable features stay unmounted).
 */
export const communicationRoutes = [];

export default communicationRoutes;
