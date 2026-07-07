import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Note: we can't easily import from api/_lib since it might be TS compiled differently, 
// so we'll just implement the cleaning logic here for simplicity and safety.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function cleanTitleAdvanced(raw: string, castNames: string[] = []): string {
  if (!raw) return raw;
  
  let title = raw.trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ');

  // 0. Pre-capture EP info
  const epMatch = title.match(/\b(EP|EPISODE|EP\.|E|SEASON|PART|VOL|VOLUME|V)\s*(\d+)/i);
  const epInfo = epMatch ? epMatch[0] : null;
  if (epInfo) {
    title = title.replace(epMatch[0], ' __EP_PLACEHOLDER__ ').replace(/\s{2,}/g, ' ').trim();
  }

  // 1. Remove "Starring", "Ft", "Featuring" blocks
  title = title.replace(/\b(starring|ft\.?|featuring|with|cast)\b[\s\S]*$/i, '');

  // 2. Remove cast names explicitly
  if (castNames.length > 0) {
    for (const name of castNames) {
      if (!name) continue;
      // create case insensitive regex for the actor name
      const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
      title = title.replace(regex, '');
    }
  }

  // 3. Remove leftover junk like "&", "and", ",", "|", "()" if they are just hanging out after removing names
  title = title.replace(/\(\s*(&|and|,|\||\s)*\s*\)/gi, '');
  title = title.replace(/\[\s*(&|and|,|\||\s)*\s*\]/gi, '');
  
  // 4. Prefix noise removal
  title = title.replace(/^(LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(\d{4})?\s*[-–—:]\s*/i, '');

  // 5. Specific Nollywood/YouTube noise patterns
  title = title.replace(/\s*\/\s*[A-Z]{2,5}\.?\s*\/?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s*Watch\s+.*/i, '');
  title = title.replace(/\s+[-–—]\s*LATEST\s*.*/i, '');
  title = title.replace(/\s+[-–—]\s*NEW\s*.*/i, '');
  title = title.replace(/\s*#\w+/g, ''); // Hashtags
  title = title.replace(/\s+[-–—]\s+(Nigerian|Nollywood|African).*/i, '');
  title = title.replace(/\s+[-–—](Nigerian|Nollywood|African).*/i, '');
  title = title.replace(/\s*Latest\s*(Nigerian|Nollywood|Yoruba|Igbo)?\s*(Epic\s*)?(New\s*)?(Drama\s*)?(Movie|Film|Movies|Films)s?\s*(\d{4})?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*[\/,]\s*[A-Z].*$/i, '');
  title = title.replace(/\s*(Full|Complete)\s*(Movie|Film|Season)\s*$/i, '');
  title = title.replace(/\s*[|/]\s*(Moments with Mo|MWM|Full|Complete|Latest|New|Nollywood|Nigerian|African|Epic|Drama|Action|Comedy|Season)\s*(Movie|Film|Movies|Films)?\s*.*$/i, '');
  title = title.replace(/\s*\(Latest\s*(Comedy\s*)?(Drama\s*)?(Action\s*)?(Movie|Film|Movies|Films|Full Movie)\s*\)\s*.*$/i, '');

  // Remove pipe-delimited segments and large bracketed text
  title = title.replace(/\|\|[^|]+\|\|/g, '').replace(/\([A-Z][A-Z\s,]{6,}\)/g, '').trim();

  // Heuristic: if title is very long and has a dash, take the first part
  if (title.length > 80) {
    const dashParts = title.split(/\s+[-–—]\s+/);
    if (dashParts[0].length >= 3 && dashParts[0].length <= 70) {
      title = dashParts[0];
    }
  }

  // Polish
  title = title.replace(/\s{2,}/g, ' ').trim();
  title = title.replace(/\s*[,|/\\–—-]+\s*$/, '').trim();
  title = title.replace(/^\s*[,|/\\–—-]+\s*/, '').trim();
  
  // Re-inject EP
  if (epInfo) {
    title = title.replace('__EP_PLACEHOLDER__', epInfo);
    if (!title.includes(epInfo)) {
      title = `${title} ${epInfo}`;
    }
  }

  // Title Case
  const minorWords = ['A', 'AN', 'THE', 'AND', 'BUT', 'OR', 'FOR', 'NOR', 'ON', 'AT', 'TO', 'BY', 'OF', 'IN', 'WITH', 'FROM', 'AS'];
  const preservedAcronyms = ['EP', 'EPISODE', 'EP.', 'E', 'SEASON', 'PART', 'VOL', 'VOLUME'];
  
  return title.split(/\s+/).map((w, i) => {
    const upper = w.toUpperCase();
    if (preservedAcronyms.includes(upper)) return upper;
    if (/^\d+$/.test(w) && i > 0) {
      const prev = title.split(/\s+/)[i-1].toUpperCase();
      if (preservedAcronyms.includes(prev)) return w;
    }
    if (w.length <= 3 && w === w.toUpperCase() && /^[A-Z]+$/.test(w) && !minorWords.includes(upper)) {
      return w;
    }
    if (minorWords.includes(upper) && i !== 0) {
      return w.toLowerCase();
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ').replace(/\s{2,}/g, ' ').trim();
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

async function runCleanup() {
  console.log('Starting title cleanup for YouTube films...');

  let updatedCount = 0;
  let totalProcessed = 0;
  const BATCH_SIZE = 1000;
  let hasMore = true;
  let lastId = '00000000-0000-0000-0000-000000000000';

  while (hasMore) {
    const { data: films, error: fetchErr } = await supabase
      .from('films')
      .select('id, title')
      .eq('source', 'youtube')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error('Error fetching films:', fetchErr);
      process.exit(1);
    }

    if (!films || films.length === 0) {
      hasMore = false;
      break;
    }

    totalProcessed += films.length;
    lastId = films[films.length - 1].id;

    console.log(`Processing batch of ${films.length}...`);

    for (const film of films) {
      if (!film.title) continue;

      // Fetch cast members for this film
      const { data: credits, error: creditErr } = await supabase
        .from('credits')
        .select(`people(name)`)
        .eq('film_id', film.id);

      let castNames: string[] = [];
      if (!creditErr && credits) {
        castNames = credits
          .map((c: any) => c.people?.name)
          .filter(Boolean);
      }
      
      const cleaned = cleanTitleAdvanced(film.title, castNames);
      
      // Only update if there was a change
      if (cleaned && cleaned !== film.title) {
        console.log(`Cleaning: "${film.title}" -> "${cleaned}"`);
        
        const { error: updateErr } = await supabase
          .from('films')
          .update({ title: cleaned })
          .eq('id', film.id);
          
        if (updateErr) {
          console.error(`Failed to update ${film.title}:`, updateErr);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`\nCleanup complete! Processed ${totalProcessed} films, updated ${updatedCount} titles.`);
}

runCleanup();
