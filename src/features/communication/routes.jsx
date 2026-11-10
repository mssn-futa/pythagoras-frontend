import BroadcastDetailPage from "./pages/BroadcastDetailPage.jsx";
import CommunicationLayout from "./pages/CommunicationLayout.jsx";
import ComposePage from "./pages/ComposePage.jsx";
import DraftsPage from "./pages/DraftsPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

/**
 * Communication route slot (D4). Mounted by App at /admin/* inside AdminLayout,
 * behind RequireAdmin (every D4 route is admin-only), so these paths are
 * /admin/communication, /drafts, /drafts/:id, /history and /history/:id.
 * Automations (COMM-07) and the rich editor (COMM-05) are added later.
 */
export const communicationRoutes = [
  {
    path: "communication",
    element: <CommunicationLayout />,
    children: [
      { index: true, element: <ComposePage /> },
      { path: "drafts", element: <DraftsPage /> },
      { path: "drafts/:id", element: <ComposePage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "history/:id", element: <BroadcastDetailPage /> },
    ],
  },
];

export default communicationRoutes;
