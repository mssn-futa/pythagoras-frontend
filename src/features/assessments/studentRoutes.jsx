import AttemptPage from "./student/pages/AttemptPage.jsx";
import AvailableQuizzesPage from "./student/pages/AvailableQuizzesPage.jsx";
import ClassCatalogPage from "./student/classes/pages/ClassCatalogPage.jsx";
import ClassDetailPage from "./student/classes/pages/ClassDetailPage.jsx";
import ModulePage from "./student/classes/pages/ModulePage.jsx";
import QuizIntroPage from "./student/pages/QuizIntroPage.jsx";
import ResultPage from "./student/pages/ResultPage.jsx";
import ResultsHistoryPage from "./student/pages/ResultsHistoryPage.jsx";

/**
 * Assessments student route slot (D3 "Frontend Design").
 * Mounted at /* inside the student Layout, behind RequireAuth (assessments are
 * private, A03). Relative paths. `/profile/results*` are siblings of the root
 * `profile` route, which has no children.
 */
export const assessmentStudentRoutes = [
  { path: "dawah/classes", element: <ClassCatalogPage /> },
  { path: "dawah/classes/:id", element: <ClassDetailPage /> },
  { path: "dawah/classes/:id/modules/:moduleId", element: <ModulePage /> },
  { path: "dawah/quizzes", element: <AvailableQuizzesPage /> },
  { path: "dawah/quizzes/:id", element: <QuizIntroPage /> },
  { path: "dawah/attempts/:id", element: <AttemptPage /> },
  { path: "profile/results", element: <ResultsHistoryPage /> },
  { path: "profile/results/:id", element: <ResultPage /> },
];

export default assessmentStudentRoutes;
