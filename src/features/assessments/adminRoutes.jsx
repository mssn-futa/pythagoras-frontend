/**
 * Assessments admin route slot (D3 Frontend Design).
 * Mounted at /admin/* inside AdminLayout, behind RequireAdmin (see src/App.jsx).
 * Also mounts the Arabic class / module / roster admin (/admin/classes, ASSESS-08).
 */
import { lazyPage } from "../../routes/lazyPage.js";

// Route-level code splitting (PLAT-07): each page is its own chunk, loaded on first visit.
const ClassEditorPage = lazyPage(() => import("./admin/classes/pages/ClassEditorPage.jsx"));
const ClassListPage = lazyPage(() => import("./admin/classes/pages/ClassListPage.jsx"));
const ModuleEditorPage = lazyPage(() => import("./admin/classes/pages/ModuleEditorPage.jsx"));
const ModuleListPage = lazyPage(() => import("./admin/classes/pages/ModuleListPage.jsx"));
const RosterPage = lazyPage(() => import("./admin/classes/pages/RosterPage.jsx"));
const QuizEditorPage = lazyPage(() => import("./admin/pages/QuizEditorPage.jsx"));
const QuizListPage = lazyPage(() => import("./admin/pages/QuizListPage.jsx"));
const QuizResultsPage = lazyPage(() => import("./admin/pages/QuizResultsPage.jsx"));

export const assessmentAdminRoutes = [
  { path: "quizzes", element: <QuizListPage /> },
  { path: "quizzes/new", element: <QuizEditorPage key="new" /> },
  { path: "quizzes/:id", element: <QuizEditorPage key="existing" /> },
  { path: "quizzes/:id/results", element: <QuizResultsPage /> },
  { path: "classes", element: <ClassListPage /> },
  { path: "classes/new", element: <ClassEditorPage /> },
  { path: "classes/:id", element: <ClassEditorPage /> },
  { path: "classes/:id/modules", element: <ModuleListPage /> },
  { path: "classes/:id/modules/new", element: <ModuleEditorPage /> },
  { path: "classes/:id/modules/:moduleId", element: <ModuleEditorPage /> },
  { path: "classes/:id/roster", element: <RosterPage /> },
];

export default assessmentAdminRoutes;
