import { useContext, useEffect, useMemo, useRef } from "react";
import { useHref, useLocation } from "react-router-dom";
import { AuthContext } from "../auth/AuthContext.js";
import { useAnalytics } from "./AnalyticsContext.js";
import { analyticsRouteTree, describeRoute, FALLBACK_TITLE, NOT_FOUND_TEMPLATE, PAGE_TITLES } from "./routeTemplates.js";

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
  const rootHref = useHref("/");

  // Lets the adapter sanitize a URL BEFORE the router commits it (history hooks): strip the router basename,
  // then template the rest; anything outside the app's basename is "not found".
  useEffect(() => {
    if (!analytics?.enabled) return undefined;
    const basename = rootHref.replace(/\/+$/, "");
    analytics.setPageResolver?.((pathname) => {
      if (basename && pathname !== basename && !pathname.startsWith(`${basename}/`)) {
        return { template: NOT_FOUND_TEMPLATE, title: PAGE_TITLES[NOT_FOUND_TEMPLATE] ?? FALLBACK_TITLE };
      }
      return describeRoute(tree, pathname.slice(basename.length) || "/");
    });
    return () => analytics.setPageResolver?.(null);
  }, [analytics, rootHref, tree]);

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
