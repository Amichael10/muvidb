import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface NomineeItem {
  year: number;
  season: number;
  category: string;
  film: string;
  country?: string;
  people?: string[];
  role?: string;
  dept?: string;
  won: boolean;
}

const REFFA_DATA: NomineeItem[] = [
  // ================= 2025 WINNERS =================
  {
    year: 2025,
    season: 2025,
    category: 'Best African Language Film',
    film: 'Karamoja',
    country: 'Uganda',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Actor in a Supporting Role',
    film: 'The Fisherman',
    people: ['Ricky Adelayitar'],
    role: 'actor',
    dept: 'Acting',
    country: 'Ghana',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Actor in a Supporting Role',
    film: 'Last Stop',
    people: ['Clemento Suarez'],
    role: 'actor',
    dept: 'Acting',
    country: 'Ghana',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Actress in a Leading Role',
    film: '3 Cold Dishes',
    people: ['Fatou Toure', 'Osas Ighodaro', 'Maud Guerard'],
    role: 'actress',
    dept: 'Acting',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Short Film',
    film: 'Rise',
    country: 'Zimbabwe',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Student Film',
    film: 'Ebu',
    country: 'Ghana',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Documentary',
    film: 'Beyond Olympic Glory',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Visual Effects',
    film: 'The Fisherman',
    people: ['Darie Amai Shelton', 'Nurudeen Tahiru'],
    role: 'vfx_artist',
    dept: 'Visual Effects',
    country: 'Ghana',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Most Promising Actor',
    film: '3 Cold Dishes',
    people: ['Maud Guerard'],
    role: 'actress',
    dept: 'Acting',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Actress in a Supporting Role',
    film: 'My Mother is a Witch',
    people: ['Mercy Aigbe'],
    role: 'actress',
    dept: 'Acting',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Make-Up',
    film: 'My Mother is a Witch',
    people: ['Alakpa Uduoghene'],
    role: 'makeup_artist',
    dept: 'Costume & Make-Up',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Sound',
    film: '3 Cold Dishes',
    people: ['Andrew Ahuurra'],
    role: 'sound_designer',
    dept: 'Sound',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Ghanaian Film',
    film: 'The Fisherman',
    country: 'Ghana',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Cinematography',
    film: '3 Cold Dishes',
    people: ['KC Obiajulu'],
    role: 'cinematographer',
    dept: 'Camera',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Screenplay',
    film: 'My Mother is a Witch',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Production Design',
    film: '3 Cold Dishes',
    people: ['Asurf Oluseyi'],
    role: 'production_designer',
    dept: 'Art',
    country: 'Nigeria',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Child Actor',
    film: 'Rise',
    people: ['Sikhanyiso Ngwenya'],
    role: 'actor',
    dept: 'Acting',
    country: 'Zimbabwe',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Editing',
    film: 'The Fisherman',
    people: ['Jasmin Way'],
    role: 'editor',
    dept: 'Editing',
    country: 'Ghana',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Achievement in Costume Design',
    film: 'Karamoja',
    people: ['Joan Nantege'],
    role: 'costume_designer',
    dept: 'Costume & Make-Up',
    country: 'Uganda',
    won: true
  },
  {
    year: 2025,
    season: 2025,
    category: 'Best Animation',
    film: 'The Guardians - The Chosen Ones',
    country: 'Ghana',
    won: true
  },

  // ================= 2026 NOMINEES =================
  // Best Picture
  { year: 2026, season: 2026, category: 'Best Picture', film: 'Nawi - Dear Future Me', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Picture', film: 'No Man of God', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Picture', film: 'Colors of Fire', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Picture', film: 'Ebinto', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best Picture', film: 'Two', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Picture', film: 'One Woman One Bra', country: 'Kenya, Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Picture', film: 'Slum Bomber', country: 'Uganda', won: false },

  // Best Director
  { year: 2026, season: 2026, category: 'Best Director', film: 'Nawi - Dear Future Me', people: ['Vallentine Chelluget', 'Apuu Mourine', 'Kevin Schmutzler', 'Tobias Schmutzler'], role: 'director', dept: 'Directing', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Director', film: 'Ebinto', people: ['Luc Gnepa'], role: 'director', dept: 'Directing', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best Director', film: 'No Man of God', people: ['Ampong Kwaku Kwakye'], role: 'director', dept: 'Directing', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Director', film: 'Slum Bomber', people: ['Maureen Mona Jolly'], role: 'director', dept: 'Directing', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Director', film: 'One Woman One Bra', people: ['Vincho Nchogu'], role: 'director', dept: 'Directing', country: 'Kenya, Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Director', film: 'Son of the Soil', people: ['Chee Keong Cheung'], role: 'director', dept: 'Directing', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Director', film: 'Two', people: ['Nana Kofi Asihene'], role: 'director', dept: 'Directing', country: 'Ghana', won: false },

  // Best Debut Film
  { year: 2026, season: 2026, category: 'Best Debut Film', film: 'Ebinto', people: ['Luc Gnepa'], role: 'director', dept: 'Directing', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best Debut Film', film: 'Two', people: ['Nana Kofi Asihene'], role: 'director', dept: 'Directing', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Debut Film', film: 'Vibes - The Movie', people: ['Nicholas Nartey'], role: 'director', dept: 'Directing', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Debut Film', film: 'One Woman One Bra', people: ['Vincho Nchogu'], role: 'director', dept: 'Directing', country: 'Kenya, Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Debut Film', film: 'Slum Bomber', people: ['Maureen Mona Jolly'], role: 'director', dept: 'Directing', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Debut Film', film: 'Somewhere Near Love', people: ['Gbolahan Gafar'], role: 'director', dept: 'Directing', country: 'Nigeria', won: false },

  // Best Actor (Female)
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'Nawi - Dear Future Me', people: ['Michelle Lemuya Ikeny'], role: 'actress', dept: 'Acting', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'No Man of God', people: ['Gadede Segbefia'], role: 'actress', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'Slum Bomber', people: ['Jackline Nafula'], role: 'actress', dept: 'Acting', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'Monica', people: ['Uche Montana'], role: 'actress', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'Ebinto', people: ['Armande Lo'], role: 'actress', dept: 'Acting', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'Safari', people: ['Osas Ighodaro'], role: 'actress', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Female)', film: 'One Woman One Bra', people: ['Sarah Karei'], role: 'actress', dept: 'Acting', country: 'Kenya, Nigeria', won: false },

  // Best Actor (Male)
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'Ebinto', people: ['Ephriam Oka Kouakou'], role: 'actor', dept: 'Acting', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'No Man of God', people: ['Majid Michel'], role: 'actor', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'The Creek', people: ['Bucci Franklin'], role: 'actor', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'Two', people: ['Gideon Boakye'], role: 'actor', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'Boda Love', people: ['Murunyu Duncan Mungai'], role: 'actor', dept: 'Acting', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'Heaven Must Wait', people: ['Fredrick Leonard'], role: 'actor', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Actor (Male)', film: 'Safari', people: ['Emmanuel Mugo'], role: 'actor', dept: 'Acting', country: 'Nigeria', won: false },

  // Best Supporting Actor (Female)
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Female)', film: 'No Man of God', people: ['Bamike Olawunmi'], role: 'actress', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Female)', film: 'Nawi - Dear Future Me', people: ['Michelle Tiren'], role: 'actress', dept: 'Acting', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Female)', film: 'Ebinto', people: ['Maud Guerard'], role: 'actress', dept: 'Acting', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Female)', film: 'Two', people: ['Dela Seade'], role: 'actress', dept: 'Acting', country: 'Ghana', won: false },

  // Best Supporting Actor (Male)
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Male)', film: 'No Man of God', people: ['Adjetey Anang'], role: 'actor', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Male)', film: 'Evi', people: ['Uzor Arukwe'], role: 'actor', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Male)', film: 'Slum Bomber', people: ['Samuel Kabugo'], role: 'actor', dept: 'Acting', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Male)', film: 'The Creek', people: ['Kelechi Udegbe'], role: 'actor', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Male)', film: 'Nawi - Dear Future Me', people: ['Ochungo Obiero'], role: 'actor', dept: 'Acting', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Supporting Actor (Male)', film: 'Two', people: ['Senanu Gbedawo'], role: 'actor', dept: 'Acting', country: 'Ghana', won: false },

  // Most Promising Actor
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'Slum Bomber', people: ['Jackline Nafula'], role: 'actress', dept: 'Acting', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'No Man of God', people: ['Gadede Segbefia'], role: 'actress', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'Black Pepper', people: ['Gbubemi Ejeye'], role: 'actor', dept: 'Acting', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'Nawi - Dear Future Me', people: ['Michelle Lemuya Ikeny'], role: 'actress', dept: 'Acting', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'Amenfi', people: ['Evangelista Adjei'], role: 'actor', dept: 'Acting', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'Unvirtuous', people: ['Larabie Dimzoure'], role: 'actor', dept: 'Acting', country: 'Burkina Faso', won: false },
  { year: 2026, season: 2026, category: 'Most Promising Actor', film: 'Nkinzi', people: ['Simon Peter Walusimbi'], role: 'actor', dept: 'Acting', country: 'Uganda', won: false },

  // Best Child Actor
  { year: 2026, season: 2026, category: 'Best Child Actor', film: 'Nkinzi', people: ['Lubowa Mayra Ariana'], role: 'actor', dept: 'Acting', country: 'Uganda', won: false },

  // Achievement in Screenplay
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'Nawi - Dear Future Me', people: ['Kevin Schmutzler', 'Tobias Schmutzler'], role: 'writer', dept: 'Writing', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'No Man of God', people: ['Ampong Kwaku Kwakye'], role: 'writer', dept: 'Writing', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'Ebinto', people: ['Armand Gauz'], role: 'writer', dept: 'Writing', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'Unvirtuous', people: ['Chloé Aïcha Boro'], role: 'writer', dept: 'Writing', country: 'Burkina Faso', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'Slum Bomber', people: ['Nanfuka Rehema', 'Musa Luswata'], role: 'writer', dept: 'Writing', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'Boda Love', people: ['Grace Irungu', 'Janet Wells'], role: 'writer', dept: 'Writing', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Screenplay', film: 'One Woman One Bra', people: ['Vincho Nchogu'], role: 'writer', dept: 'Writing', country: 'Kenya, Nigeria', won: false },

  // Achievement in Cinematography
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'Nawi - Dear Future Me', people: ['Klaus Kneist', 'Mwende Renata'], role: 'cinematographer', dept: 'Camera', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'Two', people: ['John Kwame Markin'], role: 'cinematographer', dept: 'Camera', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'No Man of God', people: ['Kelly Doe', 'Eric Oppong Appiah'], role: 'cinematographer', dept: 'Camera', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'Colors of Fire', people: ['Barnabas Emordi'], role: 'cinematographer', dept: 'Camera', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'The Creek', people: ['Tolu Timilehin'], role: 'cinematographer', dept: 'Camera', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'Ebinto', people: ['Mandione Laye Ka', 'Moussa Diallo', 'Elie Josue Dabire'], role: 'cinematographer', dept: 'Camera', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Achievement in Cinematography', film: 'Evi', people: ['Barnabas Emordi'], role: 'cinematographer', dept: 'Camera', country: 'Nigeria', won: false },

  // Achievement in Editing
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'Nawi - Dear Future Me', people: ['Tobias Schmutzler'], role: 'editor', dept: 'Editing', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'Colors of Fire', people: ['Dolapo Adigun'], role: 'editor', dept: 'Editing', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'Son of the Soil', people: ['Alistair Cave'], role: 'editor', dept: 'Editing', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'Ebinto', people: ['Penda Ndiaye'], role: 'editor', dept: 'Editing', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'The Creek', people: ['Toka McBaror'], role: 'editor', dept: 'Editing', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'Two', people: ['Majeed Abdul Mohammed'], role: 'editor', dept: 'Editing', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Editing', film: 'No Man of God', people: ['Magdalene Morton'], role: 'editor', dept: 'Editing', country: 'Ghana', won: false },

  // Achievement in Casting
  { year: 2026, season: 2026, category: 'Achievement in Casting', film: 'Nawi - Dear Future Me', people: ['Roman Pogorzelski'], role: 'casting_director', dept: 'Production', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Casting', film: 'Two', people: ['Nana Gyasi Owusu', 'Richmond Ofori'], role: 'casting_director', dept: 'Production', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Casting', film: 'No Man of God', people: ['Ampong Kwaku Kwakye'], role: 'casting_director', dept: 'Production', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Casting', film: 'Slum Bomber', people: ['Maureen Mona Jolly'], role: 'casting_director', dept: 'Production', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Casting', film: 'Boda Love', people: ['Florence Nduta'], role: 'casting_director', dept: 'Production', country: 'Kenya', won: false },

  // Achievement in Production Design
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'Slum Bomber', people: ['Suuna Abubakar'], role: 'production_designer', dept: 'Art', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'Amenfi', people: ['Emanuel Owusu Sarpong'], role: 'production_designer', dept: 'Art', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'Nawi - Dear Future Me', people: ['Erixon Kangethe'], role: 'production_designer', dept: 'Art', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'Ebinto', people: ['Franck-Lionel Groude'], role: 'production_designer', dept: 'Art', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'The Creek', people: ['Toka McBaror'], role: 'production_designer', dept: 'Art', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'Two', people: ['Nana Kofi Asihene'], role: 'production_designer', dept: 'Art', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Production Design', film: 'Colors of Fire', people: ['Ayanmo Yakub'], role: 'production_designer', dept: 'Art', country: 'Nigeria', won: false },

  // Achievement in Costume Design
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'Colors of Fire', people: ['Valerie Okeke'], role: 'costume_designer', dept: 'Costume & Make-Up', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'Ebinto', people: ['Emma Gaho'], role: 'costume_designer', dept: 'Costume & Make-Up', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'Two', people: ['Aphua Larbi-Amoah'], role: 'costume_designer', dept: 'Costume & Make-Up', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'One Woman One Bra', people: ['Vincho Nchogu', 'Fatuo Hassan', 'Neema Mbeti Ithea'], role: 'costume_designer', dept: 'Costume & Make-Up', country: 'Kenya, Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'Amenfi', people: ['Lucy Opoku'], role: 'costume_designer', dept: 'Costume & Make-Up', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'Nawi - Dear Future Me', people: ['Vivian Njeri Kimotho'], role: 'costume_designer', dept: 'Costume & Make-Up', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Costume Design', film: 'Evi', people: ['Kingsley Okoye Rex'], role: 'costume_designer', dept: 'Costume & Make-Up', country: 'Nigeria', won: false },

  // Achievement in Hair & Make-Up
  { year: 2026, season: 2026, category: 'Achievement in Hair & Make-Up', film: 'Evi', people: ['Tolu Obadipe', 'Carina Ojoko'], role: 'makeup_artist', dept: 'Costume & Make-Up', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Hair & Make-Up', film: 'Colors of Fire', people: ['Alakpa Uduoghene'], role: 'makeup_artist', dept: 'Costume & Make-Up', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Hair & Make-Up', film: 'Ebinto', people: ['Madjeneba Diomande', 'Elvine Nandoh'], role: 'makeup_artist', dept: 'Costume & Make-Up', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Achievement in Hair & Make-Up', film: 'Amenfi', people: ['Frederick Boateng'], role: 'makeup_artist', dept: 'Costume & Make-Up', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Hair & Make-Up', film: 'Adui', people: ['Micheal Wawuyo Snr'], role: 'makeup_artist', dept: 'Costume & Make-Up', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Hair & Make-Up', film: 'Heaven Must Wait', people: ['Maureen Ifezue'], role: 'makeup_artist', dept: 'Costume & Make-Up', country: 'Nigeria', won: false },

  // Achievement in Soundtrack
  { year: 2026, season: 2026, category: 'Achievement in Soundtrack', film: 'Nawi - Dear Future Me', people: ['Apuu Mourine', 'Amadeus Indetzki'], role: 'composer', dept: 'Sound', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Soundtrack', film: 'Colors of Fire', people: ['Gbenga Akinnola'], role: 'composer', dept: 'Sound', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Soundtrack', film: 'Evi', people: ['Tolu Obanro'], role: 'composer', dept: 'Sound', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Soundtrack', film: 'Vibes - The Movie', people: ['Nicholas Nartey'], role: 'composer', dept: 'Sound', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Soundtrack', film: 'No Man of God', people: ['Tito Marshall Gomez'], role: 'composer', dept: 'Sound', country: 'Ghana', won: false },

  // Achievement in Sound
  { year: 2026, season: 2026, category: 'Achievement in Sound', film: 'Slum Bomber', people: ['Andrew Ahuurra'], role: 'sound_designer', dept: 'Sound', country: 'Uganda', won: false },

  // Achievement in Visual Effects
  { year: 2026, season: 2026, category: 'Achievement in Visual Effects', film: 'The Creek', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Visual Effects', film: 'No Man of God', people: ['Peter Kojo Sampah'], role: 'vfx_artist', dept: 'Visual Effects', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Visual Effects', film: 'Black Pepper', people: ['Banjo Ayodele'], role: 'vfx_artist', dept: 'Visual Effects', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Visual Effects', film: 'Colors of Fire', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Achievement in Visual Effects', film: 'Son of the Soil', people: ['Steve Askey'], role: 'vfx_artist', dept: 'Visual Effects', country: 'Nigeria', won: false },

  // Best Indigenous Language Film
  { year: 2026, season: 2026, category: 'Best Indigenous Language Film', film: 'Amenfi', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Indigenous Language Film', film: 'Adui', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Indigenous Language Film', film: 'Nawi - Dear Future Me', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Indigenous Language Film', film: 'One Woman One Bra', country: 'Kenya, Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Indigenous Language Film', film: 'Sika Fra Mogya', country: 'Ghana', won: false },

  // Best Ghanaian Film
  { year: 2026, season: 2026, category: 'Best Ghanaian Film', film: 'No Man of God', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Ghanaian Film', film: 'Two', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Ghanaian Film', film: 'Amenfi', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Ghanaian Film', film: 'Vibes - The Movie', country: 'Ghana', won: false },

  // Best Comedy Film
  { year: 2026, season: 2026, category: 'Best Comedy Film', film: 'Vibes - The Movie', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Comedy Film', film: 'Family Brouhaha', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Comedy Film', film: 'Local Trouble', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Comedy Film', film: 'Boda Love', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Comedy Film', film: 'Three for Trouble', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Comedy Film', film: 'Dorathy', country: 'Nigeria', won: false },

  // Best Short Film
  { year: 2026, season: 2026, category: 'Best Short Film', film: '1992', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Short Film', film: 'The House That Never Sleeps', country: 'South Africa', won: false },
  { year: 2026, season: 2026, category: 'Best Short Film', film: 'Almost Forever', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Short Film', film: 'Dictatrix', country: 'Ghana, United States', won: false },
  { year: 2026, season: 2026, category: 'Best Short Film', film: 'Mfuko the Duffle Bag', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Short Film', film: 'Jimbi', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best Short Film', film: 'Ashes of Accra', country: 'Ghana', won: false },

  // Best Documentary
  { year: 2026, season: 2026, category: 'Best Documentary', film: 'Mama Nike: Queen of Adire', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Documentary', film: 'Prisoner in My Mind', country: 'South Africa', won: false },
  { year: 2026, season: 2026, category: 'Best Documentary', film: "We Won't Let You Poison Us", country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Documentary', film: 'The Journalist Who Never Came Home', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Documentary', film: 'Shining a Light on Lupus', country: 'Uganda', won: false },

  // Best TV Series
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'Damalie', country: 'Uganda', won: false },
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'House of Klu', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'La Coach', country: "Côte d'Ivoire", won: false },
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'Hustle', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'With You Every Moment', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'Big Boys', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best TV Series', film: 'After the Ashes', country: 'Uganda', won: false },

  // Best Animation
  { year: 2026, season: 2026, category: 'Best Animation', film: 'Tumi', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Animation', film: 'Lion Gwoza', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Animation', film: 'The Travails of Ajadi', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Animation', film: "Selase's Adventure", country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Animation', film: 'The Rusty Fish', country: 'Iran', won: false },
  { year: 2026, season: 2026, category: 'Best Animation', film: 'Lice and Shine', country: 'Uganda', won: false },

  // Best Diasporan Film
  { year: 2026, season: 2026, category: 'Best Diasporan Film', film: 'Echoes from the Past', country: 'United Kingdom', won: false },
  { year: 2026, season: 2026, category: 'Best Diasporan Film', film: 'Dictatrix', country: 'United States', won: false },
  { year: 2026, season: 2026, category: 'Best Diasporan Film', film: 'Destination Ghana - PIM', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Diasporan Film', film: "Don't Whistle at Night", country: 'Belgium', won: false },
  { year: 2026, season: 2026, category: 'Best Diasporan Film', film: 'Dreaming of Serenada', country: 'Denmark', won: false },

  // Best International Film
  { year: 2026, season: 2026, category: 'Best International Film', film: 'The Border', country: 'Italy', won: false },
  { year: 2026, season: 2026, category: 'Best International Film', film: 'Blind Pursuit', country: 'United States', won: false },
  { year: 2026, season: 2026, category: 'Best International Film', film: 'Dhakira', country: 'France', won: false },
  { year: 2026, season: 2026, category: 'Best International Film', film: 'Anche Se L\'Odio', country: 'Italy', won: false },

  // Best YouTube / Web Film
  { year: 2026, season: 2026, category: 'Best YouTube / Web Film', film: 'Monica', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best YouTube / Web Film', film: 'Me, You and Luna', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best YouTube / Web Film', film: 'Local Trouble', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best YouTube / Web Film', film: "A Mother's Bargain", country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best YouTube / Web Film', film: 'Heaven Must Wait', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best YouTube / Web Film', film: 'Trails of Olaide', country: 'Nigeria', won: false },

  // Student Film categories
  { year: 2026, season: 2026, category: 'Best Student Short Film', film: 'Echoes from Home', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Student Short Film', film: 'Her Dark Past', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Student Short Film', film: 'Rekiya', country: 'Nigeria', won: false },
  { year: 2026, season: 2026, category: 'Best Student Short Film', film: 'Blind Pursuit', country: 'United States', won: false },
  { year: 2026, season: 2026, category: 'Best Student Short Film', film: 'Unfinished Ride', people: ['Emmanuel Kwaku Dosoo'], role: 'director', dept: 'Directing', country: 'Ghana', won: false },

  { year: 2026, season: 2026, category: 'Best Student Animation', film: 'Nzo', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Student Animation', film: 'Smokes and Mirrors', country: 'Ghana', won: false },

  { year: 2026, season: 2026, category: 'Best Student Documentary', film: 'Shadows of the Past', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Student Documentary', film: 'Fiashidi', country: 'Ghana', won: false },
  { year: 2026, season: 2026, category: 'Best Student Documentary', film: 'Asanti Nyuki', country: 'Kenya', won: false },
  { year: 2026, season: 2026, category: 'Best Student Documentary', film: 'Forged Scrap', country: 'Ghana', won: false }
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function findOrCreateFilm(title: string, country?: string, year?: number) {
  const cleanTitle = title.trim();
  // 1. Try finding existing film
  const { data: existing } = await supabase
    .from('films')
    .select('id, title, awards, year')
    .ilike('title', cleanTitle)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // 2. Try without parentheses
  const noParens = cleanTitle.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (noParens && noParens !== cleanTitle) {
    const { data: noParenMatch } = await supabase
      .from('films')
      .select('id, title, awards, year')
      .ilike('title', noParens)
      .limit(1)
      .maybeSingle();
    if (noParenMatch) return noParenMatch;
  }

  // 3. Create missing film cleanly
  const baseSlug = slugify(cleanTitle);
  let slug = baseSlug;
  const { data: slugCheck } = await supabase.from('films').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    slug = `${baseSlug}-${year || 2026}`;
  }

  const newFilm = {
    title: cleanTitle,
    slug,
    year: year || 2026,
    source: 'REFFA',
    status: 'released',
    awards: []
  };

  const { data: created, error } = await supabase
    .from('films')
    .insert(newFilm)
    .select('id, title, awards, year')
    .single();

  if (error) {
    console.warn(`  ⚠️ Could not insert film "${cleanTitle}":`, error.message);
    return null;
  }
  console.log(`  ✨ Created new film row: "${cleanTitle}" [${created.id}]`);
  return created;
}

async function findOrCreatePerson(name: string, role?: string, dept?: string) {
  const cleanName = name.trim();
  // 1. Check exact / ilike
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, awards')
    .ilike('name', cleanName)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // 2. Check RPC helper if available
  try {
    const { data: rpcId } = await supabase.rpc('find_person_by_name', { p_name: cleanName });
    if (rpcId) {
      const { data: p } = await supabase.from('people').select('id, name, awards').eq('id', rpcId).single();
      if (p) return p;
    }
  } catch {}

  // 3. Create missing person cleanly
  const baseSlug = slugify(cleanName);
  let slug = baseSlug;
  const { data: slugCheck } = await supabase.from('people').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    slug = `${baseSlug}-${Math.floor(Math.random() * 8999 + 1000)}`;
  }

  const newPerson = {
    name: cleanName,
    slug,
    known_for_department: dept || 'Acting',
    awards: []
  };

  const { data: created, error } = await supabase
    .from('people')
    .insert(newPerson)
    .select('id, name, awards')
    .single();

  if (error) {
    console.warn(`  ⚠️ Could not insert person "${cleanName}":`, error.message);
    return null;
  }
  console.log(`  ✨ Created new person row: "${cleanName}" [${created.id}]`);
  return created;
}

async function linkCreditIfNotExists(personId: string, filmId: string, role: string) {
  // Adheres to Zero-Duplicate Actor/Credit Guarantee Rule in AGENTS.md
  const { data: existingCredit } = await supabase
    .from('credits')
    .select('id, role')
    .eq('person_id', personId)
    .eq('film_id', filmId)
    .maybeSingle();

  if (!existingCredit) {
    await supabase.from('credits').insert({
      person_id: personId,
      film_id: filmId,
      role: role || 'actor'
    });
    console.log(`    🔗 Linked credit: person ${personId} ↔ film ${filmId} as ${role}`);
  }
}

async function syncAllReffaAwards() {
  console.log(`🏆 Beginning REFFA (Regal Film Festival and Awards) DB Synchronization...`);
  console.log(`Total nomination items to process: ${REFFA_DATA.length}\n`);

  let filmsUpdated = 0;
  let peopleUpdated = 0;

  for (const item of REFFA_DATA) {
    // 1. Process Film
    const film = await findOrCreateFilm(item.film, item.country, item.year);
    if (film) {
      const currentFilmAwards = Array.isArray(film.awards) ? [...film.awards] : [];
      const alreadyHasFilmAward = currentFilmAwards.some((a: any) =>
        (a.organization === 'REFFA' || a.organization === 'Regal Film Festival and Awards') &&
        Number(a.year) === item.year &&
        String(a.category || '').toLowerCase() === item.category.toLowerCase()
      );

      if (!alreadyHasFilmAward) {
        currentFilmAwards.push({
          organization: 'REFFA',
          organization_name: 'Regal Film Festival and Awards',
          website: 'https://reffaawards.com/',
          year: item.year,
          season: item.season,
          category: item.category,
          won: item.won,
          recipients: item.people || []
        });

        const { error: fErr } = await supabase
          .from('films')
          .update({ awards: currentFilmAwards })
          .eq('id', film.id);

        if (!fErr) {
          filmsUpdated++;
          console.log(`  🎬 Added REFFA ${item.year} [${item.category}] to film "${film.title}" (won=${item.won})`);
        }
      }
    }

    // 2. Process People
    if (item.people && item.people.length > 0) {
      for (const pName of item.people) {
        const person = await findOrCreatePerson(pName, item.role, item.dept);
        if (person) {
          // Link credit to movie if movie exists
          if (film) {
            await linkCreditIfNotExists(person.id, film.id, item.role || 'actor');
          }

          const currentPersonAwards = Array.isArray(person.awards) ? [...person.awards] : [];
          const alreadyHasPersonAward = currentPersonAwards.some((a: any) =>
            (a.organization === 'REFFA' || a.organization === 'Regal Film Festival and Awards') &&
            Number(a.year) === item.year &&
            String(a.category || '').toLowerCase() === item.category.toLowerCase()
          );

          if (!alreadyHasPersonAward) {
            currentPersonAwards.push({
              organization: 'REFFA',
              organization_name: 'Regal Film Festival and Awards',
              website: 'https://reffaawards.com/',
              year: item.year,
              season: item.season,
              category: item.category,
              work: item.film,
              film_id: film?.id || null,
              won: item.won
            });

            const { error: pErr } = await supabase
              .from('people')
              .update({ awards: currentPersonAwards })
              .eq('id', person.id);

            if (!pErr) {
              peopleUpdated++;
              console.log(`  👤 Added REFFA ${item.year} [${item.category}] to person "${person.name}" (won=${item.won})`);
            }
          }
        }
      }
    }
  }

  console.log('\n=============================================================');
  console.log(`🎉 REFFA Synchronization Completed Successfully!`);
  console.log(`   Films with REFFA awards enriched: ${filmsUpdated}`);
  console.log(`   People with REFFA awards enriched: ${peopleUpdated}`);
  console.log('=============================================================');
}

syncAllReffaAwards().catch(console.error);
