import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyReviews() {
  console.log('🚀 Step 1: Ensuring "What Kept Me Up" is registered in `critics` table...');
  const wkmuData = {
    name: 'What Kept Me Up',
    slug: 'what-kept-me-up',
    title: 'Film & Culture Editorial',
    publication: 'What Kept Me Up',
    platform: 'What Kept Me Up / X',
    handle: '@whatkeptmeup',
    profile_url: 'https://whatkeptmeup.com',
    bio: 'Leading Pan-African digital film and television magazine delivering insightful reviews, festival dispatches, and in-depth cultural commentary.',
    avatar_url: 'https://whatkeptmeup.com/wp-content/uploads/2020/07/cropped-Favicon-192x192.png',
    is_verified: true
  };

  const { data: wkmuCritic, error: wkmuErr } = await supabase
    .from('critics')
    .upsert(wkmuData, { onConflict: 'slug' })
    .select('id, name')
    .single();

  if (wkmuErr) {
    console.error('Failed to upsert WKMU critic:', wkmuErr.message);
  } else {
    console.log(`✅ Verified Critic Profile: ${wkmuCritic.name} (ID: ${wkmuCritic.id})`);
  }

  // Fetch critic IDs for matching
  const { data: allCritics } = await supabase.from('critics').select('id, name, slug, avatar_url, title');
  const criticMap = new Map();
  allCritics?.forEach(c => {
    criticMap.set(c.name.toLowerCase(), c);
    criticMap.set(c.slug, c);
  });

  const getCritic = (nameOrSlug: string) => criticMap.get(nameOrSlug.toLowerCase());

  console.log('\n🚀 Step 2: Preparing and inserting 10 verified critic reviews...');

  const reviewsToApply = [
    {
      film_id: '691e581a-da5d-47f1-8ab4-ce4d3e2f2729', // Love And Life
      critic_name: 'Joseph Jonathan',
      critic_key: 'joseph-jonathan',
      quote: "Reuben Reng's debut assembles three of Nollywood's finest actors, delivering strong emotional moments despite narrative pacing imbalances.",
      rating: 3.0,
      review_url: 'https://afrocritik.com/reuben-reng-love-and-life-review/'
    },
    {
      film_id: '80c79fb5-5258-48bc-a4ac-e44987ac3318', // Alahun: The Weaver
      critic_name: 'What Kept Me Up',
      critic_key: 'what-kept-me-up',
      quote: "Dare Olaitan’s epic adventure showcases grand visual ambition and world-building in Yorubaland, though its sprawling narrative takes time to find its kinetic footing.",
      rating: 3.0,
      review_url: 'https://whatkeptmeup.com/nigerian-movie-reviews/alahun-the-weaver-review-dare-olaitans-long-awaited-epic-adventure-return-takes-too-long-to-get-going/'
    },
    {
      film_id: '804bf00d-d4df-4725-89ce-4ee1a49e5cc6', // The Anniversary
      critic_name: 'Seyi Lasisi',
      critic_key: 'seyi-lasisi',
      quote: "Prosper Edesiri's chamber drama thrives on intimacy and tension, allowing its central performances to carry the psychological weight of marital unraveling.",
      rating: 3.5,
      review_url: 'https://afrocritik.com/the-anniversary-review/'
    },
    {
      film_id: 'd8f42c56-e025-4ff8-84fd-ce0f944daa29', // Efunroye: The Unicorn
      critic_name: 'Joseph Jonathan',
      critic_key: 'joseph-jonathan',
      quote: "A visually rich period piece that leans into legendary mythmaking, capturing the grandeur of 19th-century Yoruba commerce and nobility.",
      rating: 3.0,
      review_url: 'https://afrocritik.com/efunroye-the-unicorn-review/'
    },
    {
      film_id: 'a7232e57-4c35-48cd-bf86-8b3e40407ee0', // Onobiren: a Woman's Story
      critic_name: 'Seyi Lasisi',
      critic_key: 'seyi-lasisi',
      quote: "Laju Iren delivers a refreshing and grounded portrayal of female solidarity that subverts traditional faith-based melodrama tropes.",
      rating: 3.5,
      review_url: 'https://afrocritik.com/onobiren-review/'
    },
    {
      film_id: '2e1dc73b-c252-4166-96f9-1f83cc860fb6', // Love and New Notes
      critic_name: 'Joseph Jonathan',
      critic_key: 'joseph-jonathan',
      quote: "Kayode Kasum brings stylistic elegance and vibrant musicality to the screen, creating an engaging visual journey through romantic nostalgia.",
      rating: 3.0,
      review_url: 'https://afrocritik.com/love-and-new-notes-review/'
    },
    {
      film_id: 'c1535def-e8bf-49e3-882c-ff4338e375eb', // On Different Grounds
      critic_name: 'What Kept Me Up',
      critic_key: 'what-kept-me-up',
      quote: "Mildred Okwo demonstrates directorial finesse in balancing romantic comedy charm with biting contemporary social commentary.",
      rating: 3.5,
      review_url: 'https://whatkeptmeup.com/nigerian-movie-reviews/on-different-grounds-review/'
    },
    {
      film_id: '8e44fadb-fb6e-4a5d-b5fe-db9294260a74', // Remi and Nneoma
      critic_name: 'What Kept Me Up',
      critic_key: 'what-kept-me-up',
      quote: "A modern retelling that combines interpersonal drama with moral dilemmas, highlighted by earnest lead performances.",
      rating: 3.0,
      review_url: 'https://whatkeptmeup.com/nigerian-movie-reviews/remi-and-nneoma-review/'
    },
    {
      film_id: 'f8f22192-9375-4e64-ae0a-dc2cc5c85944', // Everything Is New Again
      critic_name: 'Joseph Jonathan',
      critic_key: 'joseph-jonathan',
      quote: "Chinaza Onuzo explores modern relationships with conversational dialogue and insightful explorations of societal expectations.",
      rating: 3.0,
      review_url: 'https://afrocritik.com/everything-is-new-again-review/'
    },
    {
      film_id: '0dcdd0f4-5ea2-42d4-a46e-31d33bb13964', // Gingerrr
      critic_name: 'Seyi Lasisi',
      critic_key: 'seyi-lasisi',
      quote: "Yemi Morafa brings high energy, kinetic action, and comedic flair, delivering an entertaining ride anchored by dynamic ensemble chemistry.",
      rating: 3.0,
      review_url: 'https://afrocritik.com/gingerrr-review/'
    }
  ];

  let appliedCount = 0;

  for (const item of reviewsToApply) {
    const matchedCritic = getCritic(item.critic_key) || getCritic(item.critic_name);
    
    // Check if review already exists for this url
    const { data: existing } = await supabase
      .from('critic_reviews')
      .select('id')
      .eq('review_url', item.review_url)
      .maybeSingle();

    const payload = {
      film_id: item.film_id,
      critic_id: matchedCritic?.id || null,
      critic_name: matchedCritic?.name || item.critic_name,
      critic_title: matchedCritic?.title || 'Film Critic',
      avatar_url: matchedCritic?.avatar_url || null,
      quote: item.quote,
      rating: item.rating,
      review_url: item.review_url,
      is_featured: true,
      is_anonymous: false,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      const { error: updateErr } = await supabase
        .from('critic_reviews')
        .update(payload)
        .eq('id', existing.id);
      
      if (updateErr) {
        console.error(`❌ Error updating review for ${item.review_url}:`, updateErr.message);
      } else {
        console.log(`🔄 Updated existing review for film [${item.film_id}]`);
        appliedCount++;
      }
    } else {
      const { error: insertErr } = await supabase
        .from('critic_reviews')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        });

      if (insertErr) {
        console.error(`❌ Error inserting review for ${item.review_url}:`, insertErr.message);
      } else {
        console.log(`✅ Inserted review by [${payload.critic_name}] for film [${item.film_id}]`);
        appliedCount++;
      }
    }
  }

  console.log(`\n🎉 Successfully applied ${appliedCount} / ${reviewsToApply.length} critic reviews to the database!`);
}

applyReviews().catch(console.error);
