import React, { useState, Fragment, useEffect } from 'react';
import QuestionEditor from '../../components/questions';
import { Dialog, Transition } from '@headlessui/react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  XMarkIcon,
  InformationCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const Academics = () => {
  // ===== MODES =====
  const [mode, setMode] = useState('create'); // 'create', 'view', 'edit'
  
  // ===== STATE =====
  const [quizData, setQuizData] = useState({
    id: null,
    title: '',
    description: '',
    questions: [],
    category: '',
    difficulty: 'medium',
    timeLimit: 30,
    createdAt: null,
    updatedAt: null,
  });

  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState({ 
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  // ===== TOAST SYSTEM =====
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    const newToast = { id, message, type, visible: true };
    
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.map(toast => 
        toast.id === id ? { ...toast, visible: false } : toast
      ));
      
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, 300);
    }, 3000);

    return id;
  };

  // Toast shortcut methods
  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    warning: (msg) => showToast(msg, 'warning'),
    info: (msg) => showToast(msg, 'info'),
  };

  // ===== MODAL SYSTEM =====
  const showModal = (config) => {
    setModal({
      isOpen: true,
      type: config.type || 'warning',
      title: config.title || '',
      message: config.message || '',
      onConfirm: config.onConfirm || (() => {}),
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
    });
  };

  const hideModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (modal.onConfirm) modal.onConfirm();
    hideModal();
  };

  // ===== LOCAL STORAGE =====
  useEffect(() => {
    // Load saved quizzes from localStorage on component mount
    const saved = localStorage.getItem('savedQuizzes');
    if (saved) {
      try {
        setSavedQuizzes(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading quizzes:', error);
      }
    }
  }, []);

  const saveQuizToStorage = (quiz) => {
    const updatedQuizzes = [...savedQuizzes];
    const existingIndex = updatedQuizzes.findIndex(q => q.id === quiz.id);
    
    if (existingIndex >= 0) {
      // Update existing quiz
      updatedQuizzes[existingIndex] = {
        ...quiz,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new quiz
      const newQuiz = {
        ...quiz,
        id: quiz.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedQuizzes.push(newQuiz);
    }
    
    setSavedQuizzes(updatedQuizzes);
    localStorage.setItem('savedQuizzes', JSON.stringify(updatedQuizzes));
    return updatedQuizzes;
  };

  const deleteQuizFromStorage = (quizId) => {
    const updatedQuizzes = savedQuizzes.filter(q => q.id !== quizId);
    setSavedQuizzes(updatedQuizzes);
    localStorage.setItem('savedQuizzes', JSON.stringify(updatedQuizzes));
  };

  // ===== QUIZ MANAGEMENT =====
  const categories = [
    'General Knowledge',
    'Mathematics',
    'Science',
    'History',
    'Programming',
    'Literature',
    'Other',
  ];

  // Reset form for new quiz
  const resetForm = () => {
    setQuizData({
      id: null,
      title: '',
      description: '',
      questions: [],
      category: '',
      difficulty: 'medium',
      timeLimit: 30,
      createdAt: null,
      updatedAt: null,
    });
    setMode('create');
  };

  // Load quiz for viewing/editing
  const loadQuiz = (quiz, viewMode = 'view') => {
    setQuizData({
      ...quiz,
      // Ensure all questions have proper structure
      questions: quiz.questions.map(q => ({
        ...q,
        choices: q.choices || ['', '', '', ''],
        correctAnswer: q.correctAnswer || 0,
      })),
    });
    setMode(viewMode);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuizData(prev => ({
      ...prev,
      [name]: name === 'timeLimit' ? parseInt(value) || undefined : value,
    }));
  };

  const handleAddQuestion = () => {
    const newQuestion = {
      id: Date.now().toString(),
      question: '',
      choices: ['', '', '', ''],
      correctAnswer: 0,
    };

    setQuizData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));

    toast.success('Question added! Start typing your question and answers.');
  };

  const handleUpdateQuestion = (updatedQuestion) => {
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === updatedQuestion.id ? updatedQuestion : q
      ),
    }));
  };

  const handleRemoveQuestion = (questionId) => {
    const questionIndex = quizData.questions.findIndex(q => q.id === questionId);
    
    showModal({
      title: 'Remove Question',
      message: `Are you sure you want to remove Question ${questionIndex + 1}? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Yes, Remove',
      onConfirm: () => {
        setQuizData(prev => ({
          ...prev,
          questions: prev.questions.filter(q => q.id !== questionId),
        }));
        toast.success(`Question ${questionIndex + 1} removed.`);
      },
    });
  };

  const handleReorderQuestions = (startIndex, endIndex) => {
    const newQuestions = [...quizData.questions];
    const [removed] = newQuestions.splice(startIndex, 1);
    newQuestions.splice(endIndex, 0, removed);
    
    setQuizData(prev => ({
      ...prev,
      questions: newQuestions,
    }));

    toast.info('Question order updated.');
  };

  // ===== VALIDATION =====
  const validateQuiz = () => {
    if (!quizData.title.trim()) {
      toast.error('Please enter a quiz title.');
      return false;
    }

    if (!quizData.category) {
      toast.error('Please select a category.');
      return false;
    }

    if (quizData.questions.length === 0) {
      toast.error('Please add at least one question.');
      return false;
    }

    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is empty. Please enter a question.`);
        return false;
      }

      const emptyChoices = q.choices.filter(choice => !choice.trim());
      if (emptyChoices.length > 0) {
        toast.error(`Question ${i + 1} has empty answer choices.`);
        return false;
      }
    }

    return true;
  };

  // ===== FORM SUBMISSION =====
  const handleSaveQuiz = () => {
    if (!validateQuiz()) return;

    const loadingId = showToast('Saving quiz...', 'info');

    setTimeout(() => {
      const isNew = !quizData.id;
      const updatedQuizzes = saveQuizToStorage(quizData);
      
      setToasts(prev => prev.filter(t => t.id !== loadingId));
      
      if (isNew) {
        toast.success('Quiz saved successfully! 🎉');
        showModal({
          title: '🎉 Quiz Saved!',
          message: `Your quiz "${quizData.title}" has been saved with ${quizData.questions.length} questions. What would you like to do next?`,
          type: 'success',
          confirmText: 'Create Another',
          cancelText: 'View Quiz',
          onConfirm: () => {
            resetForm();
            toast.info('Ready to create a new quiz!');
          },
        });
      } else {
        toast.success('Quiz updated successfully! ✏️');
        setMode('view');
      }
    }, 1000);
  };

  const handleDeleteQuiz = (quizId) => {
    const quizToDelete = savedQuizzes.find(q => q.id === quizId);
    
    showModal({
      title: 'Delete Quiz',
      message: `Are you sure you want to delete "${quizToDelete.title}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Yes, Delete',
      onConfirm: () => {
        deleteQuizFromStorage(quizId);
        toast.success('Quiz deleted successfully.');
        
        // If we're viewing/editing the deleted quiz, reset form
        if (quizData.id === quizId) {
          resetForm();
        }
      },
    });
  };

  const handleClearForm = () => {
    if (quizData.questions.length > 0 || quizData.title.trim()) {
      showModal({
        title: 'Clear All Content',
        message: 'Are you sure you want to clear all quiz content? This will remove all questions and reset the form. This action cannot be undone.',
        type: 'danger',
        confirmText: 'Yes, Clear All',
        onConfirm: () => {
          resetForm();
          toast.success('Form cleared successfully.');
        },
      });
    }
  };

  // ===== RENDER FUNCTIONS =====
  const renderModeButtons = () => {
    if (mode === 'create') {
      return (
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={handleClearForm}
            className="px-4 py-2 sm:px-6 sm:py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium flex items-center justify-center text-sm sm:text-base"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Clear All
          </button>
          <button
            type="button"
            onClick={handleSaveQuiz}
            disabled={quizData.questions.length === 0}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
          >
            <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Save Quiz
          </button>
        </div>
      );
    }

    if (mode === 'view') {
      return (
        <div className="flex flex-col sm:flex-row justify-between pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={() => resetForm()}
            className="px-4 py-2 sm:px-6 sm:py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium flex items-center justify-center text-sm sm:text-base mb-3 sm:mb-0"
          >
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Back to Create
          </button>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center text-sm sm:text-base"
            >
              <PencilSquareIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              Edit Quiz
            </button>
            <button
              type="button"
              onClick={() => handleDeleteQuiz(quizData.id)}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center text-sm sm:text-base"
            >
              <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              Delete Quiz
            </button>
          </div>
        </div>
      );
    }

    if (mode === 'edit') {
      return (
        <div className="flex flex-col sm:flex-row justify-between pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={() => setMode('view')}
            className="px-4 py-2 sm:px-6 sm:py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium flex items-center justify-center text-sm sm:text-base mb-3 sm:mb-0"
          >
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Cancel Edit
          </button>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={handleSaveQuiz}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center text-sm sm:text-base"
            >
              <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              Save Changes
            </button>
          </div>
        </div>
      );
    }
  };

  const renderQuestionEditor = (question, index) => {
    if (mode === 'view') {
      return (
        <div key={question.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center space-x-4">
            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-semibold">
              {index + 1}
            </span>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              {question.question}
            </h3>
          </div>
          
          <div className="space-y-3 pl-12">
            {question.choices.map((choice, choiceIndex) => (
              <div
                key={choiceIndex}
                className={`p-3 rounded-lg border ${
                  question.correctAnswer === choiceIndex
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold ${
                    question.correctAnswer === choiceIndex
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {String.fromCharCode(65 + choiceIndex)}
                  </div>
                  <div className="flex-1">
                    <p className={`${
                      question.correctAnswer === choiceIndex
                        ? 'text-green-700 dark:text-green-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {choice}
                      {question.correctAnswer === choiceIndex && (
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

    // Create or Edit mode
    return (
      <QuestionEditor
        key={question.id}
        question={question}
        index={index}
        onUpdate={handleUpdateQuestion}
        onRemove={handleRemoveQuestion}
        onReorder={handleReorderQuestions}
        totalQuestions={quizData.questions.length}
        readOnly={mode === 'view'}
      />
    );
  };

  // ===== COMPONENT RENDER =====
  return (
    <>
      {/* Main Content */}
      <div className="min-h-screen bg-white dark:bg-gray-700 pt-20 py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-full pt-15 lg:max-w-5xl mx-auto">
          {/* Saved Quizzes Sidebar */}
          {savedQuizzes.length > 0 && (
            <div className="mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Saved Quizzes ({savedQuizzes.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedQuizzes.map(quiz => (
                    <div key={quiz.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-800 dark:text-white truncate">
                          {quiz.title}
                        </h3>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => loadQuiz(quiz, 'view')}
                            className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            title="View Quiz"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => loadQuiz(quiz, 'edit')}
                            className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                            title="Edit Quiz"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete Quiz"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 space-x-2">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                          {quiz.category}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                          {quiz.questions.length} Qs
                        </span>
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs capitalize">
                          {quiz.difficulty}
                        </span>
                      </div>
                      {quiz.updatedAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          Updated: {new Date(quiz.updatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Quiz Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-4 sm:p-6 md:p-8">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="font-poppins font-semibold text-gray-800 dark:text-white 
                            text-sm sm:text-base md:text-xl lg:text-3xl mb-1 sm:mb-2">
                    {mode === 'create' ? 'Create New Quiz' : 
                     mode === 'view' ? `Viewing: ${quizData.title}` : 
                     `Editing: ${quizData.title}`}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">
                    {mode === 'create' ? 'Build your quiz by adding questions and answer choices.' :
                     mode === 'view' ? 'Review your quiz. Click Edit to make changes.' :
                     'Make changes to your quiz. Click Save when done.'}
                  </p>
                </div>
                
                {/* Mode Indicator */}
                <div className="flex space-x-2">
                  {mode !== 'create' && (
                    <button
                      onClick={() => resetForm()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      New Quiz
                    </button>
                  )}
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    mode === 'create' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    mode === 'view' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}>
                    {mode === 'create' ? 'Create Mode' :
                     mode === 'view' ? 'View Mode' : 'Edit Mode'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quiz Metadata (Editable in create/edit modes) */}
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-6 bg-gray-50 dark:bg-gray-700 p-4 sm:p-6 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-600">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 flex items-center">
                  <span className="mr-2 sm:mr-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </span>
                  Quiz Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Quiz Title *
                    </label>
                    {mode === 'view' ? (
                      <div className="px-3 py-2 text-sm sm:text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white">
                        {quizData.title}
                      </div>
                    ) : (
                      <input
                        type="text"
                        name="title"
                        value={quizData.title}
                        onChange={handleInputChange}
                        required
                        disabled={mode === 'view'}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 dark:bg-white dark:text-dark rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter quiz title"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Category *
                    </label>
                    {mode === 'view' ? (
                      <div className="px-3 py-2 text-sm sm:text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white">
                        {quizData.category}
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          name="category"
                          value={quizData.category}
                          onChange={handleInputChange}
                          required
                          disabled={mode === 'view'}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 dark:bg-white dark:text-dark rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none"
                        >
                          <option value="">Select a category</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Difficulty *
                    </label>
                    {mode === 'view' ? (
                      <div className="px-3 py-2 text-sm sm:text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white">
                        <span className="capitalize">{quizData.difficulty}</span>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        {['easy', 'medium', 'hard'].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setQuizData(prev => ({ ...prev, difficulty: level }))}
                            disabled={mode === 'view'}
                            className={`flex-1 px-3 py-2 sm:px-4 sm:py-2 rounded-lg border transition-all duration-200 font-medium text-xs sm:text-sm ${
                              quizData.difficulty === level
                                ? level === 'easy'
                                  ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300'
                                  : level === 'medium'
                                  ? 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-300'
                                  : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300'
                                : 'bg-white dark:bg-white dark:text-dark border-gray-300 hover:border-white dark:border-gray-600 text-gray-600  hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:text-white'
                            } ${mode === 'view' ? 'cursor-default opacity-60' : ''}`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Time Limit (minutes)
                    </label>
                    {mode === 'view' ? (
                      <div className="px-3 py-2 text-sm sm:text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white">
                        {quizData.timeLimit} minutes
                      </div>
                    ) : (
                      <input
                        type="number"
                        name="timeLimit"
                        value={quizData.timeLimit}
                        onChange={handleInputChange}
                        min="1"
                        max="180"
                        disabled={mode === 'view'}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 dark:bg-white dark:text-dark rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="30"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Description
                  </label>
                  {mode === 'view' ? (
                    <div className="px-3 py-2 text-sm sm:text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white min-h-[60px]">
                      {quizData.description || <span className="text-gray-500 dark:text-gray-500 italic">No description</span>}
                    </div>
                  ) : (
                    <textarea
                      name="description"
                      value={quizData.description}
                      onChange={handleInputChange}
                      rows={2}
                      disabled={mode === 'view'}
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 dark:bg-white dark:text-dark rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder="Enter a brief description of your quiz..."
                    />
                  )}
                </div>

                {/* Quiz Stats */}
                {mode === 'view' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-gray-800 dark:text-white">{quizData.questions.length}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Questions</div>
                    </div>
                    <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-gray-800 dark:text-white">{quizData.timeLimit}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Minutes</div>
                    </div>
                    <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-gray-800 dark:text-white capitalize">{quizData.difficulty}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Difficulty</div>
                    </div>
                    <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-gray-800 dark:text-white">
                        {quizData.questions.reduce((acc, q) => acc + q.choices.filter(c => c.trim()).length, 0)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total Answers</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Questions Section */}
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-gray-200 dark:border-gray-600 pb-3 sm:pb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 flex items-center">
                      <span className="mr-2 sm:mr-3">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </span>
                      Questions
                      <span className="ml-2 px-2 py-0.5 sm:px-2 sm:py-1 text-xs sm:text-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                        {quizData.questions.length}
                      </span>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mt-0.5 sm:mt-1">
                      {mode === 'view' ? 'Review all questions and answers' :
                       mode === 'edit' ? 'Edit questions and mark correct answers' :
                       'Add questions and mark the correct answer for each'}
                    </p>
                  </div>
                  
                  {mode !== 'view' && (
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="mt-2 sm:mt-0 px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 shadow hover:shadow-lg text-sm sm:text-base"
                    >
                      <PlusIcon className="w-5 h-5" />
                      <span>Add Question</span>
                    </button>
                  )}
                </div>

                {quizData.questions.length === 0 ? (
                  <div className="text-center py-8 sm:py-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-full">
                      <PlusIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-300" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">
                      No questions yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-md mx-auto px-2">
                      {mode === 'view' ? 'This quiz has no questions yet.' :
                       'Click "Add Question" to start building your quiz. Each question needs at least 2 answer choices.'}
                    </p>
                    {mode !== 'view' && (
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 inline-flex items-center"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add Your First Question
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {quizData.questions.map((question, index) => 
                      renderQuestionEditor(question, index)
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {renderModeButtons()}
            </div>
          </div>
        </div>
      </div>

      {/* ===== TOAST CONTAINER ===== */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {toasts.map(toastItem => (
          <Transition
            key={toastItem.id}
            show={toastItem.visible}
            as={Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-300"
            leaveFrom="opacity-100 translate-x-0"
            leaveTo="opacity-0 translate-x-full"
          >
            <div className={`rounded-lg shadow-xl border p-4 max-w-sm ${
              toastItem.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
              toastItem.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
              toastItem.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              <div className="flex items-start">
                <div className="shrink-0">
                  {toastItem.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-400" />}
                  {toastItem.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />}
                  {toastItem.type === 'warning' && <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />}
                  {toastItem.type === 'info' && <InformationCircleIcon className="h-5 w-5 text-blue-400" />}
                </div>
                <div className="ml-3 flex-1 pt-0.5">
                  <p className="text-sm font-medium">{toastItem.message}</p>
                </div>
                <div className="ml-4 shrink-0">
                  <button
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toastItem.id))}
                    className="inline-flex text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        ))}
      </div>

      {/* ===== MODAL ===== */}
      <Transition appear show={modal.isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={hideModal}>
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
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
                      modal.type === 'danger' ? 'bg-red-100' :
                      modal.type === 'success' ? 'bg-green-100' :
                      modal.type === 'info' ? 'bg-blue-100' :
                      'bg-yellow-100'
                    }`}>
                      {modal.type === 'success' ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600" />
                      ) : (
                        <ExclamationTriangleIcon className={`h-6 w-6 ${
                          modal.type === 'danger' ? 'text-red-600' :
                          modal.type === 'info' ? 'text-blue-600' :
                          'text-yellow-600'
                        }`} />
                      )}
                    </div>
                    
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mt-4"
                    >
                      {modal.title}
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        {modal.message}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={hideModal}
                    >
                      {modal.cancelText}
                    </button>
                    
                    <button
                      type="button"
                      className={`inline-flex justify-center rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors ${
                        modal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' :
                        modal.type === 'success' ? 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500' :
                        modal.type === 'info' ? 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500' :
                        'bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-500'
                      }`}
                      onClick={handleConfirm}
                    >
                      {modal.confirmText}
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

export default Academics;