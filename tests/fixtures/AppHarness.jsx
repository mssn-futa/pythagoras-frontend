import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppRoutes } from '../../src/App.jsx'
import AuthProvider from '../../src/features/auth/AuthProvider.jsx'

// The real app WITHOUT preloading its lazy page chunks (PLAT-07): pages load on
// demand exactly as in the browser. Most suites use TestApp.jsx, which preloads.

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
