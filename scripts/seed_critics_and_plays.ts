import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_CRITICS = [
  {
    name: 'Tolu Fagbure',
    slug: 'tolu-fagbure',
    title: 'Film Critic & Culture Analyst',
    publication: 'Melody FM / Independent',
    platform: 'Facebook & Instagram',
    handle: '@tolufagbure',
    profile_url: 'https://www.facebook.com/tolufagbure',
    bio: 'Renowned Nigerian film analyst, culture commentator, and host of Melody FM film review broadcasts. Specializes in indigenous Yoruba cinema, narrative kinetics, and visual storytelling integrity.',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
  },
  {
    name: 'Oris Aigbokhaevbolo',
    slug: 'oris-aigbokhaevbolo',
    title: 'Chief Critic & Essayist',
    publication: 'Film Efiko',
    platform: 'Film Efiko / X',
    handle: '@catchoris',
    profile_url: 'https://filmefiko.com',
    bio: 'AFRIFF Best Film Journalist award winner, founder of Film Efiko, and former West African editor for Music in Africa. One of West Africa’s most influential cinematic voices.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400'
  },
  {
    name: 'Seyi Lasisi',
    slug: 'seyi-lasisi',
    title: 'Culture Writer & Film Critic',
    publication: 'Afrocritik & Culture Custodian',
    platform: 'Afrocritik / X',
    handle: '@SeyiVortex',
    profile_url: 'https://afrocritik.com/author/seyi-lasisi/',
    bio: 'Lagos-based film journalist and culture essayist writing for Afrocritik and Culture Custodian. Known for incisive critiques on Nollywood directorial choices, narrative structure, and budget allocation.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400'
  },
  {
    name: 'Joseph Jonathan',
    slug: 'joseph-jonathan',
    title: 'Senior Film Journalist',
    publication: 'Afrocritik',
    platform: 'Afrocritik / X',
    handle: '@JosieJp3',
    profile_url: 'https://afrocritik.com/author/joseph-jonathan/',
    bio: 'Senior film reviewer at Afrocritik covering Nollywood, West African indie cinema, and international festival circuits. Passionate about authentic character arcs and artistic integrity.',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400'
  },
  {
    name: 'Victor Salami',
    slug: 'victor-salami',
    title: 'Founder & Managing Editor',
    publication: 'Marapolsa Movies',
    platform: 'Instagram / X',
    handle: '@marapolsa',
    profile_url: 'https://www.instagram.com/marapolsa',
    bio: 'Founder of Marapolsa Movies, delivering high-impact Nollywood box office breakdowns, detailed scorecards, and cast performance evaluations.',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400'
  },
  {
    name: 'Iroko Critic (Mr C & Mrs C)',
    slug: 'iroko-critic',
    title: 'Co-Founders & Film Analysts',
    publication: 'Iroko Critic & Nollywood Film Club',
    platform: 'YouTube & Spotify',
    handle: '@IrokoCritic',
    profile_url: 'https://www.youtube.com/@IrokoCritic',
    bio: 'Husband-and-wife reviewing duo providing deep-dive video essays, podcast debates, and detailed act-by-act analysis of blockbuster African cinema.',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400'
  },
  {
    name: 'Halimah Yusuf',
    slug: 'halimah-yusuf',
    title: 'Independent Film Reviewer',
    publication: 'Halimah Thebird',
    platform: 'YouTube',
    handle: '@HalimahThebird',
    profile_url: 'https://www.youtube.com/@HalimahThebird',
    bio: 'Prominent YouTube movie critic and 2024 Nollywood Critics Poll panelist highlighting indie achievements, women in African cinema, and emotional resonance in film.',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400'
  }
];

