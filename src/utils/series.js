/**
 * Extracts the base show name from a TV show episode title.
 * 
 * Examples:
 * "The Origin: Madam Koi-Koi - Chapter 1: The Awakening" -> "The Origin: Madam Koi-Koi"
 * "Blood Sisters Season 1" -> "Blood Sisters"
 * "Shanty Town Episode 2" -> "Shanty Town"
 * 
 * @param {string} title 
 * @returns {string} The base show name
 */
export function getShowName(title) {
  if (!title) return '';
  
  // This regex matches " - Chapter X", ": Season X", "Episode X", "Part X", etc.
  // We want to capture everything *before* the first occurrence of these episode markers.
  const match = title.match(/^(.*?)(?:[\s:-]+)?\b(?:Season|Chapter|Episode|Part|Vol(?:ume)?)\s*\d+/i);
  
  if (match && match[1]) {
    // Return the clean base title, stripping any trailing hyphens, colons, or spaces
    return match[1].replace(/[\s:-]+$/, '').trim();
  }
  
  // Try to remove common Yoruba episode markers (e.g. IKAN, EJI, ETA, KERIN, KARUN, KEFA, KEJE, KEJO, KESAN, KEWA, ELESE)
  // Or "Episode" in Yoruba: "Abala", "Ipin"
  const yorubaMatch = title.match(/^(.*?)(?:[\s:-]+)?\b(?:IKAN|EJI|ETA|ERIN|ARUN|EFA|EJE|EJO|ESAN|EWA|ELESE|KEJI|KETA|KERIN|KARUN|KEFA|KEJE|KEJO|KESAN|KEWA|ABALA|IPIN)\b/i);
  if (yorubaMatch && yorubaMatch[1]) {
    return yorubaMatch[1].replace(/[\s:-]+$/, '').trim();
  }

  // Also remove trailing standalone numbers like " 1", " 2" if they are at the end
  const numberMatch = title.match(/^(.*?)(?:[\s:-]+)?\b\d+$/);
  if (numberMatch && numberMatch[1]) {
    return numberMatch[1].replace(/[\s:-]+$/, '').trim();
  }

  // If no marker is found, return the original title
  return title.trim();
}
