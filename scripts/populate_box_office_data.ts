import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface BoxOfficeRecord {
  slug: string;
  title: string;
  domestic: number;
  worldwide?: number;
  currency: string;
  source: string;
}

async function populateBoxOffice() {
  const records: BoxOfficeRecord[] = [
    {
      slug: 'a-tribe-called-judah',
      title: 'A Tribe Called Judah',
      domestic: 1404000000,
      currency: 'NGN',
      source: 'CEAN Official / Comscore'
    },
    {
      slug: 'battle-on-buka-street',
      title: 'Battle on Buka Street',
      domestic: 668423056,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'omo-ghetto-the-saga',
      title: 'Omo Ghetto: The Saga',
      domestic: 636129120,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'the-wedding-party-2',
      title: 'The Wedding Party 2',
      domestic: 502400000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'the-wedding-party',
      title: 'The Wedding Party',
      domestic: 452288605,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'chief-daddy',
      title: 'Chief Daddy',
      domestic: 387500000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'brotherhood',
      title: 'Brotherhood',
      domestic: 328881120,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'malaika',
      title: 'Malaika',
      domestic: 302000000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'sugar-rush',
      title: 'Sugar Rush',
      domestic: 287000000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'ijakumo',
      title: 'Ijakumo',
      domestic: 278000000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'beast-of-two-worlds',
      title: 'Beast of Two Worlds',
      domestic: 252000000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'king-of-boys',
      title: 'King of Boys',
      domestic: 244000000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'merry-men',
      title: 'Merry Men',
      domestic: 235000000,
      currency: 'NGN',
      source: 'CEAN Official'
    },
    {
      slug: 'funmilayo-ransome-kuti',
      title: 'Funmilayo Ransome-Kuti',
      domestic: 155000000,
      currency: 'NGN',
      source: 'CEAN Official'
    }
  ];

  console.log(`Starting Box Office update for ${records.length} blockbusters...`);

  for (const rec of records) {
    const { data: film } = await supabase
      .from('films')
      .select('id, title, slug, streaming_links')
      .or(`slug.eq.${rec.slug},title.ilike.%${rec.title}%`)
      .limit(1)
      .maybeSingle();

    if (film) {
      const existingLinks = typeof film.streaming_links === 'object' && film.streaming_links !== null ? film.streaming_links : {};
      const updatedLinks = {
        ...existingLinks,
        box_office: {
          domestic: rec.domestic,
          worldwide: rec.worldwide || 0,
          currency: rec.currency,
          source: rec.source,
          updated_at: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('films')
        .update({
          streaming_links: updatedLinks
        })
        .eq('id', film.id);

      if (error) {
        console.error(`Error updating box office for ${film.title}:`, error.message);
      } else {
        console.log(`✓ Updated Box Office for "${film.title}": ₦${rec.domestic.toLocaleString('en-NG')}`);
      }
    } else {
      console.log(`⚠️ Film not found in DB: ${rec.title} (${rec.slug})`);
    }
  }

  console.log('--- BOX OFFICE POPULATION SCRIPT FINISHED ---');
}

populateBoxOffice();
