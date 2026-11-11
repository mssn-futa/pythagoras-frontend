import { createElement, lazy, useState } from "react";

/*
 * Route-level code splitting (PLAT-07). `lazyPage(() => import("./Page.jsx"))`
 * returns a component that suspends (nearest <Suspense>) until its chunk has
 * loaded, then renders the module's default export. Unlike React.lazy, a page
 * whose chunk is already loaded renders synchronously, and every page can be
 * preloaded ahead of navigation (`Page.preload()` / `preloadAllPages()`).
 * A failed download rejects into the nearest error boundary (RouteBoundary).
 */

const registry = new Set();

export function lazyPage(factory) {
  let Loaded = null;
  let pending = null;
  const preload = () => {
    // A rejection stays cached: re-rendering never re-requests in a loop; the
    // boundary's "Reload page" fetches a fresh copy of the app instead.
    pending ??= factory().then((module) => {
      Loaded = module.default;
      return Loaded;
    });
    return pending;
  };

  const Suspending = lazy(() => preload().then((Page) => ({ default: Page })));

  function LazyPage(props) {
    // Decided once per mount, so the page never switches component type (and
    // remounts) when its chunk arrives while it is on screen.
    const [ready] = useState(() => Loaded !== null);
    return createElement(ready ? Loaded : Suspending, props);
  }
  LazyPage.preload = preload;
  registry.add(preload);
  return LazyPage;
}

/** Loads every registered page chunk (used by tests; safe to call any time). */
export const preloadAllPages = () => Promise.all([...registry].map((preload) => preload()));
