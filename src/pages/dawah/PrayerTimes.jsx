import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMosque, faLocationDot, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { islamicApi } from '../../services/islamicApi';
import { convertTo12Hour } from '../../utils/timeFormatter';

const PrayerTimes = () => {
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState({ city: 'Akure', country: 'Nigeria' });
  const [useGeolocation, setUseGeolocation] = useState(false);

  useEffect(() => {
    if (useGeolocation) {
      getUserLocation();
    } else {
      fetchPrayerTimes();
    }
  }, [useGeolocation]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const times = await islamicApi.getPrayerTimesByCoordinates(latitude, longitude);
            setPrayerTimes(times);
            setError(null);
          } catch (err) {
            setError('Failed to load prayer times for your location');
            console.error(err);
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          setError('Location access denied. Using default location.');
          setUseGeolocation(false);
          fetchPrayerTimes();
        }
      );
    } else {
      setError('Geolocation not supported');
      fetchPrayerTimes();
    }
  };

  const fetchPrayerTimes = async () => {
    try {
      setLoading(true);
      const times = await islamicApi.getPrayerTimes(location.city, location.country);
      setPrayerTimes(times);
      setError(null);
    } catch (err) {
      setError('Failed to load prayer times');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const prayers = [
    { name: 'Fajr', key: 'Fajr' },
    { name: 'Dhuhr', key: 'Dhuhr' },
    { name: 'Asr', key: 'Asr' },
    { name: 'Maghrib', key: 'Maghrib' },
    { name: 'Isha', key: 'Isha' }
  ];

  if (loading) {
    return (
      <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <header className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faMosque} className="text-green-600 dark:text-green-400" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Prayer Times</h3>
        </header>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <FontAwesomeIcon 
            icon={faSpinner} 
            className="text-green-600 dark:text-green-400 text-3xl animate-spin" 
          />
          <p className="text-gray-600 dark:text-gray-400">Loading prayer times...</p>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <header className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faMosque} className="text-green-600 dark:text-green-400" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Prayer Times</h3>
        </header>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={fetchPrayerTimes}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faMosque} className="text-green-600 dark:text-green-400 flex-shrink-0" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Prayer Times</h3>
          </div>
          <button
            onClick={() => setUseGeolocation(!useGeolocation)}
            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors flex-shrink-0"
            title={useGeolocation ? 'Stop using location' : 'Use my location'}
          >
            <FontAwesomeIcon icon={faLocationDot} className="text-lg" />
          </button>
        </div>
        <div className="mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {useGeolocation ? 'Based on your current location' : `${location.city}, ${location.country}`}
          </p>
        </div>
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
              {prayerTimes ? convertTo12Hour(prayerTimes[prayer.key]) : '--:--'}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
};

export default PrayerTimes;