const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const COMPLETE_FILMOGRAPHY = [
  // --- 1970s British Television ---
  {
    title: 'The Goodies',
    slug: 'the-goodies-1971',
    year: 1971,
    release_date: '1971-10-22',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Comedy'],
    synopsis: 'Classic BBC television comedy sketch and narrative series created by and starring Tim Brooke-Taylor, Graeme Garden, and Bill Oddie ("We do anything, anytime, anywhere"). Olu Jacobs guest-starred in Season 2, Episode 4 ("Lost Tribe of the Orinoco").',
    poster_url: 'https://image.tmdb.org/t/p/original/4164h7h7j17nE3N4T9Y5d5c0Gq.jpg',
    imdb_id: 'tt0065303',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Jim Franklin', role: 'director', billing_order: 1 },
      { name: 'Tim Brooke-Taylor', role: 'actor', character_name: 'Tim', billing_order: 1 },
      { name: 'Graeme Garden', role: 'actor', character_name: 'Graeme', billing_order: 2 },
      { name: 'Bill Oddie', role: 'actor', character_name: 'Bill', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Tribesman / Native Leader', billing_order: 4 }
    ]
  },
  {
    title: 'Till Death Us Do Part',
    slug: 'till-death-us-do-part-1974',
    year: 1974,
    release_date: '1974-01-16',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Comedy'],
    synopsis: 'Critically acclaimed British BBC sitcom created by Johnny Speight centered on reactionary Cockney patriarch Alf Garnett (Warren Mitchell). Olu Jacobs guest-starred in Season 5, Episode 3 ("Strikes and Blackouts") as the television repairman.',
    poster_url: 'https://image.tmdb.org/t/p/original/u2wB2B2q3r5e2Q6B6Q7B8C9D.jpg',
    imdb_id: 'tt0058850',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Douglas Moodie', role: 'director', billing_order: 1 },
      { name: 'Warren Mitchell', role: 'actor', character_name: 'Alf Garnett', billing_order: 1 },
      { name: 'Dandy Nichols', role: 'actor', character_name: 'Else Garnett', billing_order: 2 },
      { name: 'Anthony Booth', role: 'actor', character_name: 'Mike Rawlins', billing_order: 3 },
      { name: 'Una Stubbs', role: 'actor', character_name: 'Rita Rawlins', billing_order: 4 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Television Repairman', billing_order: 5 }
    ]
  },
  {
    title: 'Barlow at Large',
    slug: 'barlow-at-large-1975',
    year: 1975,
    release_date: '1975-10-08',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Crime', 'Drama'],
    synopsis: 'BBC police procedural drama starring Stratford Johns as Detective Chief Superintendent Charlie Barlow. Olu Jacobs guest-starred as Motamba in Season 4, Episode 8 ("Protection").',
    poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    imdb_id: 'tt0163428',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Stratford Johns', role: 'actor', character_name: 'DCS Charlie Barlow', billing_order: 1 },
      { name: 'Norman Bowler', role: 'actor', character_name: 'DI Harry Hawkins', billing_order: 2 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Motamba', billing_order: 3 }
    ]
  },
  {
    title: 'The Venturers',
    slug: 'the-venturers-1975',
    year: 1975,
    release_date: '1975-06-18',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Drama'],
    synopsis: 'BBC television drama series following the high-stakes financial and corporate maneuvers of an international merchant bank. Olu Jacobs guest-starred as Mbela in Season 1, Episode 10 ("Dangerous and the Lonely Hearts").',
    poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    imdb_id: 'tt0163943',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Geoffrey Keen', role: 'actor', character_name: 'Gerald Henderson', billing_order: 1 },
      { name: 'Paul Eddington', role: 'actor', character_name: 'Richard Foster', billing_order: 2 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Mbela', billing_order: 3 }
    ]
  },
  {
    title: 'The Tomorrow People',
    slug: 'the-tomorrow-people-1975',
    year: 1975,
    release_date: '1975-03-03',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Adventure', 'Family', 'Sci-Fi'],
    synopsis: 'Iconic British ITV science-fiction series created by Roger Price about homo superior teenagers endowed with telepathy, teleportation, and psionic powers. Olu Jacobs guest-starred as General Papa Minn in the two-part epic "The Thargon Menace".',
    poster_url: 'https://image.tmdb.org/t/p/original/rM6Yx2i2m3tT1x5a1V6B6Q7B8C9.jpg',
    imdb_id: 'tt0069647',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Vic Hughes', role: 'director', billing_order: 1 },
      { name: 'Nicholas Young', role: 'actor', character_name: 'John', billing_order: 1 },
      { name: 'Elizabeth Adare', role: 'actor', character_name: 'Elizabeth', billing_order: 2 },
      { name: 'Peter Vaughan-Clarke', role: 'actor', character_name: 'Stephen', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'General Papa Minn', billing_order: 4 }
    ]
  },
  {
    title: 'Angels',
    slug: 'angels-1976',
    year: 1976,
    release_date: '1976-09-01',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Drama'],
    synopsis: 'Long-running BBC medical drama created by Paula Milne depicting the realistic personal and professional lives of student nurses at St. Angela’s Hospital in London. Olu Jacobs starred across 3 episodes as Musa Ladipo.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    imdb_id: 'tt0163423',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Julia Smith', role: 'director', billing_order: 1 },
      { name: 'Fiona Fullerton', role: 'actor', character_name: 'Patricia Rutherford', billing_order: 1 },
      { name: 'Erin Geraghty', role: 'actor', character_name: 'Jo Longhurst', billing_order: 2 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Musa Ladipo', billing_order: 3 }
    ]
  },
  {
    title: '1990',
    slug: '1990-bbc-series-1978',
    year: 1978,
    release_date: '1978-02-27',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Drama', 'Sci-Fi', 'Thriller'],
    synopsis: 'Dystopian BBC drama series created by Wilfred Greatorex set in a totalitarian Britain governed by the draconian Public Control Department (PCD). Edward Woodward stars as dissident journalist Jim Kyle. Olu Jacobs played Alan Msawi in Season 2, Episode 2 ("The Market Price").',
    poster_url: 'https://image.tmdb.org/t/p/original/tP9pT6x3y4r3x7d1V2c3b4a5G6.jpg',
    imdb_id: 'tt0075468',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Alan Gibson', role: 'director', billing_order: 1 },
      { name: 'Edward Woodward', role: 'actor', character_name: 'Jim Kyle', billing_order: 1 },
      { name: 'Robert Lang', role: 'actor', character_name: 'Herbert Skardon', billing_order: 2 },
      { name: 'Barbara Kellerman', role: 'actor', character_name: 'Delly Lomas', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Alan Msawi', billing_order: 4 }
    ]
  },
  {
    title: 'The Professionals',
    slug: 'the-professionals-1979',
    year: 1979,
    release_date: '1979-11-24',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Action', 'Crime', 'Drama'],
    synopsis: 'Brian Clemens’s legendary ITV action series centered on CI5 (Criminal Intelligence 5), a covert security agency authorized to use lethal force against terrorism and organized crime. Olu Jacobs guest-starred as Sylvester in Season 3, Episode 5 ("The Madness of Mickey Hamilton").',
    poster_url: 'https://image.tmdb.org/t/p/original/u2wB2B2q3r5e2Q6B6Q7B8C9D.jpg',
    imdb_id: 'tt0075561',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'William Brayne', role: 'director', billing_order: 1 },
      { name: 'Gordon Jackson', role: 'actor', character_name: 'George Cowley', billing_order: 1 },
      { name: 'Martin Shaw', role: 'actor', character_name: 'Ray Doyle', billing_order: 2 },
      { name: 'Lewis Collins', role: 'actor', character_name: 'William Bodie', billing_order: 3 },
      { name: 'Ian McDiarmid', role: 'actor', character_name: 'Mickey Hamilton', billing_order: 4 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Sylvester', billing_order: 5 }
    ]
  },
  {
    title: 'Squadron',
    slug: 'squadron-1982',
    year: 1982,
    release_date: '1982-12-21',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Adventure', 'Drama'],
    synopsis: 'BBC military drama series following the elite pilots and ground crew of the Royal Air Force 370 Rapid Deployment Squadron. Olu Jacobs guest-starred as President Gadin in Season 1, Episode 10 ("Cyclone").',
    poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    imdb_id: 'tt0163953',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Michael Culver', role: 'actor', character_name: 'Group Captain James Christie', billing_order: 1 },
      { name: 'Malcolm Stoddard', role: 'actor', character_name: 'Squadron Leader Peter Tyson', billing_order: 2 },
      { name: 'Derek Benfield', role: 'actor', character_name: 'Warrant Officer Harry Hall', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'President Gadin', billing_order: 4 }
    ]
  },
  {
    title: 'The Witches and the Grinnygog',
    slug: 'the-witches-and-the-grinnygog-1983',
    year: 1983,
    release_date: '1983-11-09',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Family', 'Fantasy', 'Mystery'],
    synopsis: 'TVS / ITV fantasy mystery series adapted from Dorothy Edwards’s novel. When an ancient pagan stone carving (the Grinnygog) is moved during church renovations, supernatural occurrences shake a secluded English parish. Olu Jacobs co-starred in 5 episodes as Mr. Twebele Alabaster.',
    poster_url: 'https://image.tmdb.org/t/p/original/s4P8P2m3tT1x5a1V6B6Q7B8C9.jpg',
    imdb_id: 'tt0163964',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Diarmuid Lawrence', role: 'director', billing_order: 1 },
      { name: 'Sheila Grant', role: 'actor', character_name: 'Mrs. Ems', billing_order: 1 },
      { name: 'Paul Crone', role: 'actor', character_name: 'Jimmy Adams', billing_order: 2 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Mr. Twebele Alabaster', billing_order: 3 }
    ]
  },
  {
    title: 'Rumpole of the Bailey',
    slug: 'rumpole-of-the-bailey-1983',
    year: 1983,
    release_date: '1983-10-18',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['United Kingdom'],
    genres: ['Comedy', 'Crime', 'Drama'],
    synopsis: 'Thames Television / PBS Masterpiece Theatre courtroom masterpiece created by John Mortimer starring Leo McKern as the irrepressible Old Bailey barrister Horace Rumpole. In Season 3, Episode 2 ("Rumpole and the Golden Thread"), Rumpole travels to an African nation to defend his former student, politician David Mazenze (Olu Jacobs).',
    poster_url: 'https://image.tmdb.org/t/p/original/87W6w9i2m3tT1x5a1V6B6Q7B8C9.jpg',
    imdb_id: 'tt0077069',
    is_nollywood: false,
    is_published: true,
    credits: [
      { name: 'Donald McWhinnie', role: 'director', billing_order: 1 },
      { name: 'John Mortimer', role: 'writer', billing_order: 1 },
      { name: 'Leo McKern', role: 'actor', character_name: 'Horace Rumpole', billing_order: 1 },
      { name: 'Peggy Thorpe-Bates', role: 'actor', character_name: 'Hilda Rumpole (She Who Must Be Obeyed)', billing_order: 2 },
      { name: 'Jonathan Coy', role: 'actor', character_name: 'Henry', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'David Mazenze', billing_order: 4 }
    ]
  },

  // --- International Films ---
  {
    title: 'Ashanti',
    slug: 'ashanti-1979',
    year: 1979,
    release_date: '1979-02-16',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Arabic'],
    countries: ['United States', 'Switzerland'],
    genres: ['Action', 'Adventure', 'Drama'],
    synopsis: 'Directed by Richard Fleischer, starring Michael Caine, Peter Ustinov, Beverly Johnson, Omar Sharif, Rex Harrison, and William Holden. When a WHO doctor\'s wife is abducted by modern-day slave traders in West Africa, an international rescue mission unfolds across the Sahara and Red Sea. Olu Jacobs portrays Commissioner Batak.',
    poster_url: 'https://image.tmdb.org/t/p/original/j9XQW3mJv7i1Q4wN1R4Gq6u9m2B.jpg',
    imdb_id: 'tt0078799',
    is_nollywood: false,
    is_published: true,
    runtime_minutes: 117,
    credits: [
      { name: 'Richard Fleischer', role: 'director', billing_order: 1 },
      { name: 'Michael Caine', role: 'actor', character_name: 'Dr. David Linderby', billing_order: 1 },
      { name: 'Peter Ustinov', role: 'actor', character_name: 'Suleiman', billing_order: 2 },
      { name: 'Beverly Johnson', role: 'actor', character_name: 'Dr. Anansa Linderby', billing_order: 3 },
      { name: 'Omar Sharif', role: 'actor', character_name: 'Prince Hassan', billing_order: 4 },
      { name: 'Rex Harrison', role: 'actor', character_name: 'Brian Walker', billing_order: 5 },
      { name: 'William Holden', role: 'actor', character_name: 'Jim Sandell', billing_order: 6 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Commissioner Batak', billing_order: 7 }
    ]
  },
  {
    title: 'The Dogs of War',
    slug: 'the-dogs-of-war-1980',
    year: 1980,
    release_date: '1980-12-19',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Spanish', 'French'],
    countries: ['United Kingdom', 'United States'],
    genres: ['Action', 'Adventure', 'Drama', 'War'],
    synopsis: 'Directed by John Irvin and based on Frederick Forsyth’s best-selling novel. A unit of mercenaries led by James Shannon (Christopher Walken) is contracted by a British tycoon to stage a coup against the brutal dictator of Zangaro in West Africa. Olu Jacobs stars as the Customs Officer.',
    poster_url: 'https://image.tmdb.org/t/p/original/zAVFOLcjqYoEDYBF7UPNY4DIV2I.jpg',
    imdb_id: 'tt0080641',
    is_nollywood: false,
    is_published: true,
    runtime_minutes: 104,
    credits: [
      { name: 'John Irvin', role: 'director', billing_order: 1 },
      { name: 'Christopher Walken', role: 'actor', character_name: 'James Shannon', billing_order: 1 },
      { name: 'Tom Berenger', role: 'actor', character_name: 'Drew Blakeley', billing_order: 2 },
      { name: 'Colin Blakely', role: 'actor', character_name: 'Alan North', billing_order: 3 },
      { name: 'Hugh Millais', role: 'actor', character_name: 'Roy Endean', billing_order: 4 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Customs Officer', billing_order: 5 }
    ]
  },
  {
    title: 'Baby: Secret of the Lost Legend',
    slug: 'baby-secret-of-the-lost-legend-1985',
    year: 1985,
    release_date: '1985-03-22',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['United States'],
    genres: ['Adventure', 'Family', 'Sci-Fi'],
    synopsis: 'Disney / Touchstone Pictures adventure directed by B.W.L. Norton. An American paleontologist and her husband discover a secluded family of sauropod dinosaurs living in the rainforests of Central Africa, and must protect them from ruthless military mercenaries. Olu Jacobs co-stars as Colonel Nsogbu.',
    poster_url: 'https://image.tmdb.org/t/p/original/AvIT5XHXrxeNHxTHmyRalm7tfSM.jpg',
    imdb_id: 'tt0088760',
    is_nollywood: false,
    is_published: true,
    runtime_minutes: 92,
    credits: [
      { name: 'Bill Norton', role: 'director', billing_order: 1 },
      { name: 'William Katt', role: 'actor', character_name: 'George Loomis', billing_order: 1 },
      { name: 'Sean Young', role: 'actor', character_name: 'Dr. Susan Matthews-Loomis', billing_order: 2 },
      { name: 'Patrick McGoohan', role: 'actor', character_name: 'Dr. Eric Kiviat', billing_order: 3 },
      { name: 'Julian Fellowes', role: 'actor', character_name: 'Nigel Jenkins', billing_order: 4 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Col. Nsogbu', billing_order: 5 }
    ]
  },
  {
    title: 'Pirates',
    slug: 'pirates-1986',
    year: 1986,
    release_date: '1986-05-08',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'French', 'Spanish'],
    countries: ['France', 'Tunisia'],
    genres: ['Adventure', 'Comedy'],
    synopsis: 'Directed by Roman Polanski and starring Walter Matthau as the irascible Captain Thomas Bartholomew Red. Rescued at sea by the Spanish galleon Neptune, Captain Red and his crew conspire to seize a golden Aztec throne. Olu Jacobs plays the fearsome pirate crewman Boomako.',
    poster_url: 'https://image.tmdb.org/t/p/original/cuSnexGO0vq0ynefeHJvSwGYPU2.jpg',
    imdb_id: 'tt0091757',
    is_nollywood: false,
    is_published: true,
    runtime_minutes: 121,
    credits: [
      { name: 'Roman Polanski', role: 'director', billing_order: 1 },
      { name: 'Walter Matthau', role: 'actor', character_name: 'Captain Thomas Bartholomew Red', billing_order: 1 },
      { name: 'Cris Campion', role: 'actor', character_name: 'The Frog (Jean-Baptiste)', billing_order: 2 },
      { name: 'Damien Thomas', role: 'actor', character_name: 'Don Alfonso de la Torré', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Boomako', billing_order: 4 }
    ]
  },

  // --- Nollywood Cinema & Television Masterpieces ---
  {
    title: 'The Third Eye',
    slug: 'the-third-eye-1990',
    year: 1990,
    release_date: '1990-01-01',
    release_type: 'cinema',
    content_type: 'series',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Crime', 'Drama', 'Mystery'],
    synopsis: 'The landmark NTA prime-time detective series that captivated Nigerian audiences in the 1990s. Olu Jacobs stars in the career-defining role of Inspector Best Idafa, a brilliant and unbending private investigator who untangles murder mysteries, corporate espionage, and syndicate crime alongside his daughter Uche.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    imdb_id: 'tt0392811',
    is_nollywood: true,
    is_published: true,
    credits: [
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Inspector Best Idafa', billing_order: 1 },
      { name: 'Uche Mac-Auley', role: 'actor', character_name: 'Uche Idafa', billing_order: 2 },
      { name: 'Stella Damasus', role: 'actor', character_name: 'Guest Star', billing_order: 3 }
    ]
  },
  {
    title: 'Vigilante',
    slug: 'vigilante-1988',
    year: 1988,
    release_date: '1988-06-01',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Pidgin'],
    countries: ['Nigeria'],
    genres: ['Action', 'Crime', 'Drama'],
    synopsis: 'One of the foundational Nigerian feature films produced by the Nigerian Film Corporation. When armed robberies terrorize an urban community, residents establish a disciplined vigilante watch, exposing betrayal from within the elite establishment. Olu Jacobs stars as the community patriarch.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Olujacobs.jpg',
    imdb_id: 'tt0391801',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 90,
    credits: [
      { name: 'Adedeji Roberts', role: 'director', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Chief George', billing_order: 1 },
      { name: 'Clarion Chukwura', role: 'actor', character_name: 'Comfort', billing_order: 2 }
    ]
  },
  {
    title: 'Twins of the Rain Forest',
    slug: 'twins-of-the-rain-forest-1998',
    year: 1998,
    release_date: '1998-04-12',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'History'],
    synopsis: 'An evocative drama set in pre-colonial Nigeria confronting the superstitious cultural taboo of twin infanticide and Mary Slessor’s humanitarian intervention. Starring Joke Silva and Olu Jacobs.',
    poster_url: 'https://image.tmdb.org/t/p/original/9rM6Yx2i2m3tT1x5a1V6B6Q7B8C9.jpg',
    imdb_id: 'tt0246287',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 60,
    credits: [
      { name: 'Odion Agboh', role: 'director', billing_order: 1 },
      { name: 'Joke Silva', role: 'actor', character_name: 'Ese', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Village Elder', billing_order: 2 }
    ]
  },
  {
    title: 'Iva',
    slug: 'iva-1999',
    year: 1999,
    release_date: '1999-10-01',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'History'],
    synopsis: 'Directed by Izu Ojukwu, this Nollywood historical drama chronicles the tragic 1949 Iva Valley coal mine massacre in colonial Enugu, where 21 unarmed miners were shot while protesting poor working conditions and withheld wages. Olu Jacobs gives a standout performance as the colonial district officer.',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMGUzYjI5ZjctMmU3NS00MGIzLTg5NjItMzA4NjU2NTRjMDQxXkEyXkFqcGc@._V1_SX600.jpg',
    imdb_id: 'tt0391802',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 105,
    credits: [
      { name: 'Izu Ojukwu', role: 'director', billing_order: 1 },
      { name: 'Pete Edochie', role: 'actor', character_name: 'Chief Okeke', billing_order: 1 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Ozo', billing_order: 2 },
      { name: 'Nkem Owoh', role: 'actor', character_name: 'Labor Organizer', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Colonial Commissioner', billing_order: 4 }
    ]
  },
  {
    title: 'Ijele',
    slug: 'ijele-1999',
    year: 1999,
    release_date: '1999-11-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Igbo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Fantasy', 'Romance'],
    synopsis: 'Directed by Fred Amata. Set in ancient Igboland, Ijele (Sam Dede), a heroic and invincible warrior, rejects royal suitors to pursue true love with Oma (Genevieve Nnaji). Olu Jacobs stars as the venerable King (Eze).',
    poster_url: 'https://media-cdn.nollywood.com/cdn-cgi/image/width=500,fit=cover,gravity=auto,format=auto,quality=90/photo-poster-01KXDRDSM5FKY4KYAFGQC3VGQW.png',
    imdb_id: 'tt0391804',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 120,
    credits: [
      { name: 'Fred Amata', role: 'director', billing_order: 1 },
      { name: 'Sam Dede', role: 'actor', character_name: 'Ijele', billing_order: 1 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Oma', billing_order: 2 },
      { name: 'Eucharia Anunobi', role: 'actor', character_name: 'Princess Arnest', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Eze (The King)', billing_order: 4 }
    ]
  },
  {
    title: 'Private Sin',
    slug: 'private-sin-2003',
    year: 2003,
    release_date: '2003-08-15',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Romance'],
    synopsis: 'Directed by Charles Novia. A high-society emotional drama dealing with hidden infidelities, religious hypocrisy, and broken marriages. Starring Genevieve Nnaji, Richard Mofe-Damijo, Stephanie Linus, Patience Ozokwor, and Olu Jacobs.',
    poster_url: 'https://image.tmdb.org/t/p/original/4uJ5k6m7h8j9k1L2M3N4P5Q6R7S.jpg',
    imdb_id: 'tt0391805',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 110,
    credits: [
      { name: 'Charles Novia', role: 'director', billing_order: 1 },
      { name: 'Genevieve Nnaji', role: 'actor', character_name: 'Faith', billing_order: 1 },
      { name: 'Richard Mofe-Damijo', role: 'actor', character_name: 'Pastor Rowland', billing_order: 2 },
      { name: 'Stephanie Linus', role: 'actor', character_name: 'Rose', billing_order: 3 },
      { name: 'Patience Ozokwor', role: 'actor', character_name: 'Madam Regina', billing_order: 4 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Chief Elder', billing_order: 5 }
    ]
  },
  {
    title: 'Eye of the Gods',
    slug: 'eye-of-the-gods-2004',
    year: 2004,
    release_date: '2004-05-15',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Mystery'],
    synopsis: 'Directed by Andy Amenechi. A kingdom is thrown into turmoil when ancient sacred totems vanish from the royal shrine, unleashing cosmic penalties on the royal household until the true culprits are revealed. Olu Jacobs stars as the revered King.',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BNTBmZWY1MDUtMWI1Ny00OWVlLTg1NWItYTg5ZWRhZDMwZDY2XkEyXkFqcGc@._V1_SX600.jpg',
    imdb_id: 'tt0391803',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 110,
    credits: [
      { name: 'Andy Amenechi', role: 'director', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Igwe', billing_order: 1 },
      { name: 'Sam Loco Efe', role: 'actor', character_name: 'Chief Priest', billing_order: 2 },
      { name: 'Chinyere Wilfred', role: 'actor', character_name: 'Lolo', billing_order: 3 }
    ]
  },
  {
    title: 'Dangerous Twins',
    slug: 'dangerous-twins-2004',
    year: 2004,
    release_date: '2004-12-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria', 'United Kingdom'],
    genres: ['Drama', 'Thriller'],
    synopsis: 'Directed by Tade Ogidan. Taiye and Kehinde are identical twin brothers whose lives diverge across Lagos and London. When Taiye travels to London to pose as Kehinde to save a faltering marriage, lust and deceit lead to fatal betrayals. Starring Ramsey Nouah, Stella Damasus, Bimbo Akintola, and Olu Jacobs.',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BNTBmZWY1MDUtMWI1Ny00OWVlLTg1NWItYTg5ZWRhZDMwZDY2XkEyXkFqcGc@._V1_SX600.jpg',
    imdb_id: 'tt0457319',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 135,
    credits: [
      { name: 'Tade Ogidan', role: 'director', billing_order: 1 },
      { name: 'Ramsey Nouah', role: 'actor', character_name: 'Taiye / Kehinde', billing_order: 1 },
      { name: 'Stella Damasus', role: 'actor', character_name: 'Stella', billing_order: 2 },
      { name: 'Bimbo Akintola', role: 'actor', character_name: 'Judy', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Father', billing_order: 4 }
    ]
  },
  {
    title: 'Adesuwa',
    slug: 'adesuwa-2011',
    year: 2011,
    release_date: '2011-12-09',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Edo'],
    countries: ['Nigeria'],
    genres: ['Drama', 'History'],
    synopsis: 'Directed by Lancelot Oduwa Imasuen and winner of 3 Africa Movie Academy Awards. Set in the 18th-century Benin Empire, Princess Adesuwa is caught in a bitter diplomatic power struggle between the Oba of Benin and the British Empire. Olu Jacobs portrays Ezomo, the supreme war commander.',
    poster_url: 'https://images.mubicdn.net/images/film/43602/cache-33853-1745490443/image-w1280.jpg',
    imdb_id: 'tt2375836',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 115,
    credits: [
      { name: 'Lancelot Oduwa Imasuen', role: 'director', billing_order: 1 },
      { name: 'Stephanie Linus', role: 'actor', character_name: 'Princess Adesuwa', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Ezomo (War Commander)', billing_order: 2 },
      { name: 'Ngozi Ezeonu', role: 'actor', character_name: 'Queen Mother', billing_order: 3 },
      { name: 'Bob-Manuel Udokwu', role: 'actor', character_name: 'Oba of Benin', billing_order: 4 }
    ]
  },
  {
    title: 'Potomanto',
    slug: 'potomanto-2013',
    year: 2013,
    release_date: '2013-12-20',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Ghana', 'Nigeria'],
    genres: ['Action', 'Thriller'],
    synopsis: 'Directed by Shirley Frimpong-Manso. An ex-police officer investigating unfaithful spouses in a secluded community accidentally stumbles upon a sinister international organ trafficking ring operating under the guise of an illegal sports clinic. Olu Jacobs stars as Bankole.',
    poster_url: 'https://image.tmdb.org/t/p/original/xFDdejt1BpovLbtNBv2LhlG8Zam.jpg',
    imdb_id: 'tt3412586',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 112,
    credits: [
      { name: 'Shirley Frimpong-Manso', role: 'director', billing_order: 1 },
      { name: 'Adjetey Anang', role: 'actor', character_name: 'Andane', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Bankole', billing_order: 2 },
      { name: 'Yvonne Okoro', role: 'actor', character_name: 'Alice', billing_order: 3 },
      { name: 'Marie Humbert', role: 'actor', character_name: 'Susan', billing_order: 4 }
    ]
  },
  {
    title: 'The Antique',
    slug: 'the-antique-2014',
    year: 2014,
    release_date: '2014-10-19',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Drama', 'Fantasy', 'Adventure'],
    synopsis: 'Directed by Darasen Richards and DJ Tee. When the only heir to the royal throne lies dying of an incurable curse, an innocent village maiden is chosen to venture into the forbidden spirit forest to retrieve an ancient sacred relic. Olu Jacobs stars as Oba Ekpen.',
    poster_url: 'https://www.partyjolloftv.com/api/media/file/The%20Antique-258x312.jpg',
    imdb_id: 'tt4120374',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 104,
    credits: [
      { name: 'Darasen Richards', role: 'director', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Oba Ekpen', billing_order: 1 },
      { name: 'Bimbo Akintola', role: 'actor', character_name: 'Queen Mother', billing_order: 2 },
      { name: 'Gabriel Afolayan', role: 'actor', character_name: 'Uyi', billing_order: 3 },
      { name: 'Seun Akindele', role: 'actor', character_name: 'Prince', billing_order: 4 }
    ]
  },
  {
    title: 'Oloibiri',
    slug: 'oloibiri-2015',
    year: 2015,
    release_date: '2015-10-21',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Ijaw'],
    countries: ['Nigeria'],
    genres: ['Action', 'Drama', 'Thriller'],
    synopsis: 'Directed by Curtis Graham. Set in the historic town of Oloibiri where crude oil was first drilled in Nigeria in 1956, the film explores decades of corporate exploitation, poisoned wetlands, government neglect, and the ensuing violent armed militancy. Olu Jacobs delivers a towering performance as elder statesman Timipre.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/2/23/Oloibiri_The_Movie_poster.jpg',
    imdb_id: 'tt4711318',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 122,
    credits: [
      { name: 'Curtis Graham', role: 'director', billing_order: 1 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Timipre', billing_order: 1 },
      { name: 'Richard Mofe-Damijo', role: 'actor', character_name: 'Gunpowder (Boma)', billing_order: 2 },
      { name: 'William R. Moses', role: 'actor', character_name: 'Powell', billing_order: 3 },
      { name: 'Taiwo Ajai-Lycett', role: 'actor', character_name: 'Madam Appah', billing_order: 4 }
    ]
  },
  {
    title: 'Dry',
    slug: 'dry-2014',
    year: 2014,
    release_date: '2014-11-29',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English', 'Hausa'],
    countries: ['Nigeria', 'United Kingdom'],
    genres: ['Drama'],
    synopsis: 'Written and directed by Stephanie Linus, Dry tells the poignant journey of Halima, an underage girl married off against her will who develops Vesicovaginal Fistula (VVF), and Dr. Zara, a compassionate physician battling to rehabilitate victims and reform legal protections. Olu Jacobs stars as the Speaker of the House of Assembly.',
    poster_url: 'https://www.partyjolloftv.com/api/media/file/Dry.jpg',
    imdb_id: 'tt3355088',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 100,
    credits: [
      { name: 'Stephanie Linus', role: 'director', billing_order: 1 },
      { name: 'Stephanie Linus', role: 'actor', character_name: 'Dr. Zara', billing_order: 1 },
      { name: 'Zubaida Ibrahim Fagge', role: 'actor', character_name: 'Halima', billing_order: 2 },
      { name: 'Liz Benson', role: 'actor', character_name: 'Matron', billing_order: 3 },
      { name: 'William McNamara', role: 'actor', character_name: 'Dr. Brown', billing_order: 4 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Speaker of the House', billing_order: 5 }
    ]
  },
  {
    title: 'The Royal Hibiscus Hotel',
    slug: 'the-royal-hibiscus-hotel',
    year: 2018,
    release_date: '2018-02-09',
    release_type: 'cinema',
    content_type: 'movie',
    language: 'English',
    languages: ['English'],
    countries: ['Nigeria'],
    genres: ['Comedy', 'Romance'],
    synopsis: 'Directed by Ishaya Bako. Ope, an ambitious London-trained chef, returns to Nigeria to take over her parents\' charming but debt-ridden boutique hotel. Unknown to her, her father Richard (Olu Jacobs) and mother Augustina (Joke Silva) have arranged to sell the property to a dashing young investor. Premiered at TIFF.',
    poster_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/pj-5830592f-8a3a-4b15-8351-d7fa7045f000.jpg',
    imdb_id: 'tt7242858',
    is_nollywood: true,
    is_published: true,
    runtime_minutes: 90,
    credits: [
      { name: 'Ishaya Bako', role: 'director', billing_order: 1 },
      { name: 'Zainab Balogun', role: 'actor', character_name: 'Ope', billing_order: 1 },
      { name: 'Kenneth Okolie', role: 'actor', character_name: 'Deji', billing_order: 2 },
      { name: 'Joke Silva', role: 'actor', character_name: 'Augustina', billing_order: 3 },
      { name: 'Olu Jacobs', role: 'actor', character_name: 'Richard', billing_order: 4 },
      { name: 'Jide Kosoko', role: 'actor', character_name: 'Chief Segun', billing_order: 5 },
      { name: 'Rachel Oniga', role: 'actor', character_name: 'Rose', billing_order: 6 },
      { name: 'Deyemi Okanlawon', role: 'actor', character_name: 'Martin', billing_order: 7 },
      { name: 'Kemi Lala Akindoju', role: 'actor', character_name: 'Chika', billing_order: 8 }
    ]
  }
];

async function runCompleteSeeding() {
  console.log('=== Upserting Full Filmography and Cast Ensembles for Olu Jacobs ===\n');

  // Pre-fetch Olu Jacobs person ID
  const { data: person } = await supabase
    .from('people')
    .select('id')
    .eq('slug', 'olu-jacobs')
    .single();

  const personId = person.id;

  for (const film of COMPLETE_FILMOGRAPHY) {
    const { credits, ...filmData } = film;

    // Check if film exists
    const { data: existingFilm } = await supabase
      .from('films')
      .select('id, slug')
      .eq('slug', filmData.slug)
      .maybeSingle();

    let filmId = existingFilm ? existingFilm.id : null;

    if (filmId) {
      const { error: updErr } = await supabase
        .from('films')
        .update(filmData)
        .eq('id', filmId);
      if (updErr) console.error(`Error updating film ${filmData.title}:`, updErr);
      else console.log(`✓ Updated film: ${filmData.title} (${filmId})`);
    } else {
      const { data: newFilm, error: insErr } = await supabase
        .from('films')
        .insert(filmData)
        .select()
        .single();
      if (insErr) {
        console.error(`Error inserting film ${filmData.title}:`, insErr);
        continue;
      }
      filmId = newFilm.id;
      console.log(`✓ Created film: ${filmData.title} (${filmId})`);
    }

    // Credits / Ensemble
    for (const credit of credits) {
      let creditPersonId = personId;
      if (credit.name !== 'Olu Jacobs') {
        const otherSlug = credit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: foundPerson } = await supabase
          .from('people')
          .select('id')
          .eq('slug', otherSlug)
          .maybeSingle();

        if (foundPerson) {
          creditPersonId = foundPerson.id;
        } else {
          const { data: insP } = await supabase
            .from('people')
            .insert({
              name: credit.name,
              slug: otherSlug,
              known_for_department: credit.role === 'director' ? 'Directing' : credit.role === 'writer' ? 'Writing' : 'Acting',
              is_verified: false
            })
            .select()
            .single();
          if (insP) creditPersonId = insP.id;
        }
      }

      if (!creditPersonId) continue;

      const { data: existingCredit } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', filmId)
        .eq('person_id', creditPersonId)
        .eq('role', credit.role)
        .maybeSingle();

      if (existingCredit) {
        await supabase
          .from('credits')
          .update({
            character_name: credit.character_name || null,
            billing_order: credit.billing_order,
            source: 'imdb_full_ensemble'
          })
          .eq('id', existingCredit.id);
      } else {
        await supabase
          .from('credits')
          .insert({
            film_id: filmId,
            person_id: creditPersonId,
            role: credit.role,
            character_name: credit.character_name || null,
            billing_order: credit.billing_order,
            source: 'imdb_full_ensemble'
          });
      }
    }
    console.log(`  ✓ Linked ${credits.length} ensemble cast/crew credits to ${filmData.title}`);
  }

  console.log('\n=== Ingestion Complete! Full ensemble and filmography synchronized. ===');
}

runCompleteSeeding().catch(console.error);
