import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ytGet, parseDuration, cleanTitle } from "../api/_lib/yt_service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

async function run() {
  const channelId = "70a2e399-4299-4a14-adb0-0afe0e0d9c12"; // NOLLYWOOD CLASSIC MOVIE CINEMA
  
  const { data: ch, error: chFetchErr } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (chFetchErr || !ch) {
    console.error("Channel not found:", chFetchErr);
    return;
  }
  
  console.log("Channel found:", ch.name);
  
  const handle = ch.channel_handle?.replace(/^@/, "");
  let uploadsId = "";
  let discoveredChannelId = ch.channel_id;

  // 1. Resolve uploads playlist ID
  let ytChannelData = null;
  if (discoveredChannelId) {
    ytChannelData = await ytGet("channels", { part: "snippet,contentDetails,statistics,brandingSettings", id: discoveredChannelId });
  } else if (handle) {
    ytChannelData = await ytGet("channels", { part: "snippet,contentDetails,statistics,brandingSettings", forHandle: handle });
  }

  if (ytChannelData?.items?.[0]) {
    const item = ytChannelData.items[0];
    discoveredChannelId = item.id;
    uploadsId = item.contentDetails?.relatedPlaylists?.uploads;
  }

  console.log("Uploads playlist ID:", uploadsId);

  if (!uploadsId) {
    console.error("No uploads playlist found.");
    return;
  }

  // 2. Fetch latest videos
  const { data: latestVid } = await supabase.from("channel_videos").select("published_at").eq("channel_id", ch.id).order("published_at", { ascending: false }).limit(1).single();
  const latestDate = latestVid ? new Date(latestVid.published_at) : new Date(0);
  console.log("Latest video date in DB:", latestDate);

  const plData = await ytGet("playlistItems", { 
    part: "snippet", playlistId: uploadsId, maxResults: "5", pageToken: ""
  });
  
  console.log("Videos in playlist:", plData.items?.length);
  if (plData.items && plData.items.length > 0) {
    const videoIds = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(",");
    const vData = await ytGet("videos", { part: "contentDetails,snippet", id: videoIds });
    console.log("Videos fetched from YouTube:", vData.items?.map((v: any) => ({
      title: v.snippet.title,
      duration: v.contentDetails.duration,
      parsed_duration: parseDuration(v.contentDetails.duration)
    })));
  }
}

run().catch(console.error);
