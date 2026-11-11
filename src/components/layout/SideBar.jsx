import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faChalkboardUser,
  faClipboardList,
  faHouse,
  faRightFromBracket,
  faRightToBracket,
  faSquarePollVertical,
  faUser,
  faUserPlus,
  faUserShield,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useSignOut } from "../../features/auth/useSignOut.js";
import logo from "../../assets/logo.png";
import profilePic from "../../assets/profile.png";
import { STUDENT_MENU_ID, studentNavFor } from "./navigation.js";

const ICONS = {
  home: faHouse,
  dawah: faBookOpen,
  quizzes: faClipboardList,
  classes: faChalkboardUser,
  results: faSquarePollVertical,
  profile: faUser,
  admin: faUserShield,
};

/**
 * Student/public sidebar. On small screens it is an off-canvas panel opened from
 * the NavBar; `hidden` (closed on a small screen) makes it inert.
 */
const SideBar = ({ isOpen, onClose, hidden = false, panelRef }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { signOut, signingOut } = useSignOut();
  const { pathname } = useLocation();
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const items = studentNavFor({ isAuthenticated, isAdmin });

  return (
    <aside
      id={STUDENT_MENU_ID}
      ref={panelRef}
      inert={hidden}
      aria-label="Main navigation"
      className={`fixed top-0 left-0 h-full bg-white dark:bg-[#000000] shadow-lg border-none w-[270px] max-w-[85vw]
        p-5 flex flex-col transition-transform duration-300 z-50 overflow-y-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      <div className="flex items-start justify-between gap-2 mb-8">
        <Link to={isAuthenticated ? "/" : "/dawah"} className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F]">
          <img src={logo} alt="" className="h-12" />
          <span>
            <span className="block font-bold text-[#1F2937] text-[clamp(20px,1.2vw,24px)] dark:text-[#FFFFFF]">Pythagoras</span>
            <span className="block text-sm mt-1 text-[#6B7280] dark:text-[#FFFFFF]">Muslim Students Hub</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => onClose({ restoreFocus: true })}
          className="md:hidden p-2 rounded-md text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F]"
          aria-label="Close menu"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {/* Links sit directly in the landmark (no list markup), so page-level list queries stay page-scoped. */}
      <nav aria-label="Primary" className="flex-1 flex flex-col gap-2">
        {items.map((item) => (
          <SideBarLink key={item.id} icon={ICONS[item.id]} label={item.label} to={item.to} active={item.match(pathname)} onClick={() => onClose()} />
        ))}
      </nav>

      {isAuthenticated ? (
        <div className="mt-auto pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <img src={profilePic} alt="" className="h-10 w-10 rounded-full" />
            <div className="min-w-0">
              <p className="font-medium dark:text-[#FFFFFF] truncate">{fullName || user?.email}</p>
              {user?.department && <p className="text-sm text-gray-600 -mt-1 dark:text-[#FFFFFF] truncate">{user.department}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 p-2 rounded-lg text-[#4B5563] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F]"
          >
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      ) : (
        <div className="mt-auto pt-6 space-y-3">
          <Link
            to="/sign-in"
            onClick={() => onClose()}
            className="flex items-center justify-center gap-2 py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2A742F]"
          >
            <FontAwesomeIcon icon={faRightToBracket} aria-hidden="true" />
            Sign in
          </Link>
          <Link
            to="/sign-up"
            onClick={() => onClose()}
            className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium border border-[#2A742F] text-[#2A742F] dark:text-green-300 dark:border-green-300 hover:bg-green-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F]"
          >
            <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
            Sign up
          </Link>
        </div>
      )}
    </aside>
  );
};

const SideBarLink = ({ icon, label, to, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    aria-current={active ? "page" : undefined}
    className={`group flex items-center gap-3 p-2 rounded-lg transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F] ${
      active
        ? "bg-gradient-to-r from-[#2A742F] to-[#04AF43] text-white font-medium"
        : "text-[#4B5563] dark:text-white hover:bg-gradient-to-r hover:from-[#2A742F] hover:to-[#04AF43] hover:text-white"
    }`}
  >
    <FontAwesomeIcon icon={icon} className="w-4" aria-hidden="true" />
    <span>{label}</span>
  </Link>
);

export default SideBar;
