/**
 * Utility to detect if a title represents a series episode and normalize it.
 */
export function detectAndNormalizeSeries(title: string) {
  const originalTitle = title;
  
  // Regex to find episode markers
  // Examples: "Movie Name Ep 1", "Movie Name Season 1 Episode 2", "Movie Name Part 1"
  const episodeRegex = /\s+(?:ep|episode|vol|volume|part|pt|season|series)\s*(\d+)/i;
  const match = title.match(episodeRegex);
  
  if (match) {
    // Extract the base title by removing the episode marker
    const baseTitle = title.replace(episodeRegex, '').trim();
    const episodeNum = parseInt(match[1]);
    
    return {
      isSeries: true,
      baseTitle,
      episodeNum,
      originalTitle
    };
  }
  
  // Broad markers for series without numbers
  if (/\b(seasons|episodes|series)\b/i.test(title)) {
    return {
      isSeries: true,
      baseTitle: title.trim(),
      episodeNum: null,
      originalTitle
    };
  }
  
  return {
    isSeries: false,
    baseTitle: title.trim(),
    episodeNum: null,
    originalTitle
  };
}
