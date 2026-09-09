import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
  console.log('YouTube API key present:', !!apiKey);

  if (!apiKey) {
    console.error('No YouTube API key found in env');
    return;
  }

  // 1. Search for channel "FB NOLLY TV" or "fbnolly"
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=FB+NOLLY+TV&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Channel search results for "FB NOLLY TV":', JSON.stringify(data.items?.map((i: any) => ({
    id: i.id.channelId,
    title: i.snippet.title,
    description: i.snippet.description,
    customUrl: i.snippet.customUrl
  })), null, 2));

  // 2. Also search for handle @fbnollytv
  const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&forHandle=fbnollytv&key=${apiKey}`;
  const hRes = await fetch(handleUrl);
  const hData = await hRes.json();
  console.log('Handle @fbnollytv lookup:', JSON.stringify(hData.items?.map((i: any) => ({
    id: i.id,
    title: i.snippet.title,
    customUrl: i.snippet.customUrl,
    subscriberCount: i.statistics?.subscriberCount,
    videoCount: i.statistics?.videoCount
  })), null, 2));

  // 3. Search videos from FB NOLLY TV
  if (data.items && data.items.length > 0) {
    const channelId = data.items[0].id.channelId;
    console.log(`\nFetching videos from channel ${channelId} (${data.items[0].snippet.title})...`);
    const vUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&key=${apiKey}`;
    const vRes = await fetch(vUrl);
    const vData = await vRes.json();
    console.log('Latest videos:', vData.items?.map((v: any) => ({
      videoId: v.id.videoId,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt
    })));
  }
}

main().catch(console.error);
