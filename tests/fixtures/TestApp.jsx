import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppRoutes } from '../../src/App.jsx'
import AuthProvider from '../../src/features/auth/AuthProvider.jsx'

export function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

/** The real provider and root routes in a memory router, plus a location probe. */
export function TestApp({ path = '/', routeProps = {} }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes {...routeProps} />
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>
  )
}
