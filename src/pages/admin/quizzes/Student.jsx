import React, { useState } from "react";

// Sample student quiz data
const studentsData = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    quiz: "Physics Quiz",
    score: 8,
    total: 10,
    status: "Completed",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    quiz: "Chemistry Quiz",
    score: 10,
    total: 12,
    status: "Completed",
  },
  {
    id: 3,
    name: "Ali Ahmed",
    email: "ali@example.com",
    quiz: "Mathematics Quiz",
    score: 15,
    total: 20,
    status: "Pending",
  },
  {
    id: 4,
    name: "Maryam Yusuf",
    email: "maryam@example.com",
    quiz: "Arabic Quiz",
    score: 9,
    total: 15,
    status: "Completed",
  },
];

const Student = () => {
  const [search, setSearch] = useState("");

  const filteredStudents = studentsData.filter(
    (student) =>
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.quiz.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      {/* ===== Header ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800">
          Student Quiz Overview
        </h1>

        <input
          type="text"
          placeholder="Search by student or quiz..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
      </div>

      {/* ===== Table ===== */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 border-b">Student Name</th>
              <th className="text-left px-4 py-3 border-b">Email</th>
              <th className="text-left px-4 py-3 border-b">Quiz</th>
              <th className="text-left px-4 py-3 border-b">Score</th>
              <th className="text-left px-4 py-3 border-b">Status</th>
              <th className="text-left px-4 py-3 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border-b">{student.name}</td>
                  <td className="px-4 py-3 border-b">{student.email}</td>
                  <td className="px-4 py-3 border-b">{student.quiz}</td>
                  <td className="px-4 py-3 border-b">
                    {student.score}/{student.total}
                  </td>
                  <td className="px-4 py-3 border-b">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        student.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b flex gap-2">
                    <button className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition">
                      View
                    </button>
                    <button className="px-3 py-1 rounded-lg border border-gray-300 text-sm hover:bg-gray-100 transition">
                      Message
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default Student;
