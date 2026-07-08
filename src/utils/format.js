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
