import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLanguage, faClipboardCheck, faBook, faTrophy, faMicrophone, faUsers } from '@fortawesome/free-solid-svg-icons';

const ArabicLearning = () => {
  const learningCards = [
    {
      id: 1,
      title: 'Weekly Quiz',
      subtitle: 'Test your progress',
      icon: faClipboardCheck,
      buttonText: 'Start Test',
      bgColor: 'from-[#2563EB] to-[#3B82F6]',
      badge: 'CBT',
      badgeBg: 'bg-blue-600'
    },
    {
      id: 2,
      title: 'Learn Vocabulary',
      subtitle: 'Daily words',
      icon: faBook,
      buttonText: 'Continue',
      bgColor: 'from-[#9333EA] to-[#A855F7]',
      badge: 'Module',
      badgeBg: 'bg-purple-600'
    },
    {
      id: 3,
      title: 'Your Level',
      subtitle: 'Intermediate',
      icon: faTrophy,
      buttonText: 'View Stats',
      bgColor: 'from-[#059669] to-[#10B981]',
      badge: 'Progress',
      badgeBg: 'bg-green-600'
    },
    {
      id: 4,
      title: 'Pronunciation',
      subtitle: 'Tajweed rules',
      icon: faMicrophone,
      buttonText: 'Practice',
      bgColor: 'from-[#EA580C] to-[#F97316]',
      badge: 'Audio',
      badgeBg: 'bg-orange-600'
    },
    {
      id: 5,
      title: 'Study Group',
      subtitle: 'Join discussions',
      icon: faUsers,
      buttonText: 'Join Now',
      bgColor: 'from-[#DB2777] to-[#EC4899]',
      badge: 'Group',
      badgeBg: 'bg-pink-600'
    }
  ];

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6">
      <header className="flex items-center gap-2 mb-6">
        <FontAwesomeIcon icon={faLanguage} className="text-[#FF31FF] text-xl" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Arabic Learning
        </h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {learningCards.map((card) => (
          <article
            key={card.id}
            className={`bg-gradient-to-br ${card.bgColor} rounded-xl p-6 text-white relative overflow-hidden hover:scale-105 transition-transform cursor-pointer`}
          >
            <span className={`absolute top-3 right-3 ${card.badgeBg} text-white text-xs px-2 py-1 rounded-full font-medium`}>
              {card.badge}
            </span>
            
            <div className="mb-4">
              <FontAwesomeIcon icon={card.icon} className="text-3xl mb-2 opacity-90" />
              <h3 className="text-lg font-bold mb-1">{card.title}</h3>
              <p className="text-sm opacity-90">{card.subtitle}</p>
            </div>

            <button className="w-full py-2 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              {card.buttonText}
            </button>
          </article>
        ))}
      </div>

      <article className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
        <header className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            Current Progress
          </h3>
          <span className="text-sm text-gray-600 dark:text-gray-400">Level 2</span>
        </header>

        <div className="mb-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#C002C0] to-[#FF31FF] rounded-full transition-all duration-500"
              style={{ width: '68%' }}
            ></div>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          68% Complete • 12 lessons remaining
        </p>
      </article>
    </section>
  );
};

export default ArabicLearning;