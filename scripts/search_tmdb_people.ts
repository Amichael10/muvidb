import 'dotenv/config';
import dns from 'node:dns';
import { Agent, fetch as undiciFetch } from 'undici';

dns.setDefaultResultOrder('ipv4first');
const dispatcher = new Agent({ connect: { timeout: 60000, lookup: (h, o, cb) => dns.lookup(h, { ...o, family: 4 }, cb) } });

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

async function searchTMDB(query: string) {
  const url = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
  const res = await undiciFetch(url, { dispatcher });
  if (res.ok) {
    const data = await res.json() as any;
    return data.results;
  }
  return [];
}

async function getTMDBPerson(id: number) {
  const url = `https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits,external_ids`;
  const res = await undiciFetch(url, { dispatcher });
  if (res.ok) {
    return await res.json();
  }
  return null;
}

async function main() {
  console.log('--- TMDB Search for Hakeem Onilogbo / Hakeem Effect ---');
  for (const q of ['Hakeem Onilogbo', 'Hakeem Effect', 'Olanrewaju Onilogbo']) {
    const res = await searchTMDB(q);
    console.log(`Query "${q}":`, res?.map((r: any) => ({ id: r.id, name: r.name, dept: r.known_for_department, pop: r.popularity })));
    if (res && res.length > 0) {
      const details = await getTMDBPerson(res[0].id);
      console.log('Details for', res[0].name, ':', {
        id: details.id,
        imdb_id: details.external_ids?.imdb_id || details.imdb_id,
        bio: details.biography?.slice(0, 200),
        profile_path: details.profile_path,
        birthday: details.birthday,
        crew_credits_count: details.combined_credits?.crew?.length,
        sample_crew: details.combined_credits?.crew?.slice(0, 10).map((c: any) => ({ title: c.title || c.name, job: c.job, department: c.department, year: c.release_date || c.first_air_date }))
      });
    }
  }

  console.log('\n--- TMDB Search for Adeola Thelma Bamgboye ---');
  for (const q of ['Adeola Thelma Bamgboye', 'Thelma Bamgboye', 'Adeola Bamgboye', 'Adeola Bamigboye']) {
    const res = await searchTMDB(q);
    console.log(`Query "${q}":`, res?.map((r: any) => ({ id: r.id, name: r.name, dept: r.known_for_department })));
    if (res && res.length > 0) {
      const details = await getTMDBPerson(res[0].id);
      console.log('Details for', res[0].name, ':', {
        id: details.id,
        imdb_id: details.external_ids?.imdb_id || details.imdb_id,
        bio: details.biography?.slice(0, 200),
        profile_path: details.profile_path,
        birthday: details.birthday,
        crew_credits_count: details.combined_credits?.crew?.length,
        sample_crew: details.combined_credits?.crew?.slice(0, 10).map((c: any) => ({ title: c.title || c.name, job: c.job, department: c.department, year: c.release_date || c.first_air_date }))
      });
    }
  }
}

main().catch(console.error);
