import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000
}));

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60000) })
    }
  }
);

async function retry<T>(fn: () => Promise<T>, retries = 4, delay = 1000): Promise<T> {
  let lastErr: any;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      console.warn(`  [retry ${i}/${retries}] ${err.message}. Waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 1.5;
    }
  }
  throw lastErr;
}

const TITLES = [
  'School Run',
  'King Mabutu',
  'Andauotu',
  'Kuvana',
  'Black Day',
  'The Hustle Is Real',
  'Fair Lady',
  'The Plot',
  'Heart Trending',
  'Next Door',
  '25th Birthday',
  'Hotel Choco',
  'Rumuokani',
  'Turn',
  'Irreplaceable',
  'Pranked',
  'For my Mama',
  'A Moment’s Peace',
  'Orí',
  'Onajíte',
  'Ihunanya’m',
  'Diary of a Virgin Boy',
  'Mosebolatan',
  'Kadara',
  'Taxi Driver',
  'Ija Ominira',
  'Aiye',
  'Jaiyesimi',
  'Aropin N’Tenia',
  'Agba Arin',
  'Opa Aje',
  'Ayanmo',
  'Koto Orun',
  'Ti Oluwa Ni Ile',
  'Saworoide',
  'Agogo Ewo',
  'Thunderbolt: Magun',
  'Oleku',
  'Dazzling Mirage',
  'The Narrow Path',
  'Arugba',
  'Maami'
];

async function main() {
  console.log(`Checking and updating ${TITLES.length} titles to 'feature_film'...`);

  for (const title of TITLES) {
    try {
      const films = await retry(async () => {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, content_type')
          .ilike('title', title);
        if (error) throw error;
        return data || [];
      });

      if (films.length === 0) {
        console.log(`- "${title}" not found in DB`);
        continue;
      }

      for (const f of films) {
        if (f.content_type !== 'feature_film') {
          await retry(async () => {
            const { error: updErr } = await supabase
              .from('films')
              .update({ content_type: 'feature_film' })
              .eq('id', f.id);
            if (updErr) throw updErr;
          });
          console.log(`  ✅ Updated "${f.title}" (${f.id}): ${f.content_type || 'movie'} -> feature_film`);
        } else {
          console.log(`  ℹ️ "${f.title}" already 'feature_film'`);
        }
      }
    } catch (err: any) {
      console.error(`  ❌ Error processing "${title}":`, err.message);
    }
  }

  const { count } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', 'feature_film');

  console.log(`\n🎉 Total 'feature_film' in DB now: ${count}`);
}

main().catch(console.error);
