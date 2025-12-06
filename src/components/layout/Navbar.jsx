import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faMoon, faBars } from "@fortawesome/free-solid-svg-icons";

export default function Navbar({ toggleSidebar }) {
  return (
    <nav className="w-full flex justify-between items-center px-4 md:px-6 py-4 bg-white shadow-sm">
      
      <div className="flex flex-col min-w-0">
        <p className="font-poppins font-bold text-[#1F2937] text-[clamp(16px,4vw,20px)] truncate">
          Assalamu Alaykum, Abdullah!
        </p>
        <p className="font-poppins text-sm text-[#4B5563] truncate">
          Welcome back to your Islamic student hub
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">

        <div className="p-2 rounded-xl bg-[#F3F4F6] hidden md:block">
          <FontAwesomeIcon icon={faBell} className="text-[#4B5563]" size="lg" />
        </div>

        <div className="p-2 rounded-xl bg-[#F3F4F6]">
          <FontAwesomeIcon icon={faMoon} className="text-[#4B5563]" size="lg" />
        </div>

        <button
          className="p-2 rounded-md md:hidden hover:bg-gray-100 transition"
          onClick={toggleSidebar}
        >
          <FontAwesomeIcon icon={faBars} className="text-gray-700" />
        </button>
      </div>

    </nav>
  );
}
