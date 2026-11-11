import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

/** Media query subscription. Without matchMedia (tests, old browsers) it reports `fallback`. */
export function useMediaQuery(query, fallback = true) {
  const subscribe = useCallback(
    (notify) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener?.("change", notify);
      return () => list.removeEventListener?.("change", notify);
    },
    [query],
  );
  const read = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback);
  return useSyncExternalStore(subscribe, read, () => fallback);
}

/**
 * Off-canvas menu state shared by the student and admin layouts.
 * - closes on navigation and on Escape (returning focus to the toggle);
 * - moves focus into the menu when it opens;
 * - while closed on a small screen the panel is `inert`, so its off-screen
 *   links are not reachable by Tab or assistive technology.
 */
export function useMobileMenu(desktopQuery) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery(desktopQuery);
  const { pathname } = useLocation();
  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const [seenPath, setSeenPath] = useState(pathname);

  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  const close = useCallback(({ restoreFocus = false } = {}) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector("a, button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") close({ restoreFocus: true });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return {
    open,
    isDesktop,
    toggle: () => setOpen((value) => !value),
    close,
    toggleRef,
    panelRef,
    hiddenOffCanvas: !open && !isDesktop,
  };
}
