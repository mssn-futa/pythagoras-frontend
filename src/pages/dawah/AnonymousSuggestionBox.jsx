import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

const AnonymousSuggestionBox = () => {
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const subjects = [
    'General',
    'Islamic Studies',
    'Campus Events',
    'Academics',
    'Dawah Activities',
    'Other'
  ];

  const handleSubmit = () => {
    console.log('Submitting:', { discussionTitle, question, selectedSubject });
    setDiscussionTitle('');
    setQuestion('');
    setSelectedSubject('');
  };

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <header className="flex items-center gap-2 mb-4">
        <FontAwesomeIcon icon={faCommentDots} className="text-[#FF31FF]" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
          Anonymous Suggestion Box
        </h3>
      </header>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Discussion Title
          </label>
          <input
            type="text"
            value={discussionTitle}
            onChange={(e) => setDiscussionTitle(e.target.value)}
            placeholder="What would you like to discuss?"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-[#FF31FF] bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Share your thoughts, ask questions, or start a meaningful suggestion..."
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-[#FF31FF] bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-[#FF31FF] bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
          >
            <option value="">Choose a subject...</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-3 bg-gradient-to-r from-[#C002C0] to-[#FF31FF] text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
          Post
        </button>
      </div>
    </article>
  );
};

export default AnonymousSuggestionBox;