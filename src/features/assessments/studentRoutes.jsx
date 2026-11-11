import { lazyPage } from "../../routes/lazyPage.js";

// Route-level code splitting (PLAT-07): each page is its own chunk, loaded on first visit.
const AttemptPage = lazyPage(() => import("./student/pages/AttemptPage.jsx"));
const AvailableQuizzesPage = lazyPage(() => import("./student/pages/AvailableQuizzesPage.jsx"));
const ClassCatalogPage = lazyPage(() => import("./student/classes/pages/ClassCatalogPage.jsx"));
const ClassDetailPage = lazyPage(() => import("./student/classes/pages/ClassDetailPage.jsx"));
const ModulePage = lazyPage(() => import("./student/classes/pages/ModulePage.jsx"));
const QuizIntroPage = lazyPage(() => import("./student/pages/QuizIntroPage.jsx"));
const ResultPage = lazyPage(() => import("./student/pages/ResultPage.jsx"));
const ResultsHistoryPage = lazyPage(() => import("./student/pages/ResultsHistoryPage.jsx"));

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
