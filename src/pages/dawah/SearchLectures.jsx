import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

const SearchLectures = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    console.log('Searching for:', searchQuery);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
        Looking for something?
      </h2>
      
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search lectures..."
          className="w-full px-4 py-3 pr-12 rounded-full border-2 border-[#FF31FF] focus:outline-none focus:border-[#C002C0] bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400"
        />
        <button
          onClick={handleSearch}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-r from-[#C002C0] to-[#FF31FF] flex items-center justify-center text-white hover:scale-105 transition-transform"
        >
          <FontAwesomeIcon icon={faSearch} />
        </button>
      </div>
    </section>
  );
};

export default SearchLectures;