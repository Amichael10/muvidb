const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function populate() {
  console.log('🚀 Starting Real Data Population...');

  const clearTable = async (name) => {
    const { error } = await supabase.from(name).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.error(`❌ Clear error [${name}]:`, error.message);
    else console.log(`🧹 Cleared [${name}]`);
  };

  try {
    await clearTable('showtimes');
    await clearTable('credits');
    await clearTable('films');
    await clearTable('cinemas');
    await clearTable('people');
    await clearTable('companies');

    console.log('🏢 Inserting Companies...');
    const { data: cos, error: cosErr } = await supabase.from('companies').insert([
      { name: 'FilmOne Entertainment', headquarters: 'Lagos, Nigeria', website: 'https://filmhouseng.com' },
      { name: 'EbonyLife Media', headquarters: 'Lagos, Nigeria', website: 'https://ebonylifemedia.com' },
      { name: 'Inkblot Productions', headquarters: 'Lagos, Nigeria', website: 'https://inkblotpresents.com' }
    ]).select();
    if (cosErr) console.error('❌ Company Error:', cosErr);

    console.log('👥 Inserting People...');
    const { data: people, error: pErr } = await supabase.from('people').insert([
      { name: 'Funke Akindele', photo_url: 'https://images.unsplash.com/photo-1531123897727-8f129e16fd3c?w=400&h=400&fit=crop', bio: 'Nollywood superstar, director, and producer.', nationality: 'Nigerian' },
      { name: 'Wale Ojo', photo_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop', bio: 'AMVCA award-winning actor.', nationality: 'Nigerian' }
    ]).select();
    if (pErr) console.error('❌ People Error:', pErr);

    console.log('🍿 Inserting Cinemas...');
    const { data: cins, error: cinErr } = await supabase.from('cinemas').insert([
      { name: 'Filmhouse IMAX Lekki', location: 'Lagos', address: 'Rock Drive, Lekki Phase 1', status: 'active', chain: 'Filmhouse' }
    ]).select();
    if (cinErr) console.error('❌ Cinema Error:', cinErr);

    console.log('🎬 Inserting Films...');
    const { data: films, error: fErr } = await supabase.from('films').insert([
      { 
        title: 'Breath of Life', 
        synopsis: 'A story about a man...', 
        release_date: '2023-12-15',
        runtime_minutes: 114,
        poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644ef7467?w=800',
        backdrop_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1200',
        status: 'announced'
      }
    ]).select();
    if (fErr) console.error('❌ Film Error:', fErr);
    else console.log('✅ Films inserted:', films?.length);

    console.log('✅ Finalizing...');
  } catch (err) {
    console.error('❌ Major Crash:', err);
  }
}

populate();
