import { supabase } from './supabase.js';
import { resolveMissingNollywoodFilm } from './cinema-adapters/resolve-film.js';

export interface DigestEntry {
  title: string;
  weekendGross?: number;
  totalGross?: number;
  admissionsWeekend?: number;
  admissionsTotal?: number;
  locations?: number;
  weekNumber?: number;
  sourceIssue: string;
  sourceDate: string;
  notes?: string;
}

export function parseMoney(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[₦,]/g, '').trim();
  const matchB = cleaned.match(/([\d.]+)\s*B/i);
  if (matchB) return Math.round(parseFloat(matchB[1]) * 1_000_000_000);
  const matchM = cleaned.match(/([\d.]+)\s*M/i);
  if (matchM) return Math.round(parseFloat(matchM[1]) * 1_000_000);
  const matchK = cleaned.match(/([\d.]+)\s*K/i);
  if (matchK) return Math.round(parseFloat(matchK[1]) * 1_000);
  const rawNum = parseFloat(cleaned);
  return isNaN(rawNum) ? null : Math.round(rawNum);
}

const ACTION_VERBS = [
  'opened at number [\\w]+ with',
  'opened [\\w]+ with',
  'opened with',
  'opening weekend of',
  'opened fourth with',
  'opened third with',
  'opened second with',
  'opened best with',
  'was right behind with',
  'was next with',
  'followed with',
  'came second with',
  'came third with',
  'came in at',
  'came [\\w\\s]+ with',
  'finished [\\w\\s]+ with',
  'held [\\w\\s]+ with',
  'led for a [\\w\\s]+ with',
  'led the weekend with',
  'delivered',
  'made',
  'added',
  'took',
  'taking',
  'tied on',
  'now stands at',
  'stands at',
  'reached',
  'has reached',
  'crosses',
  'crossed'
].join('|');

const SENTENCE_TITLE_REGEX = new RegExp(
  `^([A-Z0-9][A-Za-z0-9&'’.:\\- ]{1,45}?)\\s+(?:${ACTION_VERBS})\\s*(₦[\\d.]+[MB]?|\\b\\d{7,10}\\b)`,
  'i'
);

