import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin/communication", label: "Compose", end: true },
  { to: "/admin/communication/drafts", label: "Drafts" },
  { to: "/admin/communication/history", label: "History" },
  { to: "/admin/communication/automations", label: "Automations" },
];

const tabClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-3 py-2.5 sm:px-4 text-sm font-medium transition-colors ${
    isActive ? "border-[#2A742F] text-[#2A742F]" : "border-transparent text-gray-600 hover:text-[#2A742F] dark:text-gray-300"
  }`;

/** /admin/communication shell: Compose, Drafts and History tabs. */
export default function CommunicationLayout() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-[#1F2937] dark:text-white">Communication</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Compose email broadcasts to students, review what happened to each message, and manage automatic summaries and reminders.</p>
      <nav aria-label="Communication sections" className="mt-4 flex max-w-full overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
