import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);

const FFMPEG_BIN = 'C:\\Users\\User\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';

interface ReelItem {
  title: string;
  ctaText: string;
  synopsis: string;
  castLine: string;
  posterFile: string;
}

const CINEMA_REEL_ITEMS: ReelItem[] = [
  {
    title: 'Waiting for My Sister',
    ctaText: 'In Cinemas Nov. 1st',
    synopsis: 'A turbulent family secret threatens to unravel two sisters as wedding preparations uncover hidden loyalties and long-buried truths.',
    castLine: 'Starring Bimbo Ademoye · Timini Egbuson',
    posterFile: 'scratch/november-cinema/posters/poster_1.jpg',
  },
  {
    title: 'Bad Blood',
    ctaText: 'In Cinemas Nov. 1st',
    synopsis: 'Old rivalry boils over in this gritty urban drama when two estranged brothers clash over legacy, control, and survival in Lagos.',
    castLine: 'Starring Jidekene Achufusi · Sharon Ooja',
    posterFile: 'scratch/november-cinema/posters/poster_2.jpg',
  },
  {
    title: 'The Perfect Spec',
    ctaText: 'In Cinemas Nov. 6th',
    synopsis: 'A witty romantic comedy about modern dating check-lists, unrealistic expectations, and falling for the one person you least expected.',
    castLine: 'Starring Stan Nze · Nancy Isime',
    posterFile: 'scratch/november-cinema/posters/poster_3.webp',
  },
  {
    title: 'Loving Itohan',
    ctaText: 'In Cinemas Nov. 6th',
    synopsis: 'A passionate romance tested by cultural expectations, family disapproval, and personal ambition across two contrasting worlds.',
    castLine: 'Starring Linda Osifo · Blossom Chukwujekwu',
    posterFile: 'scratch/november-cinema/posters/poster_4.png',
  },
  {
    title: 'The Beacon Man',
    ctaText: 'In Cinemas Nov. 6th',
    synopsis: 'A high-stakes corporate thriller where one man holds the key to uncovering widespread maritime conspiracy and deadly greed.',
    castLine: 'Starring Deyemi Okanlawon · Kehinde Bankole',
    posterFile: 'scratch/november-cinema/posters/poster_5.webp',
  },
  {
    title: 'ISSAKABA: The Return',
    ctaText: 'In Cinemas Nov. 13th',
    synopsis: 'The legendary vigilante brotherhood returns to the streets in a thunderous action epic to purge corruption and enforce raw justice.',
    castLine: 'Starring Sam Dede · Chidi Mokeme',
    posterFile: 'scratch/november-cinema/posters/poster_6.jpg',
  },
  {
    title: 'Five Figurines',
    ctaText: 'In Cinemas Nov. 13th',
    synopsis: 'A dark mystery thriller tracing ancient mystical artifacts and the deadly consequences of greed across generations.',
    castLine: 'Starring Lateef Adedimeji · Femi Adebayo · Gabriel Afolayan',
    posterFile: 'scratch/november-cinema/posters/poster_7.jpg',
  },
  {
    title: 'The Ghetto Never Leaves',
    ctaText: 'In Cinemas Nov. 20th',
    synopsis: 'No matter how far you run, the streets remember. A gripping survival drama charting ambition, crime, and redemption.',
    castLine: 'Starring Zubby Michael · Destiny Etiko',
    posterFile: 'scratch/november-cinema/posters/poster_8.webp',
  },
];

