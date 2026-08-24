import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envText = '';
try {
  envText = fs.readFileSync('.env', 'utf8');
} catch (e) {
  try {
    envText = fs.readFileSync('.env.local', 'utf8');
  } catch (e2) {}
}

const env = {};
envText.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

const FILM_ARTWORK = [
  {
    title: 'Ijakumo: The Born Again Stripper',
    poster: 'https://image.tmdb.org/t/p/w780/91UZxu28BBEamhADXty0O6pK7kq.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/1ac0WRl9pS9Hok0q2xFkfKPtt0B.jpg',
  },
  {
    title: 'Alakada: Bad and Boujee',
    poster: 'https://www.partyjolloftv.com/api/media/file/Alakada%20Bad%20And%20Boujee.jpg',
    backdrop: 'https://www.partyjolloftv.com/api/media/file/Alakada%20Bad%20And%20Boujee.jpg',
  },
  {
    title: 'Imade',
    poster: 'https://image.tmdb.org/t/p/w780/fV7INuXhT2dnFguH0MBOGuOKEfq.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/bDWJhrleSWNHfA4jwU4AyQdznjh.jpg',
  },
  {
    title: 'A Lady Before Me',
    poster: 'https://i.ytimg.com/vi/pZbHTFNvjOo/maxresdefault.jpg',
    backdrop: 'https://i.ytimg.com/vi/pZbHTFNvjOo/maxresdefault.jpg',
  },
  {
    title: 'Shop 2 Chop',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/pj-7d2d6daa-74f0-4c0c-99ec-ed52725e6143.jpg',
    backdrop: 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0Pph6ETIVPIYeUxPNrTDJYb342aMS9zAiHkgjtvR',
  },
  {
    title: 'Love on the Edge',
    poster: 'https://image.tmdb.org/t/p/w780/9kRlpLqitFDky1CnvTDBTZtNQYW.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/9kRlpLqitFDky1CnvTDBTZtNQYW.jpg',
  },
  {
    title: 'Unspoken Words',
    poster: 'https://image.tmdb.org/t/p/w780/njkWbdQBj6Y25oo2CF7HwQE4UwK.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/9ELkvSNhLbtxgvINH1mA2XlAczp.jpg',
  },
  {
    title: 'The Chosen Bride',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-_NmK8N1UpNQ.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-_NmK8N1UpNQ.jpg',
  },
  {
    title: 'Love in the Middle',
    poster: 'https://image.tmdb.org/t/p/w780/rqONdVEib93t217GLWP7oAJnwK9.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/51UXT636myHF12xkFSLtKZlijVL.jpg',
  },
  {
    title: 'What the Heart Wants',
    poster: 'https://image.tmdb.org/t/p/w780/mzSbOGN8SdVw5L8kYBj9sJ69GvM.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/mzSbOGN8SdVw5L8kYBj9sJ69GvM.jpg',
  },
  {
    title: 'Gidi Life',
    poster: 'https://www.partyjolloftv.com/api/media/file/Gidi%20Life.jpg',
    backdrop: 'https://www.partyjolloftv.com/api/media/file/Gidi%20Life.jpg',
  },
  {
    title: 'Heart Repairs',
    poster: 'https://www.partyjolloftv.com/api/media/file/Heart%20Repairs.jpg',
    backdrop: 'https://www.partyjolloftv.com/api/media/file/Heart%20Repairs.jpg',
  },
  {
    title: 'Love Lives Here',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/pj-9d0dc5ac-3bd5-41e5-9810-2ae7e65976a2.jpg',
    backdrop: 'https://www.partyjolloftv.com/api/media/file/Love%20Lives%20Here-1200x630.jpg',
  },
  {
    title: 'Two Hearts, One Story',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-_NmK8N1UpNQ.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-_NmK8N1UpNQ.jpg',
  },
  {
    title: 'Her Last Breath',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-g7zDWgbIPo8.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/backdrops/movie-g7zDWgbIPo8-bd.jpg',
  },
  {
    title: 'Threesome',
    poster: 'https://image.tmdb.org/t/p/w780/9s80kdczR8vHJpQI1xYvdqvj7pi.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/backdrops/movie-g7zDWgbIPo8-bd.jpg',
  },
  {
    title: 'A Matter of Chance',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/9d8b098c-c880-46aa-bb33-4edf54f277c5.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/9d8b098c-c880-46aa-bb33-4edf54f277c5.jpg',
  },
  {
    title: 'Let\'s Do It',
    poster: 'https://image.tmdb.org/t/p/w780/gcieX1kDEW715nTcghAZNFIUA15.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/e2FDD5xNanQpalWCNyNH5l0lOOY.jpg',
  },
  {
    title: 'The Interrogation Room',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-eUX7T1itc94.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-eUX7T1itc94.jpg',
  },
  {
    title: 'Breaking Out',
    poster: 'https://image.tmdb.org/t/p/w780/auQ67e5mSPkN9UuTc6j5WRPDzaf.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/35VjwVCVJ7QpFFkX7RoTnmeI5Je.jpg',
  },
  {
    title: 'Double Cross',
    poster: 'https://image.tmdb.org/t/p/w780/4kWVqZtwlNFHMbWPRdvY0BPpsG5.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/hyO805gtwIhqlXJVKLEjLMlsOqx.jpg',
  },
  {
    title: 'Ukulo Iyi',
    poster: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-eUX7T1itc94.jpg',
    backdrop: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/movie-eUX7T1itc94.jpg',
  },
  {
    title: '11:59',
    poster: 'https://image.tmdb.org/t/p/w780/5z8lPwPJTkKLwOnA5QIqYaz9e7J.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/vJWUaWY8gv11t7JO20aTWF5uxl7.jpg',
  },
  {
    title: 'You Deserve Better',
    poster: 'https://image.tmdb.org/t/p/w780/mS1Upo7GecuGEwL7HXSEACASgLy.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/tZVP9HOfVdk8jtYHNaQTwSm3wll.jpg',
  },
  {
    title: 'Waiting for Tomorrow',
    poster: 'https://image.tmdb.org/t/p/w780/hfZUbvqabczFo93PdyAt8V43dlG.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/7pQvCRkDN3ROiinSWwmne0TgaOR.jpg',
  }
];

async function main() {
  console.log('🚀 Updating posters and backdrops for all newly enriched films...');

  for (const art of FILM_ARTWORK) {
    const { data: films } = await supabase
      .from('films')
      .select('id, title')
      .ilike('title', art.title);

    if (!films || films.length === 0) {
      console.warn(`No film matching "${art.title}" found.`);
      continue;
    }

    for (const f of films) {
      console.log(`✨ Updating [${f.id}] "${f.title}"...`);
      await supabase
        .from('films')
        .update({
          poster_url: art.poster,
          backdrop_url: art.backdrop,
          backdrop: art.backdrop,
        })
        .eq('id', f.id);
    }
  }

  console.log('🎉 ALL POSTERS & BACKDROPS UPDATED WITH HIGH-RESOLUTION ARTWORK!');
}

main().catch(console.error);
