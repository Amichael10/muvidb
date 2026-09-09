import { serviceSupabase } from './lib/credit_consensus_verifier';

async function main() {
  const { data: films } = await serviceSupabase
    .from('films')
    .select('id, title, year, youtube_watch_url, created_at')
    .not('youtube_watch_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Sample test candidates:');
  for (const f of films || []) {
    const { count } = await serviceSupabase.from('credits').select('*', { count: 'exact', head: true }).eq('film_id', f.id);
    console.log(`- [${f.title}] (${f.id}) | Credits: ${count} | URL: ${f.youtube_watch_url}`);
  }
}

main().catch(console.error);
