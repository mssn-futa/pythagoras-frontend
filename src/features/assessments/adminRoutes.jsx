/**
 * Assessments admin route slot (D3 Frontend Design).
 * Mounted at /admin/* inside AdminLayout, behind RequireAdmin (see src/App.jsx).
 * Arabic classes/modules (/admin/classes) belong to ASSESS-08 and are not here.
 */
import QuizEditorPage from "./admin/pages/QuizEditorPage.jsx";
import QuizListPage from "./admin/pages/QuizListPage.jsx";
import QuizResultsPage from "./admin/pages/QuizResultsPage.jsx";

export const assessmentAdminRoutes = [
  { path: "quizzes", element: <QuizListPage /> },
  { path: "quizzes/new", element: <QuizEditorPage key="new" /> },
  { path: "quizzes/:id", element: <QuizEditorPage key="existing" /> },
  { path: "quizzes/:id/results", element: <QuizResultsPage /> },
];

export default assessmentAdminRoutes;
