import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Films to check
const films = [
  'Nawi - Dear Future Me',
  'No Man of God',
  'Colors of Fire',
  'Ebinto',
  'Two',
  'One Woman One Bra',
  'Slum Bomber',
  'Son of the Soil',
  'Vibes - The Movie',
  'Somewhere Near Love',
  'The Creek',
  'Evi',
  'Safari',
  'Monica',
  'Heaven Must Wait',
  'Boda Love',
  'Black Pepper',
  'Amenfi',
  'Unvirtuous',
  'Nkinzi',
  'Adui',
  'Sika Fra Mogya',
  'Family Brouhaha',
  'Local Trouble',
  'Three for Trouble',
  'Dorathy',
  '1992',
  'The House That Never Sleeps',
  'Almost Forever',
  'Dictatrix',
  'Mfuko the Duffle Bag',
  'Jimbi',
  'Ashes of Accra',
  'Mama Nike: Queen of Adire',
  'Prisoner in My Mind',
  "We Won't Let You Poison Us",
  'The Journalist Who Never Came Home',
  'Shining a Light on Lupus',
  'Damalie',
  'House of Klu',
  'La Coach',
  'Hustle',
  'With You Every Moment',
  'Big Boys',
  'After the Ashes',
  'Tumi',
  'Lion Gwoza',
  'The Travails of Ajadi',
  "Selase's Adventure",
  'The Rusty Fish',
  'Lice and Shine',
  'Echoes from the Past',
  'Destination Ghana - PIM',
  "Don't Whistle at Night",
  'Dreaming of Serenada',
  'The Border',
  'Blind Pursuit',
  'Dhakira',
  'Anche Se L\'Odio',
  'Me, You and Luna',
  "A Mother's Bargain",
  'Trails of Olaide',
  'Echoes from Home',
  'Her Dark Past',
  'Rekiya',
  'Unfinished Ride',
  'Nzo',
  'Smokes and Mirrors',
  'Shadows of the Past',
  'Fiashidi',
  'Asanti Nyuki',
  'Forged Scrap',
  // 2025 winners & selections
  'Karamoja',
  'The Fisherman',
  '3 Cold Dishes',
  'Rise',
  'Ebu',
  'Beyond Olympic Glory',
  'My Mother is a Witch',
  'Last Stop',
  'The Guardians - The Chosen Ones'
];

// People to check
const people = [
  'Michelle Lemuya Ikeny',
  'Gadede Segbefia',
  'Jackline Nafula',
  'Uche Montana',
  'Armande Lo',
  'Osas Ighodaro',
  'Sarah Karei',
  'Ephriam Oka Kouakou',
  'Majid Michel',
  'Bucci Franklin',
  'Gideon Boakye',
  'Murunyu Duncan Mungai',
  'Fredrick Leonard',
  'Emmanuel Mugo',
  'Bamike Olawunmi',
  'Michelle Tiren',
  'Maud Guerard',
  'Dela Seade',
  'Adjetey Anang',
  'Uzor Arukwe',
  'Samuel Kabugo',
  'Kelechi Udegbe',
  'Ochungo Obiero',
  'Senanu Gbedawo',
  'Gbubemi Ejeye',
  'Evangelista Adjei',
  'Larabie Dimzoure',
  'Simon Peter Walusimbi',
  'Lubowa Mayra Ariana',
  'Maureen Mona Jolly',
  'Nana Kofi Asihene',
  'Luc Gnepa',
  'Ampong Kwaku Kwakye',
  'Vincho Nchogu',
  'Chee Keong Cheung',
  'Nicholas Nartey',
  'Gbolahan Gafar',
  'Barnabas Emordi',
  'Toka McBaror',
  'Suuna Abubakar',
  'Andrew Ahuurra',
  'Nanfuka Rehema',
  'Musa Luswata',
  'Micheal Wawuyo Snr',
  'Ricky Adelayitar',
  'Clemento Suarez',
  'Fatou Toure',
  'Mercy Aigbe',
  'Alakpa Uduoghene',
  'Asurf Oluseyi',
  'Sikhanyiso Ngwenya',
  'Jasmin Way',
  'Joan Nantege'
];

async function testMatch() {
  console.log('Testing film matches...');
  let filmsMatched = 0;
  for (const f of films) {
    const { data } = await supabase.from('films').select('id, title, year').ilike('title', f).limit(1);
    if (data && data.length > 0) {
      console.log(`  ✓ FILM MATCH: "${f}" -> [${data[0].id}] "${data[0].title}" (${data[0].year})`);
      filmsMatched++;
    }
  }
  console.log(`Total films matched: ${filmsMatched} / ${films.length}`);

  console.log('\nTesting people matches...');
  let peopleMatched = 0;
  for (const p of people) {
    const { data } = await supabase.from('people').select('id, name').ilike('name', `%${p}%`).limit(1);
    if (data && data.length > 0) {
      console.log(`  ✓ PERSON MATCH: "${p}" -> [${data[0].id}] "${data[0].name}"`);
      peopleMatched++;
    }
  }
  console.log(`Total people matched: ${peopleMatched} / ${people.length}`);
}

testMatch().catch(console.error);