const SEED_PLAYS = [
  {
    title: 'Saro The Musical',
    slug: 'saro-the-musical',
    playwright: 'Bolanle Austen-Peters',
    director: 'Bolanle Austen-Peters',
    producer: 'Bolanle Austen-Peters Productions (BAP)',
    venue: 'Terra Kulture & Shaw Theatre',
    city: 'Lagos & London',
    country: 'Nigeria / UK',
    poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800',
    synopsis: 'A high-octane musical extravaganza detailing the journeys of four ambitious young men who migrate to Lagos in search of fame, fortune, and artistic freedom.',
    genre: 'Musical Drama',
    year: 2013,
    run_start_date: '2013-10-25',
    run_end_date: '2017-08-27',
    status: 'archived'
  },
  {
    title: 'Wakaa! The Musical',
    slug: 'wakaa-the-musical',
    playwright: 'Bolanle Austen-Peters',
    director: 'Bolanle Austen-Peters',
    producer: 'Terra Kulture & BAP Productions',
    venue: 'Shaw Theatre & Muson Centre',
    city: 'London & Lagos',
    country: 'UK / Nigeria',
    poster_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&q=80&w=800',
    synopsis: 'The first Nigerian musical to play London’s West End. A satire of political rivalry, youth empowerment, social stratification, and triumph over adversity.',
    genre: 'Political Musical Satire',
    year: 2016,
    run_start_date: '2016-07-21',
    run_end_date: '2016-07-25',
    status: 'archived'
  },
  {
    title: 'Death and the King’s Horseman',
    slug: 'death-and-the-kings-horseman',
    playwright: 'Wole Soyinka',
    director: 'Bayo Awala & Wole Soyinka',
    producer: 'National Theatre Nigeria',
    venue: 'National Arts Theatre & Royal National Theatre',
    city: 'Lagos & London',
    country: 'Nigeria',
    poster_url: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=800',
    synopsis: 'Wole Soyinka’s tragic masterpiece based on real historical events in colonial Oyo. When King Oba dies, his horseman Elesin Oba must commit ritual suicide to accompany him into the afterlife.',
    genre: 'Historical Tragedy',
    year: 2021,
    run_start_date: '2021-11-12',
    run_end_date: '2021-12-05',
    status: 'archived'
  },
  {
    title: 'Fela and the Kalakuta Queens',
    slug: 'fela-and-the-kalakuta-queens',
    playwright: 'Bolanle Austen-Peters',
    director: 'Bolanle Austen-Peters',
    producer: 'BAP Productions & Estate of Fela Kuti',
    venue: 'Terra Kulture & Pretoria State Theatre',
    city: 'Lagos & Pretoria',
    country: 'Nigeria / South Africa',
    poster_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800',
    synopsis: 'An uplifting musical chronicle celebrating the courageous women, dancers, and wives who formed the backbone of Afrobeat pioneer Fela Anikulapo-Kuti’s Kalakuta Republic.',
    genre: 'Afrobeat Musical Bio-Drama',
    year: 2017,
    run_start_date: '2017-12-17',
    run_end_date: '2019-04-14',
    status: 'archived'
  },
  {
    title: 'Moremi The Musical',
    slug: 'moremi-the-musical',
    playwright: 'Bolanle Austen-Peters',
    director: 'Gbenga Yusuf',
    producer: 'House of Oduduwa & Reanimark',
    venue: 'Terra Kulture Arena',
    city: 'Lagos',
    country: 'Nigeria',
    poster_url: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&q=80&w=800',
    synopsis: 'The epic legend of Queen Moremi Ajasoro of Ile-Ife, who sacrificed everything to liberate her people from the mysterious Ugbo invaders in ancient Yorubaland.',
    genre: 'Epic Historical Drama',
    year: 2018,
    run_start_date: '2018-12-21',
    run_end_date: '2019-01-02',
    status: 'archived'
  }
];

async function seedData() {
  console.log('🌱 Seeding Critics...');
  for (const c of SEED_CRITICS) {
    const { data, error } = await supabase
      .from('critics')
      .upsert(c, { onConflict: 'slug' })
      .select('id, name');
    if (error) {
      console.error(`❌ Error seeding critic ${c.name}:`, error.message);
    } else {
      console.log(`✅ Seeded critic: ${c.name}`);
    }
  }

  console.log('🌱 Seeding Stage Plays...');
  for (const p of SEED_PLAYS) {
    const { data, error } = await supabase
      .from('plays')
      .upsert(p, { onConflict: 'slug' })
      .select('id, title');
    if (error) {
      console.error(`❌ Error seeding play ${p.title}:`, error.message);
    } else {
      console.log(`✅ Seeded play: ${p.title}`);
    }
  }

  console.log('🎉 Seeding complete!');
}

seedData().catch(console.error);