function parseFilmSentence(sentence: string, issue: string, date: string): DigestEntry | null {
  if (!sentence.includes('₦')) return null;
  if (/^cinemas made|^the box office|^the year|^october is|^november is|^the nigerian box office|^last year/i.test(sentence)) {
    return null;
  }

  const cleanSentence = sentence.replace(/^(?:of the other new titles,?\s*|away from\s*|behind\s*|for\s*)/i, '').trim();

  const match = cleanSentence.match(SENTENCE_TITLE_REGEX);
  if (!match) return null;

  let title = match[1].trim();
  if (/^(cinemas|the box office|the market|every single month|this weekend|this week|october|november|december|nigerian|hollywood|nollywood|indian titles)$/i.test(title)) {
    return null;
  }

  // Normalize titles
  if (/Agbara Nla/i.test(title)) title = 'Agbara Nla: The Return';
  if (/Maybe.*Maybe Not/i.test(title)) title = 'Maybe... Maybe Not';

  let gross = parseMoney(match[2]) || undefined;

  // Check cumulative total
  let total: number | undefined;
  const totalMatch = cleanSentence.match(/(?:now stands at|stands at|taking its total to|total(?: is now| to)?|has reached|reached|for a total of|to reach|moves to)\s*(₦[\d.]+[MB]?|\b\d{7,10}\b)/i);
  if (totalMatch) {
    total = parseMoney(totalMatch[1]) || undefined;
  } else {
    const forMatch = cleanSentence.match(/for\s*(₦[\d.]+[MB]?)/i);
    if (forMatch) {
      total = parseMoney(forMatch[1]) || undefined;
    }
  }

  // Admissions
  let admissions: number | undefined;
  let admissionsTotal: number | undefined;
  const admMatches = [...cleanSentence.matchAll(/(?:from\s*)?([\d,]+)\s*admissions/gi)];
  if (admMatches.length === 1) {
    if (totalMatch && cleanSentence.indexOf('admissions') > cleanSentence.indexOf(totalMatch[0])) {
      admissionsTotal = parseInt(admMatches[0][1].replace(/,/g, ''));
    } else {
      admissions = parseInt(admMatches[0][1].replace(/,/g, ''));
    }
  } else if (admMatches.length >= 2) {
    admissions = parseInt(admMatches[0][1].replace(/,/g, ''));
    admissionsTotal = parseInt(admMatches[1][1].replace(/,/g, ''));
  }

  // Locations
  let locations: number | undefined;
  const locMatch = cleanSentence.match(/(?:across|from)\s*(\d+)\s*locations/i);
  if (locMatch) locations = parseInt(locMatch[1]);

  // Week number
  let weekNumber: number | undefined;
  const weekNumMatch = cleanSentence.match(/(\d+)(?:st|nd|rd|th)\s+(?:consecutive\s+)?(?:weekend|week)/i);
  if (weekNumMatch) {
    weekNumber = parseInt(weekNumMatch[1]);
  } else if (/first\s+(?:full\s+)?(?:weekend|week)/i.test(cleanSentence)) {
    weekNumber = 1;
  } else if (/second\s+(?:weekend|week)/i.test(cleanSentence)) {
    weekNumber = 2;
  } else if (/third\s+(?:weekend|week)/i.test(cleanSentence)) {
    weekNumber = 3;
  } else if (/fourth\s+(?:weekend|week)/i.test(cleanSentence)) {
    weekNumber = 4;
  } else if (/fifth\s+(?:weekend|week)/i.test(cleanSentence)) {
    weekNumber = 5;
  } else if (/sixth\s+(?:weekend|week)/i.test(cleanSentence)) {
    weekNumber = 6;
  }

  return {
    title,
    weekendGross: gross,
    totalGross: total,
    admissionsWeekend: admissions,
    admissionsTotal,
    locations,
    weekNumber,
    sourceIssue: issue,
    sourceDate: date,
    notes: cleanSentence
  };
}

function parseSpecialSentences(text: string, issue: string, date: string): DigestEntry[] {
  const records: DigestEntry[] = [];

  // 1. "The Beacon Man with ₦2.1M"
  const beaconMatch = text.match(/The Beacon Man\s+with\s*(₦[\d.]+[MB]?)/i);
  if (beaconMatch) {
    records.push({
      title: 'The Beacon Man',
      weekendGross: parseMoney(beaconMatch[1]) || undefined,
      sourceDate: date,
      sourceIssue: issue,
      notes: beaconMatch[0]
    });
  }

  // 2. "Tele X Zikora ... opening weekend of ₦26.9M from 4,168 admissions across 83 locations"
  if (/Tele X Zikora/i.test(text) && /opening weekend of/i.test(text)) {
    const teleOpenMatch = text.match(/Tele X Zikora[^]*?opening weekend\s*of\s*(₦[\d.]+[MB]?)[^]*?(?:from\s*([\d,]+)\s*admissions)?[^]*?(?:across\s*(\d+)\s*locations)?/i);
    if (teleOpenMatch) {
      records.push({
        title: 'Tele X Zikora',
        weekendGross: parseMoney(teleOpenMatch[1]) || undefined,
        totalGross: parseMoney(teleOpenMatch[1]) || undefined,
        admissionsWeekend: teleOpenMatch[2] ? parseInt(teleOpenMatch[2].replace(/,/g, '')) : undefined,
        locations: teleOpenMatch[3] ? parseInt(teleOpenMatch[3]) : undefined,
        sourceDate: date,
        sourceIssue: issue,
        notes: teleOpenMatch[0].slice(0, 150)
      });
    }
  }

  // 3. "A Land Apart ... ₦8.4M from 1,500 admissions"
  if (/A Land Apart/i.test(text) && /opened fifth with|took/i.test(text)) {
    const landMatch = text.match(/A Land Apart\s+(?:took|opened fifth with)\s*(₦[\d.]+[MB]?)[^]*?(?:from\s*([\d,]+)\s*admissions)?/i);
    if (landMatch) {
      records.push({
        title: 'A Land Apart',
        weekendGross: parseMoney(landMatch[1]) || undefined,
        totalGross: parseMoney(landMatch[1]) || undefined,
        admissionsWeekend: landMatch[2] ? parseInt(landMatch[2].replace(/,/g, '')) : undefined,
        sourceDate: date,
        sourceIssue: issue,
        notes: landMatch[0].slice(0, 150)
      });
    }
  }

  // 4. "No Fury made ₦6.8M"
  const furyMatch = text.match(/No Fury\s+made\s*(₦[\d.]+[MB]?)/i);
  if (furyMatch) {
    records.push({
      title: 'No Fury',
      weekendGross: parseMoney(furyMatch[1]) || undefined,
      sourceDate: date,
      sourceIssue: issue,
      notes: furyMatch[0]
    });
  }

  // 5. "Onibon Oje opened in 18th with ₦1.1M"
  const onibonMatch = text.match(/Onibon Oje\s+opened[^]*?with\s*(₦[\d.]+[MB]?)/i);
  if (onibonMatch) {
    records.push({
      title: 'Onibon Oje',
      weekendGross: parseMoney(onibonMatch[1]) || undefined,
      sourceDate: date,
      sourceIssue: issue,
      notes: onibonMatch[0]
    });
  }

  return records;
}

