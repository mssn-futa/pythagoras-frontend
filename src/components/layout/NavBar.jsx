import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faBars, faBell } from "@fortawesome/free-solid-svg-icons";

export default function NavBar({ toggleSidebar, darkMode, handleThemeToggle }) {
  return (
    <nav className="w-full flex items-center justify-between px-4 md:px-6 py-4 
                    bg-white dark:bg-[#000000] shadow-sm transition-colors">
      
      <div className="flex flex-col min-w-0 flex-1 mr-4">
        <p className="font-poppins font-semibold text-gray-800 dark:text-white 
                      text-lg sm:text-[12px] md:text-2xl lg:text-3xl truncate flex flex-wrap gap-2.5">
          Assalamu Alaykum<span>Salami Abdullah,</span>
        </p>

        

        <p className="font-poppins text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate md:block hidden">
          Welcome back to your Islamic student hub
        </p>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        
        {/* Bell Icon */}
        <div className="hidden md:flex items-center justify-center 
                        p-2 rounded-xl bg-gray-100 dark:bg-gray-700
                        hover:bg-linear-to-r hover:from-[#FFB300] hover:to-[#EAB308]
                        hover:text-white transform transition-all duration-300 ease-in-out
                        hover:scale-105">
          <FontAwesomeIcon icon={faBell} className="text-gray-600 dark:text-gray-200" size="lg" />
        </div>

        {/* Theme Toggle */}
        <button
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 
                     hover:bg-linear-to-r hover:from-[#2A742F] hover:to-[#04AF43]
                     hover:text-white transform transition-all duration-300 ease-in-out
                     hover:scale-105"
          onClick={handleThemeToggle}
        >
          <FontAwesomeIcon
            icon={faMoon}
            className="text-gray-700 dark:text-white"
            size="lg"
          />
        </button>

        {/* Sidebar Toggle (mobile) */}
        <button
          className="p-2 rounded-md md:hidden 
                     hover:bg-gray-200 dark:hover:bg-gray-700 transition transform hover:scale-105 duration-300"
          onClick={toggleSidebar}
        >
          <FontAwesomeIcon icon={faBars} className="text-gray-700 dark:text-white" />
        </button>
      </div>
    </nav>
  );
}
