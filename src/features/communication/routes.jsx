import { lazy, Suspense } from "react";
import { RouteLoading } from "../../routes/RouteBoundary.jsx";
import CommunicationLayout from "./pages/CommunicationLayout.jsx";

// Route-level code splitting (PLAT-07): each tab page is its own chunk, loaded on first visit.
// The tab shell stays eager; tab pages suspend inside it so the tabs do not flash.
const tab = (page) => <Suspense fallback={<RouteLoading />}>{page}</Suspense>;
const AutomationRulePage = lazy(() => import("./pages/AutomationRulePage.jsx"));
const AutomationsPage = lazy(() => import("./pages/AutomationsPage.jsx"));
const BroadcastDetailPage = lazy(() => import("./pages/BroadcastDetailPage.jsx"));
const ComposePage = lazy(() => import("./pages/ComposePage.jsx"));
const DraftsPage = lazy(() => import("./pages/DraftsPage.jsx"));
const HistoryPage = lazy(() => import("./pages/HistoryPage.jsx"));

/**
 * Communication route slot (D4). Mounted by App at /admin/* inside AdminLayout,
 * behind RequireAdmin (every D4 route is admin-only), so these paths are
 * /admin/communication, /drafts, /drafts/:id, /history and /history/:id.
 * COMM-07 adds /automations, /automations/new and /automations/:id (rules, preview, run history).
 */
export const communicationRoutes = [
  {
    path: "communication",
    element: <CommunicationLayout />,
    children: [
      { index: true, element: tab(<ComposePage />) },
      { path: "drafts", element: tab(<DraftsPage />) },
      { path: "drafts/:id", element: tab(<ComposePage />) },
      { path: "history", element: tab(<HistoryPage />) },
      { path: "history/:id", element: tab(<BroadcastDetailPage />) },
      { path: "automations", element: tab(<AutomationsPage />) },
      { path: "automations/new", element: tab(<AutomationRulePage />) },
      { path: "automations/:id", element: tab(<AutomationRulePage />) },
    ],
  },
];

export default communicationRoutes;
