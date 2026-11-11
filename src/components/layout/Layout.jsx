import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import RouteBoundary from "../../routes/RouteBoundary.jsx";
import SideBar from "./SideBar";
import NavBar from "./NavBar";
import { useMobileMenu } from "./useMobileMenu.js";

export default function Layout() {
  const { open: menuOpen, toggle: toggleMenu, close: closeMenu, toggleRef, panelRef, hiddenOffCanvas } = useMobileMenu("(min-width: 768px)");
  const [darkMode, setDarkMode] = useState(() => sessionStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    sessionStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleThemeToggle = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div className="flex min-h-screen bg-[#E5E7EB] dark:bg-gray-700 transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[#2A742F] focus:shadow"
      >
        Skip to content
      </a>

      <SideBar isOpen={menuOpen} onClose={closeMenu} hidden={hiddenOffCanvas} panelRef={panelRef} />

      {menuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" aria-hidden="true" onClick={() => closeMenu()} />}

      <div className="flex-1 flex flex-col min-w-0 md:ml-[270px]">
        <div className="fixed top-0 left-0 right-0 md:left-[270px] z-30">
          <NavBar
            toggleSidebar={toggleMenu}
            sidebarOpen={menuOpen}
            toggleRef={toggleRef}
            darkMode={darkMode}
            handleThemeToggle={handleThemeToggle}
          />
        </div>

        <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6 focus:outline-none">
          <RouteBoundary className="mt-20">
            <Outlet />
          </RouteBoundary>
        </main>
      </div>
    </div>
  );
}
