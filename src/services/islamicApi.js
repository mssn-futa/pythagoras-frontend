import axios from 'axios';

const BASE_URL = 'https://api.aladhan.com/v1';

export const islamicApi = {
  getCurrentHijriDate: async () => {
    try {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const dateString = `${day}-${month}-${year}`;
      
      const response = await axios.get(`${BASE_URL}/gToH/${dateString}`);
      return response.data.data.hijri;
    } catch (error) {
      console.error('Error fetching Hijri date:', error);
      throw error;
    }
  },

  getHijriCalendar: async (month, year) => {
    try {
      const response = await axios.get(`${BASE_URL}/gToHCalendar/${month}/${year}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching Hijri calendar:', error);
      throw error;
    }
  },

  getPrayerTimes: async (city, country, method = 2) => {
    try {
      const response = await axios.get(`${BASE_URL}/timingsByCity`, {
        params: {
          city,
          country,
          method
        }
      });
      return response.data.data.timings;
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      throw error;
    }
  },

  getPrayerTimesByCoordinates: async (latitude, longitude, method = 2) => {
    try {
      const response = await axios.get(`${BASE_URL}/timings`, {
        params: {
          latitude,
          longitude,
          method
        }
      });
      return response.data.data.timings;
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      throw error;
    }
  }
};