import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faBook, faMicrophone, faBriefcase, faUser ,faMosque} from "@fortawesome/free-solid-svg-icons";
import logo from "../../assets/logo.png";
import profilePic from "../../assets/profile.png";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white shadow-lg border-r border-r-[#E5E7EB] w-[270px]
        p-5 flex flex-col transition-transform duration-300 z-40
        ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10">
        <img src={logo} alt="Logo" className="h-12" />
        <div>
          <h1 className="font-bold text-lg text-[#1F2937] text-[clamp(20px,1.2vw,24px)]">Pythagoras</h1>
          <p className="text-sm mt-1 text-[#6B7280]">Muslim Students Hub</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-4 flex-1">
        <SidebarLink icon={faHome} label="Home" to="/" />
        <SidebarLink icon={faMosque} label="Dawah" to="/dawah" />
        <SidebarLink icon={faBook} label="Academics" to="/academics" />
        <SidebarLink icon={faBriefcase} label="Empowerment Hub" to="/empowerment" />
        <SidebarLink icon={faUser} label="Profile" to="/profile" />
      </nav>

      {/* Profile */}
      <div className="mt-auto flex items-center gap-3 pt-6">
        <img src={profilePic} alt="Profile" className="h-10 w-10 rounded-full" />
        <div>
          <p className="font-medium">Salami Abdullah</p>
          <p className="text-sm text-gray-600 -mt-1">Computer Science</p>
        </div>
      </div>
    </aside>
  );
};

const SidebarLink = ({ icon, label, to }) => (
  <a
    href={to}
    className="flex items-center gap-3 p-2 rounded-lg text-[#4B5563] hover:bg-gray-100 transition"
  >
    <FontAwesomeIcon icon={icon} className="text-[#4B5563]" />
    <span className="text-[#4B5563] text-[16px]">{label}</span>
  </a>
);

export default Sidebar;
