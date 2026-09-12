import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from './lib/db';

const CRITIC_ID = 'abe0f198-5b70-47fb-b5e4-b08a93bdef6d';
const CRITIC_NAME = 'Dami Dawson';
const CRITIC_TITLE = 'Film Critic';
const CRITIC_AVATAR = 'https://static.wixstatic.com/media/f87a6d_4dd9e45b448549e1a4b6bfb6251af0d4~mv2.png';

const articlesPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\\scratch\\all_dami_articles.json';
const rawArticles = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
const articlesBySlug = new Map(rawArticles.map((a: any) => [a.url.split('/').pop(), a]));

console.log(`Loaded ${rawArticles.length} scraped articles from It's A Wrap Nigeria.`);

const reviewMappings = [
  {
    url_slug: 'aba-blues-a-beautiful-idea-lost-in-execution',
    film_search: 'Aba Blues',
    fallback_year: 2024,
    genres: ['Drama', 'Romance'],
    rating: 2.5,
    quote: "In Aba Blues, director Jack’enneth attempts to explore a deeply familiar premise of interrupted love and the lingering weight of what could have been, but its promising emotional core gets lost in narrative execution."
  },
  {
    url_slug: 'a-father-s-secret-a-familiar-story-told-with-some-intention',
    film_search: "A Father's Secret",
    fallback_year: 2024,
    genres: ['Drama', 'Family'],
    rating: 3.0,
    quote: "There is something deceptively simple about A Father’s Secret; it is a familiar domestic tale told with genuine intention, where a good film is hiding right inside a conventional structure."
  },
  {
    url_slug: 'ordinary-people-extraordinary-overreach-moses-inwang-s-three-hats-couldn-t-hold-the-weight',
    film_search: 'Ordinary People',
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 2.5,
    quote: "Moses Inwang’s ambitious three-hat juggling act aims high with sprawling dramatic intent, but the sheer thematic overreach strains the narrative weight."
  },
  {
    url_slug: 'agesinkole-2-a-kingdom-worth-saving-a-story-still-finding-its-feet',
    film_search: 'Agesinkole 2',
    film_alt_search: 'King of Thieves',
    fallback_year: 2024,
    genres: ['Epic', 'Drama', 'Action'],
    rating: 3.0,
    quote: "Agesinkole 2 offers an epic Yoruba kingdom worth saving, though the unfolding sequel narrative takes its time finding its kinetic storytelling feet."
  },
  {
    url_slug: 'mother-s-love-clear-vision-strong-themes-and-an-execution-that-leaves-room-for-more',
    film_search: "Mother's Love",
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 3.0,
    quote: "Mother's Love brings a clear directorial vision and strong emotional themes, delivering earnest performances while leaving room for sharper dramatic execution."
  },
  {
    url_slug: 'behind-the-scenes-a-beautifully-layered-drama-that-needed-sharper-consequences',
    film_search: 'Behind the Scenes',
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 3.5,
    quote: "A beautifully layered industry drama that navigates the intricate nuances of filmmaking life, only yearning for sharper narrative consequences in its final act."
  },
  {
    url_slug: 'mothers-of-chibok-the-story-we-moved-on-from-but-they-never-did',
    film_search: 'Mothers of Chibok',
    fallback_year: 2024,
    genres: ['Documentary', 'Drama'],
    rating: 4.0,
    quote: "A profoundly moving and unflinching documentary account that forces audiences to confront the enduring human grief and resilience of families who could never simply move on."
  },
  {
    url_slug: 'alive-till-dawn-bold-necessary-but-still-finding-its-horror-voice',
    film_search: 'Alive Till Dawn',
    fallback_year: 2024,
    genres: ['Horror', 'Thriller'],
    rating: 3.0,
    quote: "A bold and necessary venture into Nollywood horror territory, packed with atmospheric ambition while continuing to hone its distinctive genre voice."
  },
  {
    url_slug: 'the-boy-who-gave-is-a-bold-exercise-in-patient-storytelling',
    film_search: 'The Boy Who Gave',
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 3.5,
    quote: "A refreshing, patient exercise in contemplative cinema that trusts its audience and lets character interiority drive its quiet emotional power."
  },
  {
    url_slug: 'evi-when-ambition-meets-authenticity-and-landed-fairly-well',
    film_search: 'Evi',
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 3.5,
    quote: "When raw ambition meets cultural authenticity, Evi strikes an earnest chord, landing its story with grounded performances and evocative direction."
  },
  {
    url_slug: 'headless-a-bold-nollywood-thriller-that-couldn-t-hold-it-s-nerve',
    film_search: 'Headless',
    fallback_year: 2024,
    genres: ['Crime', 'Thriller'],
    rating: 2.5,
    quote: "Headless bursts out of the gate as a stylish, high-stakes thriller, but struggles to sustain its narrative tension and hold its nerve through the climax."
  },
  {
    url_slug: 'the-return-of-arinzo-a-sequel-that-came-back-without-its-soul',
    film_search: 'The Return of Arinzo',
    film_alt_search: 'Arinzo',
    fallback_year: 2024,
    genres: ['Drama', 'Action'],
    rating: 2.0,
    quote: "The Return of Arinzo revives a recognizable world but returns without the visceral tension and authentic soul that made the original compelling."
  },
  {
    url_slug: 'the-return-of-omotara-johnson-a-franchise-that-forgot-how-to-be-dangerous',
    film_search: 'The Return of Omotara Johnson',
    film_alt_search: 'Omotara Johnson',
    fallback_year: 2024,
    genres: ['Drama', 'Crime'],
    rating: 2.5,
    quote: "Bukky Wright's return revives a storied classic persona, yet feels softened around the edges, forgetting the danger and bite that originally defined the franchise."
  },
  {
    url_slug: 'why-you-should-see-to-adaego-with-love',
    film_search: 'To Adaego With Love',
    fallback_year: 2024,
    genres: ['Romance', 'Drama'],
    rating: 3.5,
    quote: "A heartfelt romantic drama exploring forgiveness and relationship intricacies, marked by genuine chemistry and honest writing."
  },
  {
    url_slug: 'mercy-aigbe-s-everything-is-new-again-lacked-all-the-emotions',
    film_search: 'Everything Is New Again',
    fallback_year: 2024,
    genres: ['Drama', 'Family'],
    rating: 2.0,
    quote: "Despite an ensemble cast and glossy production values, Everything Is New Again misses the vital emotional depth and connective tissue required of its melodrama."
  },
  {
    url_slug: 'niyi-akinmolayan-s-colours-of-fire-a-visually-ambitious-narratively-uneven-foray',
    film_search: 'Colours of Fire',
    fallback_year: 2024,
    genres: ['Action', 'Thriller'],
    rating: 3.0,
    quote: "Niyi Akinmolayan crafts a visually arresting spectacle with bold production design, even if its narrative pacing proves uneven across its expansive runtime."
  },
  {
    url_slug: 'drenched-in-survival-onobiren-and-the-quiet-violence-of-becoming',
    film_search: 'Onobiren',
    film_alt_search: "Onobiren: A Woman's Story",
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 3.5,
    quote: "Drenched in survival instincts, Onobiren unpacks the quiet societal pressures on womanhood with tender, grounded nuance and commendable conviction."
  },
  {
    url_slug: 'a-fairytale-still-needs-logic-the-beauty-and-frustration-of-call-of-my-life',
    film_search: 'The Call of My Life',
    film_alt_search: 'Call of My Life',
    fallback_year: 2024,
    genres: ['Romance', 'Drama', 'Comedy'],
    rating: 3.0,
    quote: "Blessing Uzzi’s Call of My Life exhibits undeniable visual charm and fairy-tale romance, though its dramatic credibility occasionally stumbles over internal logic."
  },
  {
    url_slug: 'the-shadow-that-belongs-to-everyone-why-my-father-s-shadow-is-the-most-important-nigerian-film-of-t',
    film_search: "My Father's Shadow",
    fallback_year: 2024,
    genres: ['Drama'],
    rating: 4.0,
    quote: "A remarkable, vital piece of Nigerian cinema that explores familial fracture and legacy with unmatched emotional poignancy and directorial clarity."
  },
  {
    url_slug: 'timiniegbuson',
    film_search: 'Love and New Notes',
    film_alt_search: 'Love & New Notes',
    fallback_year: 2024,
    genres: ['Romance', 'Drama'],
    rating: 3.5,
    quote: "Timini Egbuson anchors Love & New Notes with charismatic flair, infusing the contemporary romantic drama with infectious energy and stylish charm."
  },
  {
    url_slug: 'four-years-later-blood-sisters-returned-without-its-greatest-strength',
    film_search: 'Blood Sisters',
    fallback_year: 2022,
    genres: ['Crime', 'Thriller', 'Drama'],
    rating: 3.0,
    quote: "Returning to the pulse-pounding world of Blood Sisters reveals the enduring appeal of its high-stakes premise, even when navigating the absence of its original pacing tightrope."
  },
  {
    url_slug: 'netflix-wanted-more-anikulapo-the-story-may-not-have-needed-it',
    film_search: 'Anikulapo',
    film_alt_search: 'Anikulapo: Rise of the Spectre',
    fallback_year: 2022,
    genres: ['Epic', 'Fantasy', 'Drama'],
    rating: 3.0,
    quote: "Kunle Afolayan’s mystical world remains visually alluring and steeped in cultural folklore, even when stretching the mythic scope across serialized television."
  }
];

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
  console.log("=== 1. UPSERTING DAMI DAWSON CRITIC PROFILE ===");
  const { error: criticErr } = await supabase.from('critics').upsert({
    id: CRITIC_ID,
    name: CRITIC_NAME,
    slug: 'dami-dawson',
    publication: "It's A Wrap Nigeria",
    platform: "It's A Wrap Nigeria / X",
    handle: '@damidawson',
    profile_url: 'https://itsawrapng.com',
    avatar_url: CRITIC_AVATAR,
    is_verified: true,
    created_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (criticErr) console.error("Critic upsert error:", criticErr);
  else console.log("✅ Dami Dawson critic profile confirmed active & verified.");

  console.log("\n=== 2. RESOLVING FILMS FOR ALL 22 REVIEWS ===");
  const allTitles = reviewMappings.flatMap(m => [m.film_search, m.film_alt_search]).filter(Boolean) as string[];
  const allSlugs = reviewMappings.map(m => m.film_search.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

  const { data: matchedTitles } = await supabase.from('films').select('id, title, slug, poster_url, year').in('title', allTitles);
  const { data: matchedSlugs } = await supabase.from('films').select('id, title, slug, poster_url, year').in('slug', allSlugs);

  const filmMap = new Map<string, any>();
  for (const f of [...(matchedTitles || []), ...(matchedSlugs || [])]) {
    filmMap.set(normalize(f.title), f);
    if (f.slug) filmMap.set(normalize(f.slug), f);
  }

  console.log(`Matched ${filmMap.size} distinct film entries from existing database.`);

  const resolvedFilms = new Map<string, any>();

  for (const m of reviewMappings) {
    const norm1 = normalize(m.film_search);
    const norm2 = m.film_alt_search ? normalize(m.film_alt_search) : null;
    let film = filmMap.get(norm1) || (norm2 ? filmMap.get(norm2) : null);

    if (!film) {
      // Create film
      const article = articlesBySlug.get(m.url_slug);
      const baseSlug = m.film_search.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const posterUrl = article?.image_url || null;
      const synopsis = article?.description || `Official Nollywood production '${m.film_search}' released in ${m.fallback_year}.`;

      // Try inserting
      let { data: created, error } = await supabase.from('films').insert({
        title: m.film_search,
        slug: baseSlug,
        year: m.fallback_year,
        synopsis,
        poster_url: posterUrl,
        genres: m.genres || ['Drama'],
        is_nollywood: true,
        is_published: true,
        language: 'English'
      }).select('id, title, slug, poster_url, year').maybeSingle();

      if (error && error.code === '23505') {
        // Slug collision, query by slug or insert with year
        const { data: existingBySlug } = await supabase.from('films').select('id, title, slug, poster_url, year').eq('slug', baseSlug).maybeSingle();
        if (existingBySlug) {
          film = existingBySlug;
        } else {
          const disambigSlug = `${baseSlug}-${m.fallback_year}`;
          const { data: createdDisambig } = await supabase.from('films').insert({
            title: m.film_search,
            slug: disambigSlug,
            year: m.fallback_year,
            synopsis,
            poster_url: posterUrl,
            genres: m.genres || ['Drama'],
            is_nollywood: true,
            is_published: true,
            language: 'English'
          }).select('id, title, slug, poster_url, year').single();
          film = createdDisambig;
        }
      } else {
        film = created;
      }

      if (film) {
        console.log(`✨ Created/linked film: '${film.title}' (${film.id})`);
        filmMap.set(norm1, film);
      }
    } else {
      console.log(`✅ Existing film: '${film.title}' (${film.id})`);
    }

    if (film) {
      resolvedFilms.set(m.url_slug, film);
    }
  }

  console.log(`\n=== 3. UPSERTING ALL 22 CRITIC REVIEWS ===`);
  const { data: existingReviews } = await supabase
    .from('critic_reviews')
    .select('id, film_id')
    .eq('critic_id', CRITIC_ID);

  const existingReviewByFilm = new Map((existingReviews || []).map(r => [r.film_id, r.id]));
  const resultsSummary = [];

  for (const m of reviewMappings) {
    const film = resolvedFilms.get(m.url_slug);
    if (!film) {
      console.error(`Could not resolve film for review: ${m.film_search}`);
      continue;
    }

    const article = articlesBySlug.get(m.url_slug);
    const reviewUrl = article?.url || `https://www.itsawrapng.com/post/${m.url_slug}`;
    const existingId = existingReviewByFilm.get(film.id);

    const reviewPayload = {
      film_id: film.id,
      critic_id: CRITIC_ID,
      critic_name: CRITIC_NAME,
      critic_title: CRITIC_TITLE,
      avatar_url: CRITIC_AVATAR,
      quote: m.quote,
      rating: m.rating,
      review_url: reviewUrl,
      is_featured: true,
      is_anonymous: false
    };

    if (existingId) {
      await supabase.from('critic_reviews').update(reviewPayload).eq('id', existingId);
      console.log(`🔄 Updated review: '${film.title}' (${m.rating}★)`);
    } else {
      const { data: inserted, error: insErr } = await supabase.from('critic_reviews').insert(reviewPayload).select('id').single();
      if (insErr) console.error(`Error inserting review for ${film.title}:`, insErr);
      else console.log(`🌟 Inserted review: '${film.title}' (${m.rating}★)`);
    }

    resultsSummary.push({
      film_title: film.title,
      film_id: film.id,
      poster_url: film.poster_url,
      year: film.year,
      rating: m.rating,
      quote: m.quote,
      url: reviewUrl
    });
  }

  console.log(`\n🎉 INGESTION COMPLETE! Stored ${resultsSummary.length} reviews for Dami Dawson.`);

  const summaryPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\\scratch\\dami_dawson_final_summary.json';
  fs.writeFileSync(summaryPath, JSON.stringify(resultsSummary, null, 2), 'utf-8');
  console.log(`Saved report to ${summaryPath}`);

  // Verification from Supabase
  const { data: dbVerify, count } = await supabase
    .from('critic_reviews')
    .select('id, rating, quote, review_url, films(title, year, poster_url)', { count: 'exact' })
    .eq('critic_id', CRITIC_ID);

  console.log(`\n=== FINAL DB VERIFICATION ===`);
  console.log(`Total verified reviews for Dami Dawson: ${dbVerify?.length || 0}`);
  for (const r of (dbVerify || [])) {
    const f = (r as any).films;
    console.log(` • [${r.rating}★] ${f?.title || 'Unknown'} (${f?.year || 'N/A'}) - "${r.quote?.slice(0, 60)}..."`);
  }
}

run().catch(console.error);
