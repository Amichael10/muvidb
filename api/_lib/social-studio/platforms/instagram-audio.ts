import { getPlatformPublishingCredentials } from '../../threads_oauth.js';
import { supabase } from '../../supabase.js';
import { CURATED_AUDIO_CATALOG, type CuratedAudioTrack } from './audio-catalog.js';

export type InstagramAudioType = 'music' | 'original_sound';
export type AudioMoodProfile =
  | 'romance_drama'
  | 'upbeat_energy'
  | 'cinematic_thriller'
  | 'faith_inspirational'
  | 'cultural_highlife'
  | 'nollywood_soundtrack'
  | 'general_afrobeats';

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
  genre?: string;
  mood?: string;
  energyLevel?: 'chill' | 'medium' | 'high';
  isCurated?: boolean;
  isRecentlyUsed?: boolean;
};

export type AudioRecommendationContext = {
  title?: string | null;
  genres?: string[] | string | null;
  synopsis?: string | null;
  theme?: string | null;
  contentType?: string | null;
  connectionId?: string | null;
  excludeAudioIds?: string[];
  shuffle?: boolean;
};

export type SearchOptions = {
  query?: string;
  genre?: string;
  mood?: AudioMoodProfile | string;
  audioType?: InstagramAudioType;
  connectionId?: string | null;
  shuffle?: boolean;
  limit?: number;
};

export const AUDIO_GENRES = [
  { id: 'all', label: 'All Catalog (135+)', icon: 'solar:music-library-2-bold' },
  { id: 'trending', label: 'Trending on IG', icon: 'solar:fire-bold' },
  { id: 'afrobeats_hits', label: 'Afrobeats Hits', icon: 'solar:star-fall-2-bold' },
  { id: 'romance_drama', label: 'Romance & Drama', icon: 'solar:heart-bold' },
  { id: 'nollywood_soundtrack', label: 'Nollywood Cinema & OST', icon: 'solar:clapperboard-play-bold' },
  { id: 'cultural_highlife', label: 'Highlife & Cultural', icon: 'solar:record-bold' },
  { id: 'amapiano_energy', label: 'Amapiano & Street Pop', icon: 'solar:bolt-bold' },
  { id: 'faith_inspirational', label: 'Faith & Gospel', icon: 'solar:sun-2-bold' },
  { id: 'cinematic_thriller', label: 'Thriller & Suspense', icon: 'solar:shield-warning-bold' },
] as const;

export function getAudioCatalogStats() {
  const counts: Record<string, number> = { all: CURATED_AUDIO_CATALOG.length };
  for (const t of CURATED_AUDIO_CATALOG) {
    counts[t.genre] = (counts[t.genre] || 0) + 1;
  }
  return counts;
}

