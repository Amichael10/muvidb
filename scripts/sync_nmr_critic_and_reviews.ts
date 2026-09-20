import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface WpPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  categories: number[];
}

function decodeHtml(html: string): string {
  return html
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function cleanReviewTitle(rawTitle: string): { title: string; cleanVariants: string[] } {
  let title = decodeHtml(rawTitle);

  // Strip review tags
  title = title
    .replace(/\s*[:–—\-]\s*(?:a\s+)?(?:quick\s+)?(?:movie|film|series|nollywood)?\s*review.*$/i, '')
    .replace(/\s*movie\s*review:?\s*/i, '')
    .replace(/\s*film\s*review:?\s*/i, '')
    .replace(/\s*[:–—\-]\s*Was it worth the hype\??/i, '')
    .replace(/\s*[:–—\-]\s*a\s+different\s+kind\s+of\s+love\s+story.*$/i, '')
    .replace(/\s*[:–—\-]\s*A\s+masterpiece\s+or\s+.*$/i, '')
    .replace(/\s*[:–—\-]\s*Full review.*$/i, '')
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/['"“”]/g, '')
    .trim();

  // Known special titles on the site
  if (/there is nothing special about.*special jollof/i.test(title)) {
    title = 'Special Jollof';
  }
  if (/^elesin oba/i.test(title)) {
    title = 'Elesin Oba';
  }
  if (/^chief daddy.*going for broke/i.test(title)) {
    title = 'Chief Daddy 2: Going for Broke';
  }
  if (/^gone.*daniel ademinokan/i.test(title)) {
    title = 'Gone';
  }

  const variants = [title];

  // If title has a dash or colon with commentary, e.g. "Sista – A moving story of motherhood"
  if (/[\-–—:]/.test(title)) {
    const prefix = title.split(/[\-–—:]/)[0].trim();
    if (prefix.length >= 2) variants.push(prefix);
  }

  // If title ends with "remake", e.g. "Glamour Girls 2022 Remake" -> "Glamour Girls"
  if (/\b(?:20\d{2}\s+)?remake\b/i.test(title)) {
    const noRemake = title.replace(/\s*(?:20\d{2}\s+)?remake\b/i, '').trim();
    variants.push(noRemake);
  }

  // If title has parenthetical alternate name e.g. "Beast of Two Worlds (Ajakaju)" or "King of thieves (Ageshinkole)"
  if (/\([^)]+\)/.test(title)) {
    const noParen = title.replace(/\s*\([^)]+\)/g, '').trim();
    variants.push(noParen);
    const inParen = title.match(/\(([^)]+)\)/)?.[1]?.trim();
    if (inParen) variants.push(inParen);
  }

  // Remove "The Movie" e.g. "4.4.44 The Movie" -> "4.4.44", "Swallow the Movie" -> "Swallow"
  if (/\bthe movie\b/i.test(title)) {
    const noMovie = title.replace(/\s*the movie\b/i, '').trim();
    variants.push(noMovie);
    if (noMovie === '4.4.44') {
      variants.push('4:4:44');
      variants.push('Four Four Forty Four');
    }
  }

  // Also handle "The Blood Covenant" vs "Blood Covenant", "The Perfect Arrangement" vs "Perfect Arrangement"
  for (const v of [...variants]) {
    if (!v.toLowerCase().startsWith('the ')) variants.push(`The ${v}`);
    if (v.toLowerCase().startsWith('the ')) variants.push(v.slice(4).trim());
  }

  return { title, cleanVariants: [...new Set(variants)] };
}

