import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faBars } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../features/auth/AuthContext.js";
import { STUDENT_MENU_ID } from "./navigation.js";

export default function NavBar({ toggleSidebar, sidebarOpen = false, toggleRef, darkMode, handleThemeToggle }) {
  const { user, isAuthenticated } = useAuth();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    <header className="w-full flex items-center justify-between px-4 md:px-6 py-4 bg-white dark:bg-[#000000] shadow-sm transition-colors">
      <div className="flex flex-col min-w-0 flex-1 mr-4">
        <p className="font-poppins font-semibold text-gray-800 dark:text-white text-lg md:text-2xl lg:text-3xl truncate">
          Assalamu Alaykum{name ? `, ${name}` : ""}
        </p>
        <p className="font-poppins text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate md:block hidden">
          {isAuthenticated ? "Welcome back to your Islamic student hub" : "Browse the published Da'wah archive"}
        </p>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          type="button"
          aria-label="Dark mode"
          aria-pressed={darkMode}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-linear-to-r hover:from-[#2A742F] hover:to-[#04AF43] hover:text-white transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F]"
          onClick={handleThemeToggle}
        >
          <FontAwesomeIcon icon={faMoon} className="text-gray-700 dark:text-white" size="lg" />
        </button>

        <button
          type="button"
          ref={toggleRef}
          aria-label="Open menu"
          aria-expanded={sidebarOpen}
          aria-controls={STUDENT_MENU_ID}
          className="p-2 rounded-md md:hidden hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F]"
          onClick={toggleSidebar}
        >
          <FontAwesomeIcon icon={faBars} className="text-gray-700 dark:text-white" />
        </button>
      </div>
    </header>
  );
}