let _trendingCache: { timestamp: number; tracks: InstagramAudioTrack[] } | null = null;
const TRENDING_CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

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
    const firstArtist = (artist || '').split(/[,&]/)[0].trim();
    const term = `${cleanTitle} ${firstArtist}`.trim();
    if (!term) return { streamUrl: null, artworkUrl: null };
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', term);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '1');
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { streamUrl: null, artworkUrl: null };
    const json: any = await res.json().catch(() => ({}));
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

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function searchInstagramAudio(options: SearchOptions = {}): Promise<{
  tracks: InstagramAudioTrack[];
  audioType: InstagramAudioType;
  query: string;
  genre?: string;
  totalFound?: number;
}> {
  const audioType: InstagramAudioType = options.audioType === 'original_sound' ? 'original_sound' : 'music';
  const query = String(options.query || '').trim().slice(0, 120);
  const selectedGenre = String(options.genre || options.mood || '').trim().toLowerCase();
  const shouldShuffle = Boolean(options.shuffle);

  // 1. Check recent usage so we can badge tracks
  const recentIds = await getRecentlyUsedInstagramAudioIds(50).catch(() => new Set<string>());

  // 2. Filter from curated catalog
  let curatedMatches: InstagramAudioTrack[] = [];
  if (selectedGenre && selectedGenre !== 'all' && selectedGenre !== 'trending') {
    curatedMatches = CURATED_AUDIO_CATALOG.filter(t => t.genre === selectedGenre || t.mood === selectedGenre).map(t => ({
      ...t,
      matchReason: `Curated · ${t.genre.replace('_', ' ')}`,
      isRecentlyUsed: recentIds.has(t.audioId),
    }));
  } else if (!query) {
    curatedMatches = CURATED_AUDIO_CATALOG.map(t => ({
      ...t,
      matchReason: `Curated · ${t.genre.replace('_', ' ')}`,
      isRecentlyUsed: recentIds.has(t.audioId),
    }));
  }

  if (query) {
    const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    curatedMatches = CURATED_AUDIO_CATALOG.filter(t => {
      const fullText = `${t.title} ${t.artist} ${t.genre} ${t.mood}`.toLowerCase();
      return qTokens.every(tok => fullText.includes(tok));
    }).map(t => ({
      ...t,
      matchReason: 'Catalog Match',
      isRecentlyUsed: recentIds.has(t.audioId),
    }));
  }

  if (shouldShuffle && curatedMatches.length > 0) {
    curatedMatches = shuffleArray(curatedMatches);
  }

  // 3. Live Instagram Graph API (with in-memory caching for trending)
  let liveTracks: InstagramAudioTrack[] = [];
  const isTrendingRequest = !query && (selectedGenre === 'trending' || selectedGenre === 'all' || !selectedGenre);

  if (isTrendingRequest && _trendingCache && Date.now() - _trendingCache.timestamp < TRENDING_CACHE_TTL_MS) {
    liveTracks = _trendingCache.tracks;
  } else {
    try {
      const { accessToken, connection } = await getPlatformPublishingCredentials('instagram', options.connectionId);
      const igUserId = String(connection?.external_account_id || '').trim();

      if (igUserId && accessToken) {
        const url = new URL(`https://graph.facebook.com/${graphVersion()}/ig_audio`);
        url.searchParams.set('ig_user_id', igUserId);
        url.searchParams.set('audio_type', audioType);
        if (query) url.searchParams.set('search_query', query);
        url.searchParams.set('access_token', accessToken);

        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && !payload?.error) {
          const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.audio) ? payload.audio : [];
          const rawTracks = rows.map((row: any) => normalizeTrack(row, audioType)).filter(Boolean) as InstagramAudioTrack[];

          liveTracks = await Promise.all(
            rawTracks.slice(0, 15).map(async (track, index) => {
              const isRecent = recentIds.has(track.audioId);
              const enriched = {
                ...track,
                matchReason: query ? `#${index + 1} IG Search Result` : `#${index + 1} Trending on IG`,
                isRecentlyUsed: isRecent,
              };
              if (!enriched.previewUrl || enriched.previewUrl.includes('instagram.com/reels/audio')) {
                const res = await resolveItunesAudioStream(track.title, track.artist).catch(() => ({ streamUrl: null, artworkUrl: null }));
                if (res.streamUrl) enriched.previewUrl = res.streamUrl;
                if (res.artworkUrl && !enriched.artworkUrl) enriched.artworkUrl = res.artworkUrl;
              }
              return enriched;
            })
          );

          if (isTrendingRequest && liveTracks.length > 0) {
            _trendingCache = { timestamp: Date.now(), tracks: liveTracks };
          }
        }
      }
    } catch {
      // Non-blocking fallback to curated catalog
    }
  }

  // 4. Merge candidates, deduplicating on audioId or title+artist
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const combined: InstagramAudioTrack[] = [];

  const addTrack = (track: InstagramAudioTrack) => {
    const idKey = track.audioId;
    const nameKey = `${track.title.toLowerCase()}::${(track.artist || '').toLowerCase()}`;
    if (seenIds.has(idKey) || seenNames.has(nameKey)) return;
    seenIds.add(idKey);
    seenNames.add(nameKey);
    combined.push(track);
  };

  if (selectedGenre === 'trending') {
    for (const t of liveTracks) addTrack(t);
    for (const t of curatedMatches) addTrack(t);
  } else if (query) {
    for (const t of curatedMatches) addTrack(t);
    for (const t of liveTracks) addTrack(t);
  } else {
    for (const t of curatedMatches) addTrack(t);
    for (const t of liveTracks) addTrack(t);
  }

  const limit = options.limit || 40;
  return {
    tracks: combined.slice(0, limit),
    audioType,
    query,
    genre: selectedGenre || undefined,
    totalFound: combined.length,
  };
}

