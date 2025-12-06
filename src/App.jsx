import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
// import Navbar from "./components/layout/Navbar";
import Navbar from "./components/layout/NavBar";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
   <div className="flex min-h-screen bg-gray-50">
  {/* Sidebar */}
  <Sidebar
    isOpen={isSidebarOpen}
    toggleSidebar={() => setIsSidebarOpen(false)}
  />

  {isSidebarOpen && (
    <div
      className="fixed inset-0 bg-black/40 z-30 md:hidden"
      onClick={() => setIsSidebarOpen(false)}
    />
  )}

  {/* Main Content */}
  <div className="flex-1 flex flex-col md:ml-[270px]">
    <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

    <main className="flex-1 p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard Content</h1>
      <p>Your main content goes here.</p>
    </main>
  </div>
</div>

  );
}

export default App;
