const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function safeInsert(table, data) {
  let attempt = 0;
  let currentData = [...data];
  
  while (attempt < 20) {
    const { data: result, error } = await supabase.from(table).insert(currentData).select();
    
    if (!error) return result;
    
    if (error.message.includes('Could not find the') && error.message.includes('column')) {
      // Extract column name: "Could not find the 'logo' column..."
      const match = error.message.match(/'([^']+)'/);
      if (match) {
        const col = match[1];
        console.warn(`      ⚠️ Column [${col}] missing in [${table}]. Removing and retrying...`);
        currentData = currentData.map(item => {
          const newItem = { ...item };
          delete newItem[col];
          return newItem;
        });
        attempt++;
        continue;
      }
    }
    
    throw error;
  }
}

async function seed() {
  console.log('🌱 Starting Self-Healing Industry Seed...');

  try {
    // 1. Clear transient tables
    console.log('🧹 Clearing transient tables...');
    await supabase.from('showtimes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('film_genres').delete().neq('film_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('films').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('cinemas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Companies
    console.log('🏢 Seeding Companies...');
    const cos = await safeInsert('companies', [
      { name: 'FilmOne Entertainment', website_url: 'https://filmhouseng.com', website: 'https://filmhouseng.com', url: 'https://filmhouseng.com', description: 'Major film distribution and production company.', logo_url: 'https://filmhouseng.com/logo.png', logo: 'https://filmhouseng.com/logo.png', founded_year: 2010, year: 2010, headquarters: 'Lagos' },
      { name: 'EbonyLife Media', website_url: 'https://ebonylifemedia.com', website: 'https://ebonylifemedia.com', url: 'https://ebonylifemedia.com', description: 'Lifestyle and entertainment media group.', logo_url: 'https://ebonylifemedia.com/logo.png', logo: 'https://ebonylifemedia.com/logo.png', founded_year: 2013, year: 2013, headquarters: 'Lagos' },
      { name: 'Inkblot Productions', website_url: 'https://inkblotpresents.com', website: 'https://inkblotpresents.com', url: 'https://inkblotpresents.com', description: 'Independent film production company.', logo_url: 'https://inkblotpresents.com/logo.png', logo: 'https://inkblotpresents.com/logo.png', founded_year: 2011, year: 2011, headquarters: 'Lagos' }
    ]);

    // 3. People
    console.log('👥 Seeding Talent...');
    const people = await safeInsert('people', [
      { name: 'Funke Akindele', photo_url: 'https://images.unsplash.com/photo-1531123897727-8f129e16fd3c?w=400&h=400&fit=crop', bio: 'Iconic director and actress.', nationality: 'Nigerian' },
      { name: 'Wale Ojo', photo_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop', bio: 'Veteran actor, Breath of Life star.', nationality: 'Nigerian' },
      { name: 'Timini Egbuson', photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', bio: 'Nollywood sweetheart.', nationality: 'Nigerian' },
      { name: 'BB Sasore', photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', bio: 'Award-winning director.', nationality: 'Nigerian' },
      { name: 'Kayode Kasum', photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', bio: 'Prolific Nigerian director.', nationality: 'Nigerian' }
    ]);
    const p = people.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.id }), {});

    // 4. Cinemas
    console.log('🍿 Seeding Cinemas...');
    await safeInsert('cinemas', [
      { name: 'Filmhouse IMAX Lekki', city: 'Lagos', state: 'Lagos', location: 'Lagos', address: 'Rock Drive, Lekki Phase 1', is_active: true, status: 'active', chain: 'Filmhouse' },
      { name: 'Silverbird Galleria VI', city: 'Lagos', state: 'Lagos', location: 'Lagos', address: 'Ahmad Bello Way, Victoria Island', is_active: true, status: 'active', chain: 'Silverbird' },
      { name: 'Genesis Palms Lekki', city: 'Lagos', state: 'Lagos', location: 'Lagos', address: 'The Palms Mall, Lekki', is_active: true, status: 'active', chain: 'Genesis' }
    ]);

    // 5. Genres
    console.log('🎭 Fetching Genre IDs...');
    const { data: genreList } = await supabase.from('genres').select('*');
    const g = (genreList || []).reduce((acc, curr) => ({ ...acc, [curr.name]: curr.id }), {});

    // 6. Films
    console.log('🎬 Seeding Films...');
    const films = await safeInsert('films', [
      { title: 'Breath of Life', synopsis: 'A tale of redemption and spiritual purpose.', year: 2023, runtime_minutes: 114, poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644ef7467?w=800', backdrop_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1200', status: 'released' },
      { title: 'A Tribe Called Judah', synopsis: 'A family heist like no other.', year: 2023, runtime_minutes: 134, poster_url: 'https://images.unsplash.com/photo-1542204111-970c9a6a8d8e?w=800', backdrop_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200', status: 'released' },
      { title: 'Afamefuna: An Nwa Boi Story', synopsis: 'The Igbo apprenticeship system explored.', year: 2023, runtime_minutes: 120, poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800', backdrop_url: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=1200', status: 'released' }
    ]);
    const f = films.reduce((acc, curr) => ({ ...acc, [curr.title]: curr.id }), {});

    // 7. Credits & Linking
    console.log('🔗 Linking Credits & Genres...');
    await safeInsert('credits', [
      { film_id: f['Breath of Life'], person_id: p['BB Sasore'], role: 'director', billing_order: 0 },
      { film_id: f['Breath of Life'], person_id: p['Wale Ojo'], role: 'actor', character_name: 'Timileyin', billing_order: 1 },
      { film_id: f['A Tribe Called Judah'], person_id: p['Funke Akindele'], role: 'director', billing_order: 0 },
      { film_id: f['A Tribe Called Judah'], person_id: p['Funke Akindele'], role: 'actor', character_name: 'Jedidiah Judah', billing_order: 1 },
      { film_id: f['A Tribe Called Judah'], person_id: p['Timini Egbuson'], role: 'actor', character_name: 'Pere Judah', billing_order: 2 },
      { film_id: f['Afamefuna: An Nwa Boi Story'], person_id: p['Kayode Kasum'], role: 'director', billing_order: 0 },
      { film_id: f['Afamefuna: An Nwa Boi Story'], person_id: p['Timini Egbuson'], role: 'actor', character_name: 'Paul', billing_order: 1 }
    ]);

    await safeInsert('film_genres', [
      { film_id: f['Breath of Life'], genre_id: g['Drama'] || genreList?.[0]?.id },
      { film_id: f['A Tribe Called Judah'], genre_id: g['Action'] || genreList?.[0]?.id },
      { film_id: f['A Tribe Called Judah'], genre_id: g['Comedy'] || genreList?.[1]?.id },
      { film_id: f['Afamefuna: An Nwa Boi Story'], genre_id: g['Drama'] || genreList?.[0]?.id }
    ]);

    console.log('✅ Self-Healing Seed Complete!');
  } catch (err) {
    console.error('❌ Seed Failed permanently:', err.message || err);
  }
}

seed();
