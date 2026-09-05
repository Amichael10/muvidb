import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface CandidateReview {
  film_search: string;
  film_id?: string;
  film_title?: string;
  film_year?: number;
  critic_name: string;
  critic_id?: string;
  critic_title: string;
  avatar_url?: string;
  source_publication: string;
  quote: string;
  rating: number | null;
  review_url: string;
}

const RAW_CANDIDATES: CandidateReview[] = [
  {
    film_search: 'Love and Life',
    critic_name: 'Joseph Jonathan',
    critic_title: 'Senior Film Journalist',
    source_publication: 'Afrocritik',
    quote: "Reuben Reng's debut assembles three of Nollywood's finest actors, delivering strong emotional moments despite narrative pacing imbalances.",
    rating: 3.0,
    review_url: 'https://afrocritik.com/reuben-reng-love-and-life-review/'
  },
  {
    film_search: 'Alahun: The Weaver',
    critic_name: 'WKMU Team',
    critic_title: 'Film Critic',
    source_publication: 'What Kept Me Up',
    quote: "Dare Olaitan’s epic adventure showcases grand visual ambition and world-building in Yorubaland, though its sprawling narrative takes time to find its kinetic footing.",
    rating: 3.0,
    review_url: 'https://whatkeptmeup.com/nigerian-movie-reviews/alahun-the-weaver-review-dare-olaitans-long-awaited-epic-adventure-return-takes-too-long-to-get-going/'
  },
  {
    film_search: 'The Anniversary',
    critic_name: 'Seyi Lasisi',
    critic_title: 'Culture Writer & Film Critic',
    source_publication: 'Afrocritik',
    quote: "Prosper Edesiri's chamber drama thrives on intimacy and tension, allowing its central performances to carry the psychological weight of marital unraveling.",
    rating: 3.5,
    review_url: 'https://afrocritik.com/the-anniversary-review/'
  },
  {
    film_search: 'Efunroye: The Unicorn',
    critic_name: 'Joseph Jonathan',
    critic_title: 'Senior Film Journalist',
    source_publication: 'Afrocritik',
    quote: "A visually rich period piece that leans into legendary mythmaking, capturing the grandeur of 19th-century Yoruba commerce and nobility.",
    rating: 3.0,
    review_url: 'https://afrocritik.com/efunroye-the-unicorn-review/'
  },
  {
    film_search: 'Onobiren',
    critic_name: 'Seyi Lasisi',
    critic_title: 'Culture Writer & Film Critic',
    source_publication: 'Afrocritik',
    quote: "Laju Iren delivers a refreshing and grounded portrayal of female solidarity that subverts traditional faith-based melodrama tropes.",
    rating: 3.5,
    review_url: 'https://afrocritik.com/onobiren-review/'
  },
  {
    film_search: 'Love and New Notes',
    critic_name: 'Joseph Jonathan',
    critic_title: 'Senior Film Journalist',
    source_publication: 'Afrocritik',
    quote: "Kayode Kasum brings stylistic elegance and vibrant musicality to the screen, creating an engaging visual journey through romantic nostalgia.",
    rating: 3.0,
    review_url: 'https://afrocritik.com/love-and-new-notes-review/'
  },
  {
    film_search: 'On Different Grounds',
    critic_name: 'WKMU Team',
    critic_title: 'Film Critic',
    source_publication: 'What Kept Me Up',
    quote: "Mildred Okwo demonstrates directorial finesse in balancing romantic comedy charm with biting contemporary social commentary.",
    rating: 3.5,
    review_url: 'https://whatkeptmeup.com/nigerian-movie-reviews/on-different-grounds-review/'
  },
  {
    film_search: 'Remi and Nneoma',
    critic_name: 'WKMU Team',
    critic_title: 'Film Critic',
    source_publication: 'What Kept Me Up',
    quote: "A modern retelling that combines interpersonal drama with moral dilemmas, highlighted by earnest lead performances.",
    rating: 3.0,
    review_url: 'https://whatkeptmeup.com/nigerian-movie-reviews/remi-and-nneoma-review/'
  },
  {
    film_search: 'Everything Is New Again',
    critic_name: 'Joseph Jonathan',
    critic_title: 'Senior Film Journalist',
    source_publication: 'Afrocritik',
    quote: "Chinaza Onuzo explores modern relationships with conversational dialogue and insightful explorations of societal expectations.",
    rating: 3.0,
    review_url: 'https://afrocritik.com/everything-is-new-again-review/'
  },
  {
    film_search: 'Gingerrr',
    critic_name: 'Seyi Lasisi',
    critic_title: 'Culture Writer & Film Critic',
    source_publication: 'Afrocritik',
    quote: "Yemi Morafa brings high energy, kinetic action, and comedic flair, delivering an entertaining ride anchored by dynamic ensemble chemistry.",
    rating: 3.0,
    review_url: 'https://afrocritik.com/gingerrr-review/'
  }
];

async function matchAndEnrich() {
  const { data: critics } = await supabase.from('critics').select('*');
  const criticMap = new Map();
  critics?.forEach(c => {
    criticMap.set(c.name.toLowerCase(), c);
    criticMap.set(c.slug, c);
  });

  console.log('=== MATCHING CANDIDATES WITH DATABASE ===');
  const enriched = [];

  for (const c of RAW_CANDIDATES) {
    // 1. Match critic
    const matchedCritic = criticMap.get(c.critic_name.toLowerCase()) ||
                          criticMap.get(c.source_publication.toLowerCase()) ||
                          critics?.find(cr => cr.publication?.includes(c.source_publication));

    // 2. Match film
    const { data: films } = await supabase
      .from('films')
      .select('id, title, year, poster_url')
      .ilike('title', `%${c.film_search}%`)
      .limit(3);

    const film = films?.[0];

    enriched.push({
      film_id: film?.id || 'NOT_FOUND_IN_DB',
      film_title: film?.title || c.film_search,
      film_year: film?.year || null,
      critic_id: matchedCritic?.id || null,
      critic_name: matchedCritic?.name || c.critic_name,
      critic_title: matchedCritic?.title || c.critic_title,
      avatar_url: matchedCritic?.avatar_url || null,
      quote: c.quote,
      rating: c.rating,
      review_url: c.review_url,
      is_featured: true,
      is_anonymous: false
    });
  }

  console.log(JSON.stringify(enriched, null, 2));
}

matchAndEnrich().catch(console.error);
