import { supabase } from '../api/_lib/supabase.ts';

async function main() {
  console.log('Searching deletion_logs for FB or NOLLY...');
  const { data: logs, error } = await supabase
    .from('deletion_logs')
    .select('*')
    .or('entity_name.ilike.%fb%,entity_name.ilike.%fbnolly%,entity_name.ilike.%fb nolly%');

  console.log('Logs matching FB/FBNOLLY:', logs);

  console.log('\nSearching channels table for any matching FB...');
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .or('name.ilike.%fb%,name.ilike.%fbnolly%,channel_handle.ilike.%fb%');
  console.log('Channels matching FB:', channels);

  console.log('\nChecking YouTube API / oEmbed for @FBNOLLY or FB Nolly...');
  try {
    const res = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/@FBNOLLY&format=json');
    console.log('oEmbed @FBNOLLY status:', res.status);
    if (res.ok) {
      console.log('oEmbed data:', await res.json());
    }
  } catch (e: any) {
    console.log('oEmbed error:', e.message);
  }

  try {
    const res2 = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/@fbnollytv&format=json');
    console.log('oEmbed @fbnollytv status:', res2.status);
    if (res2.ok) {
      console.log('oEmbed data:', await res2.json());
    }
  } catch (e: any) {
    console.log('oEmbed error 2:', e.message);
  }
}

main().catch(console.error);