function extractRatingAndQuote(contentHtml: string): { rating: number | null; quote: string } {
  const cleanHtml = contentHtml
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  const textLines = cleanHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map(line => decodeHtml(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let rating: number | null = null;
  let quoteCandidate = '';

  for (let i = textLines.length - 1; i >= 0; i--) {
    const line = textLines[i];
    const ratingMatch = line.match(/(?:my\s+)?rating\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/\s*10)?/i)
      || line.match(/verdict\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/i);

    if (ratingMatch) {
      const parsed = parseFloat(ratingMatch[1]);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
        rating = parsed;
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prev = textLines[j];
          if (
            prev.length >= 40 &&
            prev.length <= 400 &&
            !/^(?:have you seen|thoughts\??|read the review|we have a fun|instagram|twitter|youtube|share your thoughts|subscribe)/i.test(prev) &&
            !prev.includes('http')
          ) {
            quoteCandidate = prev;
            break;
          }
        }
        break;
      }
    }
  }

  if (!quoteCandidate) {
    for (let i = textLines.length - 1; i >= 0; i--) {
      const line = textLines[i];
      if (/^(?:overall|in conclusion|verdict|final thoughts)/i.test(line) && line.length >= 30) {
        quoteCandidate = line.replace(/^(?:overall|in conclusion|verdict|final thoughts)\s*[:,\-]?\s*/i, '');
        break;
      }
    }
  }

  if (!quoteCandidate) {
    const filtered = textLines.filter(l => 
      l.length >= 40 && 
      !/^(?:rating|have you seen|thoughts\??|read the review|we have a fun|what is this film about|what did i like|what worked|what did not work)/i.test(l) &&
      !l.includes('http')
    );
    if (filtered.length > 0) {
      quoteCandidate = filtered[filtered.length - 1];
    }
  }

  let quote = quoteCandidate.trim();
  if (quote.length > 350) {
    const cut = quote.slice(0, 347);
    const lastSpace = cut.lastIndexOf(' ');
    quote = (lastSpace > 200 ? cut.slice(0, lastSpace) : cut) + '...';
  }

  return { rating, quote };
}

