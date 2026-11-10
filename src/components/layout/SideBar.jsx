import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faUser, faRightFromBracket, faUserShield } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useSignOut } from "../../features/auth/useSignOut.js";
import logo from "../../assets/logo.png";
import profilePic from "../../assets/profile.png";

const SideBar = ({ isOpen, toggleSidebar }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { signOut, signingOut } = useSignOut();
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white dark:bg-[#000000] shadow-lg border-none w-[270px]
        p-5 flex flex-col transition-transform duration-300 z-40
        ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      <div className="flex items-center gap-3 mb-10">
        <img src={logo} alt="Logo" className="h-12" />
        <div>
          <h1 className="font-bold text-lg text-[#1F2937] text-[clamp(20px,1.2vw,24px)] dark:text-[#FFFFFF]">Pythagoras</h1>
          <p className="text-sm mt-1 text-[#6B7280] dark:text-[#FFFFFF]">Muslim Students Hub</p>
        </div>
      </div>

      <nav className="flex flex-col gap-4 flex-1">
        <SideBarLink 
          icon={faHome} 
          label="Home" 
          to="/" 
          hoverFrom="#2A742F" 
          hoverTo="#04AF43"
          onClick={toggleSidebar}
        />
        {isAuthenticated && (
          <SideBarLink
            icon={faUser}
            label="Profile"
            to="/profile"
            hoverFrom="#2D2D2D"
            hoverTo="#949292"
            onClick={toggleSidebar}
          />
        )}
        {isAdmin && (
          <SideBarLink
            icon={faUserShield}
            label="Admin panel"
            to="/admin"
            hoverFrom="#047857"
            hoverTo="#10B981"
            onClick={toggleSidebar}
          />
        )}
      </nav>

      {isAuthenticated ? (
        <div className="mt-auto pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <img src={profilePic} alt="" className="h-10 w-10 rounded-full" />
            <div className="min-w-0">
              <p className="font-medium dark:text-[#FFFFFF] truncate">{fullName}</p>
              {user?.department && (
                <p className="text-sm text-gray-600 -mt-1 dark:text-[#FFFFFF] truncate">{user.department}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 p-2 rounded-lg text-[#4B5563] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-70"
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      ) : (
        <NavLink
          to="/sign-in"
          className="mt-auto block text-center py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43]"
        >
          Sign in
        </NavLink>
      )}
    </aside>
  );
};

const SideBarLink = ({ icon, label, to, hoverFrom, hoverTo, onClick }) => (
  <NavLink
    to={to}
    end={to === "/"}
    onClick={onClick}
    className={({ isActive }) =>
      `group flex items-center gap-3 p-2 rounded-lg transition-all duration-300 relative overflow-hidden ${
        isActive ? "is-active" : ""
      }`
    }
    style={{ backgroundColor: "transparent" }}
  >
    {({ isActive }) => (
      <>
        <div
          className={`absolute inset-0 rounded-lg transition-opacity duration-300 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{ background: `linear-gradient(to right, ${hoverFrom}, ${hoverTo})`, zIndex: 0 }}
        ></div>
        
        <FontAwesomeIcon
          icon={icon}
          className={`transition-colors duration-300 relative z-10 ${
            isActive 
              ? "text-white" 
              : "text-[#4B5563] group-hover:text-white dark:text-white"
          }`}
        />
        <span 
          className={`transition-colors duration-300 relative z-10 ${
            isActive 
              ? "text-white font-medium" 
              : "text-[#4B5563] group-hover:text-white dark:text-white"
          }`}
        >
          {label}
        </span>
      </>
    )}
  </NavLink>
);

export default SideBar;