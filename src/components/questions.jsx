import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  ExclamationTriangleIcon,
  XMarkIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  MinusIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const QuestionEditor = ({
  question,
  index,
  onUpdate,
  onRemove,
  onReorder,
  totalQuestions,
  readOnly = false
}) => {
  const [localQuestion, setLocalQuestion] = useState(question);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Modal states
  const [removeQuestionModal, setRemoveQuestionModal] = useState(false);
  const [removeChoiceModal, setRemoveChoiceModal] = useState({ isOpen: false, choiceIndex: null });

  // Update local state when parent question changes
  useEffect(() => {
    setLocalQuestion(question);
  }, [question]);

  const handleQuestionChange = (e) => {
    const updated = { ...localQuestion, question: e.target.value };
    setLocalQuestion(updated);
    onUpdate(updated);
  };

  const handleChoiceChange = (choiceIndex, value) => {
    const updatedChoices = [...localQuestion.choices];
    updatedChoices[choiceIndex] = value;
    const updated = { ...localQuestion, choices: updatedChoices };
    setLocalQuestion(updated);
    onUpdate(updated);
  };

  const handleCorrectAnswerChange = (choiceIndex) => {
    const updated = { ...localQuestion, correctAnswer: choiceIndex };
    setLocalQuestion(updated);
    onUpdate(updated);
  };

  const handleAddChoice = () => {
    if (localQuestion.choices.length < 6) {
      const updatedChoices = [...localQuestion.choices, ''];
      const updated = { ...localQuestion, choices: updatedChoices };
      setLocalQuestion(updated);
      onUpdate(updated);
    }
  };

  const handleRemoveChoice = (choiceIndex) => {
    if (localQuestion.choices.length > 2) {
      const updatedChoices = localQuestion.choices.filter(
        (_, idx) => idx !== choiceIndex
      );
      
      // Adjust correct answer if needed
      let newCorrectAnswer = localQuestion.correctAnswer;
      if (choiceIndex === localQuestion.correctAnswer) {
        newCorrectAnswer = 0;
      } else if (choiceIndex < localQuestion.correctAnswer) {
        newCorrectAnswer = localQuestion.correctAnswer - 1;
      }
      
      const updated = {
        ...localQuestion,
        choices: updatedChoices,
        correctAnswer: newCorrectAnswer,
      };
      setLocalQuestion(updated);
      onUpdate(updated);
      setRemoveChoiceModal({ isOpen: false, choiceIndex: null });
    }
  };

  const confirmRemoveChoice = (choiceIndex) => {
    setRemoveChoiceModal({ isOpen: true, choiceIndex });
  };

  const handleMoveUp = () => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const handleMoveDown = () => {
    if (index < totalQuestions - 1) {
      onReorder(index, index + 1);
    }
  };

  const handleRemoveQuestion = () => {
    setRemoveQuestionModal(true);
  };

  const confirmRemoveQuestion = () => {
    onRemove(localQuestion.id);
    setRemoveQuestionModal(false);
  };

  const choiceLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // If in read-only mode (view mode), show simplified view
  if (readOnly) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center space-x-4">
          <span className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-semibold">
            {index + 1}
          </span>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
            {localQuestion.question}
          </h3>
        </div>
        
        <div className="space-y-3 pl-12">
          {localQuestion.choices.map((choice, choiceIndex) => (
            <div
              key={choiceIndex}
              className={`p-3 rounded-lg border ${
                localQuestion.correctAnswer === choiceIndex
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold ${
                  localQuestion.correctAnswer === choiceIndex
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {String.fromCharCode(65 + choiceIndex)}
                </div>
                <div className="flex-1">
                  <p className={`${
                    localQuestion.correctAnswer === choiceIndex
                      ? 'text-green-700 dark:text-green-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {choice}
                    {localQuestion.correctAnswer === choiceIndex && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                        Correct Answer
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
        {/* Question Header */}
        <div 
          className="bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-600 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveUp();
                  }}
                  disabled={index === 0}
                  className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ChevronUpIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveDown();
                  }}
                  disabled={index === totalQuestions - 1}
                  className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ChevronDownIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-semibold">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-200">
                    {localQuestion.question || `Question ${index + 1}`}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {localQuestion.choices.filter(c => c.trim()).length} choices • 
                    Correct answer: {choiceLetters[localQuestion.correctAnswer]}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg 
                  className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? '' : 'rotate-180'}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveQuestion();
                }}
                className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                title="Remove question"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Question Content - Collapsible */}
        {isExpanded && (
          <div className="p-6 space-y-6">
            {/* Question Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Question Text *
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (Markdown supported)
                </span>
              </label>
              <textarea
                value={localQuestion.question}
                onChange={handleQuestionChange}
                required
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                placeholder="Enter your question here... (e.g., What is the capital of France?)"
                disabled={readOnly}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tip: You can use **bold**, *italic*, or `code` formatting
              </div>
            </div>

            {/* Answer Choices */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Answer Choices *
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    (Select the correct answer by clicking the radio button)
                  </span>
                </label>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {localQuestion.choices.filter(c => c.trim()).length} of {localQuestion.choices.length} filled
                  </div>
                  {localQuestion.choices.length < 6 && !readOnly && (
                    <button
                      type="button"
                      onClick={handleAddChoice}
                      className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-all duration-200 flex items-center"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Add Choice
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {localQuestion.choices.map((choice, choiceIndex) => (
                  <div
                    key={choiceIndex}
                    className={`group relative p-4 rounded-lg border transition-all duration-200 ${
                      localQuestion.correctAnswer === choiceIndex
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      {/* Radio Button */}
                      <div className="flex items-center h-full pt-1">
                        <input
                          type="radio"
                          name={`correct-answer-${localQuestion.id}`}
                          checked={localQuestion.correctAnswer === choiceIndex}
                          onChange={() => handleCorrectAnswerChange(choiceIndex)}
                          className="h-5 w-5 text-green-600 dark:text-green-400 focus:ring-green-500 cursor-pointer"
                          id={`choice-${localQuestion.id}-${choiceIndex}`}
                          disabled={readOnly}
                        />
                      </div>

                      {/* Choice Letter */}
                      <div className="shrink-0">
                        <label
                          htmlFor={`choice-${localQuestion.id}-${choiceIndex}`}
                          className={`flex items-center justify-center w-10 h-10 rounded-lg font-semibold cursor-pointer transition-all duration-200 ${
                            localQuestion.correctAnswer === choiceIndex
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 shadow-sm'
                              : 'bg-gray-100 dark:bg-white text-gray-700 dark:text-black group-hover:bg-gray-200'
                          } ${readOnly ? 'cursor-default' : ''}`}
                        >
                          {choiceLetters[choiceIndex]}
                        </label>
                      </div>

                      {/* Input Field */}
                      <div className="grow">
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => handleChoiceChange(choiceIndex, e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-white rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          placeholder={`Enter choice ${choiceLetters[choiceIndex]}...`}
                          disabled={readOnly}
                        />
                      </div>

                      {/* Remove Button */}
                      {!readOnly && localQuestion.choices.length > 2 && (
                        <button
                          type="button"
                          onClick={() => confirmRemoveChoice(choiceIndex)}
                          className="shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                          title="Remove choice"
                        >
                          <MinusIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Correct Answer Badge */}
                    {localQuestion.correctAnswer === choiceIndex && (
                      <div className="absolute -top-2 -right-2">
                        <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full flex items-center shadow-sm">
                          <CheckCircleIcon className="w-3 h-3 mr-1" />
                          Correct Answer
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Choice Status */}
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    Correct answer selected: {choiceLetters[localQuestion.correctAnswer]}
                  </span>
                </div>
                <div className="text-xs">
                  Minimum 2 choices required
                </div>
              </div>
            </div>

            {/* Question Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Question ID: {localQuestion.id.slice(-6)}
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleRemoveQuestion}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 flex items-center"
                >
                  <TrashIcon className="w-4 h-4 mr-2" />
                  Remove Question
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL: Remove Question ===== */}
      <Transition appear show={removeQuestionModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRemoveQuestionModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex flex-col items-center text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mt-4"
                    >
                      Remove Question {index + 1}?
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        Are you sure you want to remove this question? This action cannot be undone.
                        {localQuestion.question.trim() && (
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Question:</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 truncate">
                              {localQuestion.question}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={() => setRemoveQuestionModal(false)}
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={confirmRemoveQuestion}
                    >
                      Yes, Remove Question
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ===== MODAL: Remove Choice ===== */}
      <Transition appear show={removeChoiceModal.isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRemoveChoiceModal({ isOpen: false, choiceIndex: null })}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex flex-col items-center text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mt-4"
                    >
                      Remove Choice {choiceLetters[removeChoiceModal.choiceIndex]}?
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        Are you sure you want to remove this answer choice?
                        {removeChoiceModal.choiceIndex !== null && localQuestion.choices[removeChoiceModal.choiceIndex]?.trim() && (
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Choice {choiceLetters[removeChoiceModal.choiceIndex]}:</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                              {localQuestion.choices[removeChoiceModal.choiceIndex]}
                            </p>
                          </div>
                        )}
                        {removeChoiceModal.choiceIndex === localQuestion.correctAnswer && (
                          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-400">
                              ⚠️ This is currently marked as the correct answer. Removing it will reset the correct answer to Choice A.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={() => setRemoveChoiceModal({ isOpen: false, choiceIndex: null })}
                    >
                      Keep Choice
                    </button>
                    
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={() => handleRemoveChoice(removeChoiceModal.choiceIndex)}
                    >
                      Remove Choice
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default QuestionEditor;