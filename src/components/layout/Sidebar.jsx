import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faBook, faBriefcase, faUser, faMosque } from "@fortawesome/free-solid-svg-icons";
import logo from "../../assets/logo.png";
import profilePic from "../../assets/profile.png";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white dark:bg-[#000000] shadow-lg border-none w-[270px]
        p-5 flex flex-col transition-transform duration-300 z-40
        ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10">
        <img src={logo} alt="Logo" className="h-12" />
        <div>
          <h1 className="font-bold text-lg text-[#1F2937] text-[clamp(20px,1.2vw,24px)] dark:text-[#FFFFFF]">Pythagoras</h1>
          <p className="text-sm mt-1 text-[#6B7280] dark:text-[#FFFFFF]">Muslim Students Hub</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-4 flex-1">
        <SidebarLink icon={faHome} label="Home" to="/" hoverFrom="#2A742F" hoverTo="#04AF43" />
        <SidebarLink icon={faMosque} label="Dawah" to="/dawah" hoverFrom="#C002C0" hoverTo="#FF31FF" />
        <SidebarLink icon={faBook} label="Academics" to="/academics" hoverFrom="#0284C7" hoverTo="#0EA5E9" />
        <SidebarLink icon={faBriefcase} label="Empowerment Hub" to="/empowerment" hoverFrom="#FFB300" hoverTo="#EAB308" />
        <SidebarLink icon={faUser} label="Profile" to="/profile" hoverFrom="#2D2D2D" hoverTo="#949292" />
      </nav>

      {/* Profile */}
      <div className="mt-auto flex items-center gap-3 pt-6">
        <img src={profilePic} alt="Profile" className="h-10 w-10 rounded-full" />
        <div>
          <p className="font-medium dark:text-[#FFFFFF]">Salami Abdullah</p>
          <p className="text-sm text-gray-600 -mt-1 dark:text-[#FFFFFF]">Computer Science</p>
        </div>
      </div>
    </aside>
  );
};

const SidebarLink = ({ icon, label, to, hoverFrom, hoverTo }) => (
  <a
    href={to}
    className="group flex items-center gap-3 p-2 rounded-lg transition-all duration-300 relative overflow-hidden"
    style={{ backgroundColor: "transparent" }}
  >
    <div
      className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: `linear-gradient(to right, ${hoverFrom}, ${hoverTo})`, zIndex: 0 }}
    ></div>
    
    <FontAwesomeIcon
      icon={icon}
      className="text-[#4B5563] group-hover:text-white dark:text-white transition-colors duration-300 relative z-10"
    />
    <span className="text-[#4B5563] group-hover:text-white dark:text-white transition-colors duration-300 relative z-10">
      {label}
    </span>
  </a>
);

export default Sidebar;
