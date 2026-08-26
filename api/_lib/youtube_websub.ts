import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { notifyYouTubeUploads, type ChannelRow, type UploadCandidate } from './youtube_upload_notify.js';
import { parseDuration, ytGet } from './yt_service.js';

const DEFAULT_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const DEFAULT_LEASE_SECONDS = 864_000;
const RENEW_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;
const SIGNATURE_ALGORITHMS = new Set(['sha1', 'sha256', 'sha384', 'sha512']);

export type YouTubeWebSubEntry = {
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

type SubscriptionRow = {
  channel_id: string;
  youtube_channel_id: string;
  status: string;
  baseline_at: string;
  lease_expires_at?: string | null;
  last_subscribe_attempt_at?: string | null;
};

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function tagValue(xml: string, tag: string): string | null {
  const escaped = tag.replace(':', '\\:');
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : null;
}

export function parseYouTubeAtomFeed(xml: string): YouTubeWebSubEntry[] {
  const entries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)];
  return entries.flatMap((match) => {
    const entry = match[1];
    const videoId = tagValue(entry, 'yt:videoId');
    const channelId = tagValue(entry, 'yt:channelId');
    if (!videoId || !channelId) return [];
    return [
      {
        videoId,
        channelId,
        title: tagValue(entry, 'title') || 'Untitled YouTube upload',
        publishedAt: tagValue(entry, 'published'),
        updatedAt: tagValue(entry, 'updated'),
      },
    ];
  });
}

export function youtubeTopicChannelId(topic: string): string | null {
  try {
    const url = new URL(topic);
    if (url.hostname !== 'www.youtube.com' && url.hostname !== 'youtube.com') return null;
    if (url.pathname !== '/feeds/videos.xml') return null;
    const channelId = url.searchParams.get('channel_id')?.trim() || '';
    return /^UC[\w-]+$/.test(channelId) ? channelId : null;
  } catch {
    return null;
  }
}

export function verifyWebSubSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const separator = signatureHeader.indexOf('=');
  if (separator <= 0) return false;
  const algorithm = signatureHeader.slice(0, separator).toLowerCase();
  const supplied = signatureHeader.slice(separator + 1).toLowerCase();
  if (!SIGNATURE_ALGORITHMS.has(algorithm) || !/^[0-9a-f]+$/.test(supplied)) return false;
  const expected = createHmac(algorithm, secret).update(rawBody).digest('hex');
  return safeEqual(supplied, expected);
}

export function isAfterWebSubBaseline(publishedAt: string | null, baselineAt: string): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  const baseline = new Date(baselineAt).getTime();
  return Number.isFinite(published) && Number.isFinite(baseline) && published > baseline;
}

function callbackTokenIsValid(req: VercelRequest): boolean {
  const expected = env('YOUTUBE_WEBSUB_CALLBACK_TOKEN');
  const supplied = String(req.query?.token || '');
  return Boolean(expected && supplied && safeEqual(supplied, expected));
}

function callbackUrl(): string {
  const configured = env('YOUTUBE_WEBSUB_CALLBACK_URL');
  const base =
    configured ||
    `${env('VITE_PUBLIC_SITE_URL') || env('PUBLIC_SITE_URL') || 'https://muvidb.com'}/api/automation?action=youtube-websub`;
  const url = new URL(base);
  url.searchParams.set('token', env('YOUTUBE_WEBSUB_CALLBACK_TOKEN'));
  return url.toString();
}

async function rawRequestBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req.body != null) return Buffer.from(JSON.stringify(req.body), 'utf8');

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function findSubscriptionByExternalId(youtubeChannelId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('youtube_websub_subscriptions')
    .select('channel_id,youtube_channel_id,status,baseline_at,lease_expires_at,last_subscribe_attempt_at')
    .eq('youtube_channel_id', youtubeChannelId)
    .maybeSingle();
  if (error) throw error;
  return data as SubscriptionRow | null;
}

async function loadChannel(channelId: string): Promise<ChannelRow | null> {
  const { data, error } = await supabase
    .from('channels')
    .select('id,name,channel_handle,channel_id,channel_url')
    .eq('id', channelId)
    .eq('sync_enabled', true)
    .maybeSingle();
  if (error) throw error;
  return data as ChannelRow | null;
}

