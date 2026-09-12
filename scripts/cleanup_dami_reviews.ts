import { supabase } from './lib/db';

async function cleanup() {
  const CRITIC_ID = 'abe0f198-5b70-47fb-b5e4-b08a93bdef6d';
  
  // Delete the accidental Agatha Christie row
  const { data: evilRev } = await supabase
    .from('critic_reviews')
    .select('id, films(title)')
    .eq('critic_id', CRITIC_ID);

  for (const r of (evilRev || [])) {
    const title = (r as any).films?.title;
    if (title && title.includes('Agatha Christie')) {
      console.log(`Deleting mismatched review: ${title} (${r.id})`);
      await supabase.from('critic_reviews').delete().eq('id', r.id);
    }
  }

  const { data: finalRevs } = await supabase
    .from('critic_reviews')
    .select('id, rating, quote, review_url, films(id, title, year, poster_url)')
    .eq('critic_id', CRITIC_ID)
    .order('created_at', { ascending: false });

  console.log(`\n=== FINAL CLEAN VERIFIED REVIEWS FOR DAMI DAWSON (${finalRevs?.length}) ===`);
  for (const r of (finalRevs || [])) {
    const f = (r as any).films;
    console.log(`• [${r.rating}★] ${f?.title} (${f?.year || 'N/A'}) - URL: ${r.review_url}`);
  }
}

cleanup().catch(console.error);
