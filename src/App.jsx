import { useContext } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
import AnalyticsProvider from "./features/analytics/AnalyticsProvider.jsx";
import ConsentBanner from "./features/analytics/ConsentBanner.jsx";
import PrivacyPage from "./features/analytics/PrivacyPage.jsx";
import RouteAnalytics from "./features/analytics/RouteAnalytics.jsx";
import AuthProvider from "./features/auth/AuthProvider.jsx";
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth } from "./features/auth/guards.jsx";
import Login from "./pages/login/Login";
import NotFound from "./pages/notFound/NotFound";
import RouteBoundary from "./routes/RouteBoundary.jsx";
import { renderRoutes, splitPublicRoutes } from "./routes/renderRoutes.jsx";
import { adminSlotRoutes, studentSlotRoutes } from "./routes/slots.js";
// Route-level code splitting (PLAT-07): page components come from routes/pages.js
// (lazy chunks). Guards and the student layout stay eager, so no page renders
// before its guard decides; the admin layout loads only behind RequireAdmin.
import { AdminDashboard, AdminLayout, Homepage, Profile, Register, StudentDashboard } from "./routes/pages.js";
import { preloadPath, preloadTreeFor, RoutePreloadContext } from "./routes/routePreload.js";

/** Admin branch: fetches the matched admin page's chunk in parallel with the admin layout chunk. */
function AdminArea() {
  const tree = useContext(RoutePreloadContext);
  const { pathname } = useLocation();
  preloadPath(tree, pathname); // idempotent: only starts (or reuses) chunk downloads
  return <AdminLayout />;
}

/*
 * Root routing (owned by PLAT-04). Domain packages add pages ONLY through
 * their slot modules in src/features/{dawah,assessments,communication}/.
 * Unavailable or deferred prototypes (verification flow, /academics,
 * /empowerment, sample-data /dawah and /admin/quizzes pages) stay unmounted.
 * Layouts hold their own Suspense/error boundary; the outer one covers
 * sign-in/up and pages outside a layout.
 */
export function AppRoutes({ adminRoutes = adminSlotRoutes, studentRoutes = studentSlotRoutes }) {
  const { publicRoutes, protectedRoutes } = splitPublicRoutes(studentRoutes);
  const preloadTree = preloadTreeFor(studentRoutes, adminRoutes);
  return (
    <RoutePreloadContext value={preloadTree}>
      <RouteBoundary>
        <Routes>
          <Route element={<RedirectIfAuthenticated />}>
            <Route path="/sign-in" element={<Login />} />
            <Route path="/sign-up" element={<Register />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Homepage />} />
              <Route path="profile" element={<Profile />} />
              {renderRoutes(protectedRoutes, "student")}
            </Route>
          </Route>

          {/* Public pages in the student layout; /privacy (PLAT-08 analytics consent) is always reachable. */}
          <Route path="/" element={<Layout />}>
            <Route path="privacy" element={<PrivacyPage />} />
            {renderRoutes(publicRoutes, "public")}
          </Route>

          <Route path="/admin" element={<RequireAdmin />}>
            <Route element={<AdminArea />}>
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<StudentDashboard />} />
              {renderRoutes(adminRoutes, "admin")}
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </RouteBoundary>
    </RoutePreloadContext>
  );
}

/**
 * The app inside a router: root routes plus the PLAT-08 analytics seams (route observer and
 * consent prompt). Both render nothing unless an analytics controller with a measurement ID is
 * provided, and both survive any analytics failure.
 */
const App = ({ adminRoutes = adminSlotRoutes, studentRoutes = studentSlotRoutes }) => (
  <>
    <AppRoutes adminRoutes={adminRoutes} studentRoutes={studentRoutes} />
    <RouteAnalytics preloadTree={preloadTreeFor(studentRoutes, adminRoutes)} />
    <ConsentBanner />
  </>
);

/**
 * Providers composed once for main.jsx (and the analytics browser harness): the analytics
 * controller from createAnalytics(), and the auth provider whose confirmed-registration hook
 * emits the single sign_up event.
 */
export function AppRoot({ analytics = null }) {
  return (
    <AnalyticsProvider analytics={analytics}>
      <AuthProvider onRegistered={analytics?.trackSignUp}>
        <App />
      </AuthProvider>
    </AnalyticsProvider>
  );
}

export default App;
