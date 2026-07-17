export const CINEMA_TIME_ZONE = 'Africa/Lagos';

export const getZonedClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CINEMA_TIME_ZONE,
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hours = Number(values.hour);
  const minutes = Number(values.minute);
  const seconds = Number(values.second);

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    seconds: (hours * 3600) + (minutes * 60) + seconds
  };
};

export const getNextDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split('T')[0];
};

export const getNext7Dates = (date = new Date()) => {
  const firstDate = getZonedClock(date).date;
  const dates = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const nextDate = new Date(`${firstDate}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + offset);
    dates.push(nextDate.toISOString().split('T')[0]);
  }

  return dates;
};

export const getShowtimeSeconds = (timeString) => {
  if (!timeString) return null;
  const [hours, minutes, seconds = 0] = String(timeString).split(':').map(Number);
  if ([hours, minutes, seconds].some(Number.isNaN)) return null;
  return (hours * 3600) + (minutes * 60) + seconds;
};

export const isFutureShowtime = (showtime, clock) => {
  if (!showtime?.show_date || !showtime?.show_time) return false;
  if (showtime.show_date > clock.date) return true;
  if (showtime.show_date < clock.date) return false;

  const showtimeSeconds = getShowtimeSeconds(showtime.show_time);
  return showtimeSeconds !== null && showtimeSeconds >= clock.seconds;
};

export const compareShowtimes = (first, second) => {
  const dateCompare = String(first.show_date).localeCompare(String(second.show_date));
  if (dateCompare !== 0) return dateCompare;
  return (getShowtimeSeconds(first.show_time) ?? Number.MAX_SAFE_INTEGER)
    - (getShowtimeSeconds(second.show_time) ?? Number.MAX_SAFE_INTEGER);
};
