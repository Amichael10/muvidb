import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const MAX_POSTS = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : Infinity;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const WP_BASE = 'https://nollywoodreinvented.com/wp-json/wp/v2';
const REVIEW_CATEGORY_IDS = [2649, 2648, 1448, 1449, 1451, 1981, 2655];

const CATEGORY_GENRE_MAP = {
  1611: 'Action',
  788: 'Action',
  3579: 'Animation',
  783: 'Comedy',
  1505: 'Comedy',
  792: 'Crime',
  3177: 'Documentary',
  1330: 'Drama',
  785: 'Drama',
  791: 'Family',
  1849: 'Fantasy',
  794: 'Horror',
  795: 'Musical',
  1905: 'History',
  3405: 'Thriller',
  784: 'Romance',
  1331: 'Romance',
  786: 'Romance',
  3657: 'Sci-Fi',
  787: 'Thriller',
  793: 'Thriller',
  808: 'Thriller',
};

function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&ldquo;/g, '"')
    .replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&#37;/g, '%')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html = '') {
  return decodeHtmlEntities(String(html).replace(/<[^>]+>/g, ' '));
}

function normalizeTitleKey(title = '') {
  return String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePersonName(name = '') {
  return decodeHtmlEntities(name)
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text = '') {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function splitPeopleList(raw = '') {
  if (!raw) return [];
  const cleaned = decodeHtmlEntities(raw)
    .replace(/\s+and\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ');
  const parts = cleaned
    .split(/[,;]+/)
    .map(normalizePersonName)
    .filter((n) => n.length >= 2 && n.length <= 60 && !/^(n\/a|none|unknown|various|etc\.?)$/i.test(n));
  return [...new Set(parts)];
}

function parseRuntimeMinutes(raw = '') {
  if (!raw) return null;
  const text = decodeHtmlEntities(raw).toLowerCase();
  let total = 0;
  const hrMatch = text.match(/(\d+)\s*(?:hour|hr|h)s?/);
  const minMatch = text.match(/(\d+)\s*(?:minute|min|m)s?/);
  if (hrMatch) total += Number(hrMatch[1]) * 60;
  if (minMatch) total += Number(minMatch[1]);
  if (total > 0 && total <= 600) return total;
  const plainNum = text.match(/^(\d{2,3})$/);
  if (plainNum) {
    const n = Number(plainNum[1]);
    if (n >= 5 && n <= 600) return n;
  }
  return null;
}

function cleanReviewTitle(rawTitle = '', itemReviewed = '') {
  const stripOuterQuotes = (s) => s.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();

  const parseCandidate = (raw) => {
    let s = decodeHtmlEntities(raw)
      .replace(/\s*[-–—|:]\s*(?:a\s+)?(?:movie|film)?\s*review.*$/i, '')
      .replace(/\s*\((?:movie|film)?\s*review\)\s*$/i, '')
      .trim();

    // Pattern 1: "Movie Title": Commentary or “Movie Title”: Commentary
    const quotedPrefix = s.match(/^["“]([^"”]+)["”]\s*[:\-–—]\s*(.+)$/);
    if (quotedPrefix) return quotedPrefix[1].trim();

    // Pattern 2: "Movie Title: Commentary" (quotes wrap the whole thing)
    s = stripOuterQuotes(s);

    // Pattern 3: Movie Title: Long editorial subtitle
    const colonIdx = s.indexOf(':');
    if (colonIdx > 1) {
      const left = s.slice(0, colonIdx).trim();
      const right = s.slice(colonIdx + 1).trim();
      const isCommentary =
        right.split(/\s+/).length >= 3 ||
        /\b(review|thriller|drama|comedy|entertainment|mark|watch|story|film|movie|worth|provoking|disappoint|typical|missed|hits|misses|gem|mess|masterpiece|boring)\b/i.test(right);
      if (isCommentary && left.length >= 2) {
        return stripOuterQuotes(left);
      }
    }
    return stripOuterQuotes(s);
  };

  const fromItem = itemReviewed ? parseCandidate(itemReviewed) : '';
  const fromWp = rawTitle ? parseCandidate(rawTitle) : '';

  if (fromWp && fromItem && fromItem.length > fromWp.length + 10 && fromItem.toLowerCase().startsWith(fromWp.toLowerCase())) {
    return fromWp;
  }
  return fromItem || fromWp;
}

function parseDetailsFromHtml(html = '', wpPost) {
  const detailsIdx = html.indexOf('details-wrapper');
  const detailsSlice = detailsIdx !== -1 ? html.slice(detailsIdx, detailsIdx + 8000) : '';

  // Extract labeled rows inside details-wrapper
  // Theme "explicit" renders: <div class="detail-label">Label</div> ... <div class="detail-content">Value</div>
  // or <span class="label">...</span>
  const textBlock = stripTags(detailsSlice);

  const extractField = (label, nextLabels) => {
    const nextGroup = nextLabels.join('|');
    const regex = new RegExp(`\\b${label}\\s+([\\s\\S]*?)(?=\\s+(?:${nextGroup})\\b|$)`, 'i');
    const m = textBlock.match(regex);
    return m ? m[1].trim() : '';
  };

  const ALL_LABELS = [
    'Item Reviewed',
    'Author',
    'Cast',
    'Starring',
    'Synopsis',
    'Plot',
    'Length',
    'Runtime',
    'Running Time',
    'Director',
    'Directed By',
    'Producer',
    'Produced By',
    'Screenplay',
    'Writer',
    'Written By',
    'Year',
    'Release Date',
    'Watch Online At',
    'Positives',
    'Negatives',
    'Rating',
  ];

  const itemReviewed = extractField('Item Reviewed', ALL_LABELS);
  const castRaw = extractField('(?:Cast|Starring)', ALL_LABELS);
  const synopsisRaw = extractField('(?:Synopsis|Plot)', ALL_LABELS);
  const lengthRaw = extractField('(?:Length|Runtime|Running Time)', ALL_LABELS);
  const directorRaw = extractField('(?:Director|Directed By)', ALL_LABELS);
  const producerRaw = extractField('(?:Producer|Produced By)', ALL_LABELS);
  const writerRaw = extractField('(?:Screenplay|Writer|Written By)', ALL_LABELS);
  const yearRaw = extractField('(?:Year|Release Date)', ALL_LABELS);
  const watchOnlineRaw = extractField('Watch Online At', ALL_LABELS);

  const yearMatch = (yearRaw || '').match(/\b(19\d{2}|20\d{2})\b/);
  const postYear = wpPost.date ? Number(wpPost.date.slice(0, 4)) : null;
  const year = yearMatch ? Number(yearMatch[1]) : postYear;

  // Extract overall editor & user ratings (%)
  let editorRatingPct = null;
  const totalMatch = html.match(/total-rating-wrapper[\s\S]{0,600}?class="number"[^>]*>(\d{1,3})/i);
  if (totalMatch) {
    editorRatingPct = Math.min(100, Math.max(0, Number(totalMatch[1])));
  } else {
    const storyMatch = html.match(/id="editor_rating_0"[\s\S]{0,300}?class="number"[^>]*>(\d{1,3})/i);
    if (storyMatch) editorRatingPct = Math.min(100, Math.max(0, Number(storyMatch[1])));
  }

  // Extract YouTube trailer ID
  const ytMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  const trailerYoutubeId = ytMatch ? ytMatch[1] : null;

  const title = cleanReviewTitle(wpPost.title?.rendered || '', itemReviewed);
  const isNewsHeadline = /\b(is coming|watch the trailer|new showmax|returns for a second|premieres on|watch .* on (?:youtube|ndanitv|showmax)|series alert|trailer alert|teaser alert)\b/i.test(
    wpPost.title?.rendered || ''
  );
  const runtimeMinutes = parseRuntimeMinutes(lengthRaw);
  const synopsis = synopsisRaw && synopsisRaw.length >= 15 ? synopsisRaw : stripTags(wpPost.excerpt?.rendered || '');

  const cast = splitPeopleList(castRaw);
  const directors = splitPeopleList(directorRaw);
  const producers = splitPeopleList(producerRaw);
  const writers = splitPeopleList(writerRaw);

  const hasRealFilmData =
    !isNewsHeadline &&
    detailsIdx !== -1 &&
    (cast.length > 0 || directors.length > 0 || editorRatingPct != null || runtimeMinutes != null);

  const cats = wpPost.categories || [];
  let contentType = 'movie';
  if (cats.includes(1448) || cats.includes(1449)) contentType = 'series';
  else if (cats.includes(1451)) contentType = 'short_film';

  const genres = [...new Set(cats.map((cid) => CATEGORY_GENRE_MAP[cid]).filter(Boolean))];
  if (genres.length === 0) genres.push('Drama');

  const posterUrl = wpPost._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;

  let releaseType = null;
  const watchLower = (watchOnlineRaw || '').toLowerCase();
  if (watchLower.includes('netflix')) releaseType = 'netflix';
  else if (watchLower.includes('prime')) releaseType = 'prime_video';
  else if (watchLower.includes('youtube')) releaseType = 'youtube';

  return {
    wpId: wpPost.id,
    wpUrl: wpPost.link,
    title,
    year,
    synopsis: synopsis || null,
    runtimeMinutes,
    posterUrl,
    trailerYoutubeId,
    likedPercent: editorRatingPct,
    averageRating: editorRatingPct != null ? Number((editorRatingPct / 10).toFixed(1)) : null,
    contentType,
    genres,
    releaseType,
    isInCinemas: false,
    cast,
    directors,
    producers,
    writers,
    hasStructuredDetails: hasRealFilmData,
  };
}

async function fetchAllReviewPosts() {
  const postsById = new Map();
  let page = 1;
  const catParam = REVIEW_CATEGORY_IDS.join(',');

  while (postsById.size < MAX_POSTS) {
    const url = `${WP_BASE}/posts?categories=${catParam}&per_page=100&page=${page}&_embed=wp:featuredmedia`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MuviDB-Sync/1.0' } });
    if (!res.ok) {
      if (res.status === 400) break; // Beyond last page
      throw new Error(`WP API failed on page ${page}: ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const p of batch) {
      if (!postsById.has(p.id)) {
        postsById.set(p.id, p);
      }
    }
    const totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    console.log(`Fetched WP page ${page}/${totalPages} (${postsById.size} unique posts)...`);
    if (page >= totalPages) break;
    page += 1;
  }

  return Array.from(postsById.values()).slice(0, MAX_POSTS);
}

async function fetchWithConcurrency(items, concurrency, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function preloadDbMaps() {
  const filmsByTitleYear = new Map();
  const filmsByTitle = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, slug, title, year, synopsis, runtime_minutes, poster_url, backdrop_url, trailer_youtube_id, liked_percent, average_rating, genres, release_type')
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    for (const f of data) {
      const tk = normalizeTitleKey(f.title);
      if (!tk) continue;
      if (!filmsByTitle.has(tk)) filmsByTitle.set(tk, f);
      if (f.year) filmsByTitleYear.set(`${tk}|${f.year}`, f);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }

  const peopleByName = new Map();
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug')
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    for (const p of data) {
      const nk = normalizeTitleKey(p.name);
      if (nk && !peopleByName.has(nk)) peopleByName.set(nk, p.id);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }

  return { filmsByTitleYear, filmsByTitle, peopleByName };
}

async function run() {
  console.log(`\n🎬 Nollywood Reinvented Sync (${APPLY ? 'LIVE APPLY' : 'DRY RUN'})`);
  console.log('====================================================');

  const posts = await fetchAllReviewPosts();
  console.log(`\n📦 Parsing HTML details for ${posts.length} posts...`);

  const parsedFilms = await fetchWithConcurrency(posts, 10, async (post) => {
    try {
      const res = await fetch(post.link, { headers: { 'User-Agent': 'MuviDB-Sync/1.0' } });
      if (!res.ok) return null;
      const html = await res.text();
      return parseDetailsFromHtml(html, post);
    } catch {
      return null;
    }
  });

  const validFilms = parsedFilms.filter((f) => f && f.title && f.hasStructuredDetails);
  const skippedNonReview = parsedFilms.filter((f) => !f || !f.hasStructuredDetails).length;

  console.log(`✅ Structured film records extracted: ${validFilms.length} (Skipped non-review posts: ${skippedNonReview})`);

  const { filmsByTitleYear, filmsByTitle, peopleByName } = await preloadDbMaps();
  console.log(`📚 Preloaded MuviDB cache: ${filmsByTitle.size} unique film titles, ${peopleByName.size} people.`);

  let matchedExisting = 0;
  let netNewFilms = 0;
  let updatedFilms = 0;
  let insertedFilms = 0;
  let newPeopleCreated = 0;
  let creditsInserted = 0;
  let insertErrorsLogged = 0;
  const uniqueExtractedPeople = new Set();

  for (const f of validFilms) {
    for (const n of [...f.cast, ...f.directors, ...f.producers, ...f.writers]) {
      uniqueExtractedPeople.add(n);
    }

    const tk = normalizeTitleKey(f.title);
    const existing =
      (f.year ? filmsByTitleYear.get(`${tk}|${f.year}`) : null) ||
      filmsByTitle.get(tk) ||
      null;

    if (existing) matchedExisting++;
    else netNewFilms++;

    if (!APPLY) continue;

    let filmId = existing?.id || null;

    if (existing) {
      const patch = {};
      if (!existing.synopsis && f.synopsis) patch.synopsis = f.synopsis;
      if (!existing.runtime_minutes && f.runtimeMinutes) patch.runtime_minutes = f.runtimeMinutes;
      if (!existing.poster_url && f.posterUrl) patch.poster_url = f.posterUrl;
      if (!existing.backdrop_url && f.posterUrl) patch.backdrop_url = f.posterUrl;
      if (!existing.trailer_youtube_id && f.trailerYoutubeId) patch.trailer_youtube_id = f.trailerYoutubeId;
      if (existing.liked_percent == null && f.likedPercent != null) patch.liked_percent = f.likedPercent;
      if (existing.average_rating == null && f.averageRating != null) patch.average_rating = f.averageRating;
      if ((!existing.genres || existing.genres.length === 0) && f.genres.length > 0) patch.genres = f.genres;
      if (!existing.release_type && f.releaseType) patch.release_type = f.releaseType;

      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        const { error: updErr } = await supabase.from('films').update(patch).eq('id', existing.id);
        if (!updErr) updatedFilms++;
      }
    } else {
      const baseSlug = slugify(f.title) || `nr-${f.wpId}`;
      const uniqueSlug = f.year ? `${baseSlug}-${f.year}` : baseSlug;
      const newPayload = {
        title: f.title,
        slug: uniqueSlug,
        year: f.year,
        synopsis: f.synopsis,
        runtime_minutes: f.runtimeMinutes,
        poster_url: f.posterUrl,
        backdrop_url: f.posterUrl,
        trailer_youtube_id: f.trailerYoutubeId,
        liked_percent: f.likedPercent,
        average_rating: f.averageRating ?? 0,
        content_type: f.contentType,
        genres: f.genres,
        release_type: f.releaseType,
        source: 'nollywoodreinvented',
        is_published: true,
        needs_review: false,
        coming_soon: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { data: inserted, error: insErr } = await supabase
        .from('films')
        .insert(newPayload)
        .select('id')
        .single();

      if (insErr && insErr.message?.includes('slug')) {
        newPayload.slug = `${uniqueSlug}-nr-${f.wpId}`;
        ({ data: inserted, error: insErr } = await supabase
          .from('films')
          .insert(newPayload)
          .select('id')
          .single());
      }

      if (insErr) {
        if (insertErrorsLogged < 10) {
          console.error(`  ⚠️ Insert error for "${f.title}" (${f.year}): ${insErr.message}`);
          insertErrorsLogged++;
        }
      } else if (inserted) {
        filmId = inserted.id;
        filmsByTitle.set(tk, { id: filmId, ...newPayload });
        insertedFilms++;
      }
    }

    if (!filmId) continue;

    // Resolve people & insert missing credits (Zero-Duplicate Rule)
    const roleEntries = [
      ...f.directors.map((name, i) => ({ name, role: 'Director', dept: 'Directing', order: i + 1 })),
      ...f.writers.map((name, i) => ({ name, role: 'Writer', dept: 'Writing', order: i + 1 })),
      ...f.producers.map((name, i) => ({ name, role: 'Producer', dept: 'Production', order: i + 1 })),
      ...f.cast.map((name, i) => ({ name, role: 'Actor', dept: 'Acting', order: i + 1 })),
    ];

    if (roleEntries.length === 0) continue;

    const { data: existingCredits } = await supabase
      .from('credits')
      .select('person_id, role')
      .eq('film_id', filmId);

    const existingCreditKeys = new Set(
      (existingCredits || []).map((c) => `${c.person_id}|${String(c.role || '').toLowerCase()}`)
    );

    const creditsToInsert = [];
    for (const entry of roleEntries) {
      const nk = normalizeTitleKey(entry.name);
      if (!nk) continue;
      let personId = peopleByName.get(nk);
      if (!personId) {
        const pSlug = `${slugify(entry.name) || 'person'}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: newP, error: pErr } = await supabase
          .from('people')
          .insert({
            name: entry.name,
            slug: pSlug,
            known_for_department: entry.dept,
            nationality: 'Nigerian',
            source: 'nollywoodreinvented',
            is_verified: false,
          })
          .select('id')
          .single();
        if (!pErr && newP) {
          personId = newP.id;
          peopleByName.set(nk, personId);
          newPeopleCreated++;
        }
      }

      if (!personId) continue;
      const ck = `${personId}|${entry.role.toLowerCase()}`;
      if (!existingCreditKeys.has(ck)) {
        existingCreditKeys.add(ck);
        creditsToInsert.push({
          film_id: filmId,
          person_id: personId,
          role: entry.role,
          billing_order: entry.order,
          source: 'nollywoodreinvented',
        });
      }
    }

    if (creditsToInsert.length > 0) {
      const { error: credErr } = await supabase.from('credits').insert(creditsToInsert);
      if (!credErr) creditsInserted += creditsToInsert.length;
    }
  }

  let newPeopleNeeded = 0;
  for (const name of uniqueExtractedPeople) {
    if (!peopleByName.has(normalizeTitleKey(name))) newPeopleNeeded++;
  }

  console.log('\n====================================================');
  console.log(`📊 SUMMARY (${APPLY ? 'APPLIED TO DB' : 'DRY RUN'})`);
  console.log(`  Valid Structured Titles:   ${validFilms.length}`);
  console.log(`  Matched Existing in MuviDB:${matchedExisting}`);
  console.log(`  Net-New Titles:            ${netNewFilms}`);
  console.log(`  Unique People Extracted:   ${uniqueExtractedPeople.size} (${newPeopleNeeded} net-new)`);
  if (APPLY) {
    console.log(`  Films Updated In-Place:    ${updatedFilms}`);
    console.log(`  Films Inserted:            ${insertedFilms}`);
    console.log(`  New People Created:        ${newPeopleCreated}`);
    console.log(`  New Credits Linked:        ${creditsInserted}`);
  } else {
    console.log('\nSample 3 extracted titles:');
    validFilms.slice(0, 3).forEach((f) => {
      console.log(`  - ${f.title} (${f.year}) | ${f.runtimeMinutes || '?'}m | Rating: ${f.likedPercent ?? '?'}% | Cast: ${f.cast.length} | Dir: ${f.directors.join(', ')} | Trailer: ${f.trailerYoutubeId || 'none'}`);
    });
  }
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
