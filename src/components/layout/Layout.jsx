import { useState, useEffect } from "react";
import SideBar from "./SideBar";
import NavBar from "./NavBar";

export default function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Toggle theme
  const handleThemeToggle = () => {
    setDarkMode((prev) => {
      const mode = !prev;
      if (mode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return mode;
    });
  };

  return (
    <div className="flex min-h-screen bg-[#E5E7EB] dark:bg-gray-700 transition-colors">
      
      {/* Sidebar */}
      <SideBar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Screen */}
      <div className="flex-1 flex flex-col md:ml-[270px]">
        
        {/* FIXED NAVBAR */}
        <div className="fixed top-0 left-0 right-0 md:left-[270px] z-40">
          <NavBar
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            darkMode={darkMode}
            handleThemeToggle={handleThemeToggle}
          />
        </div>

        {/* CONTENT — pushed down below navbar */}
        <main className="flex-1 p-4 md:p-6 pt-20">
          {children}
        </main>
      </div>
    </div>
  );
}
