import React, { useState } from "react";

// Sample data for quizzes
const quizzes = [
  {
    id: 1,
    title: "Physics Quiz",
    totalQuestions: 10,
    totalStudents: 25,
    averageScore: 7.8,
  },
  {
    id: 2,
    title: "Chemistry Quiz",
    totalQuestions: 12,
    totalStudents: 30,
    averageScore: 8.5,
  },
  {
    id: 3,
    title: "Arabic Quiz",
    totalQuestions: 15,
    totalStudents: 20,
    averageScore: 9.2,
  },
  {
    id: 4,
    title: "Mathematics Quiz",
    totalQuestions: 20,
    totalStudents: 40,
    averageScore: 16.3,
  },
];

const AllQuiz = () => {
  const [search, setSearch] = useState("");

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      {/* ===== Page Header ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800">
          All Quizzes
        </h1>

        <input
          type="text"
          placeholder="Search quiz..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
      </div>

      {/* ===== Quizzes Grid ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredQuizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              {quiz.title}
            </h2>

            <div className="flex flex-col gap-2 text-gray-600 text-sm">
              <p>
                <span className="font-medium">Total Questions:</span>{" "}
                {quiz.totalQuestions}
              </p>
              <p>
                <span className="font-medium">Total Students:</span>{" "}
                {quiz.totalStudents}
              </p>
              <p>
                <span className="font-medium">Average Score:</span>{" "}
                {quiz.averageScore}
              </p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                View Results
              </button>
              <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">
                Edit Quiz
              </button>
            </div>
          </div>
        ))}

        {filteredQuizzes.length === 0 && (
          <p className="col-span-full text-center text-gray-500 py-8">
            No quizzes found.
          </p>
        )}
      </div>
    </section>
  );
};

export default AllQuiz;
