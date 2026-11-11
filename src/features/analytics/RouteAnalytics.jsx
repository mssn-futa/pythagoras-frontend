import { useContext, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../auth/AuthContext.js";
import { useAnalytics } from "./AnalyticsContext.js";
import { analyticsRouteTree, describeRoute } from "./routeTemplates.js";

/** Long enough for guard redirects (<Navigate> runs in an effect) to replace the location first. */
export const SETTLE_DELAY_MS = 300;

/**
 * Root route observer: one page_view per COMPLETED navigation (D1).
 * React Router commits a navigation inside a transition, so the committed location already
 * has its page chunk. The observer then waits for session restoration (guards show a loader)
 * and a short settle delay, so a redirect chain (/profile → /sign-in) counts once, as its
 * final page. Query-only or hash-only changes are not new pages. Renders nothing.
 */
export default function RouteAnalytics({ preloadTree, delay = SETTLE_DELAY_MS }) {
  const analytics = useAnalytics();
  const auth = useContext(AuthContext);
  const restoring = auth?.status === "restoring";
  const { pathname } = useLocation();
  const tree = useMemo(() => analyticsRouteTree(preloadTree), [preloadTree]);
  const reported = useRef(null);

  useEffect(() => {
    if (!analytics?.enabled || restoring) return undefined;
    const timer = setTimeout(() => {
      if (reported.current === pathname) return;
      reported.current = pathname;
      try {
        analytics.completeNavigation(describeRoute(tree, pathname));
      } catch {
        /* analytics never breaks navigation */
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [analytics, restoring, pathname, tree, delay]);

  return null;
}
