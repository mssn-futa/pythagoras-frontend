import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';

const HijriCalendar = () => {
  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  const calendarDays = [
    { day: null }, { day: null }, { day: null }, { day: 1 }, { day: 2 }, { day: 3 }, { day: null },
    { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 }, { day: 8 }, { day: 9 }, { day: 10 },
    { day: 11 }, { day: 12 }, { day: 13 }, { day: 14 }, { day: 15 }, { day: 16 }, { day: 17 },
    { day: 18 }, { day: 19 }, { day: 20 }, { day: 21 }, { day: 22 }, { day: 23 }, { day: 24 },
    { day: 25 }, { day: 26 }, { day: 27 }, { day: 28 }, { day: 29 }, { day: 30 }, { day: 31 }
  ];

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <header className="flex items-center gap-2 mb-4">
        <FontAwesomeIcon icon={faCalendar} className="text-green-600 dark:text-green-400" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">Hijri Calendar</h3>
      </header>

      <div className="text-center mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Jumada al-Thani 1446</p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Nov</p>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day, index) => (
          <div 
            key={index}
            className="text-center text-xs font-bold text-gray-600 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((item, index) => (
          <div 
            key={index}
            className={`text-center py-2 text-sm rounded ${
              item.day 
                ? 'text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer' 
                : ''
            } ${item.day === 2 ? 'bg-green-500 text-white font-bold' : ''}`}
          >
            {item.day || ''}
          </div>
        ))}
      </div>
    </article>
  );
};

export default HijriCalendar;