const THEATRE_REEL_ITEMS: ReelItem[] = [
  {
    title: 'Put It On My Head',
    ctaText: 'J. Randle Centre • Nov. 6th',
    synopsis: 'A captivating stage production about life choices, societal pressures, and romantic dilemmas, starring leading Nollywood actors.',
    castLine: 'Starring Mofe Duncan · Charles Born',
    posterFile: 'scratch/november-theatre/assets/play_1.jpg',
  },
  {
    title: 'Rite Of Passage',
    ctaText: 'J. Randle Centre • Nov. 8th',
    synopsis: 'Akah Nnani takes the stage in an intimate, deeply personal, and transformative solo performance exploring identity and growth.',
    castLine: 'Akah Nnani Live in Lagos (Ember House)',
    posterFile: 'scratch/november-theatre/assets/play_2.jpg',
  },
  {
    title: 'Mentality: What Men Don’t Say',
    ctaText: 'J. Randle Centre • Nov. 7th',
    synopsis: 'Four friends. One night. Every mask comes off. An unfiltered, raw exploration of modern Nigerian masculinity and mental health.',
    castLine: 'Starring Seun Kentebe · Tolulope Odebunmi',
    posterFile: 'scratch/november-theatre/assets/play_3.jpg',
  },
  {
    title: 'The Lottery Ticket',
    ctaText: 'Freedom Park • Nov. 7th–8th',
    synopsis: 'A legendary satirical stage drama examining human greed, desperation, and unexpected chaos when a winning lottery ticket appears.',
    castLine: 'Written by Prof. Ahmed Yerima (Dir: Oselenonomen)',
    posterFile: 'scratch/november-theatre/assets/play_4.jpg',
  },
  {
    title: 'Where’s My Groom?',
    ctaText: 'British Council • Nov. 7th–8th',
    synopsis: 'An electrifying, razor-sharp theatrical satire on African wedding culture, societal expectations, and modern womanhood.',
    castLine: 'Written & Directed by Joy Isi Bewaji · Starring Nene Aliemeke',
    posterFile: 'scratch/november-theatre/assets/play_5.jpg',
  },
  {
    title: 'My Room My Doom',
    ctaText: 'J. Randle Centre • Nov. 7th–8th',
    synopsis: 'A suspenseful psychological examination of isolation, trauma, and the haunting demons we face when trapped alone with our thoughts.',
    castLine: 'Written by Yemi Akande · Starring Olude Omotola Molly',
    posterFile: 'scratch/november-theatre/assets/play_6.jpg',
  },
  {
    title: 'Terrapolis',
    ctaText: 'J. Randle Centre • Nov. 7th–8th',
    synopsis: 'An immersive, explosive journey of rhythm, movement, and physical theatre created by acclaimed choreographer Qudus Onikeku.',
    castLine: 'Qudus Onikeku & The QDance Company',
    posterFile: 'scratch/november-theatre/assets/play_7.jpg',
  },
  {
    title: 'There Is Rice At Home',
    ctaText: 'J. Randle Centre • Nov. 7th–8th',
    synopsis: 'A hilarious and touching musical theatre celebration of Nigerian home truths, family dynamics, and relatable humor.',
    castLine: 'Starring Isoken Aruede · David Akpojisheri',
    posterFile: 'scratch/november-theatre/assets/play_8.jpg',
  },
];

