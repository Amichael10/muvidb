import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function runBapFilmsPopulate() {
  const bapCompanyId = 'c59e3e31-e823-4031-a89d-5b4bd257b5ba';

  const bapFilms = [
    {
      title: 'Funmilayo Ransome-Kuti',
      slug: 'funmilayo-ransome-kuti',
      year: 2024,
      synopsis: 'An inspiring historical biopic documenting the life of Chief Funmilayo Ransome-Kuti, the iconic Nigerian educator, women\'s rights activist, and mother of Fela Kuti.',
      poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
      status: 'released',
      is_published: true
    },
    {
      title: "House of Ga'a",
      slug: 'house-of-gaa',
      year: 2024,
      synopsis: 'A gripping historical epic chronicling the rise and fall of Bashorun Ga\'a, the ruthless 18th-century prime minister of the Old Oyo Empire who manipulated kings for absolute power.',
      poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
      status: 'released',
      is_published: true
    },
    {
      title: 'Man of God',
      slug: 'man-of-god-2022',
      year: 2022,
      synopsis: 'A Netflix original drama following Samuel, a man who forsakes his strict religious upbringing to live a lavish lifestyle, caught between the world and his roots.',
      poster_url: 'https://images.unsplash.com/photo-1518676599625-5825a07c30d9?w=800',
      status: 'released',
      is_published: true
    },
    {
      title: 'Collision Course',
      slug: 'collision-course',
      year: 2021,
      synopsis: 'A powerful drama exploring social divide, law enforcement, and tragic twist of fate involving a struggling musician and a law officer in Lagos.',
      poster_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800',
      status: 'released',
      is_published: true
    },
    {
      title: 'The Bling Lagosians',
      slug: 'the-bling-lagosians',
      year: 2019,
      synopsis: 'A high-society Lagos satire revolving around the affluent Holloway family struggling to maintain their extravagant lifestyle amidst impending financial ruin.',
      poster_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800',
      status: 'released',
      is_published: true
    },
    {
      title: '93 Days',
      slug: '93-days',
      year: 2016,
      synopsis: 'The heroic true story of Dr. Stella Ameyo Adadevoh and health workers in Lagos who risked their lives to contain the deadly Ebola virus outbreak in Nigeria.',
      poster_url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800',
      status: 'released',
      is_published: true
    }
  ];

  for (const filmData of bapFilms) {
    const { data: existing } = await supabase
      .from('films')
      .select('id, title')
      .ilike('title', `%${filmData.title}%`)
      .maybeSingle();

    let filmId = existing?.id;

    if (!existing) {
      const { data: inserted, error } = await supabase
        .from('films')
        .insert(filmData)
        .select()
        .single();
      if (error) console.error(`Error inserting ${filmData.title}:`, error);
      filmId = inserted?.id;
      console.log(`Inserted film: ${filmData.title} (ID: ${filmId})`);
    } else {
      console.log(`Film exists: ${existing.title} (ID: ${filmId})`);
    }

    if (filmId) {
      // Ensure film_companies link
      const { data: fc } = await supabase
        .from('film_companies')
        .select('*')
        .eq('film_id', filmId)
        .eq('company_id', bapCompanyId)
        .maybeSingle();

      if (!fc) {
        await supabase.from('film_companies').insert({
          film_id: filmId,
          company_id: bapCompanyId,
          role: 'production'
        });
        console.log(`Linked film_companies role='production' for ${filmData.title}`);
      } else {
        console.log(`film_companies link already exists for ${filmData.title}`);
      }
    }
  }

  console.log('--- ALL BAP FILMS SUCCESSFULLY POPULATED AND LINKED ---');
}

runBapFilmsPopulate();
