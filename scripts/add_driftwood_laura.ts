import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`Attempt ${i + 1} failed. Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

async function main() {
  const lauraId = '6ee6425f-9e69-4db3-91f1-db31d4ee4389';

  await withRetry(async () => {
    // 1. Check if Driftwood film exists
    let { data: films } = await sb.from('films').select('*').ilike('title', '%driftwood%');
    let driftwood = films && films.length > 0 ? films[0] : null;

    if (!driftwood) {
      console.log('Creating Driftwood film record...');
      const { data: newFilm, error: filmErr } = await sb.from('films').insert({
        title: 'Driftwood',
        synopsis: 'A mystical drama that explores themes of Yoruba spirituality, cultural identity, and self-discovery as a young woman named Ama reconciles her ancestral heritage with her present-day identity and encounters a deific presence.',
        release_date: '2026-01-01',
        year: 2026,
        status: 'released',
      }).select().single();

      if (filmErr) throw filmErr;
      driftwood = newFilm;
    }

    console.log('Driftwood Film ID:', driftwood.id);

    // 2. Check/Add Temi Oluokun (Director)
    let { data: directors } = await sb.from('people').select('*').ilike('name', '%Temi Oluokun%');
    let temi = directors && directors.length > 0 ? directors[0] : null;
    if (!temi) {
      const { data: newTemi, error: temiErr } = await sb.from('people').insert({
        name: 'Temi Oluokun',
        gender: 'Female',
        source: 'manual',
      }).select().single();
      if (!temiErr) temi = newTemi;
    }

    if (temi) {
      const { data: existingDirectorCredit } = await sb
        .from('credits')
        .select('*')
        .eq('person_id', temi.id)
        .eq('film_id', driftwood.id);
      if (!existingDirectorCredit || existingDirectorCredit.length === 0) {
        await sb.from('credits').insert({
          person_id: temi.id,
          film_id: driftwood.id,
          role: 'Director',
        });
        console.log('Added Director credit for Temi Oluokun.');
      }
    }

    // 3. Add Laura Lambo credit as Odara
    const { data: existingLauraCredit } = await sb
      .from('credits')
      .select('*')
      .eq('person_id', lauraId)
      .eq('film_id', driftwood.id);

    if (!existingLauraCredit || existingLauraCredit.length === 0) {
      console.log('Adding credit for Laura Lambo as Odara in Driftwood...');
      const { data: newCredit, error: creditErr } = await sb.from('credits').insert({
        person_id: lauraId,
        film_id: driftwood.id,
        role: 'Actor',
        character_name: 'Odara',
      }).select().single();

      if (creditErr) throw creditErr;
      console.log('Successfully added credit for Laura Lambo:', newCredit.id);
    } else {
      console.log('Laura Lambo credit already exists:', existingLauraCredit[0].id);
    }

    // 4. Update Laura's film count
    const { data: allCredits } = await sb.from('credits').select('id').eq('person_id', lauraId);
    const filmCount = allCredits ? allCredits.length : 1;

    const { error: personErr } = await sb.from('people').update({
      film_count: filmCount,
      updated_at: new Date().toISOString()
    }).eq('id', lauraId);

    if (personErr) throw personErr;
    console.log(`Updated Laura Lambo's film_count to ${filmCount}.`);
  });
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
