import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen } from '@fortawesome/free-solid-svg-icons';

const DailyHadith = () => {
  return (
    <article className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
      <header className="flex items-center gap-2 mb-4">
        <FontAwesomeIcon icon={faBookOpen} className="text-green-600 dark:text-green-400" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">Daily Hadith</h3>
      </header>
      
      <blockquote className="mb-4">
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed italic">
          "The believer is not one who eats his fill while his neighbor goes hungry."
        </p>
      </blockquote>
      
      <footer className="text-sm text-gray-600 dark:text-gray-400">
        — Prophet Muhammad (SAW)
      </footer>
    </article>
  );
};

export default DailyHadith;