function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function run() {
  console.log('=== Step 1: Ensure Nigerian Movies Review exists in critics ===');
  
  const { data: existingCritics } = await supabase
    .from('critics')
    .select('*')
    .or('slug.eq.nigerian-movies-review,name.ilike.%Nigerian Movies Review%');

  let criticId: string;
  const criticAvatar = 'https://nigerianmoviesreview.com/wp-content/uploads/2023/08/NMR-WITHOUT-BG-150x150.png';

  if (existingCritics && existingCritics.length > 0) {
    criticId = existingCritics[0].id;
    console.log(`Critic already exists with id: ${criticId}`);
  } else {
    const newCritic = {
      slug: 'nigerian-movies-review',
      name: 'Nigerian Movies Review',
      title: 'Editorial Review Team',
      publication: 'Nigerian Movies Review',
      bio: 'Nigerian Movie Reviews (NMR) started in 2020 as a platform dedicated to critical appraisals of Nollywood movies - the good, the bad, the ugly, and the beautiful! Over time we have built a platform where Nollywood lovers can get detailed and objective reviews and also share their feedback. NMR is fast becoming the foremost platform helping Nigerians within the country as well as Nigerians in Diaspora identify Nollywood movies that are worth seeing and those that are not.',
      avatar_url: criticAvatar,
      platform: 'Web, Instagram & X',
      handle: '@nigerianmoviesreview',
      profile_url: 'https://nigerianmoviesreview.com/',
      is_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: cErr } = await supabase.from('critics').insert(newCritic).select().single();
    if (cErr || !inserted) {
      console.error('Failed to create critic:', cErr);
      return;
    }
    criticId = inserted.id;
    console.log(`✅ Created critic "Nigerian Movies Review" with id: ${criticId}`);
  }

  console.log('\n=== Step 2: Fetching All Posts from Nigerian Movies Review ===');
  let allPosts: WpPost[] = [];
  let page = 1;

  while (true) {
    const url = `https://nigerianmoviesreview.com/wp-json/wp/v2/posts?per_page=100&page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) break;
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) break;
    allPosts.push(...posts);
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    if (page >= totalPages) break;
    page++;
  }
  console.log(`Fetched ${allPosts.length} posts from site.`);

  console.log('\n=== Step 3: Loading Films from Lumi Database ===');
  let films: any[] = [];
  let fPage = 0;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, original_title, year, slug')
      .range(fPage * 1000, (fPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    films.push(...data);
    if (data.length < 1000) break;
    fPage++;
  }
  console.log(`Loaded ${films.length} films from DB.`);

  const filmByExactTitle = new Map<string, any[]>();
  const filmByNormalized = new Map<string, any[]>();

  for (const f of films) {
    const t = f.title.trim();
    if (!filmByExactTitle.has(t.toLowerCase())) filmByExactTitle.set(t.toLowerCase(), []);
    filmByExactTitle.get(t.toLowerCase())!.push(f);

    const n = norm(t);
    if (n) {
      if (!filmByNormalized.has(n)) filmByNormalized.set(n, []);
      filmByNormalized.get(n)!.push(f);
    }
    if (f.original_title) {
      const no = norm(f.original_title);
      if (no) {
        if (!filmByNormalized.has(no)) filmByNormalized.set(no, []);
        filmByNormalized.get(no)!.push(f);
      }
    }
  }

  console.log('\n=== Step 4: Matching and Upserting Critic Reviews ===');
  const { data: existingReviews } = await supabase
    .from('critic_reviews')
    .select('review_url, film_id');
  
  const existingReviewUrls = new Set((existingReviews || []).map(r => r.review_url).filter(Boolean));

  let insertedCount = 0;
  let skippedExistingCount = 0;
  const matchedReviews: any[] = [];
  const missingFilms: any[] = [];

  for (const post of allPosts) {
    const rawTitle = decodeHtml(post.title.rendered);
    const { rating, quote } = extractRatingAndQuote(post.content.rendered);
    const { title: movieTitle, cleanVariants } = cleanReviewTitle(rawTitle);

    const isArticleCategory = post.categories.includes(226) || post.categories.includes(232);
    if (isArticleCategory && rating === null && !/review/i.test(rawTitle)) {
      continue;
    }

    let matchedFilm: any = null;
    for (const v of cleanVariants) {
      const exactMatches = filmByExactTitle.get(v.toLowerCase());
      if (exactMatches && exactMatches.length > 0) {
        matchedFilm = exactMatches[0];
        break;
      }
      const n = norm(v);
      if (n && filmByNormalized.has(n)) {
        const cand = filmByNormalized.get(n)!;
        matchedFilm = cand[0];
        break;
      }
    }

    if (matchedFilm) {
      matchedReviews.push({
        film: matchedFilm,
        movieTitle,
        postTitle: rawTitle,
        rating,
        quote,
        url: post.link,
        date: post.date
      });

      if (existingReviewUrls.has(post.link)) {
        skippedExistingCount++;
        continue;
      }

      const reviewPayload = {
        film_id: matchedFilm.id,
        critic_id: criticId,
        critic_name: 'Nigerian Movies Review',
        critic_title: 'Editorial Review Team',
        avatar_url: criticAvatar,
        quote: quote || `Nigerian Movies Review of ${matchedFilm.title}`,
        rating: rating,
        review_url: post.link,
        is_featured: true,
        is_anonymous: false,
        created_at: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insErr } = await supabase.from('critic_reviews').insert(reviewPayload);
      if (!insErr) {
        insertedCount++;
        existingReviewUrls.add(post.link);
      } else {
        console.warn(`Failed to insert review for ${matchedFilm.title}:`, insErr.message);
      }
    } else {
      missingFilms.push({
        movieTitle,
        postTitle: rawTitle,
        rating,
        quote,
        url: post.link
      });
    }
  }

  console.log('\n======================================================');
  console.log(`Total Reviews Matched in DB  : ${matchedReviews.length}`);
  console.log(`New Critic Reviews Inserted : ${insertedCount}`);
  console.log(`Already Present (Skipped)   : ${skippedExistingCount}`);
  console.log(`Missing Films (Not in DB)   : ${missingFilms.length}`);
  console.log('======================================================\n');

  console.log('--- MISSING FILMS REPORT (Reviewed by NMR but not in Lumi DB) ---');
  missingFilms.forEach((m, idx) => {
    console.log(`${idx + 1}. Title: "${m.movieTitle}"`);
    console.log(`   Post Title : "${m.postTitle}"`);
    console.log(`   NMR Rating : ${m.rating !== null ? m.rating + '/10' : 'Unrated'}`);
    console.log(`   Review URL : ${m.url}\n`);
  });

  fs.writeFileSync('scripts/nmr_missing_films.json', JSON.stringify(missingFilms, null, 2));
}

run();
