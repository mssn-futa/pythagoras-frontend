import { createRoot } from "react-dom/client";
import "./index.css";
import { AppRoot } from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { createAnalytics } from "./features/analytics/analytics.js";
import { readAnalyticsConfig } from "./features/analytics/config.js";

// PLAT-08: analytics is off unless VITE_GA_MEASUREMENT_ID is set, and then loads only after consent.
const analytics = createAnalytics(readAnalyticsConfig(import.meta.env));

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppRoot analytics={analytics} />
  </BrowserRouter>
);
