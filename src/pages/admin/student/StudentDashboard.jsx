import React from "react";
import Active from "../../../assets/Active.png";
import Cap from "../../../assets/Cap.png";
import faculty from "../../../assets/faculty.png";
import inactive from "../../../assets/inactive.png";
import male from "../../../assets/male.png";
import female from "../../../assets/female.png";
import { Search, Filter, Download } from "lucide-react";

const stats = [
  {
    title: "Total Students",
    value: "2,847",
    change: "+12% this month",
    changeColor: "text-[#04AF43]",
    bg: "bg-[#0EA5E933]",
    icon: Cap,
  },
  {
    title: "Active Students",
    value: "2,700",
    change: "+12% this month",
    changeColor: "text-[#04AF43]",
    bg: "bg-[#04AF4333]",
    icon: Active,
  },
  {
    title: "Inactive Students",
    value: "147",
    change: "-8% this month",
    changeColor: "text-[#E50000]",
    bg: "bg-[#E5000033]",
    icon: inactive,
  },
  {
    title: "Faculties",
    value: "26",
    change: "26 Departments",
    changeColor: "text-[#6B7280]",
    bg: "bg-[#82828233]",
    icon: faculty,
  },
];
const students = [
  {
    name: "John Doe",
    matric: "CSC/21/001",
    img: male,
    tag: "Male",
    department: "Computer Science",
    level: "300",
    email: "john@example.com",
    status: "Active",
  },
  {
    name: "Jane Smith",
    matric: "ENG/20/014",
    img: male,
    tag: "Male",
    department: "Engineering",
    level: "400",
    email: "jane@example.com",
    status: "Inactive",
  },
  {
    name: "Michael Brown",
    matric: "BUS/22/112",
    img: male,
    tag: "Male",
    department: "Business",
    level: "200",
    email: "michael@school.edu",
    status: "Active",
  },
  {
    name: "Aisha Bello",
    matric: "CSC/23/078",
    img: female,
    tag: "Female",
    department: "Computer Science",
    level: "100",
    email: "aisha@school.edu",
    status: "Active",
  },
  {
    name: "Daniel Okoye",
    matric: "ENG/21/045",
    img: male,
    tag: "Male",
    department: "Engineering",
    level: "300",
    email: "daniel@school.edu",
    status: "Inactive",
  },
  {
    name: "Fatima Yusuf",
    matric: "BUS/20/301",
    img: female,
    tag: "female",
    department: "Business",
    level: "400",
    email: "fatima@school.edu",
    status: "Active",
  },
  {
    name: "Samuel Johnson",
    matric: "CSC/19/210",
    img: male,
    tag: "Male",
    department: "Computer Science",
    level: "400",
    email: "samuel@school.edu",
    status: "Active",
  },
  {
    name: "Grace Williams",
    matric: "ENG/22/066",
    img: female,
    tag: "female",
    department: "Engineering",
    level: "200",
    email: "grace@school.edu",
    status: "Inactive",
  },
];

const StudentDashboard = () => {
  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Student Management
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          Manage and monitor all registered students.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition"
          >
            <p className="text-sm text-gray-500">{item.title}</p>

            <div className="flex items-center justify-between mt-3">
              <span className="text-2xl font-bold text-gray-900">
                {item.value}
              </span>

              <div className={`${item.bg} p-3 rounded-lg`}>
                <img src={item.icon} alt={item.title} className="h-6 w-6" />
              </div>
            </div>

            <span className={`mt-2 text-sm ${item.changeColor}`}>
              {item.change}
            </span>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <section className="mt-8 bg-white rounded-2xl p-4">
        {/* Top Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          {/* Search Bar */}
          <div className="relative w-full lg:max-w-md bg-[#F9FAFB]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Name or Matric Number..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Right Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* All Departments */}
            <select className="rounded-lg px-3 py-2 text-sm text-gray-700 border border-[#E5E7EB]">
              <option>All Departments</option>
              <option>Computer Science</option>
              <option>Engineering</option>
              <option>Business</option>
            </select>

            {/* All Levels */}
            <select className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-gray-700">
              <option>All Levels</option>
              <option>100 Level</option>
              <option>200 Level</option>
              <option>300 Level</option>
              <option>400 Level</option>
            </select>

            {/* Filters */}
            <button className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filters
            </button>

            {/* Download */}
            <button className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 text-left text-sm text-gray-600">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" />
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold ">
                  Name
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold">
                  Matric No
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold">
                  Department
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold">
                  Level
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold">
                  Email
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold">
                  Status
                </th>
                <th className="px-4 py-3 text-[16px] text-[#000000] font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {students.map((student, index) => (
                <tr
                  key={index}
                  className="border-b border-[#E5E7EB] hover:bg-gray-50 p-4"
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" />
                  </td>

                  <td className="px-4 py-3 font-medium">
                    <div className="flex gap-3 items-centers">
                      <img src={student.img} className="h-6 w-6 self-center" />
                      <div className="flex flex-col gap-3">
                        <span className="text-[#4B5563] font-medium text-[14px]">{student.name}</span>
                        <span className="text-[#828282] text-[12px] font-normal">{student.tag}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[#4B4B4B] font-medium text-[14px]">
                    {student.matric}
                  </td>

                  <td className="px-4 py-3 text-[#4B4B4B] font-medium text-[14px]">
                    {student.department}
                  </td>

                  <td className="px-4 py-3 text-[#4B4B4B] font-medium text-[14px]">
                    {student.level}
                  </td>

                  <td className="px-4 py-3 text-[#4B4B4B] font-medium text-[14px]">
                    {student.email}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-3 rounded-full text-xs font-medium ${
                        student.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <button className="bg-[#E5E7EB] text-[#4B5563] font-medium text-[12px] rounded-[20px] p-4">
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default StudentDashboard;
