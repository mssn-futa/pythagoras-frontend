import { lazyPage } from "./lazyPage.js";

// Pages App mounts itself (PLAT-07 code splitting). Sign-in and Not found stay
// in the entry chunk (first screen for anonymous visitors); these load on demand.
export const AdminLayout = lazyPage(() => import("../components/layout/AdminLayout.jsx"));
export const AdminDashboard = lazyPage(() => import("../pages/admin/AdminDashboard.jsx"));
export const StudentDashboard = lazyPage(() => import("../pages/admin/student/StudentDashboard.jsx"));
export const Profile = lazyPage(() => import("../pages/profile/Profile.jsx"));
export const Register = lazyPage(() => import("../pages/register/Register.jsx"));
export const Homepage = lazyPage(() => import("../pages/student/HomePage.jsx"));
