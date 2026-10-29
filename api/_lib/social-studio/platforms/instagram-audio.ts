import { getPlatformPublishingCredentials } from '../../threads_oauth.js';
import { supabase } from '../../supabase.js';

export type InstagramAudioType = 'music' | 'original_sound';
export type AudioMoodProfile = 'romance_drama' | 'upbeat_energy' | 'cinematic_thriller' | 'faith_inspirational' | 'general_afrobeats';

export type InstagramAudioTrack = {
  audioId: string;
  audioType: InstagramAudioType;
  title: string;
  artist: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  matchScore?: number;
  matchReason?: string;
};

export type AudioRecommendationContext = {
  title?: string | null;
  genres?: string[] | string | null;
  synopsis?: string | null;
  theme?: string | null;
  contentType?: string | null;
  connectionId?: string | null;
  excludeAudioIds?: string[];
};

type SearchOptions = {
  query?: string;
  audioType?: InstagramAudioType;
  connectionId?: string | null;
};

function graphVersion(): string {
  const configured = String(process.env.META_GRAPH_API_VERSION || 'v19.0').trim();
  return /^v\d+\.\d+$/.test(configured) ? configured : 'v19.0';
}

function normalizeTrack(raw: any, fallbackType: InstagramAudioType): InstagramAudioTrack | null {
  const audioId = String(raw?.audio_id || raw?.id || '').trim();
  if (!audioId) return null;
  const duration = Number(raw?.duration_in_ms ?? raw?.duration_ms ?? raw?.duration);
  return {
    audioId,
    audioType: raw?.audio_type === 'original_sound' ? 'original_sound' : fallbackType,
    title: String(raw?.title || raw?.audio_name || 'Untitled audio').trim(),
    artist: String(raw?.display_artist || raw?.artist_name || raw?.ig_username || '').trim() || null,
    durationMs: Number.isFinite(duration) && duration > 0 ? duration : null,
    artworkUrl: String(raw?.cover_artwork_thumbnail_uri || raw?.cover_image_uri || raw?.profile_picture_url || '').trim() || null,
    previewUrl: String(raw?.download_url || raw?.preview_url || raw?.on_platform_audio_preview_link || '').trim() || null,
  };
}

async function resolveItunesAudioStream(title: string, artist: string | null): Promise<{
  streamUrl: string | null;
  artworkUrl: string | null;
}> {
  try {
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const firstArtist = (artist || '').split(',')[0].trim();
    const term = `${cleanTitle} ${firstArtist}`.trim();
    if (!term) return { streamUrl: null, artworkUrl: null };
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', term);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '1');
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { streamUrl: null, artworkUrl: null };
    const json: any = await res.json();
    const hit = json?.results?.[0];
    if (!hit) return { streamUrl: null, artworkUrl: null };
    return {
      streamUrl: typeof hit.previewUrl === 'string' ? hit.previewUrl : null,
      artworkUrl: typeof hit.artworkUrl100 === 'string' ? hit.artworkUrl100.replace('100x100bb', '300x300bb') : null,
    };
  } catch {
    return { streamUrl: null, artworkUrl: null };
  }
}

