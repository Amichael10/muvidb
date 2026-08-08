export function toTitleCase(str) {
  if (!str) return str;
  const isAllCaps = str === str.toUpperCase() && str !== str.toLowerCase();
  const target = isAllCaps ? str.toLowerCase() : str;
  return target.replace(/(?:^|[\s-'])\w/g, function(match) {
    return match.toUpperCase();
  });
}

export function toSentenceCase(str) {
  if (!str) return str;
  const isAllCaps = str === str.toUpperCase() && str !== str.toLowerCase();
  const target = isAllCaps ? str.toLowerCase() : str;
  // Capitalize first character of string
  let result = target.charAt(0).toUpperCase() + target.slice(1);
  // Capitalize first character of each subsequent sentence
  return result.replace(/([.!?]\s+)([a-z])/g, function(match, p1, p2) {
    return p1 + p2.toUpperCase();
  });
}

export function formatFilmTitle(str) {
  if (!str) return str;
  return toSentenceCase(str);
}

export function formatPersonName(str) {
  if (!str) return str;
  return toTitleCase(str);
}

// Years like 0001 mean "year unknown" — show day + month only.
export function formatDateOfBirth(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!month || !day) return raw;

  // Years 0–99 are treated as 1900–1999 by Date; use a stand-in for day/month.
  // Local noon avoids UTC timezone day-shift.
  const calendarYear = year < 100 ? 2000 : year;
  const date = new Date(calendarYear, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return raw;

  const options = { day: 'numeric', month: 'long' };
  if (year > 1) options.year = 'numeric';

  return date.toLocaleDateString('en-NG', options);
}
