import { createContext, useContext, useSyncExternalStore } from "react";

export const AnalyticsContext = createContext(null);

const DISABLED = Object.freeze({ enabled: false, choice: "unset", optOutSignal: false, active: false, scriptStatus: "idle", withdrawnByReload: false });
const subscribeNone = () => () => {};
const disabledSnapshot = () => DISABLED;

/** The analytics controller, or null outside <AnalyticsProvider> (then everything is off). */
export const useAnalytics = () => useContext(AnalyticsContext);

/** { enabled, choice, optOutSignal, active, scriptStatus }; re-renders on consent/script changes. */
export function useAnalyticsState() {
  const analytics = useAnalytics();
  return useSyncExternalStore(analytics?.subscribe ?? subscribeNone, analytics?.getSnapshot ?? disabledSnapshot, analytics?.getSnapshot ?? disabledSnapshot);
}
