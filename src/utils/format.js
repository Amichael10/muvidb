export function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(?:^|[\s-'])\w/g, function(match) {
    return match.toUpperCase();
  });
}

export function toSentenceCase(str) {
  if (!str) return str;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatFilmTitle(str) {
  if (!str) return str;
  // Force sentence format as requested by user
  return toSentenceCase(str);
}
