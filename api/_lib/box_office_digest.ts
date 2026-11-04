import { supabase } from './supabase.js';

interface DigestEntry {
  title: string;
  weekendGross?: number;
  totalGross?: number;
  admissionsWeekend?: number;
  admissionsTotal?: number;
  locations?: number;
  weekendDates?: string;
  notes?: string;
  sourceIssue: string;
  sourceDate: string;
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

export async function fetchAndExtractDigest(): Promise<DigestEntry[]> {
  const res = await fetch('https://filmintelligencedigest.substack.com/feed', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
  const xml = await res.text();
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
      .replace(/<\/(p|div|figure)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&#8358;/g, '₦')
      .replace(/&#8217;/g, "'")
      .replace(/&#8212;/g, '—')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ');

    const paragraphs = text.split('\n').map(p => p.trim()).filter(Boolean);

    for (const p of paragraphs) {
      // 1. Agbara Nla
      const agbaraMatch = p.match(/(Agbara Nla(?:: The Return)?)[^]*?(?:with|taking|grossing|of)\s*(₦[\d.]+[MB])[^]*?(?:from\s*([\d,]+)\s*admissions)?.*?total\s*(?:is\s*now)?\s*(₦[\d.]+[MB])(?:[^]*?from\s*([\d,]+)\s*admissions)?/i);
      if (agbaraMatch) {
        extractedData.push({
          title: 'Agbara Nla: The Return',
          weekendGross: parseMoney(agbaraMatch[2]) || undefined,
          admissionsWeekend: agbaraMatch[3] ? parseInt(agbaraMatch[3].replace(/,/g, '')) : undefined,
          totalGross: parseMoney(agbaraMatch[4]) || undefined,
          admissionsTotal: agbaraMatch[5] ? parseInt(agbaraMatch[5].replace(/,/g, '')) : undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 2. Tele X Zikora
      const teleMatch = p.match(/(Tele X Zikora)[^]*?opening weekend\s*of\s*(₦[\d.]+[MB])[^]*?(?:from\s*([\d,]+)\s*admissions)?[^]*?(?:across\s*(\d+)\s*locations)?/i);
      if (teleMatch) {
        extractedData.push({
          title: 'Tele X Zikora',
          weekendGross: parseMoney(teleMatch[2]) || undefined,
          admissionsWeekend: teleMatch[3] ? parseInt(teleMatch[3].replace(/,/g, '')) : undefined,
          locations: teleMatch[4] ? parseInt(teleMatch[4]) : undefined,
          totalGross: parseMoney(teleMatch[2]) || undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 3. Clayface
      const clayMatch = p.match(/(Clayface)[^]*?opened[^]*?with\s*(₦[\d.]+[MB])[^]*?(?:from\s*([\d,]+)\s*admissions)?/i);
      if (clayMatch) {
        extractedData.push({
          title: 'Clayface',
          weekendGross: parseMoney(clayMatch[2]) || undefined,
          admissionsWeekend: clayMatch[3] ? parseInt(clayMatch[3].replace(/,/g, '')) : undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 4. A Land Apart
      const landMatch = p.match(/(A Land Apart)[^]*?(?:took|opened[^]*?with)\s*(₦[\d.]+[MB])[^]*?(?:from\s*([\d,]+)\s*admissions)?/i);
      if (landMatch) {
        extractedData.push({
          title: 'A Land Apart',
          weekendGross: parseMoney(landMatch[2]) || undefined,
          admissionsWeekend: landMatch[3] ? parseInt(landMatch[3].replace(/,/g, '')) : undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 5. No Fury
      const furyMatch = p.match(/(No Fury)[^]*?(?:made|opened[^]*?with|took)\s*(₦[\d.]+[MB])/i);
      if (furyMatch) {
        extractedData.push({
          title: 'No Fury',
          weekendGross: parseMoney(furyMatch[2]) || undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 6. Onibon Oje
      const onibonMatch = p.match(/(Onibon Oje)[^]*?with\s*(₦[\d.]+[MB])/i);
      if (onibonMatch) {
        extractedData.push({
          title: 'Onibon Oje',
          weekendGross: parseMoney(onibonMatch[2]) || undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 7. Street Fighter
      const sfMatch = p.match(/(Street Fighter)[^]*?made\s*(₦[\d.]+[MB])[^]*?total\s*(?:is\s*now)?\s*(₦[\d.]+[MB])/i);
      if (sfMatch) {
        extractedData.push({
          title: 'Street Fighter',
          weekendGross: parseMoney(sfMatch[2]) || undefined,
          totalGross: parseMoney(sfMatch[3]) || undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }

      // 8. Ikenga
      const ikengaMatch = p.match(/(Ikenga)[^]*?(?:crosses|crossed|hits|reached)\s*(₦[\d.]+[MB])/i);
      if (ikengaMatch) {
        extractedData.push({
          title: 'Ikenga',
          totalGross: parseMoney(ikengaMatch[2]) || undefined,
          sourceIssue: issueTitle,
          sourceDate,
          notes: p,
        });
        continue;
      }
    }
  }

  return extractedData;
}

export async function runBoxOfficeDigestSync() {
  const data = await fetchAndExtractDigest();
  let updatedCount = 0;
  const processedTitles: string[] = [];

  for (const item of data) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, year, box_office_domestic, box_office_opening_weekend, streaming_links')
      .ilike('title', item.title)
      .limit(2);

    if (error || !films || films.length === 0) continue;

    const film = films[0];
    const currentLinks = film.streaming_links || {};
    const existingBo = currentLinks.box_office || {};

    const history = existingBo.history || [];
    const existingIdx = history.findIndex((h: any) => h.date === item.sourceDate || h.issue === item.sourceIssue);
    const historyItem = {
      issue: item.sourceIssue,
      date: item.sourceDate,
      gross: item.weekendGross || item.totalGross,
      admissions: item.admissionsWeekend || item.admissionsTotal,
      locations: item.locations,
    };

    if (existingIdx >= 0) {
      history[existingIdx] = { ...history[existingIdx], ...historyItem };
    } else {
      history.push(historyItem);
    }

    const updatedDomestic = Math.max(Number(film.box_office_domestic || 0), Number(item.totalGross || 0));
    const updatedOpening = film.box_office_opening_weekend || item.weekendGross;

    const newBoData = {
      ...existingBo,
      domestic: updatedDomestic > 0 ? updatedDomestic : (film.box_office_domestic || item.weekendGross),
      opening_weekend: updatedOpening || existingBo.opening_weekend,
      admissions: item.admissionsTotal || existingBo.admissions,
      admissions_weekend: item.admissionsWeekend || existingBo.admissions_weekend,
      locations: item.locations || existingBo.locations,
      currency: 'NGN',
      source: 'Nigerian Film Intelligence (Filmhouse)',
      source_issue: item.sourceIssue,
      source_date: item.sourceDate,
      history,
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
    }
  }

  return {
    task: 'box_office_digest',
    observationsExtracted: data.length,
    processed: data.length,
    upserted: updatedCount,
    updatedFilms: processedTitles,
  };
}