export async function searchInstagramAudio(options: SearchOptions = {}): Promise<{
  tracks: InstagramAudioTrack[];
  audioType: InstagramAudioType;
  query: string;
}> {
  const audioType: InstagramAudioType = options.audioType === 'original_sound' ? 'original_sound' : 'music';
  const query = String(options.query || '').trim().slice(0, 120);
  const { accessToken, connection } = await getPlatformPublishingCredentials('instagram', options.connectionId);
  const igUserId = String(connection?.external_account_id || '').trim();
  if (!igUserId) {
    const error = new Error('Connected Instagram account is missing its external_account_id.') as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  // Instagram Audio API is available only to accounts connected through
  // Facebook Login. The global /ig_audio edge returns the account-authorized
  // catalogue (or trending audio when search_query is omitted).
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/ig_audio`);
  url.searchParams.set('ig_user_id', igUserId);
  url.searchParams.set('audio_type', audioType);
  if (query) url.searchParams.set('search_query', query);
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || 'Instagram could not load its audio catalogue.';
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status === 401 || payload?.error?.code === 190 ? 409 : 502;
    throw error;
  }

  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.audio) ? payload.audio : [];
  const rawTracks = rows.map((row: any) => normalizeTrack(row, audioType)).filter(Boolean) as InstagramAudioTrack[];

  // Enrich licensed music tracks (which only return an instagram.com page URL)
  // with playable AAC audio streams and cover art in bounded batches of 5.
  const tracks: InstagramAudioTrack[] = [];
  for (let i = 0; i < rawTracks.length; i += 5) {
    const batch = rawTracks.slice(i, i + 5);
    const enriched = await Promise.all(
      batch.map(async (track) => {
        const hasDirectStream =
          track.previewUrl &&
          !track.previewUrl.includes('instagram.com/reels/audio');
        if (hasDirectStream) return track;
        const resolved = await resolveItunesAudioStream(track.title, track.artist);
        return {
          ...track,
          previewUrl: resolved.streamUrl || track.previewUrl,
          artworkUrl: track.artworkUrl || resolved.artworkUrl,
        };
      })
    );
    tracks.push(...enriched);
  }

  return { tracks, audioType, query };
}

const MELODIC_ROMANCE_PATTERN = /\b(fola|bnxn|buju|young jonn|omah lay|tems|ayra starr|ckay|joeboy|fireboy|johnny drille|simi|chike|adekunle gold|wizkid|oxlade|victony|ruger|magixx|crayon|qing madi|bloody civilian|seyi vibez|llona|tiwa savage|nonso amadi|wurld|ladipoe|kizz daniel)\b/i;
const UPBEAT_PARTY_PATTERN = /\b(davido|asake|zlatan|txc|shoday|scotts maphuma|shallipopi|odumodublvck|burna boy|rema|naira marley|zinoleesky|mohbad|portable|kcce|flavour|phyno|olamide|pocolee|rex|timaya|bella shmurda|sarkodie|stonebwoy|black sherif|uncle waffles|tyla)\b/i;
const FAITH_GOSPEL_PATTERN = /\b(moses bliss|mercy chinwo|nathaniel bassey|dunsin oyekan|sinach|ada ehi|frank edwards|ebuka songs|theophilus sunday|sunmisola|judikay|tim godfrey|mabel omajuwa|tasha cobbs|maverick city|worship|praise|prophetic|hallelujah)\b/i;
const NIGERIAN_AFROBEATS_PATTERN = new RegExp(
  `${MELODIC_ROMANCE_PATTERN.source}|${UPBEAT_PARTY_PATTERN.source}|\\b(peruzzi|mr eazi|mayorkun|falz|yemi alade|timi dakolo|wande coal|patoranking|tekno|pheelz|spinall|dj tunez|dj consequence|basketmouth|vector|mi abaga|show dem camp|cavemen|obongjayar|cruel santino)\\b`,
  'i'
);

export function classifyContentAudioMood(ctx: AudioRecommendationContext = {}): AudioMoodProfile {
  const genreList = Array.isArray(ctx.genres)
    ? ctx.genres.join(' ')
    : String(ctx.genres || '');
  const blob = `${ctx.title || ''} ${genreList} ${ctx.synopsis || ''} ${ctx.theme || ''} ${ctx.contentType || ''}`.toLowerCase();

  if (/\b(faith|gospel|christian|church|pastor|prayer|miracle|redemption|spiritual)\b/.test(blob)) {
    return 'faith_inspirational';
  }
  if (/\b(box_office|box office|milestone|record|comedy|party|celebration|blockbuster|street|action|heist|wedding party)\b/.test(blob)) {
    return 'upbeat_energy';
  }
  if (/\b(romance|romantic|love|marriage|heartbreak|relationship|drama|emotional|family|betrayal|cycle|healing|affair)\b/.test(blob)) {
    return 'romance_drama';
  }
  if (/\b(thriller|crime|mystery|horror|suspense|dark|revenge|detective)\b/.test(blob)) {
    return 'cinematic_thriller';
  }
  return 'general_afrobeats';
}

export async function getRecentlyUsedInstagramAudioIds(limit = 12): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from('social_platform_variants')
      .select('platform_options,updated_at')
      .eq('platform', 'instagram')
      .order('updated_at', { ascending: false })
      .limit(60);

    const used = new Set<string>();
    for (const row of data || []) {
      const opts = (row as any)?.platform_options || {};
      const audioId = String(opts?.instagram_audio?.audio_id || opts?.audio_id || '').trim();
      if (audioId) {
        used.add(audioId);
        if (used.size >= limit) break;
      }
    }
    return used;
  } catch {
    return new Set<string>();
  }
}

export async function recommendInstagramAudioForContent(
  ctx: AudioRecommendationContext = {}
): Promise<{
  mood: AudioMoodProfile;
  recommended: InstagramAudioTrack | null;
  alternatives: InstagramAudioTrack[];
  recentlyUsedAudioIds: string[];
}> {
  const mood = classifyContentAudioMood(ctx);
  const [trendingMusic, recentSet] = await Promise.all([
    searchInstagramAudio({ audioType: 'music', connectionId: ctx.connectionId }),
    getRecentlyUsedInstagramAudioIds(10),
  ]);

  for (const id of ctx.excludeAudioIds || []) {
    if (id) recentSet.add(String(id).trim());
  }

  const scored = trendingMusic.tracks.map((track, index) => {
    const text = `${track.title} ${track.artist || ''}`;
    const hasPlayableStream = Boolean(
      track.previewUrl && !track.previewUrl.includes('instagram.com/reels/audio')
    );
    const isRecentlyUsed = recentSet.has(track.audioId);

    // Base score rewards higher trending rank on Instagram (rank #1 gets +25, rank #25 gets +1)
    let score = Math.max(1, 26 - index);
    const reasons: string[] = [`#${index + 1} Trending on IG`];

    if (hasPlayableStream) {
      score += 20;
    } else {
      score -= 30;
    }

    if (NIGERIAN_AFROBEATS_PATTERN.test(text)) {
      score += 28;
      reasons.push('Afrobeats / Nollywood fit');
    }

    if (mood === 'romance_drama') {
      if (MELODIC_ROMANCE_PATTERN.test(text)) {
        score += 32;
        reasons.push('Melodic Drama/Romance vibe');
      } else if (/\b(love|miss u|heart|air|beautiful|angel|hold|baby|forever|feel)\b/i.test(track.title)) {
        score += 18;
        reasons.push('Romantic/Emotional title match');
      }
    } else if (mood === 'upbeat_energy') {
      if (UPBEAT_PARTY_PATTERN.test(text)) {
        score += 32;
        reasons.push('High-energy / Box Office vibe');
      }
    } else if (mood === 'faith_inspirational') {
      if (FAITH_GOSPEL_PATTERN.test(text)) {
        score += 45;
        reasons.push('Inspirational / Gospel match');
      }
    } else if (mood === 'cinematic_thriller') {
      if (/\b(asake|burna|rema|odumodu|zlatan|bnxn|omah lay|tems|genesis|ego|inferno)\b/i.test(text)) {
        score += 28;
        reasons.push('Dark / Intense tone match');
      }
    }

    if (isRecentlyUsed) {
      score -= 65;
      reasons.push('Recently used (rotated down)');
    }

    return {
      ...track,
      matchScore: score,
      matchReason: reasons.join(' · '),
    };
  });

  scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  return {
    mood,
    recommended: scored[0] || null,
    alternatives: scored.slice(1, 8),
    recentlyUsedAudioIds: Array.from(recentSet),
  };
}
