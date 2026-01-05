import React, { useState } from "react";
import logo from "../../assets/logo.png";
import { Outlet, Link } from "react-router-dom";
import {
  Menu,
  X,
  Bell,
  ChevronDown,
  BarChart3,
  Users,
  MessageSquare,
  FileText,
  Video,
  Calendar,
  Settings,
} from "lucide-react";

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { icon: BarChart3, label: "Dashboard", path: "/admin" },
    { icon: Users, label: "Students", path: "/admin/students" },
    {
      icon: MessageSquare,
      label: "Communication",
      path: "/admin/communication",
    },
    { icon: FileText, label: "Content", path: "/admin/content" },
    { icon: Video, label: "Quizzes", path: "/admin/quizzes" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: Calendar, label: "Co-Admins", path: "/admin/co-admins" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  return (
    <section className="min-h-screen bg-gray-50">
      <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <section className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <section className="flex items-center gap-2">
            <img src={logo} alt="Pythagoras Logo" className="w-8 h-8" />
            <section>
              <h1 className="font-bold text-base text-gray-800">Admin Panel</h1>
              <p className="text-xs text-gray-600">
                Pythagoras Learning Hub
              </p>
            </section>
          </section>
        </section>

        <section className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
            A
          </span>
        </section>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40 transition-transform duration-300 w-64
        ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <header className="p-6 border-b border-gray-200">
          <section className="flex items-center gap-3">
            <img src={logo} alt="Pythagoras Logo" className="w-10 h-10" />
            <h1 className="text-sm font-bold text-emerald-600 whitespace-nowrap tracking-tight">
              Pythagoras Admin Panel
            </h1>
          </section>
        </header>

        <nav className="p-4 space-y-1">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-600 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <section className="lg:ml-64">
        <header className="hidden lg:flex bg-white border-b border-gray-200 px-8 py-4 items-center justify-end sticky top-0 z-20">
          <section className="flex items-center gap-4">

            <section className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded-lg px-3 py-2">
              <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                A
              </span>
              <span className="font-medium text-gray-700">Admin User</span>
              <ChevronDown size={16} className="text-gray-500" />
            </section>
          </section>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </section>
    </section>
  );
};

export default AdminLayout;