async function videoCandidate(entry: YouTubeWebSubEntry): Promise<UploadCandidate | null> {
  const response = await ytGet('videos', {
    part: 'snippet,contentDetails,status',
    id: entry.videoId,
  });
  const video = response?.items?.[0];
  if (!video || video.status?.privacyStatus === 'private') return null;
  return {
    video_id: entry.videoId,
    title: video.snippet?.title || entry.title,
    duration_seconds: parseDuration(video.contentDetails?.duration || ''),
    published_at: video.snippet?.publishedAt || entry.publishedAt,
    thumbnail_url: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || null,
  };
}

export async function processYouTubeWebSubEntries(
  entries: YouTubeWebSubEntry[],
  dependencies?: {
    findSubscription?: typeof findSubscriptionByExternalId;
    getChannel?: typeof loadChannel;
    getVideo?: typeof videoCandidate;
    notify?: typeof notifyYouTubeUploads;
    recordEvent?: (subscription: SubscriptionRow, entry: YouTubeWebSubEntry) => Promise<void>;
  },
) {
  const findSubscription = dependencies?.findSubscription || findSubscriptionByExternalId;
  const getChannel = dependencies?.getChannel || loadChannel;
  const getVideo = dependencies?.getVideo || videoCandidate;
  const notify = dependencies?.notify || notifyYouTubeUploads;
  let notified = 0;
  let skipped = 0;

  for (const entry of entries) {
    const subscription = await findSubscription(entry.channelId);
    if (!subscription || !['pending', 'active'].includes(subscription.status)) {
      skipped += 1;
      continue;
    }

    const eventTime = entry.publishedAt || entry.updatedAt;
    if (!isAfterWebSubBaseline(eventTime, subscription.baseline_at)) {
      skipped += 1;
      continue;
    }

    const channel = await getChannel(subscription.channel_id);
    if (!channel) {
      skipped += 1;
      continue;
    }

    const candidate = await getVideo(entry);
    if (!candidate) {
      skipped += 1;
      continue;
    }

    const result = await notify(channel, [candidate], {
      baselineAt: subscription.baseline_at,
      source: 'websub',
    });
    notified += result.notified;
    skipped += result.skipped;

    if (dependencies?.recordEvent) {
      await dependencies.recordEvent(subscription, entry);
    } else {
      await supabase
        .from('youtube_websub_subscriptions')
        .update({
          last_event_at: new Date().toISOString(),
          last_video_id: entry.videoId,
          last_video_published_at: entry.publishedAt,
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('channel_id', subscription.channel_id);
    }
  }

  return { received: entries.length, notified, skipped };
}

async function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = String(req.query['hub.mode'] || '');
  const topic = String(req.query['hub.topic'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const leaseSeconds = Math.max(0, Number(req.query['hub.lease_seconds'] || 0));
  const externalId = youtubeTopicChannelId(topic);

  if (!['subscribe', 'unsubscribe'].includes(mode) || !externalId || !challenge || challenge.length > 512) {
    return res.status(404).end();
  }

  const subscription = await findSubscriptionByExternalId(externalId);
  if (!subscription) return res.status(404).end();

  const now = new Date();
  await supabase
    .from('youtube_websub_subscriptions')
    .update({
      status: mode === 'subscribe' ? 'active' : 'unsubscribed',
      lease_expires_at:
        mode === 'subscribe' && leaseSeconds ? new Date(now.getTime() + leaseSeconds * 1000).toISOString() : null,
      last_verified_at: now.toISOString(),
      failure_count: 0,
      last_error: null,
      updated_at: now.toISOString(),
    })
    .eq('channel_id', subscription.channel_id);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(challenge);
}

export async function youtubeWebSubHandler(req: VercelRequest, res: VercelResponse) {
  if (!callbackTokenIsValid(req)) return res.status(401).json({ error: 'Invalid YouTube callback token' });

  if (req.method === 'GET') return handleVerification(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = env('YOUTUBE_WEBSUB_SECRET');
  if (!secret) return res.status(503).json({ error: 'YouTube WebSub is not configured' });

  const rawBody = await rawRequestBody(req);
  const signature = String(req.headers['x-hub-signature'] || '');
  if (!verifyWebSubSignature(rawBody, signature, secret)) {
    return res.status(202).json({ accepted: false, reason: 'invalid_signature' });
  }

  const entries = parseYouTubeAtomFeed(rawBody.toString('utf8'));
  const result = await processYouTubeWebSubEntries(entries);
  return res.status(200).json({ accepted: true, ...result });
}

async function resolveYouTubeChannelId(channel: ChannelRow): Promise<string | null> {
  const direct = channel.channel_id?.trim();
  if (direct && /^UC[\w-]+$/.test(direct)) return direct;
  const fromUrl = channel.channel_url?.match(/\/channel\/(UC[\w-]+)/)?.[1];
  if (fromUrl) return fromUrl;
  const handle = channel.channel_handle?.replace(/^@/, '').trim();
  if (!handle) return null;
  const response = await ytGet('channels', { part: 'id', forHandle: handle });
  return response?.items?.[0]?.id || null;
}

async function requestSubscription(topicUrl: string): Promise<void> {
  const secret = env('YOUTUBE_WEBSUB_SECRET');
  const token = env('YOUTUBE_WEBSUB_CALLBACK_TOKEN');
  if (!secret || !token) throw new Error('YOUTUBE_WEBSUB_SECRET and YOUTUBE_WEBSUB_CALLBACK_TOKEN are required');

  const form = new URLSearchParams({
    'hub.callback': callbackUrl(),
    'hub.mode': 'subscribe',
    'hub.topic': topicUrl,
    'hub.lease_seconds': String(DEFAULT_LEASE_SECONDS),
    'hub.secret': secret,
  });
  const response = await fetch(env('YOUTUBE_WEBSUB_HUB_URL') || DEFAULT_HUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`YouTube WebSub hub returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export async function renewYouTubeWebSubSubscriptions(input: { force?: boolean } = {}) {
  if (!env('YOUTUBE_WEBSUB_SECRET') || !env('YOUTUBE_WEBSUB_CALLBACK_TOKEN')) {
    throw new Error('YouTube WebSub secrets are not configured');
  }

  const { data: channels, error } = await supabase
    .from('channels')
    .select('id,name,channel_handle,channel_id,channel_url')
    .eq('sync_enabled', true)
    .order('name');
  if (error) throw error;

  const now = new Date();
  const results: Array<Record<string, unknown>> = [];
  for (const channel of (channels || []) as ChannelRow[]) {
    try {
      const youtubeChannelId = await resolveYouTubeChannelId(channel);
      if (!youtubeChannelId) throw new Error('Could not resolve a YouTube channel ID');
      const topicUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(youtubeChannelId)}`;
      const { data: existing, error: existingError } = await supabase
        .from('youtube_websub_subscriptions')
        .select('channel_id,status,baseline_at,lease_expires_at,last_subscribe_attempt_at')
        .eq('channel_id', channel.id)
        .maybeSingle();
      if (existingError) throw existingError;

      const leaseTime = existing?.lease_expires_at ? new Date(existing.lease_expires_at).getTime() : 0;
      if (!input.force && existing?.status === 'active' && leaseTime > now.getTime() + RENEW_BEFORE_MS) {
        results.push({ channel: channel.name, status: 'current' });
        continue;
      }

      await supabase.from('youtube_websub_subscriptions').upsert(
        {
          channel_id: channel.id,
          youtube_channel_id: youtubeChannelId,
          topic_url: topicUrl,
          status: 'pending',
          baseline_at: existing?.baseline_at || now.toISOString(),
          last_subscribe_attempt_at: now.toISOString(),
          last_error: null,
          updated_at: now.toISOString(),
        },
        { onConflict: 'channel_id' },
      );

      if (!channel.channel_id || channel.channel_id !== youtubeChannelId) {
        await supabase.from('channels').update({ channel_id: youtubeChannelId }).eq('id', channel.id);
      }

      await requestSubscription(topicUrl);
      results.push({
        channel: channel.name,
        status: existing ? 'renewal_requested' : 'subscription_requested',
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      await supabase
        .from('youtube_websub_subscriptions')
        .update({
          status: 'failed',
          last_error: message.slice(0, 1000),
          updated_at: now.toISOString(),
        })
        .eq('channel_id', channel.id);
      results.push({ channel: channel.name, status: 'failed', error: message });
    }
  }

  return {
    channels: channels?.length || 0,
    requested: results.filter((result) => String(result.status).includes('requested')).length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}