const MELODIC_ROMANCE_PATTERN = /\b(fola|bnxn|buju|young jonn|omah lay|tems|ayra starr|ckay|joeboy|fireboy|johnny drille|simi|chike|adekunle gold|wizkid|oxlade|victony|ruger|magixx|crayon|qing madi|bloody civilian|seyi vibez|llona|tiwa savage|nonso amadi|wurld|ladipoe|kizz daniel|ric hassani|fave)\b/i;
const UPBEAT_PARTY_PATTERN = /\b(davido|asake|zlatan|txc|shoday|scotts maphuma|shallipopi|odumodublvck|burna boy|rema|naira marley|zinoleesky|mohbad|portable|kcce|flavour|phyno|olamide|pocolee|rex|timaya|bella shmurda|sarkodie|stonebwoy|black sherif|uncle waffles|tyla|titom|yuppe)\b/i;
const FAITH_GOSPEL_PATTERN = /\b(moses bliss|mercy chinwo|nathaniel bassey|dunsin oyekan|sinach|ada ehi|frank edwards|ebuka songs|theophilus sunday|sunmisola|judikay|tim godfrey|mabel omajuwa|tasha cobbs|maverick city|worship|praise|prophetic|hallelujah|gospel|pastor)\b/i;
const HIGHLIFE_CULTURAL_PATTERN = /\b(cavemen|the cavemen|flavour|phyno|umu obiligbo|osita osadebe|oliver de coque|bright chimezie|highlife|igbo|palmwine|cultural)\b/i;
const SOUNDTRACK_NOLLYWOOD_PATTERN = /\b(stanley okorie|billionaire|happy day|soundtrack|score|sound sultan|brymo|cobhams|timi dakolo|nollywood)\b/i;
const NIGERIAN_AFROBEATS_PATTERN = new RegExp(
  `${MELODIC_ROMANCE_PATTERN.source}|${UPBEAT_PARTY_PATTERN.source}|${HIGHLIFE_CULTURAL_PATTERN.source}|${SOUNDTRACK_NOLLYWOOD_PATTERN.source}|\\b(peruzzi|mr eazi|mayorkun|falz|yemi alade|wande coal|patoranking|tekno|pheelz|spinall|dj tunez|basketmouth|vector|mi abaga|show dem camp|obongjayar|cruel santino)\\b`,
  'i'
);

export function classifyContentAudioMood(ctx: AudioRecommendationContext = {}): AudioMoodProfile {
  const genreList = Array.isArray(ctx.genres)
    ? ctx.genres.join(' ')
    : String(ctx.genres || '');
  const blob = `${ctx.title || ''} ${genreList} ${ctx.synopsis || ''} ${ctx.theme || ''} ${ctx.contentType || ''}`.toLowerCase();

  if (/\b(faith|gospel|christian|church|pastor|prayer|miracle|redemption|spiritual|god)\b/.test(blob)) {
    return 'faith_inspirational';
  }
  if (/\b(highlife|cultural|traditional|igbo|yoruba|village|chieftaincy|native|epic traditional|folklore|ritual|kingdom)\b/.test(blob)) {
    return 'cultural_highlife';
  }
  if (/\b(soundtrack|ost|score|classic nollywood|nostalgia|vintage nollywood)\b/.test(blob)) {
    return 'nollywood_soundtrack';
  }
  if (/\b(box_office|box office|milestone|record|comedy|party|celebration|blockbuster|street|action|heist|wedding party|amapiano)\b/.test(blob)) {
    return 'upbeat_energy';
  }
  if (/\b(romance|romantic|love|marriage|heartbreak|relationship|drama|emotional|family|betrayal|cycle|healing|affair)\b/.test(blob)) {
    return 'romance_drama';
  }
  if (/\b(thriller|crime|mystery|horror|suspense|dark|revenge|detective|investigation)\b/.test(blob)) {
    return 'cinematic_thriller';
  }
  return 'general_afrobeats';
}

export type RecentAudioUsageInfo = {
  usedAudioIds: Set<string>;
  recentArtists: Set<string>;
  recentTitles: Set<string>;
};

export async function getRecentlyUsedInstagramAudioInfo(limit = 60): Promise<RecentAudioUsageInfo> {
  const usedAudioIds = new Set<string>();
  const recentArtists = new Set<string>();
  const recentTitles = new Set<string>();

  try {
    const { data } = await supabase
      .from('social_platform_variants')
      .select('platform_options,updated_at')
      .eq('platform', 'instagram')
      .order('updated_at', { ascending: false })
      .limit(limit);

    for (const row of data || []) {
      const opts = (row as any)?.platform_options || {};
      const audio = opts?.instagram_audio || opts;
      const audioId = String(audio?.audio_id || '').trim();
      const artist = String(audio?.artist || '').trim().toLowerCase();
      const title = String(audio?.title || '').trim().toLowerCase();

      if (audioId) usedAudioIds.add(audioId);
      if (artist) recentArtists.add(artist);
      if (title) recentTitles.add(title);
    }
  } catch {
    // Non-blocking fallback
  }

  return { usedAudioIds, recentArtists, recentTitles };
}

