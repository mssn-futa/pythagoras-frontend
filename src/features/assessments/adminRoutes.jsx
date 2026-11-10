/**
 * Assessments admin route slot (D3 Frontend Design).
 * Mounted at /admin/* inside AdminLayout, behind RequireAdmin (see src/App.jsx).
 * Also mounts the Arabic class / module / roster admin (/admin/classes, ASSESS-08).
 */
import ClassEditorPage from "./admin/classes/pages/ClassEditorPage.jsx";
import ClassListPage from "./admin/classes/pages/ClassListPage.jsx";
import ModuleEditorPage from "./admin/classes/pages/ModuleEditorPage.jsx";
import ModuleListPage from "./admin/classes/pages/ModuleListPage.jsx";
import RosterPage from "./admin/classes/pages/RosterPage.jsx";
import QuizEditorPage from "./admin/pages/QuizEditorPage.jsx";
import QuizListPage from "./admin/pages/QuizListPage.jsx";
import QuizResultsPage from "./admin/pages/QuizResultsPage.jsx";

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
