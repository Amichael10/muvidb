import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function linkBySlug() {
  const bapCompanyId = 'c59e3e31-e823-4031-a89d-5b4bd257b5ba';
  const slugs = [
    'funmilayo-ransome-kuti',
    'house-of-gaa',
    'man-of-god-2022',
    'collision-course',
    'the-bling-lagosians',
    '93-days'
  ];

  for (const slug of slugs) {
    const { data: film } = await supabase
      .from('films')
      .select('id, title')
      .eq('slug', slug)
      .maybeSingle();

    if (film) {
      await supabase
        .from('films')
        .update({ production_company_id: bapCompanyId })
        .eq('id', film.id);

      const { data: fc } = await supabase
        .from('film_companies')
        .select('*')
        .eq('film_id', film.id)
        .eq('company_id', bapCompanyId)
        .maybeSingle();

      if (!fc) {
        await supabase.from('film_companies').insert({
          film_id: film.id,
          company_id: bapCompanyId,
          role: 'production'
        });
      }
      console.log(`Successfully linked ${film.title} (${film.id}) to BAP Productions`);
    } else {
      console.log(`Film with slug ${slug} not found`);
    }
  }
}

linkBySlug();
