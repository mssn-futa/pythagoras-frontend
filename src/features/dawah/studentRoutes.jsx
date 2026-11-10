/**
 * Da'wah student/public route slot (D2: /dawah, /dawah/events/:id, /dawah/content/:id).
 * Mounted at /* inside the student Layout. Published content is public (A03),
 * so every entry is `public: true` (no RequireAuth, no bearer on its requests).
 */
import ArchivePage from "./public/pages/ArchivePage.jsx";
import ContentDetailPage from "./public/pages/ContentDetailPage.jsx";
import EventDetailPage from "./public/pages/EventDetailPage.jsx";

export const dawahStudentRoutes = [
  { path: "dawah", public: true, element: <ArchivePage /> },
  { path: "dawah/events/:id", public: true, element: <EventDetailPage /> },
  { path: "dawah/content/:id", public: true, element: <ContentDetailPage /> },
];

export default dawahStudentRoutes;
