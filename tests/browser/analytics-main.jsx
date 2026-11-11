import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../../src/index.css'
import { AppRoot } from '../../src/App.jsx'
import { createAnalytics } from '../../src/features/analytics/analytics.js'
import { readAnalyticsConfig } from '../../src/features/analytics/config.js'

// PLAT-08 harness: the real app (same AppRoot as src/main.jsx) with a synthetic GA4 measurement ID,
// served under /ga-harness/* so the shared browser server keeps analytics off for every other spec.
const HARNESS_BASE = '/ga-harness'
const analytics = createAnalytics(readAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: 'G-PLAT08TEST' }))

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={HARNESS_BASE}>
    <AppRoot analytics={analytics} />
  </BrowserRouter>,
)
