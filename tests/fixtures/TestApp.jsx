import { preloadAllPages } from '../../src/routes/lazyPage.js'

// The app loads route pages as lazy chunks (PLAT-07). Load them all up front, so
// pages render synchronously in tests as they did before code splitting. The
// on-demand path is covered with AppHarness.jsx in tests/behavior/route-splitting.test.jsx.
await preloadAllPages()

export { LocationProbe, TestApp } from './AppHarness.jsx'
