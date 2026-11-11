import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppRoutes } from '../../src/App.jsx'
import AuthProvider from '../../src/features/auth/AuthProvider.jsx'
import { preloadAllPages } from '../../src/routes/lazyPage.js'

// The app loads route pages as lazy chunks (PLAT-07). Load them all up front, so
// pages render synchronously in tests as they did before code splitting; the
// lazy boundaries themselves are covered by tests/behavior/release-navigation.test.jsx.
await preloadAllPages()

/** Shows the current location; optionally records every location visited. */
export function LocationProbe({ history }) {
  const location = useLocation()
  const current = `${location.pathname}${location.search}`
  useEffect(() => {
    history?.push(current)
  }, [history, current])
  return <div data-testid="location">{current}</div>
}

/** The real provider and root routes in a memory router, plus a location probe. */
export function TestApp({ path = '/', routeProps = {}, history }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes {...routeProps} />
        <LocationProbe history={history} />
      </AuthProvider>
    </MemoryRouter>
  )
}
