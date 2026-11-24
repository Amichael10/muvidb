import { SupabaseClient } from '@supabase/supabase-js';

export interface PlatformMatchParams {
  platform: 'kava' | 'docuth' | 'netflix' | 'prime' | 'youtube' | 'ironflix' | 'homitv' | 'filmporte' | 'ebonylife' | 'nollistream' | string;
  sourceVideoId: string;
  url?: string | null;
  slug?: string | null;
  title: string;
  year?: number | null;
  seriesSlug?: string | null;
  episodeNum?: number | null;
}

export function normalizeTitleForMatch(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Finds an existing film in the database using external platform IDs first,
 * then URL/slug inside streaming_links, series/episode hierarchy, and title variants.
 * Guarantees that renaming a film will NEVER cause duplicate ingestion.
 */
export async function findExistingPlatformFilm(
  supabase: SupabaseClient,
  params: PlatformMatchParams
): Promise<any | null> {
  const { platform, sourceVideoId, url, slug, title, year, seriesSlug, episodeNum } = params;

  // 1. Direct match on source_video_id
  if (sourceVideoId) {
    const { data: bySource } = await supabase
      .from('films')
      .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
      .eq('source_video_id', sourceVideoId)
      .limit(1)
      .maybeSingle();

    if (bySource) return bySource;

    // Also check if slug alone was used as source_video_id
    if (slug && sourceVideoId.includes('-')) {
      const { data: bySlugSource } = await supabase
        .from('films')
        .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
        .eq('source_video_id', slug)
        .limit(1)
        .maybeSingle();
      if (bySlugSource) return bySlugSource;
    }
  }

  // 2. Exact or partial match on streaming_links->>platform URL
  if (url && platform) {
    const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
    const { data: byUrl } = await supabase
      .from('films')
      .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
      .eq(`streaming_links->>${platform}`, cleanUrl)
      .limit(1)
      .maybeSingle();

    if (byUrl) return byUrl;

    // Check with trailing slash variant or full url
    const { data: byFullUrl } = await supabase
      .from('films')
      .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
      .eq(`streaming_links->>${platform}`, url)
      .limit(1)
      .maybeSingle();

    if (byFullUrl) return byFullUrl;
  }

  // 3. Match by video slug inside streaming_links->>platform
  if (slug && platform) {
    const { data: bySlugLink } = await supabase
      .from('films')
      .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
      .ilike(`streaming_links->>${platform}`, `%${slug}%`)
      .limit(1)
      .maybeSingle();

    if (bySlugLink) return bySlugLink;
  }

  // 4. Series & Episode hierarchy matching
  // (e.g. URL has /seven-doors/ and episode 1, or series title matches)
  if (seriesSlug) {
    const cleanSeriesKey = seriesSlug.replace(/[-_]+/g, ' ').trim();
    // Look up parent series
    const { data: parents } = await supabase
      .from('films')
      .select('id, title, slug')
      .or(`slug.ilike.%${seriesSlug}%,title.ilike.%${cleanSeriesKey}%`)
      .limit(5);

    if (parents && parents.length > 0) {
      for (const parent of parents) {
        // Query child episodes of this series
        const { data: episodes } = await supabase
          .from('films')
          .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
          .eq('series_id', parent.id);

        if (episodes && episodes.length > 0) {
          // If episodeNum is known, match by episode_number
          if (episodeNum != null) {
            const epMatch = episodes.find(e => e.episode_number === episodeNum);
            if (epMatch) return epMatch;
          }

          // Match if child episode title contains the scraped title or slug
          if (title) {
            const normTitle = normalizeTitleForMatch(title);
            const epTitleMatch = episodes.find(e => {
              const normEp = normalizeTitleForMatch(e.title);
              return normEp.includes(normTitle) || (normEp && normTitle.includes(normEp));
            });
            if (epTitleMatch) return epTitleMatch;
          }

          // Match if child episode has matching slug in streaming_links
          if (slug) {
            const epSlugMatch = episodes.find(e => {
              const link = e.streaming_links?.[platform];
              return typeof link === 'string' && link.includes(slug);
            });
            if (epSlugMatch) return epSlugMatch;
          }
        }
      }
    }
  }

  // 5. Title-based matching
  const cleanedTitle = (title || '').trim();
  if (cleanedTitle) {
    // 5a. Exact title match
    const { data: byExactTitle } = await supabase
      .from('films')
      .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
      .ilike('title', cleanedTitle)
      .limit(1)
      .maybeSingle();

    if (byExactTitle) return byExactTitle;

    // 5b. Check if existing DB title contains this title (e.g. "Seven Doors - Door Threshold | Episode 1" contains "Door Threshold")
    const { data: containsTitle } = await supabase
      .from('films')
      .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
      .ilike('title', `%${cleanedTitle}%`)
      .limit(5);

    if (containsTitle && containsTitle.length > 0) {
      // Pick best match by year if available
      if (year != null) {
        const yearMatch = containsTitle.find((c: any) => c.year === year);
        if (yearMatch) return yearMatch;
      }
      return containsTitle[0];
    }

    // 5c. Normalized match ignoring punctuation/spaces
    const norm = normalizeTitleForMatch(cleanedTitle);
    const words = cleanedTitle.split(/[:\s-]+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const { data: candidates } = await supabase
        .from('films')
        .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type, content_type, series_id, episode_number')
        .ilike('title', `%${words[0]}%`)
        .limit(20);

      if (candidates && candidates.length > 0) {
        const found = candidates.find(c => {
          const cNorm = normalizeTitleForMatch(c.title);
          return cNorm === norm || cNorm.includes(norm) || (norm.length > 8 && norm.includes(cNorm));
        });
        if (found) return found;
      }
    }
  }

  return null;
}
