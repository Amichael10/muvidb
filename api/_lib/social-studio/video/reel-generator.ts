import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { supabase } from '../../supabase.js';
import { uploadToR2 } from '../../r2.js';
import type { UpcomingMovieSnapshot } from '../content/snapshots.js';

const execFileAsync = promisify(execFile);

const WIN_FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH || '',
  'C:\\Users\\User\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe',
  'ffmpeg',
].filter(Boolean);

function resolveFfmpegBinary(): string {
  for (const candidate of WIN_FFMPEG_CANDIDATES) {
    if (candidate === 'ffmpeg' || existsSync(candidate)) {
      return candidate;
    }
  }
  return 'ffmpeg';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ReelRenderOptions = {
  contentItemId: string;
  snapshot: UpcomingMovieSnapshot;
  seriesLabel: 'Now Streaming' | 'New & Upcoming';
  audioStreamUrl?: string | null;
  durationSec?: number;
  fps?: number;
};

export type RenderedReelResult = {
  assetId: string;
  publicUrl: string;
  coverImageUrl: string | null;
  width: number;
  height: number;
  durationSec: number;
  fileSizeBytes: number;
};

function buildReelHtml(params: {
  posterDataUri: string;
  logoDataUri: string;
  seriesTitle: string;
  seriesBadge: string;
  filmTitle: string;
  ctaText: string;
  synopsisText: string;
  castLine: string;
  durationSec: number;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    background: #000000;
    color: #ffffff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .reel {
    position: relative;
    width: 1080px;
    height: 1920px;
    background: #000000;
    display: flex;
    flex-direction: column;
  }
  .top-rail {
    position: relative;
    z-index: 10;
    height: 246px;
    width: 100%;
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40px 64px 20px 64px;
  }
  .logo-img {
    height: 82px;
    width: auto;
    object-fit: contain;
    transform-origin: left center;
  }
  .series-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .series-title {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #ffffff;
    line-height: 1.1;
  }
  .series-badge {
    margin-top: 10px;
    background: #ff5514;
    color: #ffffff;
    font-size: 36px;
    font-weight: 700;
    padding: 6px 18px 8px 18px;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .poster-stage {
    position: relative;
    width: 1080px;
    height: 1210px;
    overflow: hidden;
    background: #08090c;
  }
  .poster-backdrop {
    position: absolute;
    inset: -40px;
    width: calc(100% + 80px);
    height: calc(100% + 80px);
    object-fit: cover;
    filter: blur(28px) brightness(0.45);
    transform: scale(1.08);
  }
  .poster-main {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transform-origin: center 35%;
    will-change: transform, filter;
  }
  .poster-vignette {
    position: absolute;
    inset: 0;
    z-index: 3;
    background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.18) 0%,
      rgba(0,0,0,0) 14%,
      rgba(0,0,0,0) 72%,
      rgba(0,0,0,0.72) 91%,
      #000000 100%
    );
    pointer-events: none;
  }
  .poster-sheen {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 420px;
    z-index: 4;
    background: linear-gradient(
      105deg,
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0.06) 45%,
      rgba(255,255,255,0.12) 50%,
      rgba(255,255,255,0.06) 55%,
      rgba(255,255,255,0) 100%
    );
    transform: translateX(-600px);
    pointer-events: none;
  }
  .audio-pill {
    position: absolute;
    right: 34px;
    bottom: 28px;
    z-index: 5;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(18, 18, 22, 0.78);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.14);
  }
  .audio-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 22px;
  }
  .bar {
    width: 4px;
    background: #ff5514;
    border-radius: 2px;
  }
  .bottom-deck {
    position: relative;
    z-index: 10;
    flex: 1;
    background: #000000;
    padding: 34px 72px 54px 72px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .film-title {
    font-size: 62px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.04;
    color: #ffffff;
    margin-bottom: 24px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cta-pill {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    background: #ff5514;
    color: #ffffff;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 16px 34px;
    border-radius: 999px;
    margin-bottom: 26px;
    box-shadow: 0 10px 30px rgba(255, 85, 20, 0.28);
  }
  .synopsis {
    font-size: 30px;
    font-weight: 500;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.92);
    max-width: 936px;
    letter-spacing: -0.01em;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta-row {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
  }
  .meta-accent {
    color: #ff5514;
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="reel">
    <header class="top-rail" id="topRail">
      <img class="logo-img" id="logoImg" src="${params.logoDataUri}" alt="MuviDB">
      <div class="series-block" id="seriesBlock">
        <div class="series-title">${escapeHtml(params.seriesTitle)}</div>
        <div class="series-badge">${escapeHtml(params.seriesBadge)}</div>
      </div>
    </header>

    <div class="poster-stage">
      <img class="poster-backdrop" src="${params.posterDataUri}" alt="">
      <img class="poster-main" id="posterMain" src="${params.posterDataUri}" alt="${escapeHtml(params.filmTitle)}">
      <div class="poster-sheen" id="posterSheen"></div>
      <div class="poster-vignette"></div>
      <div class="audio-pill" id="audioPill">
        <div class="audio-bars">
          <div class="bar" id="bar1" style="height: 10px"></div>
          <div class="bar" id="bar2" style="height: 18px"></div>
          <div class="bar" id="bar3" style="height: 14px"></div>
          <div class="bar" id="bar4" style="height: 20px"></div>
        </div>
      </div>
    </div>

    <section class="bottom-deck">
      <h1 class="film-title" id="filmTitle">${escapeHtml(params.filmTitle)}</h1>
      <div class="cta-pill" id="ctaPill">${escapeHtml(params.ctaText)}</div>
      <p class="synopsis" id="synopsis">${escapeHtml(params.synopsisText)}</p>
      <div class="meta-row" id="metaRow">
        <span>${escapeHtml(params.castLine)}</span>
        <span class="meta-accent">MUVIDB.COM</span>
      </div>
    </section>
  </div>

  <script>
    function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
    function easeInOutSine(x) { return -(Math.cos(Math.PI * x) - 1) / 2; }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    window.setFrameTime = function(t) {
      const dur = ${params.durationSec};
      const progress = clamp01(t / dur);

      const railP = easeOutCubic(clamp01(t / 0.55));
      const topRail = document.getElementById('topRail');
      topRail.style.opacity = String(railP);
      topRail.style.transform = \`translateY(\${(1 - railP) * -18}px)\`;

      const posterMain = document.getElementById('posterMain');
      const scale = 1.015 + 0.06 * easeInOutSine(progress);
      const driftY = -12 * easeInOutSine(progress);
      const introFade = easeOutCubic(clamp01(t / 0.45));
      posterMain.style.opacity = String(introFade);
      posterMain.style.transform = \`scale(\${scale.toFixed(4)}) translateY(\${driftY.toFixed(2)}px)\`;

      const sheenP = clamp01((t - 1.2) / 2.4);
      const posterSheen = document.getElementById('posterSheen');
      posterSheen.style.transform = \`translateX(\${-500 + sheenP * 1700}px)\`;

      const titleP = easeOutCubic(clamp01((t - 0.18) / 0.55));
      const filmTitle = document.getElementById('filmTitle');
      filmTitle.style.opacity = String(titleP);
      filmTitle.style.transform = \`translateY(\${(1 - titleP) * 22}px)\`;

      const ctaP = easeOutCubic(clamp01((t - 0.34) / 0.55));
      const ctaPill = document.getElementById('ctaPill');
      const pulse = t > 1.0 ? 1 + 0.015 * Math.sin((t - 1.0) * 3.2) : 1;
      ctaPill.style.opacity = String(ctaP);
      ctaPill.style.transform = \`translateY(\${(1 - ctaP) * 20}px) scale(\${pulse.toFixed(4)})\`;

      const synP = easeOutCubic(clamp01((t - 0.50) / 0.65));
      const synopsis = document.getElementById('synopsis');
      synopsis.style.opacity = String(synP);
      synopsis.style.transform = \`translateY(\${(1 - synP) * 18}px)\`;

      const metaP = easeOutCubic(clamp01((t - 0.68) / 0.6));
      const metaRow = document.getElementById('metaRow');
      metaRow.style.opacity = String(metaP);

      const b1 = 8 + Math.round(12 * Math.abs(Math.sin(t * 6.5)));
      const b2 = 8 + Math.round(14 * Math.abs(Math.sin(t * 5.2 + 1.1)));
      const b3 = 8 + Math.round(11 * Math.abs(Math.sin(t * 7.8 + 2.3)));
      const b4 = 8 + Math.round(13 * Math.abs(Math.sin(t * 4.7 + 0.5)));
      document.getElementById('bar1').style.height = b1 + 'px';
      document.getElementById('bar2').style.height = b2 + 'px';
      document.getElementById('bar3').style.height = b3 + 'px';
      document.getElementById('bar4').style.height = b4 + 'px';
    };
  </script>
</body>
</html>`;
}

export async function renderAndStoreReelAsset(options: ReelRenderOptions): Promise<RenderedReelResult> {
  const durationSec = options.durationSec || 6;
  const fps = options.fps || 24;
  const totalFrames = durationSec * fps;
  const snap = options.snapshot;

  const posterUrl = (snap.posterUrl || snap.backdropUrl || '').trim();
  if (!posterUrl) {
    throw new Error(`Film "${snap.title}" does not have a poster URL for Reel generation.`);
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'muvidb-reel-'));
  const framesDir = path.join(workDir, 'frames');
  await fs.mkdir(framesDir, { recursive: true });

  try {
    const posterRes = await fetch(posterUrl);
    if (!posterRes.ok) throw new Error(`Could not download poster for "${snap.title}"`);
    const posterMime = posterRes.headers.get('content-type') || 'image/jpeg';
    const posterBuf = Buffer.from(await posterRes.arrayBuffer());
    const posterDataUri = `data:${posterMime};base64,${posterBuf.toString('base64')}`;

    let logoDataUri = '';
    const possibleLogoPaths = [
      path.join(process.cwd(), 'public', 'brand', 'White Logo.png'),
      path.join(process.cwd(), 'api', '_lib', 'decor', 'White Logo.png'),
      path.join(__dirname, '..', '..', 'decor', 'White Logo.png'),
      path.join(__dirname, '..', 'decor', 'White Logo.png'),
    ];
    for (const lp of possibleLogoPaths) {
      try {
        const logoBuf = await fs.readFile(lp);
        logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;
        break;
      } catch {}
    }

    const avail = String(snap.watchAvailability || '').trim();
    const channel = String(snap.youtubeChannelName || '').trim();
    const isYoutube = Boolean(channel || /youtube/i.test(avail));
    const seriesBadge = isYoutube
      ? 'Youtube'
      : avail
        ? avail.replace(/^Watch on\s+/i, '').slice(0, 22)
        : options.seriesLabel === 'New & Upcoming'
          ? 'Coming Soon'
          : 'Streaming';

    const ctaText = isYoutube && channel
      ? `WATCH ON YOUTUBE VIA ${channel.toUpperCase()}`
      : avail
        ? `WATCH ON ${avail.toUpperCase()}`
        : options.seriesLabel === 'New & Upcoming'
          ? (snap.releaseDate ? `RELEASING ${snap.releaseDate}` : 'COMING SOON TO SCREENS')
          : 'NOW STREAMING';

    const synopsisText = (snap.synopsis || snap.tagline || `${snap.title} — discover full cast, crew, and watch links on MuviDB.`).slice(0, 185);
    const topActors = (snap.topCast || []).slice(0, 3).map(c => c.name).filter(Boolean);
    const castLine = topActors.length ? `STARRING ${topActors.join(' · ').toUpperCase()}` : `${snap.year || new Date().getFullYear()} · AFRICAN CINEMA`;

    const html = buildReelHtml({
      posterDataUri,
      logoDataUri,
      seriesTitle: options.seriesLabel,
      seriesBadge,
      filmTitle: snap.title,
      ctaText,
      synopsisText,
      castLine,
      durationSec,
    });

    const htmlPath = path.join(workDir, 'reel.html');
    await fs.writeFile(htmlPath, html, 'utf8');

    let coverPngBuf: Buffer | null = null;
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load', timeout: 15_000 });
      await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});

      for (let f = 0; f < totalFrames; f++) {
        const t = f / fps;
        await page.evaluate((time) => (window as any).setFrameTime(time), t);
        const frameFile = path.join(framesDir, `frame_${String(f).padStart(4, '0')}.jpg`);
        await page.screenshot({ path: frameFile, type: 'jpeg', quality: 92 });
        if (f === Math.min(totalFrames - 1, Math.round(fps * 1.2))) {
          coverPngBuf = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 92 }));
        }
      }
    } finally {
      await browser.close();
    }

    let audioFilePath: string | null = null;
    if (options.audioStreamUrl && !options.audioStreamUrl.includes('instagram.com/reels/audio')) {
      try {
        const aRes = await fetch(options.audioStreamUrl, { signal: AbortSignal.timeout(8000) });
        if (aRes.ok) {
          const aBuf = Buffer.from(await aRes.arrayBuffer());
          audioFilePath = path.join(workDir, 'track.m4a');
          await fs.writeFile(audioFilePath, aBuf);
        }
      } catch {
        audioFilePath = null;
      }
    }

    const outputMp4 = path.join(workDir, 'reel.mp4');
    const ffmpegBin = resolveFfmpegBinary();
    const framePattern = path.join(framesDir, 'frame_%04d.jpg');

    if (audioFilePath) {
      await execFileAsync(ffmpegBin, [
        '-y',
        '-framerate', String(fps),
        '-i', framePattern,
        '-ss', '4',
        '-i', audioFilePath,
        '-filter_complex', `[1:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${durationSec - 0.9}:d=0.9,volume=0.9[aout]`,
        '-map', '0:v:0',
        '-map', '[aout]',
        '-t', String(durationSec),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '19',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        outputMp4,
      ]);
    } else {
      await execFileAsync(ffmpegBin, [
        '-y',
        '-framerate', String(fps),
        '-i', framePattern,
        '-f', 'lavfi',
        '-i', `aevalsrc=0.025*sin(2*PI*110*t)+0.018*sin(2*PI*164.81*t)+0.012*sin(2*PI*220*t):s=44100:d=${durationSec}`,
        '-filter_complex', `[1:a]afade=t=in:st=0:d=0.6,afade=t=out:st=${durationSec - 1.0}:d=1.0[aout]`,
        '-map', '0:v:0',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '19',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
        outputMp4,
      ]);
    }

    const mp4Bytes = await fs.readFile(outputMp4);
    let publicUrl = '';
    let storageBucket = process.env.SOCIAL_ASSET_BUCKET || 'social-published-assets';
    let storagePath = `${options.contentItemId}/reel-${Date.now()}.mp4`;

    // Upload to R2 if configured, otherwise Supabase Storage
    try {
      const r2Res = await uploadToR2(`social/reels/${options.contentItemId}-${Date.now()}.mp4`, mp4Bytes, 'video/mp4');
      publicUrl = r2Res.url;
      storageBucket = 'external';
      storagePath = r2Res.key;
    } catch {
      const { error: upErr } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, mp4Bytes, { contentType: 'video/mp4', upsert: true });
      if (upErr) throw upErr;
      publicUrl = supabase.storage.from(storageBucket).getPublicUrl(storagePath).data.publicUrl;
    }

    let coverImageUrl: string | null = null;
    if (coverPngBuf) {
      const coverBucket = process.env.SOCIAL_ASSET_BUCKET || 'social-published-assets';
      const coverPath = `${options.contentItemId}/reel-cover-${Date.now()}.jpg`;
      const { error: covErr } = await supabase.storage
        .from(coverBucket)
        .upload(coverPath, coverPngBuf, { contentType: 'image/jpeg', upsert: true });
      if (!covErr) {
        coverImageUrl = supabase.storage.from(coverBucket).getPublicUrl(coverPath).data.publicUrl;
      }
    }

    const { data: assetRow, error: assetErr } = await supabase
      .from('social_assets')
      .upsert(
        {
          content_item_id: options.contentItemId,
          format: 'video_vertical_9_16',
          storage_bucket: storageBucket,
          storage_path: storagePath,
          public_url: publicUrl,
          mime_type: 'video/mp4',
          width: 1080,
          height: 1920,
          file_size_bytes: mp4Bytes.length,
          render_metadata: { source: 'reel_generator', duration_sec: durationSec, cover_url: coverImageUrl },
        },
        { onConflict: 'content_item_id,format' }
      )
      .select('id')
      .single();

    if (assetErr) throw assetErr;

    return {
      assetId: assetRow.id,
      publicUrl,
      coverImageUrl,
      width: 1080,
      height: 1920,
      durationSec,
      fileSizeBytes: mp4Bytes.length,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
