import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import SideBar from "./SideBar";
import NavBar from "./NavBar";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      
      <SideBar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col md:ml-[270px]">
        
        {/* FIXED NAVBAR */}
        <div className="fixed top-0 left-0 right-0 md:left-[270px] z-40">
          <NavBar
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            darkMode={darkMode}
            handleThemeToggle={handleThemeToggle}
          />
        </div>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