function fileToDataUri(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReelSlideHtml(params: {
  logoDataUri: string;
  posterDataUri: string;
  seriesTitle: string;
  seriesBadge: string;
  title: string;
  ctaText: string;
  synopsis: string;
  castLine: string;
  slideIdx: number;
  totalSlides: number;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');
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
    height: 240px;
    width: 100%;
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40px 64px 20px 64px;
  }
  .logo-img {
    height: 76px;
    width: auto;
    object-fit: contain;
  }
  .series-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .series-title {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffffff;
    line-height: 1.1;
  }
  .series-badge {
    margin-top: 8px;
    background: #ff5514;
    color: #ffffff;
    font-size: 30px;
    font-weight: 800;
    padding: 6px 18px;
    border-radius: 6px;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .poster-stage {
    position: relative;
    width: 1080px;
    height: 1220px;
    overflow: hidden;
    background: #08090c;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .poster-backdrop {
    position: absolute;
    inset: -40px;
    width: calc(100% + 80px);
    height: calc(100% + 80px);
    object-fit: cover;
    filter: blur(34px) brightness(0.35);
    transform: scale(1.1);
  }
  .poster-main {
    position: relative;
    z-index: 2;
    height: 94%;
    width: auto;
    max-width: 88%;
    object-fit: contain;
    border-radius: 20px;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.12);
  }
  .poster-vignette {
    position: absolute;
    inset: 0;
    z-index: 3;
    background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.3) 0%,
      rgba(0,0,0,0) 15%,
      rgba(0,0,0,0) 70%,
      rgba(0,0,0,0.85) 94%,
      #000000 100%
    );
    pointer-events: none;
  }
  .audio-pill {
    position: absolute;
    right: 40px;
    bottom: 30px;
    z-index: 5;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(18, 18, 22, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.18);
    box-shadow: 0 8px 20px rgba(0,0,0,0.6);
  }
  .audio-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 24px;
  }
  .bar {
    width: 4px;
    background: #ff5514;
    border-radius: 2px;
  }
  .slide-count-badge {
    position: absolute;
    left: 40px;
    bottom: 30px;
    z-index: 5;
    background: rgba(18, 18, 22, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #ffffff;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 8px 20px;
    border-radius: 999px;
  }
  .bottom-deck {
    position: relative;
    z-index: 10;
    flex: 1;
    background: #000000;
    padding: 28px 64px 44px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .film-title {
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.08;
    color: #ffffff;
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
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 12px 30px;
    border-radius: 999px;
    margin: 14px 0 16px 0;
    box-shadow: 0 8px 24px rgba(255, 85, 20, 0.35);
  }
  .synopsis {
    font-size: 27px;
    font-weight: 500;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: -0.01em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.12);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
  }
  .meta-accent {
    color: #ff5514;
    font-weight: 800;
  }
</style>
</head>
<body>
  <div class="reel">
    <header class="top-rail">
      <img class="logo-img" src="${params.logoDataUri}" alt="MuviDB">
      <div class="series-block">
        <div class="series-title">${escapeHtml(params.seriesTitle)}</div>
        <div class="series-badge">${escapeHtml(params.seriesBadge)}</div>
      </div>
    </header>

    <div class="poster-stage">
      <img class="poster-backdrop" src="${params.posterDataUri}" alt="">
      <img class="poster-main" src="${params.posterDataUri}" alt="${escapeHtml(params.title)}">
      <div class="poster-vignette"></div>
      <div class="slide-count-badge">${params.slideIdx} of ${params.totalSlides}</div>
      <div class="audio-pill">
        <div class="audio-bars">
          <div class="bar" style="height: 10px"></div>
          <div class="bar" style="height: 22px"></div>
          <div class="bar" style="height: 14px"></div>
          <div class="bar" style="height: 18px"></div>
        </div>
      </div>
    </div>

    <section class="bottom-deck">
      <div>
        <h1 class="film-title">${escapeHtml(params.title)}</h1>
        <div class="cta-pill">${escapeHtml(params.ctaText)}</div>
        <p class="synopsis">${escapeHtml(params.synopsis)}</p>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(params.castLine)}</span>
        <span class="meta-accent">MUVIDB.COM</span>
      </div>
    </section>
  </div>
