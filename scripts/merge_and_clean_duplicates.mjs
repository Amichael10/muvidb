import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

function cleanTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|a|an|part|season|episode|movie|nollywood|nigerian|full)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function fetchAllFilms() {
  const allFilms = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, year, slug, source, poster_url, backdrop_url, box_office_domestic')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    allFilms.push(...data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  return allFilms;
}

async function mergeAndClean() {
  const allFilms = await fetchAllFilms();
  const newFilms = allFilms.filter(f => f.source === 'nollywood_com');
  const existingFilms = allFilms.filter(f => f.source !== 'nollywood_com');

  const existingByClean = new Map();
  for (const f of existingFilms) {
    const k = cleanTitle(f.title);
    if (k) {
      if (!existingByClean.has(k)) existingByClean.set(k, []);
      existingByClean.get(k).push(f);
    }
  }

  console.log(`Checking ${newFilms.length} newly inserted films for merges...`);

  let mergedCount = 0;
  for (const nf of newFilms) {
    const k = cleanTitle(nf.title);
    const matches = existingByClean.get(k);
    if (matches && matches.length > 0) {
      const primary = matches.find(m => Math.abs((m.year || 0) - (nf.year || 0)) <= 1) || matches[0];
      console.log(`Merging duplicate "${nf.title}" [${nf.id}] -> "${primary.title}" [${primary.id}]`);

      // 1. Move credits to primary film
      await supabase.from('credits').update({ film_id: primary.id }).eq('film_id', nf.id);

      // 2. Update primary film poster/backdrop/box office if missing
      const updates = {};
      if (!primary.poster_url && nf.poster_url) updates.poster_url = nf.poster_url;
      if (!primary.backdrop_url && nf.backdrop_url) updates.backdrop_url = nf.backdrop_url;
      if (!primary.box_office_domestic && nf.box_office_domestic) {
        updates.box_office_domestic = nf.box_office_domestic;
        updates.box_office_source = 'Nollywood.com';
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', primary.id);
      }

      // 3. Delete the duplicate film
      await supabase.from('films').delete().eq('id', nf.id);
      mergedCount++;
    }
  }

  console.log(`✅ Merged and removed ${mergedCount} duplicate film records.`);
}

mergeAndClean().catch(console.error);
