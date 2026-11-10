import { Route, Routes } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import Layout from "./components/layout/Layout";
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth } from "./features/auth/guards.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentDashboard from "./pages/admin/student/StudentDashboard";
import Login from "./pages/login/Login";
import NotFound from "./pages/notFound/NotFound";
import Profile from "./pages/profile/Profile";
import Register from "./pages/register/Register";
import Homepage from "./pages/student/HomePage";
import { renderRoutes, splitPublicRoutes } from "./routes/renderRoutes.jsx";
import { adminSlotRoutes, studentSlotRoutes } from "./routes/slots.js";

/*
 * Root routing (owned by PLAT-04). Domain packages add pages ONLY through
 * their slot modules in src/features/{dawah,assessments,communication}/.
 * Unavailable or deferred prototypes (verification flow, /academics,
 * /empowerment, sample-data /dawah and /admin/quizzes pages) stay unmounted.
 */
export function AppRoutes({ adminRoutes = adminSlotRoutes, studentRoutes = studentSlotRoutes }) {
  const { publicRoutes, protectedRoutes } = splitPublicRoutes(studentRoutes);
  return (
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
  );
}

const App = () => <AppRoutes />;

export default App;