</body>
</html>`;
}

async function renderSlides(
  browser: any,
  config: {
    name: string;
    seriesTitle: string;
    seriesBadge: string;
    items: ReelItem[];
    outDir: string;
  }
): Promise<string[]> {
  fs.mkdirSync(config.outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const logoDataUri = fileToDataUri('public/images/MuviDB Brand/White Logo.png');

  const slidePaths: string[] = [];

  for (let i = 0; i < config.items.length; i++) {
    const item = config.items[i];
    const slideNumber = i + 1;
    const slideFileName = `slide_${slideNumber < 10 ? '0' : ''}${slideNumber}.png`;
    const outSlidePath = path.join(config.outDir, slideFileName);

    console.log(`[${config.name}] Rendering Slide ${slideNumber}/${config.items.length}: ${item.title}...`);
    const posterDataUri = fileToDataUri(item.posterFile);

    const html = buildReelSlideHtml({
      logoDataUri,
      posterDataUri,
      seriesTitle: config.seriesTitle,
      seriesBadge: config.seriesBadge,
      title: item.title,
      ctaText: item.ctaText,
      synopsis: item.synopsis,
      castLine: item.castLine,
      slideIdx: slideNumber,
      totalSlides: config.items.length,
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await (document as any).fonts?.ready;
    });
    await page.waitForTimeout(300);

    await page.screenshot({ path: outSlidePath, clip: { x: 0, y: 0, width: 1080, height: 1920 }, type: 'png' });
    slidePaths.push(outSlidePath);
    console.log(`  ✓ Saved ${slideFileName}`);
  }

  await page.close();
  return slidePaths;
}

async function compileReelVideo(
  slidePaths: string[],
  audioPath: string,
  outputMp4: string,
  slideSeconds = 5
): Promise<string> {
  const totalDuration = slidePaths.length * slideSeconds;
  console.log(`Compiling ${slidePaths.length} slides × ${slideSeconds}s = ${totalDuration}s video into ${path.basename(outputMp4)}...`);

  // Write concat file
  const concatFile = outputMp4.replace('.mp4', '_concat.txt');
  const lines: string[] = [];
  for (const s of slidePaths) {
    const escaped = s.replace(/\\/g, '/');
    lines.push(`file '${escaped}'`);
    lines.push(`duration ${slideSeconds}`);
  }
  // FFmpeg concat demuxer requirement: last image repeated
  lines.push(`file '${slidePaths[slidePaths.length - 1].replace(/\\/g, '/')}'`);
  fs.writeFileSync(concatFile, lines.join('\n'), 'utf-8');

  // FFmpeg command to combine slides with audio
  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-i', audioPath,
    '-t', String(totalDuration),
    '-filter_complex', `[1:a]afade=t=in:st=0:d=0.8,afade=t=out:st=${totalDuration - 1.2}:d=1.2,volume=0.9[aout]`,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outputMp4,
  ];

  await execFileAsync(FFMPEG_BIN, args);
  console.log(`✓ Reel generated: ${outputMp4} (${fs.statSync(outputMp4).size} bytes)`);
  return outputMp4;
}

async function sendReelToTelegram(
  videoPath: string,
  caption: string,
  groupLabel: string
) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '780844382').trim();

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return;
  }

  console.log(`Sending ${groupLabel} video to Telegram chat ${chatId}...`);

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  formData.append('supports_streaming', 'true');
  formData.append('width', '1080');
  formData.append('height', '1920');

  const buf = fs.readFileSync(videoPath);
  formData.append('video', new Blob([buf], { type: 'video/mp4' }), path.basename(videoPath));

  const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(180_000),
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok && body.ok) {
    console.log(`🎉 SUCCESS! ${groupLabel} video delivered to Telegram! Message ID: ${body.result?.message_id}`);
  } else {
    console.error(`❌ Telegram error for ${groupLabel}:`, body);
  }
}

async function main() {
  console.log('=== GENERATING 1ST-OF-THE-MONTH REEL SLIDESHOWS (NOVEMBER 2026) ===\n');

  const browser = await chromium.launch({ headless: true });

  // 1. Cinema Reel Slides
  const cinemaDir = path.resolve('scratch/november-cinema-reel');
  const cinemaSlides = await renderSlides(browser, {
    name: 'CINEMA',
    seriesTitle: 'Showing In Cinemas',
    seriesBadge: 'November 2026',
    items: CINEMA_REEL_ITEMS,
    outDir: cinemaDir,
  });

  // 2. Stage Plays Reel Slides
  const theatreDir = path.resolve('scratch/november-theatre-reel');
  const theatreSlides = await renderSlides(browser, {
    name: 'THEATRE',
    seriesTitle: "What's On Stage",
    seriesBadge: 'November 2026',
    items: THEATRE_REEL_ITEMS,
    outDir: theatreDir,
  });

  await browser.close();

  // 3. Compile Videos via FFmpeg
  console.log('\n--- Compiling Videos via FFmpeg ---');
  const cinemaVideoPath = path.resolve('scratch/november_cinema_reel.mp4');
  await compileReelVideo(cinemaSlides, path.resolve('scratch/audio_cinema.m4a'), cinemaVideoPath, 5);

  const theatreVideoPath = path.resolve('scratch/november_theatre_reel.mp4');
  await compileReelVideo(theatreSlides, path.resolve('scratch/audio_theatre.m4a'), theatreVideoPath, 5);

  // Copy sample slides to artifacts
  const artifactsDir = 'C:/Users/User/.gemini/antigravity/brain/321eeeb7-b36f-4a6a-9c0a-30d8bb53f45f';
  fs.copyFileSync(cinemaSlides[5], path.join(artifactsDir, 'reel_cinema_issakaba.png'));
  fs.copyFileSync(cinemaSlides[6], path.join(artifactsDir, 'reel_cinema_five_figurines.png'));
  fs.copyFileSync(theatreSlides[0], path.join(artifactsDir, 'reel_theatre_put_it_on_my_head.png'));
  fs.copyFileSync(theatreSlides[1], path.join(artifactsDir, 'reel_theatre_rite_of_passage.png'));

  // 4. Captions
  const cinemaCaption = `🎬 CINEMA RELEASES: SHOWING IN NOVEMBER 2026 (40s REEL) 🇳🇬\n\nHere is your full monthly cinema preview for November:\n\n1. 🎞️ Waiting for My Sister — Nov. 1st\n2. 🩸 Bad Blood — Nov. 1st\n3. 👓 The Perfect Spec — Nov. 6th\n4. 💖 Loving Itohan — Nov. 6th\n5. 🔦 The Beacon Man — Nov. 6th\n6. ⚔️ ISSAKABA: The Return — Nov. 13th\n7. 🗿 Five Figurines — Nov. 13th\n8. 🏙️ The Ghetto Never Leaves — Nov. 20th\n\nFull trailers, verified cast, and box office tracking on muvidb.com`;

  const theatreCaption = `🎭 WHAT'S ON STAGE IN NOVEMBER 2026 (40s REEL) 🇳🇬\n\nLive Lagos theatre is packed this month! Here are 8 headlining productions happening across Lagos:\n\n1. 🎭 Put It On My Head (Mofe Duncan, Charles Born) — Nov. 6th • J. Randle Centre\n2. 🎤 Rite Of Passage (Akah Nnani Live) — Nov. 8th • J. Randle Centre\n3. 🗣️ Mentality: What Men Don’t Say (Seun Kentebe) — Nov. 7th • J. Randle Centre\n4. 🎟️ The Lottery Ticket (Prof. Ahmed Yerima) — Nov. 7th–8th • Freedom Park\n5. 💍 Where’s My Groom? (Joy Isi Bewaji) — Nov. 7th–8th • British Council\n6. 🚪 My Room My Doom (Yemi Akande) — Nov. 7th–8th • J. Randle Centre\n7. 💃 Terrapolis (QDance Company) — Nov. 7th–8th • J. Randle Centre\n8. 🍚 There Is Rice At Home (Musical) — Nov. 7th–8th • J. Randle Centre\n\nTicket tiers & festival schedules on muvidb.com`;

  // 5. Send to Telegram
  console.log('\n--- Delivering 40s Reels to Telegram ---');
  await sendReelToTelegram(cinemaVideoPath, cinemaCaption, 'November Cinema Reel');
  await sendReelToTelegram(theatreVideoPath, theatreCaption, 'November Stage Plays Reel');

  console.log('\n🎉 ALL DONE! Both 40-second slideshow reels rendered and dispatched!');
}

main().catch(console.error);
