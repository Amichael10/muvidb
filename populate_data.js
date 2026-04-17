const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function populate() {
  console.log('🚀 Starting Real Data Population...');

  try {
    // 1. Clear existing data (in reverse order of dependencies)
    console.log('🧹 Clearing old records...');
    await supabase.from('showtimes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('films').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('cinemas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Insert Companies
    console.log('🏢 Inserting Companies...');
    const { data: cos } = await supabase.from('companies').insert([
      { name: 'FilmOne Entertainment', headquarters: 'Lagos, Nigeria', website: 'https://filmhouseng.com' },
      { name: 'EbonyLife Media', headquarters: 'Lagos, Nigeria', website: 'https://ebonylifemedia.com' },
      { name: 'Inkblot Productions', headquarters: 'Lagos, Nigeria', website: 'https://inkblotpresents.com' },
      { name: 'Anthill Studios', headquarters: 'Lagos, Nigeria', website: 'https://anthillstudios.com' }
    ]).select();

    // 3. Insert People
    console.log('👥 Inserting People...');
    const { data: people } = await supabase.from('people').insert([
      { name: 'Funke Akindele', photo_url: 'https://images.unsplash.com/photo-1531123897727-8f129e16fd3c?w=400&h=400&fit=crop', bio: 'Nollywood superstar, director, and producer of record-breaking blockbusters.', nationality: 'Nigerian' },
      { name: 'Wale Ojo', photo_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop', bio: 'AMVCA award-winning actor known for Breath of Life and Phone Swap.', nationality: 'Nigerian' },
      { name: 'Timini Egbuson', photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', bio: 'Popular Nollywood actor and darling of the new generation.', nationality: 'Nigerian' },
      { name: 'BB Sasore', photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', bio: 'Visionary director behind Breath of Life and God Calling.', nationality: 'Nigerian' },
      { name: 'Kayode Kasum', photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', bio: 'Prolific director known for Afamefuna, Ajosepo, and Sugar Rush.', nationality: 'Nigerian' }
    ]).select();

    const p = people.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.id }), {});

    // 4. Insert Cinemas
    console.log('🍿 Inserting Cinemas...');
    await supabase.from('cinemas').insert([
      { name: 'Filmhouse IMAX Lekki', location: 'Lagos', address: 'Rock Drive, Lekki Phase 1', status: 'active', chain: 'Filmhouse' },
      { name: 'Filmhouse Surulere', location: 'Lagos', address: 'Adeniran Ogunsanya Mall', status: 'active', chain: 'Filmhouse' },
      { name: 'Silverbird Galleria VI', location: 'Lagos', address: 'Ahmad Bello Way, Victoria Island', status: 'active', chain: 'Silverbird' },
      { name: 'Genesis Palms Lekki', location: 'Lagos', address: 'The Palms Mall, Lekki', status: 'active', chain: 'Genesis' }
    ]);

    // 5. Insert Films
    console.log('🎬 Inserting Films...');
    const { data: films } = await supabase.from('films').insert([
      { 
        title: 'Breath of Life', 
        synopsis: 'A story about a man who has lost his purpose in life until an encounter with a young man changes everything.', 
        release_date: '2023-12-15',
        runtime_minutes: 114,
        poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644ef7467?w=800',
        backdrop_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1200',
        status: 'announced',
        views: 850420
      },
      { 
        title: 'A Tribe Called Judah', 
        synopsis: 'A single mother and her five sons decide to rob a small mall to save their mother from a critical illness.', 
        release_date: '2023-12-16',
        runtime_minutes: 134,
        poster_url: 'https://images.unsplash.com/photo-1542204111-970c9a6a8d8e?w=800',
        backdrop_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200',
        status: 'announced',
        views: 1240500
      },
      { 
        title: 'Afamefuna: An Nwa Boi Story', 
        synopsis: 'A deep dive into the Igbo apprenticeship system through the eyes of a young boy finding his way in the world of business.', 
        release_date: '2023-12-01',
        runtime_minutes: 120,
        poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800',
        backdrop_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1200',
        status: 'announced',
        views: 450200
      }
    ]).select();

    const f = films.reduce((acc, curr) => ({ ...acc, [curr.title]: curr.id }), {});

    // 6. Insert Credits
    console.log('🎭 Inserting Credits...');
    await supabase.from('credits').insert([
      // Breath of Life
      { film_id: f['Breath of Life'], person_id: p['BB Sasore'], role: 'director', billing_order: 0 },
      { film_id: f['Breath of Life'], person_id: p['Wale Ojo'], role: 'actor', character_name: 'Timileyin', billing_order: 1 },
      
      // A Tribe Called Judah
      { film_id: f['A Tribe Called Judah'], person_id: p['Funke Akindele'], role: 'director', billing_order: 0 },
      { film_id: f['A Tribe Called Judah'], person_id: p['Funke Akindele'], role: 'actor', character_name: 'Jedidiah Judah', billing_order: 1 },
      { film_id: f['A Tribe Called Judah'], person_id: p['Timini Egbuson'], role: 'actor', character_name: 'Pere Judah', billing_order: 2 },
      
      // Afamefuna
      { film_id: f['Afamefuna: An Nwa Boi Story'], person_id: p['Kayode Kasum'], role: 'director', billing_order: 0 },
      { film_id: f['Afamefuna: An Nwa Boi Story'], person_id: p['Timini Egbuson'], role: 'actor', character_name: 'Paul', billing_order: 1 }
    ]);

    console.log('✅ Population complete! The industry looks real now.');
  } catch (err) {
    console.error('❌ Error during population:', err);
  }
}

populate();
