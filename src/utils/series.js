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
  
  // If no marker is found, return the original title
  return title.trim();
}
