import { supabase } from './lib/db';

async function main() {
  const filmId = 'fccdd896-60dd-4e5b-9a71-66f78a8822ea';

  // 1. Create or upsert film Asarailu
  const asarailuAwards = [
    {
      organization: 'DIYMA',
      category: 'Best Director',
      title: 'Best Director - Distinct Indigenous Yoruba Movie Awards 2022',
      year: 2022,
      season: 2022,
      won: true,
      work: 'Asarailu',
      film_id: filmId,
      recipients: ['Paul Adeshina']
    },
    {
      organization: 'DIYMA',
      category: 'Best Actor',
      title: 'Best Actor - Distinct Indigenous Yoruba Movie Awards 2022',
      year: 2022,
      season: 2022,
      won: false,
      work: 'Asarailu',
      film_id: filmId,
      recipients: ['Akin Kolapo']
    },
    {
      organization: 'DIYMA',
      category: 'Best Cinematographer',
      title: 'Best Cinematographer - Distinct Indigenous Yoruba Movie Awards 2022',
      year: 2022,
      season: 2022,
      won: false,
      work: 'Asarailu',
      film_id: filmId,
      recipients: ['Sanjo Adegoke', 'Joy Ogunyemi', 'Lekan Bature']
    }
  ];

  const { data: createdFilm, error: filmErr } = await supabase
    .from('films')
    .upsert({
      id: filmId,
      title: 'Asarailu',
      slug: 'asarailu-2022',
      year: 2022,
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      genres: ['Drama', 'Indigenous'],
      synopsis: 'Asarailu is an acclaimed indigenous Yoruba feature drama directed by Paul Adeshina and recognized at the 2022 Distinct Indigenous Yoruba Movie Awards (DIYMA).',
      is_nollywood: true,
      status: 'released',
      awards: asarailuAwards
    })
    .select('id, title')
    .single();

  if (filmErr) {
    console.error('Error creating film Asarailu:', filmErr);
  } else {
    console.log('✅ Created / Upserted film Asarailu:', createdFilm);
  }

  // 2. Update Paul Adeshina's award
  const { data: person } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('id', 'dd3d6e35-e0ee-470f-940b-516dcd6d135a')
    .single();

  const updatedPersonAwards = (person.awards || []).map((a: any) => {
    if (a.organization === 'DIYMA' && Number(a.year) === 2022 && a.category === 'Best Director') {
      return {
        ...a,
        work: 'Asarailu',
        film_id: filmId,
        title: 'Asarailu'
      };
    }
    return a;
  });

  const { error: pErr } = await supabase
    .from('people')
    .update({ awards: updatedPersonAwards })
    .eq('id', person.id);

  if (pErr) {
    console.error('Error updating Paul Adeshina:', pErr);
  } else {
    console.log('✅ Updated Paul Adeshina with work: Asarailu and film_id:', filmId);
  }
}

main().catch(console.error);