export async function fetchAndExtractDigest(): Promise<DigestEntry[]> {
  let xml = '';
  try {
    const res = await fetch('https://filmintelligencedigest.substack.com/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
    xml = await res.text();
  } catch (err: any) {
    console.warn('[box_office_digest] Feed fetch failed or timed out:', err?.message || err);
    return [];
  }
  const items = xml.split('<item>').slice(1);

  const extractedData: DigestEntry[] = [];

  for (const item of items) {
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
    const issueTitle = titleMatch ? titleMatch[1].trim() : '';
    const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
    const sourceDate = dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : '';
    const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
    const content = contentMatch ? contentMatch[1] : '';

    const text = content
      .replace(/<\/(p|div|figure|h1|h2|h3|h4|li|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&#8358;/g, '₦')
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8212;/g, '—')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ');

    const sentences = text.split(/(?<=[.?!])\s+|\n+/).map(p => p.trim()).filter(Boolean);

    for (const sent of sentences) {
      const rec = parseFilmSentence(sent, issueTitle, sourceDate);
      if (rec) extractedData.push(rec);
    }

    const specialRecs = parseSpecialSentences(text, issueTitle, sourceDate);
    for (const s of specialRecs) {
      extractedData.push(s);
    }
  }

  return extractedData;
}

export async function runBoxOfficeDigestSync() {
  const data = await fetchAndExtractDigest();
  let updatedCount = 0;
  const processedTitles: string[] = [];

  // Group extracted data by title
  const byTitle: Record<string, DigestEntry[]> = {};
  for (const item of data) {
    if (!byTitle[item.title]) byTitle[item.title] = [];
    // Dedup identical date + amount
    const exists = byTitle[item.title].some(
      e => e.sourceDate === item.sourceDate && e.weekendGross === item.weekendGross
    );
    if (!exists) {
      byTitle[item.title].push(item);
    }
  }

  for (const [title, records] of Object.entries(byTitle)) {
    // Look up film in database
    const { data: films } = await supabase
      .from('films')
      .select('id, title, release_type, year, box_office_domestic, box_office_opening_weekend, streaming_links')
      .ilike('title', title)
      .limit(5);

    // Prefer exact match, or cinema release
    let film = (films && films.length > 0)
      ? (films.find(f => f.title.toLowerCase() === title.toLowerCase()) ||
         films.find(f => f.release_type === 'cinema') ||
         films[0])
      : null;

    if (!film) {
      // If not yet in database, attempt auto-resolution from TMDB
      const resolved = await resolveMissingNollywoodFilm(supabase, title, 'box_office_digest').catch(() => null);
      if (resolved) {
        film = resolved as any;
      }
    }

    if (!film) continue;

    const currentLinks = film.streaming_links || {};
    const existingBo = currentLinks.box_office || {};
    const existingHistory = Array.isArray(existingBo.history) ? [...existingBo.history] : [];

    // Sort records chronologically
    records.sort((a, b) => a.sourceDate.localeCompare(b.sourceDate));

    for (const item of records) {
      const grossVal = item.weekendGross || item.totalGross;
      if (!grossVal) continue;

      const histItem = {
        date: item.sourceDate,
        issue: item.sourceIssue,
        gross: grossVal,
        cumulative: item.totalGross || undefined,
        admissions: item.admissionsWeekend || item.admissionsTotal || undefined,
        locations: item.locations || undefined,
        notes: item.notes,
      };

      const existingIdx = existingHistory.findIndex((h: any) => h.date === item.sourceDate);
      if (existingIdx >= 0) {
        existingHistory[existingIdx] = {
          ...existingHistory[existingIdx],
          ...histItem,
          cumulative: histItem.cumulative || existingHistory[existingIdx].cumulative,
        };
      } else {
        existingHistory.push(histItem);
      }
    }

    // Sort combined history chronologically
    existingHistory.sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

    // Compute progression and monotonic cumulative
    let runningCum = 0;
    for (let idx = 0; idx < existingHistory.length; idx++) {
      const h = existingHistory[idx];
      h.week = idx + 1;
      h.label = `Week ${idx + 1}`;

      if (h.cumulative && Number(h.cumulative) > 0) {
        runningCum = Number(h.cumulative);
      } else {
        if (idx === 0) {
          runningCum = Number(h.gross || 0);
        } else {
          runningCum += Number(h.gross || 0);
        }
        h.cumulative = runningCum;
      }
    }

    const latestHistory = existingHistory[existingHistory.length - 1];
    const latestRecord = records[records.length - 1];

    // Priority for domestic:
    // 1. Explicit latest total reported in newsletter (e.g. ₦89.2M for Tele X Zikora, ₦486.4M for Agbara Nla)
    // 2. Latest cumulative in history
    // 3. Current film.box_office_domestic if already higher
    const latestExplicitTotal = Number(latestRecord.totalGross || latestHistory?.cumulative || 0);
    const updatedDomestic = latestExplicitTotal > 0
      ? latestExplicitTotal
      : Math.max(Number(film.box_office_domestic || 0), Number(latestRecord.weekendGross || 0));

    const openingGross = film.box_office_opening_weekend ||
      existingHistory[0]?.gross ||
      latestRecord.weekendGross;

    const latestAdmissions = latestRecord.admissionsTotal ||
      existingHistory.find((h: any) => h.admissions)?.admissions ||
      existingBo.admissions;

    const latestLocations = latestRecord.locations ||
      existingHistory.find((h: any) => h.locations)?.locations ||
      existingBo.locations;

    const newBoData = {
      ...existingBo,
      domestic: updatedDomestic,
      opening_weekend: openingGross,
      admissions: latestAdmissions,
      locations: latestLocations,
      currency: 'NGN',
      source: 'Nigerian Film Intelligence (Filmhouse)',
      source_issue: latestRecord.sourceIssue,
      source_date: latestRecord.sourceDate,
      history: existingHistory,
      updated_at: new Date().toISOString(),
    };

    const updatedLinksPayload = {
      ...currentLinks,
      box_office: newBoData,
    };

    const { error: updateErr } = await supabase
      .from('films')
      .update({
        box_office_domestic: newBoData.domestic,
        box_office_opening_weekend: newBoData.opening_weekend,
        box_office_currency: 'NGN',
        box_office_source: newBoData.source,
        streaming_links: updatedLinksPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', film.id);

    if (!updateErr) {
      updatedCount++;
      processedTitles.push(film.title);
      console.log(`[box_office_digest] Updated "${film.title}": domestic=₦${updatedDomestic.toLocaleString()}, ${existingHistory.length} weeks of history.`);
    } else {
      console.error(`[box_office_digest] Error updating "${film.title}":`, updateErr.message);
    }
  }

  return {
    task: 'box_office_digest',
    observationsExtracted: data.length,
    processed: Object.keys(byTitle).length,
    upserted: updatedCount,
    updatedFilms: processedTitles,
  };
}
