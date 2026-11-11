import { createElement, lazy, useState, useSyncExternalStore } from "react";

/*
 * Route-level code splitting (PLAT-07). `lazyPage(() => import("./Page.jsx"))`
 * returns a component that suspends (nearest <Suspense>) until its chunk has
 * loaded, then renders the module's default export. Unlike React.lazy alone, a
 * page whose chunk is already loaded renders synchronously, and every page can
 * be preloaded ahead of navigation (`Page.preload()`, e.g. on link hover).
 * A failed download rejects into the nearest error boundary (RouteBoundary).
 *
 * Navigation runs in a React transition (React Router), so while a new page's
 * chunk downloads the old page stays on screen. `usePageLoading()` reports that
 * a page React is trying to render is still downloading, so layouts can show
 * a pending indicator. Hover/focus preloads do not count as pending.
 */

const registry = new Set();

// ---- pending-render store --------------------------------------------------
const rendering = new Set();
const listeners = new Set();
let notifyQueued = false;

function notify() {
  // Rendering code starts loads; never update subscribers synchronously during a render.
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    listeners.forEach((listener) => listener());
  });
}

function trackRender(promise) {
  if (rendering.has(promise)) return;
  rendering.add(promise);
  notify();
  const done = () => {
    rendering.delete(promise);
    notify();
  };
  promise.then(done, done);
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const isLoading = () => rendering.size > 0;

/** True while a page that React is rendering is still downloading its chunk. */
export const usePageLoading = () => useSyncExternalStore(subscribe, isLoading, () => false);

// ---- lazy pages ------------------------------------------------------------
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

  // React calls this factory only when it actually renders the page.
  const Suspending = lazy(() => {
    const request = preload();
    trackRender(request);
    return request.then((Page) => ({ default: Page }));
  });

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

/**
 * Starts loading the page chunk(s) behind a route element, if it has any.
 * Handles wrapper elements (e.g. <Suspense>{page}</Suspense>). Errors are
 * swallowed here: a failed preload surfaces when the page actually renders.
 */
export function preloadElement(element) {
  if (!element || typeof element !== "object") return;
  if (typeof element.type?.preload === "function") {
    element.type.preload().catch(() => {});
    return;
  }
  const children = element.props?.children;
  if (Array.isArray(children)) children.forEach(preloadElement);
  else preloadElement(children);
}
