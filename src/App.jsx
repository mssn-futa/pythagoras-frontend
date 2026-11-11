import { lazyPage } from "./routes/lazyPage.js";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth } from "./features/auth/guards.jsx";
import Login from "./pages/login/Login";
import NotFound from "./pages/notFound/NotFound";
import RouteBoundary from "./routes/RouteBoundary.jsx";
import { renderRoutes, splitPublicRoutes } from "./routes/renderRoutes.jsx";
import { adminSlotRoutes, studentSlotRoutes } from "./routes/slots.js";

// Route-level code splitting (PLAT-07). Sign-in and Not found stay in the entry
// chunk (first screen for anonymous visitors); every other page loads on demand.
// Guards and the student layout stay eager, so no page renders before its guard
// decides; the admin layout (admin-only code) loads behind RequireAdmin.
const AdminLayout = lazyPage(() => import("./components/layout/AdminLayout"));
const AdminDashboard = lazyPage(() => import("./pages/admin/AdminDashboard"));
const StudentDashboard = lazyPage(() => import("./pages/admin/student/StudentDashboard"));
const Profile = lazyPage(() => import("./pages/profile/Profile"));
const Register = lazyPage(() => import("./pages/register/Register"));
const Homepage = lazyPage(() => import("./pages/student/HomePage"));

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
  return (
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

        {publicRoutes.length > 0 && (
          <Route path="/" element={<Layout />}>
            {renderRoutes(publicRoutes, "public")}
          </Route>
        )}

        <Route path="/admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<StudentDashboard />} />
            {renderRoutes(adminRoutes, "admin")}
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </RouteBoundary>
  );
}

const App = () => <AppRoutes />;

export default App;
