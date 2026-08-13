import { createWorker } from 'tesseract.js';

// Common role labels in credit rolls
const ROLE_PATTERNS = [
  { pattern: /^(?:STORY)(?: BY)?$/i, label: 'Story' },
  { pattern: /^(?:SCREEN ?PLAY|SCRIPT)(?: BY)?$/i, label: 'Screenplay' },
  { pattern: /^(?:WRITTEN|WRITER)(?: BY)?$/i, label: 'Writer' },
  { pattern: /^(?:MUSIC|SCORE)(?: BY)?$/i, label: 'Music' },
  { pattern: /^(?:DIRECTED BY|DIRECTOR)$/i, label: 'Director' },
  { pattern: /^(?:PRODUCED BY|PRODUCER)$/i, label: 'Producer' },
  { pattern: /^(?:EXECUTIVE PRODUCER)$/i, label: 'Executive Producer' },
  { pattern: /^(?:CINEMATOGRAPHER|DOP|D\.O\.P\.?)(?: BY)?$/i, label: 'Director of Photography' },
  { pattern: /^(?:EDITOR|EDITED BY)$/i, label: 'Editor' },
  { pattern: /^(?:COSTUME|WARDROBE)(?: DESIGNER)?$/i, label: 'Costume Designer' },
  { pattern: /^(?:MAKE ?UP|MAKEUP)(?: ARTIST)?$/i, label: 'Makeup Artist' },
  { pattern: /^(?:CONTINUITY)$/i, label: 'Continuity' },
  { pattern: /^(?:PRODUCTION MANAGER)$/i, label: 'Production Manager' },
  { pattern: /^(?:SOUND|AUDIO)(?: DESIGNER| EDITOR)?$/i, label: 'Sound' },
];

const STOP_MARKERS = [
  'COMING SOON', 'NEXT WEEK', 'NEXT ON', 'WATCH PART', 'TO BE CONTINUED',
  'SUBSCRIBE', 'LIKE AND SHARE', 'CLICK THE LINK', 'NOW SHOWING', 'TRAILER'
];

const NOISE_PATTERNS = [
  /^(THE END|END|CAST|CREW|CREDITS?)$/i,
  /^(THANKS?|THANK YOU)( FOR WATCHING)?$/i,
  /^(COPYRIGHT|ALL RIGHTS RESERVED|©)/i,
  /^(WWW\.|HTTP|YOUTUBE|INSTAGRAM|FACEBOOK|TWITTER|TIKTOK)/i,
  /^(A |AN )?(FILM|MOVIE|PRODUCTION) BY$/i,
  /\b(PRODUCTIONS?|ENTERTAINMENT|STUDIOS?|PICTURES|FILMS?|LTD|INC)\b/i,
];

function isNoiseLine(line) {
  const t = line.trim().toUpperCase();
  if (!t || t.length < 2) return true;
  if (STOP_MARKERS.some(m => t.includes(m))) return true;
  if (NOISE_PATTERNS.some(p => p.test(t))) return true;
  return false;
}

function cleanPersonName(raw) {
  let name = raw.replace(/[^a-zA-Z\s.'-]/g, ' ').replace(/\s+/g, ' ').trim();
  // Filter out single word non-names or Noise
  if (name.length < 3 || name.split(' ').length < 2) {
    // If it's a single word with good casing like "Gabriel" or "Omotola", allow if 3+ chars
    if (name.length < 3) return null;
  }
  return name;
}

/**
 * Perform local OCR using Tesseract.js on an image (Base64 string or File).
 * Returns array of extracted items: [{ name: string, role_or_character: string }]
 */
export async function extractCreditsWithLocalOCR(imageBase64, creditType = 'cast') {
  const worker = await createWorker('eng');
  
  try {
    const ret = await worker.recognize(imageBase64);
    const text = ret.data.text || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const results = [];
    let currentRole = creditType === 'cast' ? 'Cast' : 'Crew';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isNoiseLine(line)) continue;

      // 1. Check if line contains a colon separator (e.g. "Director: John Doe" or "John Doe ... Producer")
      if (line.includes(':') || line.includes(' - ') || line.includes(' – ') || line.includes('...')) {
        const parts = line.split(/[:\-\u2013]|(?:\.{2,})/);
        if (parts.length >= 2) {
          const p1 = parts[0].trim();
          const p2 = parts[1].trim();

          // Check if p1 is role, p2 is name
          const roleMatch1 = ROLE_PATTERNS.find(r => r.pattern.test(p1));
          if (roleMatch1) {
            const cleanedName = cleanPersonName(p2);
            if (cleanedName) {
              results.push({ name: cleanedName, role_or_character: roleMatch1.label });
              continue;
            }
          }

          // Check if p2 is role, p1 is name
          const roleMatch2 = ROLE_PATTERNS.find(r => r.pattern.test(p2));
          if (roleMatch2) {
            const cleanedName = cleanPersonName(p1);
            if (cleanedName) {
              results.push({ name: cleanedName, role_or_character: roleMatch2.label });
              continue;
            }
          }

          // In cast mode, p1 could be character, p2 could be actor name (or vice versa)
          const name1 = cleanPersonName(p1);
          const name2 = cleanPersonName(p2);
          if (name1 && name2) {
            results.push({ name: name2, role_or_character: name1 });
            continue;
          } else if (name1) {
            results.push({ name: name1, role_or_character: p2 });
            continue;
          } else if (name2) {
            results.push({ name: name2, role_or_character: p1 });
            continue;
          }
        }
      }

      // 2. Check if line itself is a standalone role label (e.g. "DIRECTED BY")
      const standaloneRole = ROLE_PATTERNS.find(r => r.pattern.test(line));
      if (standaloneRole) {
        currentRole = standaloneRole.label;
        // Next line might be the person's name
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const cleanedName = cleanPersonName(nextLine);
          if (cleanedName) {
            results.push({ name: cleanedName, role_or_character: currentRole });
            i++; // skip next line
            continue;
          }
        }
      }

      // 3. Standalone name under active role / character
      const cleaned = cleanPersonName(line);
      if (cleaned) {
        results.push({
          name: cleaned,
          role_or_character: creditType === 'cast' ? 'Actor' : currentRole,
        });
      }
    }

    return results;
  } finally {
    await worker.terminate();
  }
}
