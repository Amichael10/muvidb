import { serviceSupabase } from './lib/credit_consensus_verifier';

async function main() {
  const { count: totalFilms } = await serviceSupabase
    .from('films')
    .select('*', { count: 'exact', head: true });

  console.log(`Total films in database: ${totalFilms}`);

  // Query films with youtube_watch_url
  const { count: ytFilms } = await serviceSupabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .not('youtube_watch_url', 'is', null);

  console.log(`Total films with YouTube URL: ${ytFilms}`);
}

main().catch(console.error);
