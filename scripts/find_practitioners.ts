import { supabase } from './lib/db';

async function findPractitionerIds() {
  const names = [
    'Chief Hubert Ogunde',
    'Olu Jacobs',
    'Joke Silva',
    'Pete Edochie',
    'Wole Soyinka',
    'Ola Rotimi',
    'Bolanle Austen-Peters',
    'Taiwo Ajai-Lycett',
    'Adebayo Salami',
    'Richard Mofe-Damijo',
    'Bimbo Manuel',
    'Norbert Young',
    'Femi Osofisan',
    'J.P. Clark',
    'Chinua Achebe',
    'Wale Ogunyemi'
  ];

  for (const name of names) {
    const { data } = await supabase.from('people').select('id, name, slug').ilike('name', `%${name}%`).limit(3);
    console.log(`=== ${name} ===`, data);
  }
}

findPractitionerIds().catch(console.error);
