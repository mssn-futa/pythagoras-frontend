import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMosque } from '@fortawesome/free-solid-svg-icons';

const PrayerTimes = () => {
  const prayers = [
    { name: 'Fajr', time: '5:45 AM' },
    { name: 'Dhuhr', time: '12:30 PM' },
    { name: 'Asr', time: '4:15 PM' },
    { name: 'Maghrib', time: '6:45 PM' },
    { name: 'Isha', time: '8:00 PM' }
  ];

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <header className="flex items-center gap-2 mb-4">
        <FontAwesomeIcon icon={faMosque} className="text-green-600 dark:text-green-400" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">Prayer Times</h3>
      </header>
      
      <ul className="space-y-3">
        {prayers.map((prayer) => (
          <li 
            key={prayer.name}
            className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {prayer.name}
            </span>
            <span className="text-gray-900 dark:text-white font-bold">
              {prayer.time}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
};

export default PrayerTimes;