import AttemptPage from "./student/pages/AttemptPage.jsx";
import AvailableQuizzesPage from "./student/pages/AvailableQuizzesPage.jsx";
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
  { path: "dawah/quizzes", element: <AvailableQuizzesPage /> },
  { path: "dawah/quizzes/:id", element: <QuizIntroPage /> },
  { path: "dawah/attempts/:id", element: <AttemptPage /> },
  { path: "profile/results", element: <ResultsHistoryPage /> },
  { path: "profile/results/:id", element: <ResultPage /> },
];

export default assessmentStudentRoutes;
