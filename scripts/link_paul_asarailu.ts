import { supabase } from './lib/db';

async function main() {
  const { data: films } = await supabase
    .from('films')
    .select('id, title, year, awards')
    .ilike('title', '%Asarailu%');

  console.log('Asarailu search:', films);

  if (films && films.length > 0) {
    const film = films[0];
    console.log('Found film:', film.id, film.title);

    // 1. Update Paul Adeshina
    const { data: person } = await supabase
      .from('people')
      .select('id, name, awards')
      .eq('id', 'dd3d6e35-e0ee-470f-940b-516dcd6d135a')
      .single();

    const updatedPersonAwards = (person.awards || []).map((a: any) => {
      if (a.organization === 'DIYMA' && Number(a.year) === 2022 && a.category === 'Best Director') {
        return {
          ...a,
          work: film.title,
          film_id: film.id
        };
      }
      return a;
    });

    await supabase
      .from('people')
      .update({ awards: updatedPersonAwards })
      .eq('id', person.id);

    // 2. Update Film awards
    const filmAwards = Array.isArray(film.awards) ? [...film.awards] : [];
    const exists = filmAwards.some((a: any) => 
      a.organization === 'DIYMA' && Number(a.year) === 2022 && a.category === 'Best Director'
    );

    if (!exists) {
      filmAwards.push({
        organization: 'DIYMA',
        category: 'Best Director',
        title: 'Best Director - Distinct Indigenous Yoruba Movie Awards 2022',
        year: 2022,
        season: 2022,
        won: true,
        work: film.title,
        film_id: film.id,
        recipients: ['Paul Adeshina']
      });

      await supabase
        .from('films')
        .update({ awards: filmAwards })
        .eq('id', film.id);
    }

    console.log('✅ Updated both Paul Adeshina and Asarailu with film_id', film.id);
  } else {
    console.log('Film Asarailu not found by ilike!');
  }
}

main().catch(console.error);
