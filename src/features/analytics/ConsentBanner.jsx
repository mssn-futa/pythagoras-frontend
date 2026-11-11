import { useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAnalytics, useAnalyticsState } from "./AnalyticsContext.js";
import { primaryButton, secondaryButton } from "./styles.js";

const MODAL_SELECTOR = '[aria-modal="true"], dialog[open]';

function subscribeToModals(onChange) {
  if (typeof MutationObserver !== "function") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-modal", "open"] });
  return () => observer.disconnect();
}
const modalOpen = () => document.querySelector(MODAL_SELECTOR) !== null;

/** True while any modal dialog (aria-modal or an open <dialog>) is in the document. */
function useModalOpen() {
  return useSyncExternalStore(subscribeToModals, modalOpen, () => false);
}

/**
 * Non-modal opt-in prompt (D1: explicit opt-in). Shown only when analytics is configured, the
 * visitor has not chosen yet and the browser sends no Do Not Track / GPC signal. Nothing is
 * loaded until "Accept"; "Decline" and ignoring the banner keep every feature working.
 * Stacking: z-44 sits above the navbar (z-30) and the mobile-menu dim (z-40) but below drawers,
 * the open sidebar and dialogs (z-45+/z-50); it also steps aside entirely while a modal dialog is open.
 */
export default function ConsentBanner() {
  const analytics = useAnalytics();
  const { enabled, choice, optOutSignal } = useAnalyticsState();
  const { pathname } = useLocation();
  const titleId = useId();
  const textId = useId();
  const panel = useRef(null);
  const dialogOpen = useModalOpen();
  // The settings page has the same controls inline.
  const visible = enabled && !optOutSignal && choice === "unset" && pathname !== "/privacy" && !dialogOpen;

  // While shown, reserve its height at the end of the page so it never permanently hides the last controls.
  useLayoutEffect(() => {
    if (!visible || !panel.current) return undefined;
    const body = document.body;
    const previous = body.style.paddingBottom;
    const reserve = () => {
      body.style.paddingBottom = `${panel.current?.offsetHeight ?? 0}px`;
    };
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(panel.current);
    return () => {
      observer?.disconnect();
      body.style.paddingBottom = previous;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-testid="analytics-consent"
      ref={panel}
      className="fixed inset-x-0 bottom-0 z-[44] p-2 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl bg-white dark:bg-black text-[#1F2937] dark:text-white shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
        <div className="flex-1 min-w-0 space-y-1">
          <h2 id={titleId} className="text-sm sm:text-base font-semibold">
            Help us improve Pythagoras?
          </h2>
          <p id={textId} className="text-xs sm:text-sm text-[#4B5563] dark:text-gray-300">
            <span className="sm:hidden">Optional Google Analytics, only with your permission. No personal data is sent. Change it any time in{" "}</span>
            <span className="hidden sm:inline">
              With your permission we use Google Analytics to count page types visited and completed sign-ups. No names, emails, matric numbers or
              page content are sent. You can change this any time in{" "}
            </span>
            <Link to="/privacy" className="text-[#2A742F] dark:text-[#04AF43] font-medium hover:underline">
              privacy settings
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none [&>button]:py-2 sm:[&>button]:py-2.5">
          <button type="button" onClick={analytics.decline} className={secondaryButton}>
            Decline
          </button>
          <button type="button" onClick={analytics.accept} className={primaryButton}>
            Accept
          </button>
        </div>
      </div>
    </section>
  );
}
