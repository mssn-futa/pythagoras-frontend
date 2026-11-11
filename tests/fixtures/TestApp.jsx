import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppRoutes } from '../../src/App.jsx'
import AuthProvider from '../../src/features/auth/AuthProvider.jsx'

// The app loads route pages as React.lazy chunks (PLAT-07). Import them up front
// so a test's first render does not spend module-transform time inside its
// async timeouts; the lazy boundaries themselves are covered by
// tests/behavior/release-navigation.test.jsx.
import.meta.glob(
  [
    '../../src/features/**/pages/*.jsx',
    '../../src/pages/student/HomePage.jsx',
    '../../src/pages/admin/AdminDashboard.jsx',
    '../../src/pages/admin/student/StudentDashboard.jsx',
    '../../src/pages/profile/Profile.jsx',
    '../../src/pages/register/Register.jsx',
    '../../src/components/layout/AdminLayout.jsx',
  ],
  { eager: true },
)

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
