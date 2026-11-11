import { createContext, createElement, useCallback, useContext } from "react";
import { matchRoutes } from "react-router-dom";
import { preloadElement } from "./lazyPage.js";
import { AdminDashboard, AdminLayout, Homepage, Profile, StudentDashboard } from "./pages.js";

/*
 * Link-intent preloading (PLAT-07): navigation links call the function from
 * usePreloadRoute() on hover/focus so the destination's page chunk is usually
 * ready before the click. The route tree mirrors App's composition and is
 * provided by AppRoutes, so it always matches the mounted slots.
 */

export function buildPreloadTree({ studentRoutes, adminRoutes }) {
  return [
    {
      path: "/",
      children: [
        { index: true, element: createElement(Homepage) },
        { path: "profile", element: createElement(Profile) },
        ...studentRoutes,
      ],
    },
    {
      path: "/admin",
      admin: true,
      children: [
        { index: true, element: createElement(AdminDashboard) },
        { path: "students", element: createElement(StudentDashboard) },
        ...adminRoutes,
      ],
    },
  ];
}

const trees = new WeakMap();

/** Cached per (studentRoutes, adminRoutes) pair, so the context value is stable. */
export function preloadTreeFor(studentRoutes, adminRoutes) {
  let byAdmin = trees.get(studentRoutes);
  if (!byAdmin) trees.set(studentRoutes, (byAdmin = new WeakMap()));
  let tree = byAdmin.get(adminRoutes);
  if (!tree) byAdmin.set(adminRoutes, (tree = buildPreloadTree({ studentRoutes, adminRoutes })));
  return tree;
}

export const RoutePreloadContext = createContext(null);

/** Starts loading every page chunk a pathname would render (no-op outside AppRoutes). */
export function preloadPath(tree, pathname) {
  if (!tree) return;
  const matches = matchRoutes(tree, pathname) ?? [];
  // Only admins are shown /admin links, so only they ever fetch the admin layout chunk.
  if (matches.some((match) => match.route.admin)) AdminLayout.preload().catch(() => {});
  matches.forEach((match) => preloadElement(match.route.element));
}

export function usePreloadRoute() {
  const tree = useContext(RoutePreloadContext);
  return useCallback((pathname) => preloadPath(tree, pathname), [tree]);
}

/** Props for a link that preloads its destination on hover, focus or touch. */
export function usePreloadLinkProps() {
  const preload = usePreloadRoute();
  return useCallback(
    (to) => {
      const start = () => preload(to);
      return { onMouseEnter: start, onFocus: start, onTouchStart: start };
    },
    [preload],
  );
}
