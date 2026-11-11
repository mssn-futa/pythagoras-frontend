import { useId, useLayoutEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAnalytics, useAnalyticsState } from "./AnalyticsContext.js";
import { primaryButton, secondaryButton } from "./styles.js";

/**
 * Non-modal opt-in prompt (D1: explicit opt-in). Shown only when analytics is configured, the
 * visitor has not chosen yet and the browser sends no Do Not Track / GPC signal. Nothing is
 * loaded until "Accept"; "Decline" and ignoring the banner keep every feature working.
 */
export default function ConsentBanner() {
  const analytics = useAnalytics();
  const { enabled, choice, optOutSignal } = useAnalyticsState();
  const { pathname } = useLocation();
  const titleId = useId();
  const textId = useId();
  const panel = useRef(null);
  // The settings page has the same controls inline.
  const visible = enabled && !optOutSignal && choice === "unset" && pathname !== "/privacy";

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
      className="fixed inset-x-0 bottom-0 z-[55] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl bg-white dark:bg-black text-[#1F2937] dark:text-white shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex-1 min-w-0 space-y-1">
          <h2 id={titleId} className="text-base font-semibold">
            Help us improve Pythagoras?
          </h2>
          <p id={textId} className="text-sm text-[#4B5563] dark:text-gray-300">
            With your permission we use Google Analytics to count page types visited and completed sign-ups. No names, emails, matric numbers or
            page content are sent. You can change this any time in{" "}
            <Link to="/privacy" className="text-[#2A742F] dark:text-[#04AF43] font-medium hover:underline">
              privacy settings
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
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
