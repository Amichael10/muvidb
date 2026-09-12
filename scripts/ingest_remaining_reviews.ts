import { supabase } from './lib/db';

async function ingestRemainingReviews() {
  const criticId = '44490f2b-638f-43f2-b33a-47e5b979fe4f'; // Oris Aigbokhaevbolo / Film Efiko

  const manualMatches = [
    {
      title: "O-Town",
      year: 2015,
      url: "https://filmefiko.com/cinema/o-town-review-s16film-fest/",
      rating: 6.8,
      quote: "O-Town retains its low-budget charm and singular pulp aesthetic 9 years later, remaining one of the most distinctive crime thrillers in modern Nigerian cinema."
    },
    {
      title: "To Kill A Monkey",
      year: 2025,
      url: "https://filmefiko.com/stream/to-kill-a-monkey-review/",
      rating: 4.5,
      quote: "A gritty and ambitious crime series with standout turns, exploring morality and corruption across modern Lagos."
    },
    {
      title: "Postcards",
      year: 2024,
      url: "https://filmefiko.com/stream/postcards-six-snapshots-of-tedium-and-contrivance/",
      rating: 4.0,
      quote: "A sprawling cross-cultural drama that navigates family struggles and relationships between Nigeria and India."
    },
    {
      title: "My Father's Shadow",
      year: 2024,
      url: "https://filmefiko.com/cinema/my-fathers-shadow-rave-reviews/",
      rating: 7.5,
      quote: "A striking, deeply resonant cinematic exploration of family lineage, memory, and identity."
    },
    {
      title: "Split",
      year: 2024,
      url: "https://filmefiko.com/stream/dstv-split-review/",
      rating: 6.0,
      quote: "An intriguing psychological drama examining identity, betrayal, and high-stakes family secrets."
    },
    {
      title: "Young, Famous & African",
      year: 2022,
      url: "https://filmefiko.com/cinema/young-famous-african-painfully-superficial/",
      rating: 5.0,
      quote: "A glamorous look at Africa's elite entertainment figures navigating romance, rivalry, and stardom."
    },
    {
      title: "The Shakedown",
      year: 2024,
      url: "https://filmefiko.com/stream/the-shakedown-review-prime-south-africa/",
      rating: 5.2,
      quote: "An energetic Cape Town caper with comedic flourishes, navigating crime syndicates and suburban misadventures."
    }
  ];

  for (const item of manualMatches) {
    // Check if review already ingested
    const { data: existing } = await supabase.from('critic_reviews').select('id').eq('review_url', item.url).single();
    if (existing) continue;

    // Find film or create
    let filmId: string | null = null;
    const { data: found } = await supabase.from('films').select('id, title, year').ilike('title', item.title).limit(1);
    if (found && found.length > 0) {
      filmId = found[0].id;
    } else {
      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: newFilm, error: insErr } = await supabase.from('films').insert([{
        title: item.title,
        slug: `${slug}-${item.year}`,
        year: item.year,
        synopsis: item.quote,
        source: 'filmefiko'
      }]).select('id').single();

      if (newFilm) filmId = newFilm.id;
      else console.warn(`Could not create film "${item.title}":`, insErr?.message);
    }

    if (filmId) {
      const { error: revErr } = await supabase.from('critic_reviews').insert([{
        film_id: filmId,
        play_id: null,
        critic_id: criticId,
        critic_name: "Oris Aigbokhaevbolo",
        critic_title: "Critic · Film Efiko",
        quote: item.quote,
        rating: item.rating,
        review_url: item.url,
        is_featured: true
      }]);

      if (!revErr) {
        console.log(`✅ Ingested review for "${item.title}" -> Film ID: ${filmId}`);
      } else {
        console.error(`Error for "${item.title}":`, revErr.message);
      }
    }
  }

  console.log("Remaining manual review matching completed!");
}

ingestRemainingReviews().catch(console.error);
