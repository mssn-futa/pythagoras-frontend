export const convertTo12Hour = (time24) => {
  if (!time24) return '--:--';
  
  const [hours, minutes] = time24.split(':');
  let hour = parseInt(hours);
  const minute = minutes;
  
  const period = hour >= 12 ? 'PM' : 'AM';
  
  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour = hour - 12;
  }
  
  return `${hour}:${minute} ${period}`;
};