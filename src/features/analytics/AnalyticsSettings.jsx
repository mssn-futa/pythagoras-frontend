import { useState } from "react";
import { useAnalytics, useAnalyticsState } from "./AnalyticsContext.js";
import { primaryButton, secondaryButton } from "./styles.js";

function statusText({ enabled, choice, optOutSignal }) {
  if (!enabled) return "Analytics is not used on this site.";
  if (optOutSignal) return "Your browser asks sites not to track you (Do Not Track or Global Privacy Control), so analytics stays off.";
  if (choice === "granted") return "Analytics is on. You allowed anonymous usage measurement.";
  if (choice === "denied") return "Analytics is off. Nothing is measured.";
  return "You have not chosen yet. Analytics stays off until you allow it.";
}

/** Current analytics choice with controls to allow, decline or withdraw (D1: persistent preference and withdrawal). */
export default function AnalyticsSettings() {
  const analytics = useAnalytics();
  const state = useAnalyticsState();
  const [notice, setNotice] = useState("");
  const canChoose = state.enabled && !state.optOutSignal;

  const allow = () => {
    analytics.accept();
    setNotice("Analytics allowed.");
  };
  const decline = () => {
    analytics.withdraw();
    setNotice(state.choice === "granted" ? "Consent withdrawn. Analytics cookies were removed." : "Analytics declined.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#1F2937] dark:text-white" data-testid="analytics-status">
        {statusText(state)}
      </p>
      {canChoose && (
        <div className="flex flex-wrap gap-2">
          {state.choice !== "granted" && (
            <button type="button" onClick={allow} className={primaryButton}>
              Allow analytics
            </button>
          )}
          {state.choice === "granted" && (
            <button type="button" onClick={decline} className={secondaryButton}>
              Withdraw consent
            </button>
          )}
          {state.choice === "unset" && (
            <button type="button" onClick={decline} className={secondaryButton}>
              Decline
            </button>
          )}
        </div>
      )}
      <p role="status" className="text-sm text-[#2A742F] dark:text-green-300 min-h-5">
        {notice}
      </p>
    </div>
  );
}
