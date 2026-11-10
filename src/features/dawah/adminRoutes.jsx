import ContentPage from "./admin/pages/ContentPage.jsx";
import EventDetailPage from "./admin/pages/EventDetailPage.jsx";
import EventFormPage from "./admin/pages/EventFormPage.jsx";
import EventsListPage from "./admin/pages/EventsListPage.jsx";
import ResourceFormPage from "./admin/pages/ResourceFormPage.jsx";
import ResourcePage from "./admin/pages/ResourcePage.jsx";

/**
 * Da'wah admin route slot (D2: /admin/events, /admin/content, ...).
 *
 * Mounted by src/App.jsx at /admin/* inside AdminLayout, behind RequireAdmin
 * (admin role only); paths are relative to /admin. Navigation entries are
 * composed by PLAT-07, not here.
 */
export const dawahAdminRoutes = [
  { path: "events", element: <EventsListPage /> },
  { path: "events/new", element: <EventFormPage /> },
  { path: "events/:eventId", element: <EventDetailPage /> },
  { path: "events/:eventId/resources/new", element: <ResourceFormPage /> },
  { path: "events/:eventId/resources/:resourceId", element: <ResourcePage /> },
  { path: "content", element: <ContentPage /> },
];

export default dawahAdminRoutes;
