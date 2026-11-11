import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge.jsx";
import { fullName } from "./studentQuery.js";

const head = "px-4 py-3 text-[16px] text-[#000000] font-semibold";
const cell = "px-4 py-3 text-[#4B4B4B] font-medium text-[14px]";

const MOBILE_QUERY = "(max-width: 767px)";

const useIsMobile = () => {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [mobile, setMobile] = useState(() => (supported ? window.matchMedia(MOBILE_QUERY).matches : false));
  useEffect(() => {
    if (!supported) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [supported]);
  return mobile;
};

const StudentCards = ({ students, onView }) => (
  <ul aria-label="Students" className="space-y-3" data-testid="student-cards">
    {students.map((student) => (
      <li key={student.id} className="rounded-xl border border-[#E5E7EB] p-4">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => onView(student.id)} className="min-w-0 break-words text-left text-[15px] font-semibold text-[#111827] hover:underline">
            {fullName(student)}
          </button>
          <StatusBadge active={student.is_active} />
        </div>
        <p className="mt-1 text-[13px] font-medium text-[#4B4B4B]">{student.matric_number || "-"}</p>
        <p className="mt-1 break-words text-[13px] text-[#4B4B4B]">
          {student.department || "-"} &middot; Level {student.level || "-"}
        </p>
        <p className="mt-1 break-all text-[13px] text-[#6B7280]">{student.email}</p>
        <button
          type="button"
          onClick={() => onView(student.id)}
          aria-label={`View profile of ${fullName(student)}`}
          className="mt-3 w-full rounded-[20px] bg-[#E5E7EB] px-4 py-2 text-[12px] font-medium text-[#4B5563]"
        >
          View Profile
        </button>
      </li>
    ))}
  </ul>
);

const StudentTable = ({ students, onView }) => {
  const isMobile = useIsMobile();
  if (isMobile) return <StudentCards students={students} onView={onView} />;
  return (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <caption className="sr-only">Students</caption>
      <thead className="bg-gray-50 text-left text-sm text-gray-600">
        <tr>
          <th scope="col" className={head}>Name</th>
          <th scope="col" className={head}>Matric No</th>
          <th scope="col" className={head}>Department</th>
          <th scope="col" className={head}>Level</th>
          <th scope="col" className={head}>Email</th>
          <th scope="col" className={head}>Status</th>
          <th scope="col" className={head}>Action</th>
        </tr>
      </thead>
      <tbody className="text-sm">
        {students.map((student) => (
          <tr key={student.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
            <td className="px-4 py-3 font-medium whitespace-nowrap">
              <button type="button" onClick={() => onView(student.id)} className="text-left text-[#4B5563] font-medium text-[14px] hover:underline">
                {fullName(student)}
              </button>
            </td>
            <td className={cell}>{student.matric_number || "-"}</td>
            <td className={`${cell} break-words min-w-[9rem]`}>{student.department || "-"}</td>
            <td className={cell}>{student.level || "-"}</td>
            <td className={`${cell} max-w-[16rem]`}>
              <span className="block truncate" title={student.email}>{student.email}</span>
            </td>
            <td className="px-4 py-3"><StatusBadge active={student.is_active} /></td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => onView(student.id)}
                aria-label={`View profile of ${fullName(student)}`}
                className="bg-[#E5E7EB] text-[#4B5563] font-medium text-[12px] rounded-[20px] px-4 py-2 whitespace-nowrap"
              >
                View Profile
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

export default StudentTable;
