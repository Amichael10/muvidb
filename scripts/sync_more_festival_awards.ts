import { supabase } from './lib/db';

async function syncMoreFestivalAwards() {
  console.log('🎬 Syncing additional verified festival awards...\n');

  // 1. Sadiq Sani Sadiq (KILAF 2018 Best Actor)
  const { data: sadiq } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('id', 'c9380110-e716-4691-9332-f9f8d3cb599e')
    .single();

  if (sadiq) {
    const awards = Array.isArray(sadiq.awards) ? [...sadiq.awards] : [];
    if (!awards.some((a: any) => a.organization === 'KILAF' && a.year === 2018)) {
      awards.push({
        organization: 'KILAF',
        category: 'Best Actor',
        title: 'Best Actor - KILAF 2018 (Maiden Edition)',
        year: 2018,
        season: 2018,
        won: true,
        work: 'Ruwan Dare',
      });
      await supabase.from('people').update({ awards }).eq('id', sadiq.id);
      console.log('✅ Added KILAF 2018 Best Actor to Sadiq Sani Sadiq');
    }
  }

  // 2. Hilda Dokubo (AIFF 2015 Outstanding Female Act)
  const { data: hilda } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('id', 'f5cfe36e-ce44-4f67-95ae-5a5b552c08cd')
    .single();

  if (hilda) {
    const awards = Array.isArray(hilda.awards) ? [...hilda.awards] : [];
    if (!awards.some((a: any) => a.organization === 'AIFF' && a.year === 2015)) {
      awards.push({
        organization: 'AIFF',
        category: 'Outstanding Female Act',
        title: 'Most Outstanding Female Act (12th AIFF)',
        year: 2015,
        season: 2015,
        won: true,
        work: 'Stigma',
        film_id: 'e81d9f14-ddfd-432a-960d-943ddf9a1a67',
      });
      await supabase.from('people').update({ awards }).eq('id', hilda.id);
      console.log('✅ Added AIFF 2015 Outstanding Female Act to Hilda Dokubo');
    }
  }

  // 3. Stigma (AIFF 2015)
  const { data: stigma } = await supabase
    .from('films')
    .select('id, title, awards')
    .eq('id', 'e81d9f14-ddfd-432a-960d-943ddf9a1a67')
    .single();

  if (stigma) {
    const awards = Array.isArray(stigma.awards) ? [...stigma.awards] : [];
    if (!awards.some((a: any) => a.organization === 'AIFF' && a.year === 2015)) {
      awards.push({
        organization: 'AIFF',
        category: 'Outstanding Female Act',
        title: 'Most Outstanding Female Act - 12th AIFF',
        year: 2015,
        season: 2015,
        won: true,
        recipients: ['Hilda Dokubo'],
      });
      await supabase.from('films').update({ awards }).eq('id', stigma.id);
      console.log('✅ Added AIFF 2015 award to film Stigma');
    }
  }

  // 4. Dimbo Atiya (AIFF 2020 Outstanding Directing)
  const { data: dimbo } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('id', 'c51fb4f6-37a0-4e3a-9289-9085d3faf33d')
    .single();

  if (dimbo) {
    const awards = Array.isArray(dimbo.awards) ? [...dimbo.awards] : [];
    if (!awards.some((a: any) => a.organization === 'AIFF' && a.year === 2020)) {
      awards.push({
        organization: 'AIFF',
        category: 'Outstanding Directing',
        title: 'Outstanding Directing (17th AIFF)',
        year: 2020,
        season: 2020,
        won: true,
        work: 'Drawing Strength',
        film_id: '765c55b0-7e27-44df-90d7-b54d53726afe',
      });
      await supabase.from('people').update({ awards }).eq('id', dimbo.id);
      console.log('✅ Added AIFF 2020 Outstanding Directing to Dimbo Atiya');
    }
  }

  // 5. Drawing Strength (AIFF 2020)
  const { data: drawing } = await supabase
    .from('films')
    .select('id, title, awards')
    .eq('id', '765c55b0-7e27-44df-90d7-b54d53726afe')
    .single();

  if (drawing) {
    const awards = Array.isArray(drawing.awards) ? [...drawing.awards] : [];
    if (!awards.some((a: any) => a.organization === 'AIFF' && a.year === 2020)) {
      awards.push(
        {
          organization: 'AIFF',
          category: 'Golden Jury Award',
          title: 'Golden Jury Award - 17th AIFF',
          year: 2020,
          season: 2020,
          won: true,
          recipients: ['Drawing Strength'],
        },
        {
          organization: 'AIFF',
          category: 'Outstanding Nigerian Film',
          title: 'Outstanding Nigerian Film - 17th AIFF',
          year: 2020,
          season: 2020,
          won: true,
          recipients: ['Drawing Strength'],
        },
        {
          organization: 'AIFF',
          category: 'Outstanding Directing',
          title: 'Outstanding Directing - 17th AIFF',
          year: 2020,
          season: 2020,
          won: true,
          recipients: ['Dimbo Atiya'],
        }
      );
      await supabase.from('films').update({ awards }).eq('id', drawing.id);
      console.log('✅ Added AIFF 2020 awards to Drawing Strength');
    }
  }

  console.log('\n✨ Additional festival awards synced successfully!');
}

syncMoreFestivalAwards().catch(console.error);
