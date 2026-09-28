import { supabase } from '../supabase.js';
import { getPlatformPublishingCredentials } from '../threads_oauth.js';
function httpError(status: number, message: string) { return Object.assign(new Error(message), { status }); }

export async function resolveDestinationConnection(destinationId: string | null, platform: string, contentType?: string) {
  // Streaming alerts must never fall back to the main Instagram account.
  if (platform === 'instagram' && contentType === 'where_to_watch') {
    const { data, error } = await supabase.from('social_connections').select('id')
      .eq('platform', 'instagram').eq('status', 'connected').eq('username', 'muvi_database').maybeSingle();
    if (error) throw error;
    if (!data) throw httpError(409, 'Connect @muvi_database before publishing Streaming Alerts to Instagram.');
    await getPlatformPublishingCredentials(platform, data.id);
    return data.id;
  }
  if (contentType === 'where_to_watch' && platform !== 'instagram') {
    const { data: main, error } = await supabase.from('content_destinations').select('id').eq('slug', 'main-muvidb').single();
    if (error) throw error;
    destinationId = main.id;
  }
  if (!destinationId) return (await getPlatformPublishingCredentials(platform)).connection.id;
  const { data, error } = await supabase.from('content_destination_platforms')
    .select('social_connection_id').eq('destination_id', destinationId).eq('platform', platform).eq('enabled', true).maybeSingle();
  if (error) throw error;
  if (!data?.social_connection_id) throw httpError(409, `Choose a ${platform} account for this destination before scheduling.`);
  await getPlatformPublishingCredentials(platform, data.social_connection_id);
  return data.social_connection_id;
}
