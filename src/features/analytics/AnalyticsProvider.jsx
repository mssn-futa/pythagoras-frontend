import { AnalyticsContext } from "./AnalyticsContext.js";

/** Makes one analytics controller (createAnalytics) available to the consent UI and route observer. */
export default function AnalyticsProvider({ analytics = null, children }) {
  return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>;
}
