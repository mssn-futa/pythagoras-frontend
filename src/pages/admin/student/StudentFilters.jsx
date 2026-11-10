import { Search } from "lucide-react";
import { LEVEL_OPTIONS } from "../../../services/api/studentService.js";

const control = "border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-gray-700 bg-white";

/** Controlled filter bar; `values` are the live input values, `onChange(patch)` updates them. */
const StudentFilters = ({ values, onChange }) => (
  <>
  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-1">
    <div className="relative w-full lg:max-w-md bg-[#F9FAFB]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
      <input
        type="search"
        aria-label="Search students"
        placeholder="Search by name, email or matric number..."
        value={values.search}
        onChange={(event) => onChange({ search: event.target.value })}
        className="w-full pl-10 pr-4 py-2 rounded-2xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        aria-label="Department (exact match)"
        title="Department must match exactly (not case-sensitive)"
        placeholder="Department (exact)"
        value={values.department}
        onChange={(event) => onChange({ department: event.target.value })}
        className={control}
      />
      <select aria-label="Level" value={values.level} onChange={(event) => onChange({ level: event.target.value })} className={control}>
        <option value="">All Levels</option>
        {LEVEL_OPTIONS.map((level) => (
          <option key={level} value={level}>{`${level} Level`}</option>
        ))}
      </select>
      <select aria-label="Status" value={values.isActive} onChange={(event) => onChange({ isActive: event.target.value })} className={control}>
        <option value="">All statuses</option>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
    </div>
  </div>
  <p className="mb-4 text-xs text-gray-500">Search covers name, email and matric number. Department must match exactly.</p>
  </>
);

export default StudentFilters;
