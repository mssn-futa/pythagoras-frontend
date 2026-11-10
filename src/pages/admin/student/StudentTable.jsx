import StatusBadge from "./StatusBadge.jsx";
import { fullName } from "./studentQuery.js";

const head = "px-4 py-3 text-[16px] text-[#000000] font-semibold";
const cell = "px-4 py-3 text-[#4B4B4B] font-medium text-[14px]";

const StudentTable = ({ students, onView }) => (
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
            <td className="px-4 py-3 font-medium">
              <button type="button" onClick={() => onView(student.id)} className="text-left text-[#4B5563] font-medium text-[14px] hover:underline">
                {fullName(student)}
              </button>
            </td>
            <td className={cell}>{student.matric_number || "-"}</td>
            <td className={cell}>{student.department || "-"}</td>
            <td className={cell}>{student.level || "-"}</td>
            <td className={`${cell} break-all`}>{student.email}</td>
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

export default StudentTable;
