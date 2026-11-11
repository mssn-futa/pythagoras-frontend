import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  LogOut,
  Mail,
  Menu,
  User,
  Users,
  X,
} from "lucide-react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useSignOut } from "../../features/auth/useSignOut.js";
import RouteBoundary, { PageLoadingIndicator } from "../../routes/RouteBoundary.jsx";
import { usePageLoading } from "../../routes/lazyPage.js";
import { usePreloadLinkProps } from "../../routes/routePreload.js";
import { ADMIN_MENU_ID, ADMIN_NAV, ADMIN_SECONDARY_NAV } from "./navigation.js";
import { useMobileMenu } from "./useMobileMenu.js";

const ICONS = {
  dashboard: BarChart3,
  students: Users,
  events: CalendarDays,
  content: BookOpen,
  quizzes: ClipboardList,
  classes: GraduationCap,
  communication: Mail,
  "student-view": Home,
  profile: User,
};

const linkClass = (active) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
    active ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
  }`;

function NavItem({ item, pathname, onNavigate }) {
  const Icon = ICONS[item.id];
  const active = item.match(pathname);
  const preloadProps = usePreloadLinkProps();
  return (
    <Link to={item.to} aria-current={active ? "page" : undefined} className={linkClass(active)} onClick={onNavigate} {...preloadProps(item.to)}>
      {Icon && <Icon size={20} aria-hidden="true" />}
      <span className="font-medium">{item.label}</span>
    </Link>
  );
}

const AdminLayout = () => {
  const { open: menuOpen, toggle: toggleMenu, close: closeMenu, toggleRef, panelRef, hiddenOffCanvas, pageInert } = useMobileMenu("(min-width: 1024px)");
  const pageLoading = usePageLoading();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { signOut, signingOut } = useSignOut();
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;
  const initial = (user?.first_name || user?.email || "A").charAt(0).toUpperCase();

  return (
    <section className="min-h-screen bg-gray-50">
      <PageLoadingIndicator />
      <a
        href="#admin-main"
        inert={pageInert}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-emerald-700 focus:shadow"
      >
        Skip to content
      </a>

      {/* While the drawer is open (small screens) the page behind it is inert; the drawer has its own close button. */}
      <header inert={pageInert} className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30">
        <section className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            ref={toggleRef}
            onClick={toggleMenu}
            className="p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
            aria-expanded={menuOpen}
            aria-controls={ADMIN_MENU_ID}
          >
            <Menu size={24} aria-hidden="true" />
          </button>

          <section className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="" className="w-8 h-8" />
            <section className="min-w-0">
              <p className="font-bold text-base text-gray-800">Admin Panel</p>
              <p className="text-xs text-gray-600 truncate">Pythagoras Learning Hub</p>
            </section>
          </section>
        </section>

        <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold" aria-hidden="true">
          {initial}
        </span>
      </header>

      <aside
        id={ADMIN_MENU_ID}
        ref={panelRef}
        inert={hiddenOffCanvas}
        aria-label="Admin navigation"
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 transition-transform duration-300 w-64 max-w-[85vw] flex flex-col overflow-y-auto
        ${menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <header className="p-6 border-b border-gray-200 flex items-center justify-between gap-2">
          <Link to="/admin" className="flex min-w-0 items-center gap-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" onClick={() => closeMenu()}>
            <img src={logo} alt="" className="w-10 h-10 shrink-0" />
            <span className="text-sm font-bold text-emerald-600 tracking-tight">Pythagoras Admin Panel</span>
          </Link>
          <button
            type="button"
            className="lg:hidden p-1 rounded text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label="Close admin menu"
            onClick={() => closeMenu({ restoreFocus: true })}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Links sit directly in the landmark (no list markup), so page-level list queries stay page-scoped. */}
        <nav aria-label="Admin sections" className="p-4 flex-1 flex flex-col">
          <div className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <NavItem key={item.id} item={item} pathname={pathname} onNavigate={() => closeMenu()} />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
            {ADMIN_SECONDARY_NAV.map((item) => (
              <NavItem key={item.id} item={item} pathname={pathname} onNavigate={() => closeMenu()} />
            ))}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-600 transition-colors disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <LogOut size={20} aria-hidden="true" />
              <span className="font-medium">{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </nav>
      </aside>

      {menuOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" aria-hidden="true" onClick={() => closeMenu()} />}

      <section className="lg:ml-64" inert={pageInert}>
        <header className="hidden lg:flex bg-white border-b border-gray-200 px-8 py-4 items-center justify-end sticky top-0 z-20">
          <section className="flex items-center gap-2 rounded-lg px-3 py-2">
            <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold" aria-hidden="true">
              {initial}
            </span>
            <span className="font-medium text-gray-700">{fullName}</span>
          </section>
        </header>

        <main id="admin-main" tabIndex={-1} aria-busy={pageLoading} className="p-4 lg:p-8 focus:outline-none">
          <RouteBoundary>
            <Outlet />
          </RouteBoundary>
        </main>
      </section>
    </section>
  );
};

export default AdminLayout;
