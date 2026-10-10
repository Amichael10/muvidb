/**
 * Unified Title Cleaner & Metadata Parser
 * Standardizes:
 * - Multi-part movies: "Title Part X", "Title Part 1 & 2", "Title (Concluding Part)"
 * - Episodic series: "Series Title (Episode Subtitle) Ep X", "Series Title Ep X", "Series Title S2 Ep 5"
 * - Standalone titles: Clean Title Case without marketing buzzwords or cast strings
 */

function toTitleCaseWord(w, i, allWords) {
  const upper = w.toUpperCase();
  const minorWords = ['A', 'AN', 'THE', 'AND', 'BUT', 'OR', 'FOR', 'NOR', 'ON', 'AT', 'TO', 'BY', 'OF', 'IN', 'WITH', 'FROM', 'AS'];
  const preservedAcronyms = ['EP', 'EPS', 'EPISODE', 'SEASON', 'PART', 'PT', 'VOL', 'VOLUME', 'HD', 'UK', 'USA', 'NG', 'TV', 'VIP', 'FBI', 'BBC'];

  if (preservedAcronyms.includes(upper)) {
    if (upper === 'PT') return 'Part';
    if (upper === 'EP' || upper === 'EPS') return 'Ep';
    if (['HD', 'UK', 'USA', 'NG', 'TV', 'VIP', 'FBI', 'BBC'].includes(upper)) return upper;
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
  if (minorWords.includes(upper) && i !== 0 && i !== allWords.length - 1) {
    return w.toLowerCase();
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function formatTitleCase(str) {
  if (!str) return '';
  const words = str.trim().split(/\s+/);
  return words.map((w, i) => toTitleCaseWord(w, i, words)).join(' ');
}

export function parseTitleMetadata(raw) {
  if (!raw) {
    return {
      title: '',
      content_type: 'movie',
      episode_number: null,
      season_number: null,
      is_part: false,
      part_number: null,
    };
  }

  let str = raw.trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ');

  // 1. Season info (e.g., SEASON 1, S2, S02E05)
  let seasonNumber = null;
  const sPatternMatch = str.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
  let sPatternEp = null;
  if (sPatternMatch) {
    seasonNumber = parseInt(sPatternMatch[1], 10);
    sPatternEp = parseInt(sPatternMatch[2], 10);
  } else {
    const seasonMatch = str.match(/\b(?:SEASON|SN|S)\s*(\d+)\b/i);
    if (seasonMatch) {
      seasonNumber = parseInt(seasonMatch[1], 10);
    }
  }

  // 2. Episode info (EP 1, EPISODE 267, etc.)
  let episodeNumber = sPatternEp;
  if (episodeNumber == null) {
    const epMatch = str.match(/\b(?:EPISODE|EPS|EP\.|EP|E)\s*(\d+)\b/i);
    if (epMatch) {
      episodeNumber = parseInt(epMatch[1], 10);
    }
  }

  // 3. Part info (Movies with parts: PART 1, PT 2, PART 1 & 2, CONCLUDING PART)
  let isPart = false;
  let partStr = null;
  let partNumber = null;

  const comboPartMatch = str.match(/\b(?:PART|PT\.?)\s*(\d+)\s*(?:&|AND|\+)\s*(?:PART|PT\.?)?\s*(\d+)\b/i);
  if (comboPartMatch) {
    isPart = true;
    partStr = `Part ${comboPartMatch[1]} & ${comboPartMatch[2]}`;
  } else {
    const singlePartMatch = str.match(/\b(?:PART|PT\.?)\s*(\d+)\b/i);
    if (singlePartMatch) {
      isPart = true;
      partNumber = parseInt(singlePartMatch[1], 10);
      partStr = `Part ${singlePartMatch[1]}`;
      if (/\bCONCLUDING\s+PART\b/i.test(str)) {
        partStr = `Part ${singlePartMatch[1]} (Concluding Part)`;
      }
    } else if (/\bCONCLUDING\s+PART\b/i.test(str)) {
      isPart = true;
      partStr = '(Concluding Part)';
    }
  }

  // 4. Episode Subtitle in parentheses e.g. "SAAMU ALAJO (ALAGBADO) Latest 2026 EP 267"
  let episodeSubtitle = null;
  const parenMatch = str.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    const isNoiseParen = /^(?:latest|full\s+movie|new|20\d{2}|official|hd|yoruba\s+movie|nollywood|action|comedy|drama|concluding\s+part|english|yoruba|igbo|hausa|pidgin|subtitled|subtitles|french)\b/i.test(inner);
    const isEpOrPart = /^(?:part|pt|ep|episode|season|s)\s*\d+/i.test(inner);
    if (!isNoiseParen && !isEpOrPart && inner.length >= 2 && inner.length <= 50) {
      let sub = inner.replace(/^(?:the\s+)?latest\s+/i, '').trim();
      const subPartMatch = str.match(new RegExp(`\\(${inner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*(\\d+)`));
      if (subPartMatch) {
        sub = `${sub} Pt ${subPartMatch[1]}`;
      }
      episodeSubtitle = formatTitleCase(sub);
    }
  }

  // Also check for subtitle separated by hyphen/colon before episode: e.g. "Saamu Alajo - Alagbado Ep 267"
  if (!episodeSubtitle && (episodeNumber != null || seasonNumber != null)) {
    const dashSubMatch = str.match(/^([^|:–—\-]+?)\s*[:–—\-]\s*([^|:–—\-]+?)\s+(?:[-–—|]\s*)?(?:SEASON|SN|S|EPISODE|EPS|EP\.|EP)\s*\d+/i);
    if (dashSubMatch) {
      const candSub = dashSubMatch[2].trim();
      const isNoise = /^(?:latest|new|official|trailer|teaser|yoruba|nollywood|movie|film|season|episode|drama|comedy)\b/i.test(candSub);
      if (!isNoise && candSub.length >= 2 && candSub.length <= 40) {
        episodeSubtitle = formatTitleCase(candSub);
      }
    }
  }

  // 5. Clean core base name
  let base = str;
  if (base.includes('|')) {
    const segments = base.split(/\|+/).map(s => s.trim()).filter(Boolean);
    if (segments.length > 1) {
      const isActorOrTeaser = (seg) => {
        const hasActorConnector = /\b(?:&|and|featuring|starring|ft\.)\b/i.test(seg);
        const hasColonTeaser = /[:–—\-]/.test(seg);
        const hasStoryVerb = /\b(?:vanishes|disappears|betrays|cries|shocked|revenge|falls in love)\b/i.test(seg);
        return (hasActorConnector && hasColonTeaser) || hasStoryVerb;
      };

      const hasMovieTag = (seg) => {
        return /\b(?:full\s+(?:nollywood|nigerian|yoruba)?\s*movie|latest\s+movie|complete\s+movie)\b/i.test(seg);
      };

      if (isActorOrTeaser(segments[0]) && (hasMovieTag(segments[1]) || !isActorOrTeaser(segments[1]))) {
        base = segments[1];
      } else if (hasMovieTag(segments[0]) || !isActorOrTeaser(segments[0])) {
        base = segments[0];
      } else {
        base = segments[0];
      }
    } else {
      base = segments[0] || base;
    }
  }

  base = base.replace(/\s*\/.*$/, ''); // strip slash cast chains
  base = base.replace(/^(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(?:MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(?:\d{4})?\s*[-–—:]\s*/i, '');
  base = base.replace(/\s*\[[^\]]+\]/g, '');
  base = base.replace(/\s*\{[^}]+\}/g, '');
  base = base.replace(/\s*\([^)]*\)/g, '');
  base = base.replace(/\s+[-–—]\s*(?:Latest|New|Nigerian|Nollywood|Yoruba|African|Watch|Ft\.|Starring|Featuring|Full\s+Nollywood\s+Movie|Full\s+Movie).*/i, '');
  base = base.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/i, ''); // star chains
  base = base.replace(/\s*(?:Latest|New|Full)\s*(?:Nigerian|Nollywood|Yoruba|Igbo)?\s*(?:Epic|Drama|Comedy|Action|Romance)?\s*(?:Movie|Film|Movies|Films|Series|Comedy Series)?\s*(?:\d{4})?.*$/i, '');
  base = base.replace(/\bS\d{1,2}E\d{1,3}.*$/i, '').trim();
  base = base.replace(/\b(?:EPISODE|EPS|EP\.|EP|SEASON|S|PART|PT\.?|VOLUME|VOL|E|V)\s*\d+.*$/i, '').trim();
  base = base.replace(/\bCONCLUDING\s+PART.*$/i, '').trim();

  // If subtitle was detected via dash, extract base from before dash (only for series)
  const isSeriesCheck = Boolean(episodeNumber != null || seasonNumber != null);
  if (isSeriesCheck && episodeSubtitle && /[:–—\-]/.test(base)) {
    const splitBase = base.split(/[:–—\-]/)[0].trim();
    if (splitBase.length >= 3) {
      base = splitBase;
    }
  }

  base = base.replace(/^[–—\-:, ]+|[–—\-:, ]+$/g, '').trim();
  // Strip trailing isolated numbers if they were already parsed in subtitle or episode
  if (episodeSubtitle || episodeNumber != null || isPart) {
    base = base.replace(/\s+\d+\s*$/, '').trim();
  }
  base = formatTitleCase(base);

  const isSeries = Boolean(episodeNumber != null || seasonNumber != null);
  const contentType = isSeries ? 'series' : 'movie';

  // 6. Build the standardized final title
  let finalTitle = base;

  if (isSeries) {
    const seasonTag = (seasonNumber && seasonNumber > 1) ? `S${seasonNumber} ` : '';
    const subTag = (episodeSubtitle && episodeSubtitle.toLowerCase() !== base.toLowerCase()) ? `(${episodeSubtitle}) ` : '';
    
    if (subTag || seasonTag) {
      finalTitle = `${base} ${subTag}${seasonTag}Ep ${episodeNumber || 1}`.replace(/\s+/g, ' ').trim();
    } else if (partStr && partStr.toLowerCase() !== base.toLowerCase()) {
      finalTitle = `${base} ${partStr} Ep ${episodeNumber || 1}`.replace(/\s+/g, ' ').trim();
    } else if (episodeNumber != null) {
      finalTitle = `${base} Ep ${episodeNumber}`;
    }
  } else if (isPart && partStr) {
    if (partStr === '(Concluding Part)') {
      finalTitle = `${base} (Concluding Part)`;
    } else {
      finalTitle = `${base} ${partStr}`;
    }
  }

  return {
    raw,
    title: finalTitle || formatTitleCase(str),
    content_type: contentType,
    season_number: isSeries ? (seasonNumber || 1) : null,
    episode_number: episodeNumber,
    is_part: isPart,
    part_number: partNumber,
  };
}

export function cleanTitle(raw) {
  if (!raw) return raw;
  const parsed = parseTitleMetadata(raw);
  return parsed.title;
}
