import React, { useState } from "react";

const CreateQuiz = () => {
  const [quizDetails, setQuizDetails] = useState({
    title: "",
    duration: "",
    deadline: "",
  });

  const [currentQuestion, setCurrentQuestion] = useState({
    text: "",
    options: ["", "", "", ""],
    correctAnswer: null,
  });

  const [questions, setQuestions] = useState([]);

  // ======= Handle Quiz Details =======
  const handleQuizChange = (e) => {
    const { name, value } = e.target;
    setQuizDetails({ ...quizDetails, [name]: value });
  };

  // ======= Handle Question =======
  const handleQuestionText = (e) => {
    setCurrentQuestion({ ...currentQuestion, text: e.target.value });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const handleCorrectAnswer = (index) => {
    setCurrentQuestion({ ...currentQuestion, correctAnswer: index });
  };

  // ======= Save Question =======
  const saveQuestion = () => {
    const { text, options, correctAnswer } = currentQuestion;
    if (!text || options.some((opt) => !opt) || correctAnswer === null) {
      alert("Please complete the question properly.");
      return;
    }

    setQuestions([...questions, currentQuestion]);

    // Reset current question
    setCurrentQuestion({ text: "", options: ["", "", "", ""], correctAnswer: null });
  };

  // ======= Final Actions =======
  const saveDraft = () => {
    console.log("Draft Saved:", { quizDetails, questions });
    alert("Quiz saved as draft.");
  };

  const publishQuiz = () => {
    if (!quizDetails.title || questions.length === 0) {
      alert("Please add quiz details and at least one question.");
      return;
    }
    console.log("Quiz Published:", { quizDetails, questions });
    alert("Quiz Published Successfully 🚀");
  };

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      {/* ================= QUIZ DETAILS ================= */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8 shadow-sm">
        <h2 className="text-[#111827] font-semibold text-xl lg:text-2xl mb-6">
          Quiz Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">
              Quiz Title
            </label>
            <input
              type="text"
              name="title"
              value={quizDetails.title}
              onChange={handleQuizChange}
              placeholder="Enter quiz title"
              className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">
              Quiz Duration (minutes)
            </label>
            <input
              type="number"
              name="duration"
              value={quizDetails.duration}
              onChange={handleQuizChange}
              placeholder="e.g 30"
              className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">
              Deadline
            </label>
            <input
              type="date"
              name="deadline"
              value={quizDetails.deadline}
              onChange={handleQuizChange}
              className="border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>
        </div>
      </div>

      {/* ================= QUESTION BUILDER ================= */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <h3 className="text-lg lg:text-xl font-semibold text-gray-800">
            Question Builder
          </h3>

          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full w-fit">
            Question {questions.length + 1}
          </span>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Question
          </label>
          <textarea
            rows="4"
            value={currentQuestion.text}
            onChange={handleQuestionText}
            placeholder="Enter your question here..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {["A", "B", "C", "D"].map((option, index) => (
            <div key={option} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Option {option}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={currentQuestion.correctAnswer === index}
                  onChange={() => handleCorrectAnswer(index)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={currentQuestion.options[index]}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Enter option ${option}`}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="my-8 border-t border-gray-200" />

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mt-6">
          <p className="text-sm text-gray-500 leading-relaxed max-w-md">
            Select the correct answer by clicking the radio button next to the option.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={saveQuestion}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition w-full sm:w-auto"
            >
              Save Question
            </button>

            <button
              onClick={saveQuestion}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm w-full sm:w-auto"
            >
              Add Question
            </button>
          </div>
        </div>
      </div>

      {/* ================= FINAL ACTIONS ================= */}
      <div className="flex flex-col sm:flex-row justify-end gap-4">
        <button
          onClick={saveDraft}
          className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
        >
          Save as Draft
        </button>

        <button
          onClick={publishQuiz}
          className="px-6 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition shadow-sm"
        >
          Publish Quiz
        </button>
      </div>

      {/* ================= SAVED QUESTIONS PREVIEW ================= */}
      {questions.length > 0 && (
        <div className="bg-gray-50 border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Saved Questions</h3>
          {questions.map((q, i) => (
            <div key={i} className="mb-4">
              <p className="font-medium">
                {i + 1}. {q.text}
              </p>
              <ul className="ml-4 list-disc text-sm text-gray-600">
                {q.options.map((opt, idx) => (
                  <li
                    key={idx}
                    className={idx === q.correctAnswer ? "text-green-600 font-semibold" : ""}
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default CreateQuiz;
