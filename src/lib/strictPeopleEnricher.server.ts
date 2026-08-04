import { supabaseServer } from './supabase.server';

const TMDB_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;

export interface VerifiedPersonEnrichment {
  bio?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_handle?: string | null;
  tmdb_id?: number | null;
}

export async function enrichPersonStrict(person: any): Promise<{ data: VerifiedPersonEnrichment; verified: boolean; sources: string[] }> {
  const sources: string[] = [];
  const result: VerifiedPersonEnrichment = {};

  let tmdbData: any = null;
  let externalIds: any = null;

  // 1. Fetch TMDB Data if tmdb_id exists or search by exact name
  if (person.tmdb_id && TMDB_KEY) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/person/${person.tmdb_id}?api_key=${TMDB_KEY}`);
      if (res.ok) {
        tmdbData = await res.json();
        sources.push(`TMDB Person ID ${person.tmdb_id}`);
      }
    } catch {}
  }

  if (!tmdbData && TMDB_KEY && person.name) {
    try {
      const query = encodeURIComponent(person.name);
      const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${query}`);
      if (res.ok) {
        const searchJson = await res.json();
        const match = searchJson.results?.find((p: any) => p.name.toLowerCase() === person.name.toLowerCase());
        if (match) {
          tmdbData = match;
          result.tmdb_id = match.id;
          sources.push(`TMDB Person Search Match: ${match.name}`);
        }
      }
    } catch {}
  }

  // Fetch TMDB External IDs for strict social handles
  const activeTmdbId = person.tmdb_id || result.tmdb_id;
  if (activeTmdbId && TMDB_KEY) {
    try {
      const extRes = await fetch(`https://api.themoviedb.org/3/person/${activeTmdbId}/external_ids?api_key=${TMDB_KEY}`);
      if (extRes.ok) {
        externalIds = await extRes.json();
      }
    } catch {}
  }

  // STRICT BIO Extraction: Only use real biography text from TMDB or Wikipedia. NO AI guessing.
  if (tmdbData?.biography && tmdbData.biography.trim().length > 20) {
    result.bio = tmdbData.biography.trim();
  }

  // STRICT PHOTO Extraction: Only TMDB official profile path
  if (tmdbData?.profile_path) {
    result.photo_url = `https://image.tmdb.org/t/p/w500${tmdbData.profile_path}`;
  }

  // STRICT DOB Extraction
  if (tmdbData?.birthday && /^\d{4}-\d{2}-\d{2}$/.test(tmdbData.birthday)) {
    result.date_of_birth = tmdbData.birthday;
  }

  // STRICT GENDER Extraction (1 = female, 2 = male)
  if (tmdbData?.gender === 1) result.gender = 'female';
  if (tmdbData?.gender === 2) result.gender = 'male';

  // STRICT SOCIAL URL Extraction: Only if external_ids explicitly provided by TMDB. NO STRING CONCATENATION OR GUESSING.
  if (externalIds) {
    if (externalIds.instagram_id) {
      result.instagram_url = `https://instagram.com/${externalIds.instagram_id}`;
    }
    if (externalIds.twitter_id) {
      result.twitter_url = `https://x.com/${externalIds.twitter_id}`;
    }
    if (externalIds.facebook_id) {
      result.facebook_url = `https://facebook.com/${externalIds.facebook_id}`;
    }
    if (externalIds.tiktok_id) {
      result.tiktok_url = `https://tiktok.com/@${externalIds.tiktok_id}`;
    }
    if (externalIds.youtube_id) {
      result.youtube_handle = `@${externalIds.youtube_id}`;
    }
  }

  // Check Wikipedia if TMDB gave no bio
  if (!result.bio && person.name) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(person.name)}&format=json`;
      const res = await fetch(wikiUrl);
      if (res.ok) {
        const json = await res.json();
        const pages = json.query?.pages || {};
        for (const pid of Object.keys(pages)) {
          if (pid !== '-1' && pages[pid].extract) {
            const extract = pages[pid].extract.trim();
            // Confirm actor/director context before accepting wiki extract
            if (extract.length > 50 && /(actor|actress|director|producer|filmmaker|nollywood|cinema)/i.test(extract)) {
              result.bio = extract.slice(0, 1200);
              sources.push(`Wikipedia page: ${pages[pid].title}`);
            }
          }
        }
      }
    } catch {}
  }

  const hasNewFields = Object.keys(result).length > 0;
  return {
    data: result,
    verified: hasNewFields,
    sources,
  };
}

export async function applyPersonStrictEnrichment(personId: string, enrichment: VerifiedPersonEnrichment) {
  const payload: Record<string, any> = {};
  if (enrichment.bio) payload.bio = enrichment.bio;
  if (enrichment.photo_url) payload.photo_url = enrichment.photo_url;
  if (enrichment.date_of_birth) payload.date_of_birth = enrichment.date_of_birth;
  if (enrichment.gender) payload.gender = enrichment.gender;
  if (enrichment.instagram_url) payload.instagram_url = enrichment.instagram_url;
  if (enrichment.twitter_url) payload.twitter_url = enrichment.twitter_url;
  if (enrichment.facebook_url) payload.facebook_url = enrichment.facebook_url;
  if (enrichment.tiktok_url) payload.tiktok_url = enrichment.tiktok_url;
  if (enrichment.youtube_handle) payload.youtube_handle = enrichment.youtube_handle;
  if (enrichment.tmdb_id) payload.tmdb_id = enrichment.tmdb_id;

  if (Object.keys(payload).length > 0) {
    const { error } = await supabaseServer.from('people').update(payload).eq('id', personId);
    if (error) throw error;
  }
}