export async function getRecentlyUsedInstagramAudioIds(limit = 60): Promise<Set<string>> {
  const info = await getRecentlyUsedInstagramAudioInfo(limit);
  return info.usedAudioIds;
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
  const recentInfo = await getRecentlyUsedInstagramAudioInfo(50);

  const excludeSet = new Set<string>(recentInfo.usedAudioIds);
  for (const id of ctx.excludeAudioIds || []) {
    if (id) excludeSet.add(String(id).trim());
  }

  // 1. Gather rich candidate pool from curated catalog
  const primaryCandidates = CURATED_AUDIO_CATALOG.filter(t => t.genre === mood || t.mood === mood);
  let secondaryCandidates: CuratedAudioTrack[] = [];

  if (mood === 'romance_drama') {
    secondaryCandidates = CURATED_AUDIO_CATALOG.filter(t => t.genre === 'afrobeats_hits' && t.energyLevel !== 'high');
  } else if (mood === 'upbeat_energy') {
    secondaryCandidates = CURATED_AUDIO_CATALOG.filter(t => t.genre === 'amapiano_energy' || t.genre === 'afrobeats_hits');
  } else if (mood === 'cultural_highlife') {
    secondaryCandidates = CURATED_AUDIO_CATALOG.filter(t => t.genre === 'nollywood_soundtrack');
  } else if (mood === 'cinematic_thriller') {
    secondaryCandidates = CURATED_AUDIO_CATALOG.filter(t => t.genre === 'upbeat_energy' && t.energyLevel === 'high');
  } else if (mood === 'general_afrobeats') {
    secondaryCandidates = CURATED_AUDIO_CATALOG.filter(t => t.genre === 'upbeat_energy' || t.genre === 'romance_drama');
  }

  // 2. Also attempt to fetch live trending tracks from Instagram Graph API (uses 15m in-memory cache)
  let liveTrendingTracks: InstagramAudioTrack[] = [];
  try {
    const live = await searchInstagramAudio({ audioType: 'music', connectionId: ctx.connectionId, limit: 15 });
    liveTrendingTracks = live.tracks;
  } catch {
    // Non-blocking
  }

  // 3. Combine all candidates and deduplicate
  const pool: InstagramAudioTrack[] = [];
  const seenIds = new Set<string>();

  const pushCandidate = (track: InstagramAudioTrack) => {
    if (seenIds.has(track.audioId)) return;
    seenIds.add(track.audioId);
    pool.push(track);
  };

  for (const t of primaryCandidates) pushCandidate({ ...t, matchReason: `Curated ${mood.replace('_', ' ')}` });
  for (const t of secondaryCandidates) pushCandidate({ ...t, matchReason: `Compatible ${t.genre.replace('_', ' ')}` });
  for (const t of liveTrendingTracks) pushCandidate(t);

  // 4. Score candidates with strong anti-repetition and genre priority guards
  const scored = pool.map((track) => {
    const text = `${track.title} ${track.artist || ''}`.toLowerCase();
    const hasPlayableStream = Boolean(
      track.previewUrl && !track.previewUrl.includes('instagram.com/reels/audio')
    );
    const isRecentlyUsed = excludeSet.has(track.audioId);
    const artistLower = (track.artist || '').toLowerCase();
    const isRecentArtist = recentInfo.recentArtists.has(artistLower);

    let score = 50;
    const reasons: string[] = [];

    // Exact genre match gives decisive priority (+100)
    const isExactMatch = track.mood === mood || track.genre === mood;
    const isSecondaryMatch = secondaryCandidates.some(s => s.audioId === track.audioId);

    if (isExactMatch) {
      score += 100;
      reasons.push(`Genre match (${mood.replace('_', ' ')})`);
    } else if (isSecondaryMatch) {
      score += 25;
      reasons.push('Compatible genre');
    } else {
      score -= 60;
    }

    if (hasPlayableStream) {
      score += 30;
      reasons.push('Instant playable preview');
    }

    if (NIGERIAN_AFROBEATS_PATTERN.test(text)) {
      score += 20;
      reasons.push('Afrobeats / Nollywood vibe');
    }

    // Heavy anti-repetition penalty: recently used track cannot win if fresh ones exist
    if (isRecentlyUsed) {
      score -= 500;
      reasons.push('Recently used in past posts (rotated down)');
    } else if (isRecentArtist) {
      score -= 80;
      reasons.push('Artist recently featured (rotated down)');
    } else {
      score += 30;
      reasons.push('Fresh track (not recently posted)');
    }

    return {
      ...track,
      matchScore: score,
      matchReason: reasons.join(' · '),
      isRecentlyUsed,
    };
  });

  scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  // 5. Anti-Repeat Randomized Jitter:
  // Pick randomly from among the top 4 candidates with score > 0 and not recently used
  const topCandidates = scored.filter(t => !t.isRecentlyUsed && (t.matchScore || 0) > 0).slice(0, 5);
  let chosen: InstagramAudioTrack | null = null;

  if (topCandidates.length > 0) {
    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    chosen = topCandidates[randomIndex];
  } else {
    chosen = scored[0] || null;
  }

  const alternatives = scored.filter(t => t.audioId !== chosen?.audioId).slice(0, 15);

  return {
    mood,
    recommended: chosen,
    alternatives,
    recentlyUsedAudioIds: Array.from(excludeSet),
  };
}
