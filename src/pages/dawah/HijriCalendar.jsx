import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { islamicApi } from '../../services/islamicApi';

const HijriCalendar = () => {
  const [currentHijriDate, setCurrentHijriDate] = useState(null);
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  useEffect(() => {
    fetchHijriData();
  }, []);

  const fetchHijriData = async () => {
    try {
      setLoading(true);
      const hijriDate = await islamicApi.getCurrentHijriDate();
      setCurrentHijriDate(hijriDate);

      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      const calendarMonth = await islamicApi.getHijriCalendar(currentMonth, currentYear);
      setCalendarData(calendarMonth);
      setError(null);
    } catch (err) {
      setError('Failed to load calendar data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateCalendarDays = () => {
    if (!calendarData.length) return [];

    const firstDayOfMonth = new Date(calendarData[0].gregorian.date).getDay();
    const daysInMonth = calendarData.length;
    const calendarDays = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push({ day: null });
    }

    calendarData.forEach((dateInfo, index) => {
      const hijriDay = parseInt(dateInfo.hijri.day);
      const isToday = currentHijriDate && hijriDay === parseInt(currentHijriDate.day);
      
      calendarDays.push({
        day: hijriDay,
        isToday: isToday,
        gregorianDate: dateInfo.gregorian.date
      });
    });

    return calendarDays;
  };

  if (loading) {
    return (
      <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <header className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faCalendar} className="text-green-600 dark:text-green-400" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Hijri Calendar</h3>
        </header>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <FontAwesomeIcon 
            icon={faSpinner} 
            className="text-green-600 dark:text-green-400 text-3xl animate-spin" 
          />
          <p className="text-gray-600 dark:text-gray-400">Loading calendar...</p>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <header className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faCalendar} className="text-green-600 dark:text-green-400" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Hijri Calendar</h3>
        </header>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={fetchHijriData}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </article>
    );
  }

  const calendarDays = generateCalendarDays();

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <header className="flex items-center gap-2 mb-4">
        <FontAwesomeIcon icon={faCalendar} className="text-green-600 dark:text-green-400" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">Hijri Calendar</h3>
      </header>

      {currentHijriDate && (
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentHijriDate.month.en} {currentHijriDate.year}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            {currentHijriDate.day} {currentHijriDate.month.en}
          </p>
        </div>
      )}
      
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
            } ${item.isToday ? 'bg-green-500 text-white font-bold' : ''}`}
          >
            {item.day || ''}
          </div>
        ))}
      </div>
    </article>
  );
};

export default HijriCalendar;