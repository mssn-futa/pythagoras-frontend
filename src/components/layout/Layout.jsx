import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import SideBar from "./SideBar";
import NavBar from "./NavBar";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const handleThemeToggle = () => {
    setDarkMode((prev) => {
      const mode = !prev;
      if (mode) {
        document.documentElement.classList.add("dark");
        sessionStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        sessionStorage.setItem("theme", "light");
      }
      return mode;
    });
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
        <NavBar
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          darkMode={darkMode}
          handleThemeToggle={handleThemeToggle}
        />

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}