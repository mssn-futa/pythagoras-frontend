import React, { useState } from "react";

const quizData = [
  {
    title: "Physics",
    totalQuestions: 10,
    results: [
      { name: "Ali Ahmed", score: 8, status: "Passed" },
      { name: "Fatima Yusuf", score: 6, status: "Passed" },
      { name: "Mohammed Bello", score: 4, status: "Failed" },
    ],
  },
  {
    title: "Chemistry",
    totalQuestions: 12,
    results: [
      { name: "Ali Ahmed", score: 10, status: "Passed" },
      { name: "Fatima Yusuf", score: 9, status: "Passed" },
      { name: "Aisha Musa", score: 7, status: "Passed" },
    ],
  },
  {
    title: "Arabic",
    totalQuestions: 15,
    results: [
      { name: "Mohammed Bello", score: 10, status: "Passed" },
      { name: "Aisha Musa", score: 12, status: "Passed" },
      { name: "Usman Abdullahi", score: 5, status: "Failed" },
    ],
  },
];

const QuizResult = () => {
  const [selectedQuizIndex, setSelectedQuizIndex] = useState(0);
  const [search, setSearch] = useState("");

  const selectedQuiz = quizData[selectedQuizIndex];
  const filteredResults = selectedQuiz.results.filter((res) =>
    res.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      {/* ===== Quiz Selector & Search ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">
            Select Quiz:
          </label>
          <select
            value={selectedQuizIndex}
            onChange={(e) => setSelectedQuizIndex(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            {quizData.map((quiz, index) => (
              <option key={index} value={index}>
                {quiz.title}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition w-full md:w-64"
        />
      </div>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm">Quiz Title</p>
          <p className="font-semibold text-lg text-gray-800">{selectedQuiz.title}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm">Total Questions</p>
          <p className="font-semibold text-lg text-gray-800">{selectedQuiz.totalQuestions}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm">Total Students</p>
          <p className="font-semibold text-lg text-gray-800">{selectedQuiz.results.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm">Average Score</p>
          <p className="font-semibold text-lg text-gray-800">
            {Math.round(
              selectedQuiz.results.reduce((a, b) => a + b.score, 0) / selectedQuiz.results.length
            )}
          </p>
        </div>
      </div>

      {/* ===== Results Table ===== */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">
                Student
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase">
                Score
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredResults.map((res, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{res.name}</td>
                <td className="px-4 py-3 text-center text-gray-800">{res.score}/{selectedQuiz.totalQuestions}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-2 py-1 rounded-full text-sm font-semibold ${
                      res.status === "Passed"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {res.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredResults.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-4 text-gray-500">
                  No student found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default QuizResult;
