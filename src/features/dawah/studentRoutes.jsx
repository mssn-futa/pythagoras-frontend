/**
 * Da'wah student/public route slot (D2: /dawah, /dawah/events/:id, /dawah/content/:id).
 * Mounted at /* inside the student Layout. Published content is public (A03),
 * so every entry is `public: true` (no RequireAuth, no bearer on its requests).
 */
import { lazy } from "react";

// Route-level code splitting (PLAT-07): each page is its own chunk, loaded on first visit.
const ArchivePage = lazy(() => import("./public/pages/ArchivePage.jsx"));
const ContentDetailPage = lazy(() => import("./public/pages/ContentDetailPage.jsx"));
const EventDetailPage = lazy(() => import("./public/pages/EventDetailPage.jsx"));

export const dawahStudentRoutes = [
  { path: "dawah", public: true, element: <ArchivePage /> },
  { path: "dawah/events/:id", public: true, element: <EventDetailPage /> },
  { path: "dawah/content/:id", public: true, element: <ContentDetailPage /> },
];

export default dawahStudentRoutes;
