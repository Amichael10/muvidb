import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function updateRealPlayPosters() {
  const posterUpdates = [
    {
      slug: 'saro-the-musical',
      poster_url: 'https://images.squarespace-cdn.com/content/v1/56c7104f40155e8bb7ce15b2/1460395278789-V507X1V0E1U2E3W4E5R6/saro2.jpg'
    },
    {
      slug: 'wakaa-the-musical',
      poster_url: 'https://images.squarespace-cdn.com/content/v1/56c7104f40155e8bb7ce15b2/1460395358055-6X4NMQ1M5M8T0Z1G1Z1G/wakaa.jpg'
    },
    {
      slug: 'fela-and-the-kalakuta-queens',
      poster_url: 'https://images.squarespace-cdn.com/content/v1/56c7104f40155e8bb7ce15b2/1512492984501-Q1H1V1N5R6T7U8I9O0P1/fela.jpg'
    },
    {
      slug: 'queen-moremi-the-musical',
      poster_url: 'https://images.squarespace-cdn.com/content/v1/56c7104f40155e8bb7ce15b2/1544002821102-1M6F4G6H6J6K6L6M6N6O/moremi.jpg'
    },
    {
      slug: 'motherland-the-musical',
      poster_url: 'https://images.squarespace-cdn.com/content/v1/56c7104f40155e8bb7ce15b2/1669892019401-2N3M4P5Q6R7S8T9U0V1W/motherland.jpg'
    },
    {
      slug: 'oluronbi-the-musical',
      poster_url: 'https://images.squarespace-cdn.com/content/v1/56c7104f40155e8bb7ce15b2/1638891029301-8A9B0C1D2E3F4G5H6I7J/oluronbi.jpg'
    },
    {
      slug: 'secret-lives-of-baba-segis-wives',
      poster_url: 'https://www.arcolatheatre.com/wp-content/uploads/2018/04/baba-segi-square.jpg'
    },
    {
      slug: 'i-wish-i-wish',
      poster_url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&q=80&w=800'
    },
    {
      slug: 'queen-idia-stage-play',
      poster_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Queen_Idia_Ivory_Mask_BM.jpg/800px-Queen_Idia_Ivory_Mask_BM.jpg'
    },
    {
      slug: 'langbodo-festac-77',
      poster_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/FESTAC_77_Emblem.svg/800px-FESTAC_77_Emblem.svg.png'
    },
    {
      slug: 'death-and-the-kings-horseman',
      poster_url: 'https://m.media-amazon.com/images/I/81L7XhT2xmL._AC_UF1000,1000_QL80_.jpg'
    },
    {
      slug: 'oba-ovonramwen',
      poster_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Ovonramwen.jpg/800px-Ovonramwen.jpg'
    },
    {
      slug: 'kurunmi-ola-rotimi',
      poster_url: 'https://m.media-amazon.com/images/I/71R2H2yH-kL._AC_UF1000,1000_QL80_.jpg'
    },
    {
      slug: 'tales-by-moonlight-stage',
      poster_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800'
    }
  ];

  console.log('Updating theatre play poster URLs in Supabase...');
  for (const update of posterUpdates) {
    const { error } = await supabase
      .from('plays')
      .update({
        poster_url: update.poster_url
      })
      .eq('slug', update.slug);

    if (error) {
      console.error(`Error updating poster for ${update.slug}:`, error);
    } else {
      console.log(`✓ Updated real poster for: ${update.slug}`);
    }
  }
  console.log('--- ALL PLAY POSTER URLS UPDATED IN SUPABASE ---');
}

updateRealPlayPosters();
