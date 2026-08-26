import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  isAfterWebSubBaseline,
  parseYouTubeAtomFeed,
  processYouTubeWebSubEntries,
  verifyWebSubSignature,
  youtubeTopicChannelId,
} from './youtube_websub';

const atomPayload = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>yt:video:video-new</id>
    <yt:videoId>video-new</yt:videoId>
    <yt:channelId>UC123_channel</yt:channelId>
    <title>New &amp; Noteworthy</title>
    <published>2026-08-26T08:30:00+00:00</published>
    <updated>2026-08-26T08:31:00+00:00</updated>
  </entry>
</feed>`;

describe('YouTube WebSub', () => {
  it('parses YouTube Atom entries and XML entities', () => {
    expect(parseYouTubeAtomFeed(atomPayload)).toEqual([
      {
        videoId: 'video-new',
        channelId: 'UC123_channel',
        title: 'New & Noteworthy',
        publishedAt: '2026-08-26T08:30:00+00:00',
        updatedAt: '2026-08-26T08:31:00+00:00',
      },
    ]);
  });

  it('validates signed payloads and rejects tampering', () => {
    const body = Buffer.from(atomPayload);
    const secret = 'test-websub-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyWebSubSignature(body, signature, secret)).toBe(true);
    expect(verifyWebSubSignature(Buffer.from(`${atomPayload}tampered`), signature, secret)).toBe(false);
    expect(verifyWebSubSignature(body, 'md5=abc', secret)).toBe(false);
  });

  it('accepts only canonical YouTube channel feed topics', () => {
    expect(youtubeTopicChannelId('https://www.youtube.com/feeds/videos.xml?channel_id=UC123_channel')).toBe(
      'UC123_channel',
    );
    expect(youtubeTopicChannelId('https://evil.example/feeds/videos.xml?channel_id=UC123_channel')).toBeNull();
  });

  it('uses the first-run baseline to reject existing uploads', () => {
    const baseline = '2026-08-26T08:00:00.000Z';
    expect(isAfterWebSubBaseline('2026-08-26T08:30:00.000Z', baseline)).toBe(true);
    expect(isAfterWebSubBaseline('2026-08-26T07:59:59.000Z', baseline)).toBe(false);
  });

  it('processes a signed-feed entry through metadata lookup and notification once', async () => {
    const entries = parseYouTubeAtomFeed(atomPayload);
    const notify = vi.fn().mockResolvedValue({ notified: 1, skipped: 0 });
    const recordEvent = vi.fn().mockResolvedValue(undefined);
    const result = await processYouTubeWebSubEntries(entries, {
      findSubscription: vi.fn().mockResolvedValue({
        channel_id: '11111111-1111-4111-8111-111111111111',
        youtube_channel_id: 'UC123_channel',
        status: 'active',
        baseline_at: '2026-08-26T08:00:00.000Z',
      }),
      getChannel: vi.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Test Channel',
      }),
      getVideo: vi.fn().mockResolvedValue({
        video_id: 'video-new',
        title: 'New & Noteworthy',
        duration_seconds: 5400,
        published_at: '2026-08-26T08:30:00.000Z',
      }),
      notify,
      recordEvent,
    });

    expect(result).toEqual({ received: 1, notified: 1, skipped: 0 });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Channel' }),
      [
        expect.objectContaining({
          video_id: 'video-new',
          duration_seconds: 5400,
        }),
      ],
      { baselineAt: '2026-08-26T08:00:00.000Z', source: 'websub' },
    );
    expect(recordEvent).toHaveBeenCalledOnce();
  });

  it('does not fetch or notify for the initial backlog', async () => {
    const getVideo = vi.fn();
    const notify = vi.fn();
    const result = await processYouTubeWebSubEntries(parseYouTubeAtomFeed(atomPayload), {
      findSubscription: vi.fn().mockResolvedValue({
        channel_id: '11111111-1111-4111-8111-111111111111',
        youtube_channel_id: 'UC123_channel',
        status: 'active',
        baseline_at: '2026-08-26T09:00:00.000Z',
      }),
      getVideo,
      notify,
    });
    expect(result).toEqual({ received: 1, notified: 0, skipped: 1 });
    expect(getVideo).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
