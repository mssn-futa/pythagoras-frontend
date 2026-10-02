import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  Menu,
  X,
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  List,
  Users,
} from "lucide-react";

import viewIcon from "../../assets/viewIcon.png";
import quizAvartar from "../../assets/quizAvartar.png";
import quizIcon from "../../assets/quizIcon.png";

const QuizLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { label: "Create Quiz", icon: PlusCircle, path: "/admin/quizzes" },
    { label: "Quiz Result", icon: BarChart3, path: "/admin/quizzes/results" },
    { label: "All Quizzes", icon: List, path: "/admin/quizzes/all" },
    { label: "Students", icon: Users, path: "/admin/quizzes/students" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-50 top-0 left-0 h-full w-64 bg-white border-r border-gray-200 p-6 transition-transform duration-300
        ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-4 mb-10">
          <img src={quizIcon} alt="Quiz Logo" className="w-10 h-10" />
          <div>
            <h3 className="text-[#111827] text-lg font-bold">
              Assessment Engine
            </h3>
            <span className="text-sm text-[#6B7280]">
              Arabic Class Manager
            </span>
          </div>
        </div>

        {/* Menu */}
        <nav className="space-y-2">
          <span className="text-[#9CA3AF] font-semibold text-[12px]">menu</span>
          {/* {menuItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition
                ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))} */}
          {menuItems.map((item, index) => (
  <NavLink
    key={index}
    to={item.path}
    end={item.path === "/admin/quizzes"} // Only exact match for Create Quiz
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-lg transition
      ${isActive ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"}`
    }
    onClick={() => setSidebarOpen(false)}
  >
    <item.icon size={18} />
    <span className="font-medium">{item.label}</span>
  </NavLink>
))}

        </nav>
      </aside>

      {/* Main Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div>
              <h3 className="font-bold text-xl lg:text-2xl text-[#111827]">
                Quiz Management
              </h3>
              <span className="text-sm lg:text-base text-[#4B5563]">
                Create and manage Arabic class assessments
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
            <button className="bg-[#2563EB] text-white rounded-lg px-4 py-2 flex items-center gap-2 text-sm lg:text-base">
              <img src={viewIcon} alt="" className="w-4 h-4" />
              <span>View Results</span>
            </button>

            <img
              src={quizAvartar}
              alt="Avatar"
              className="w-9 h-9 rounded-full"
            />
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default QuizLayout;
