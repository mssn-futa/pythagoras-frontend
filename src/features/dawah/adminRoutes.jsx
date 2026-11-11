import { lazyPage } from "../../routes/lazyPage.js";

// Route-level code splitting (PLAT-07): each page is its own chunk, loaded on first visit.
const ContentPage = lazyPage(() => import("./admin/pages/ContentPage.jsx"));
const EventDetailPage = lazyPage(() => import("./admin/pages/EventDetailPage.jsx"));
const EventFormPage = lazyPage(() => import("./admin/pages/EventFormPage.jsx"));
const EventsListPage = lazyPage(() => import("./admin/pages/EventsListPage.jsx"));
const ResourceFormPage = lazyPage(() => import("./admin/pages/ResourceFormPage.jsx"));
const ResourcePage = lazyPage(() => import("./admin/pages/ResourcePage.jsx"));

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
