import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

interface SlideItem {
  title: string;
  date: string;
  venue?: string;
  image_file: string;
  badge: string;
}

const CINEMA_SLIDES: SlideItem[] = JSON.parse(
  fs.readFileSync('scratch/november-cinema/data.json', 'utf-8')
);

const THEATRE_SLIDES: SlideItem[] = JSON.parse(
  fs.readFileSync('scratch/november-theatre/data.json', 'utf-8')
);

function fileToDataUri(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// 1. Cover Slide HTML Builder
function buildCoverHtml(opts: {
  bgDataUri: string;
  iconDataUri: string;
  categoryTag: string; // "SHOWING IN" or "ON STAGE IN"
  month: string;       // "NOVEMBER"
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1350px;
    background: #080A0D;
    color: #FFFFFF;
    font-family: 'Inter', sans-serif;
    overflow: hidden;
    position: relative;
  }
  .bg-image {
    position: absolute;
    inset: 0;
    width: 1080px;
    height: 1350px;
    object-fit: cover;
    object-position: center;
    filter: brightness(0.65) contrast(1.1);
  }
  .overall-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 35%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 80%);
    z-index: 2;
  }
  .top-gradient {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 520px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0) 100%);
    z-index: 3;
  }
  .header-brand {
    position: absolute;
    top: 65px;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }
  .brand-logo-icon {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
  .brand-name {
    font-family: 'Barlow', sans-serif;
    font-size: 38px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #FFFFFF;
  }
  .brand-name span {
    color: #FF5A1F;
  }
  .center-headline-block {
    position: absolute;
    top: 230px;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .showing-pill {
    background: #144933;
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #FFFFFF;
    font-family: 'Barlow', sans-serif;
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 10px 32px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  }
  .month-title {
    font-family: 'Barlow', sans-serif;
    font-size: 122px;
    font-weight: 900;
    letter-spacing: -0.04em;
    text-transform: uppercase;
    color: #FFFFFF;
    line-height: 0.95;
    margin-top: 14px;
    text-shadow: 0 10px 40px rgba(0, 0, 0, 0.95);
  }
  .swipe-pill {
    position: absolute;
    bottom: 65px;
    right: 65px;
    z-index: 10;
    background: #155E42;
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #FFFFFF;
    font-family: 'Barlow', sans-serif;
    font-size: 26px;
    font-weight: 800;
    padding: 12px 34px;
    border-radius: 999px;
    letter-spacing: 0.04em;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
  }
</style>
</head>
<body>
  <img class="bg-image" src="${opts.bgDataUri}">
  <div class="overall-vignette"></div>
  <div class="top-gradient"></div>
  <div class="header-brand">
    <img class="brand-logo-icon" src="${opts.iconDataUri}">
    <div class="brand-name">Muvi<span>DB</span></div>
  </div>
  <div class="center-headline-block">
    <div class="showing-pill">${opts.categoryTag}</div>
    <div class="month-title">${opts.month}</div>
  </div>
  <div class="swipe-pill">Swipe&gt;&gt;&gt;</div>
</body>
</html>`;
}

// 2. Content Slide HTML Builder
function buildContentHtml(opts: {
  bgDataUri: string;
  iconDataUri: string;
  title: string;
  dateStr: string;
  badgeLabel: string;
  venueLabel?: string;
}): string {
  const metaBadgeText = opts.venueLabel
    ? `${opts.badgeLabel} • ${opts.venueLabel}`
    : opts.badgeLabel;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1350px;
    background: #080A0D;
    color: #FFFFFF;
    font-family: 'Inter', sans-serif;
    overflow: hidden;
    position: relative;
  }
  .bg-image {
    position: absolute;
    inset: 0;
    width: 1080px;
    height: 1350px;
    object-fit: cover;
    object-position: center;
  }
  .top-vignette {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 320px;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.3) 50%, rgba(0, 0, 0, 0) 100%);
    z-index: 2;
  }
  .bottom-vignette {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 640px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.98) 0%, rgba(0, 0, 0, 0.88) 32%, rgba(0, 0, 0, 0.45) 65%, rgba(0, 0, 0, 0) 100%);
    z-index: 2;
  }
  .top-brand {
    position: absolute;
    top: 60px;
    left: 65px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-logo-icon {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
  .brand-name {
    font-family: 'Barlow', sans-serif;
    font-size: 34px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #FFFFFF;
  }
  .brand-name span {
    color: #FF5A1F;
  }
  .content-bottom {
    position: absolute;
    bottom: 75px;
    left: 65px;
    right: 65px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .item-title {
    font-family: 'Barlow', sans-serif;
    font-size: 68px;
    font-weight: 900;
    line-height: 1.08;
    color: #FFFFFF;
    text-shadow: 0 4px 22px rgba(0, 0, 0, 0.95);
    letter-spacing: -0.02em;
    max-width: 950px;
  }
  .meta-row {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .date-pill {
    background: #E50914;
    color: #FFFFFF;
    font-family: 'Barlow', sans-serif;
    font-size: 24px;
    font-weight: 800;
    padding: 8px 24px;
    border-radius: 999px;
    letter-spacing: 0.02em;
    box-shadow: 0 4px 15px rgba(229, 9, 20, 0.45);
    white-space: nowrap;
  }
  .platform-text {
    font-family: 'Barlow', sans-serif;
    font-size: 25px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #FFFFFF;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85);
  }
</style>
</head>
<body>
  <img class="bg-image" src="${opts.bgDataUri}">
  <div class="top-vignette"></div>
  <div class="bottom-vignette"></div>
  <div class="top-brand">
    <img class="brand-logo-icon" src="${opts.iconDataUri}">
    <div class="brand-name">Muvi<span>DB</span></div>
  </div>
  <div class="content-bottom">
    <div class="item-title">${opts.title}</div>
    <div class="meta-row">
      <div class="date-pill">${opts.dateStr}</div>
      <div class="platform-text">${metaBadgeText}</div>
    </div>
  </div>
</body>
</html>`;
}

async function renderCarousel(
  browser: any,
  config: {
    name: string;
    categoryTag: string; // "SHOWING IN" or "ON STAGE IN"
    month: string;
    coverBgPath: string;
    items: SlideItem[];
    outDir: string;
  }
): Promise<string[]> {
  fs.mkdirSync(config.outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const iconDataUri = fileToDataUri('public/images/MuviDB Brand/MuviDB Icon.png');

  const slidePaths: string[] = [];

  // Slide 1: Cover
  console.log(`[${config.name}] Rendering Slide 1 (Cover)...`);
  const coverBgUri = fileToDataUri(config.coverBgPath);
  const coverHtml = buildCoverHtml({
    bgDataUri: coverBgUri,
    iconDataUri,
    categoryTag: config.categoryTag,
    month: config.month,
  });
  await page.setContent(coverHtml, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await (document as any).fonts?.ready;
  });
  await page.waitForTimeout(350);

  const slide1Path = path.join(config.outDir, 'slide_01.png');
  await page.screenshot({ path: slide1Path, clip: { x: 0, y: 0, width: 1080, height: 1350 }, type: 'png' });
  slidePaths.push(slide1Path);
  console.log(`  ✓ Saved ${path.basename(slide1Path)}`);

  // Slides 2 to 9: Content Slides
  for (let i = 0; i < config.items.length; i++) {
    const item = config.items[i];
    const slideNumber = i + 2;
    const slideFileName = `slide_0${slideNumber}.png`.replace('_010', '_10');
    const outSlidePath = path.join(config.outDir, slideFileName);

    console.log(`[${config.name}] Rendering Slide ${slideNumber}/10: ${item.title}...`);
    const bgUri = fileToDataUri(item.image_file);
    const contentHtml = buildContentHtml({
      bgDataUri: bgUri,
      iconDataUri,
      title: item.title,
      dateStr: item.date,
      badgeLabel: item.badge,
      venueLabel: item.venue,
    });

    await page.setContent(contentHtml, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await (document as any).fonts?.ready;
    });
    await page.waitForTimeout(350);

    await page.screenshot({ path: outSlidePath, clip: { x: 0, y: 0, width: 1080, height: 1350 }, type: 'png' });
    slidePaths.push(outSlidePath);
    console.log(`  ✓ Saved ${slideFileName}`);
  }

  await page.close();

  // Slide 10: Official Back Cover
  console.log(`[${config.name}] Rendering Slide 10 (Back Cover)...`);
  const backCoverPath = path.join(config.outDir, 'slide_10.png');
  await sharp('public/images/social/carousel-back-cover-v1.png')
    .resize(1080, 1350, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(backCoverPath);
  slidePaths.push(backCoverPath);
  console.log(`  ✓ Saved slide_10.png`);

  return slidePaths;
}

async function sendCarouselToTelegram(
  caption: string,
  slidePaths: string[],
  groupLabel: string
) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '780844382').trim();

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return;
  }

  console.log(`Sending ${groupLabel} (${slidePaths.length} slides) to Telegram chat ${chatId}...`);

  const formData = new FormData();
  formData.append('chat_id', chatId);

  const mediaArray = slidePaths.map((slidePath, idx) => {
    const attachName = `slide_${idx + 1}`;
    const buf = fs.readFileSync(slidePath);
    formData.append(attachName, new Blob([buf], { type: 'image/png' }), `${attachName}.png`);
    return {
      type: 'photo',
      media: `attach://${attachName}`,
      caption: idx === 0 ? caption : undefined,
    };
  });

  formData.append('media', JSON.stringify(mediaArray));

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok && body.ok) {
    console.log(`🎉 SUCCESS! ${groupLabel} delivered to Telegram!`);
  } else {
    console.error(`❌ Telegram error for ${groupLabel}:`, body);
  }
}

async function main() {
  console.log('=== GENERATING MONTHLY 1ST-OF-THE-MONTH CAROUSELS (NOVEMBER 2026) ===\n');

  const browser = await chromium.launch({ headless: true });

  // 1. Cinema Carousel
  const cinemaOutDir = path.resolve('scratch/november-cinema-carousel');
  const cinemaSlides = await renderCarousel(browser, {
    name: 'CINEMA',
    categoryTag: 'SHOWING IN',
    month: 'NOVEMBER',
    coverBgPath: 'scratch/november-cinema/assets/film_6.png', // ISSAKABA: The Return
    items: CINEMA_SLIDES,
    outDir: cinemaOutDir,
  });

  // 2. Stage Plays Carousel
  const theatreOutDir = path.resolve('scratch/november-theatre-carousel');
  const theatreSlides = await renderCarousel(browser, {
    name: 'THEATRE',
    categoryTag: 'ON STAGE IN',
    month: 'NOVEMBER',
    coverBgPath: 'scratch/november-theatre/assets/play_2.jpg', // Rite Of Passage (Akah Nnani)
    items: THEATRE_SLIDES,
    outDir: theatreOutDir,
  });

  await browser.close();

  // Copy sample slides to artifacts directory for user viewing
  const artifactsDir = 'C:/Users/User/.gemini/antigravity/brain/321eeeb7-b36f-4a6a-9c0a-30d8bb53f45f';
  fs.copyFileSync(cinemaSlides[0], path.join(artifactsDir, 'cinema_cover_nov2026.png'));
  fs.copyFileSync(cinemaSlides[5], path.join(artifactsDir, 'cinema_slide_issakaba.png'));
  fs.copyFileSync(theatreSlides[0], path.join(artifactsDir, 'theatre_cover_nov2026.png'));
  fs.copyFileSync(theatreSlides[1], path.join(artifactsDir, 'theatre_slide_put_it_on_my_head.png'));
  fs.copyFileSync(theatreSlides[2], path.join(artifactsDir, 'theatre_slide_rite_of_passage.png'));

  // Editorial Captions
  const cinemaCaption = `🎬 CINEMA RELEASES: SHOWING IN NOVEMBER 2026 🇳🇬\n\nEvery first of the month, we bring you every major movie hitting the big screens this month:\n\n1. 🎞️ Waiting for My Sister — Nov. 1st\n2. 🩸 Bad Blood — Nov. 1st\n3. 👓 The Perfect Spec — Nov. 6th\n4. 💖 Loving Itohan — Nov. 6th\n5. 🔦 The Beacon Man — Nov. 6th\n6. ⚔️ ISSAKABA: The Return — Nov. 13th\n7. 🗿 Five Figurines — Nov. 13th\n8. 🏙️ The Ghetto Never Leaves — Nov. 20th\n\n👉 Swipe through to see the full theatrical calendar and set your cinema dates!\n\nVerified release dates & ticketing on muvidb.com`;

  const theatreCaption = `🎭 WHAT'S ON STAGE IN NOVEMBER 2026 🇳🇬\n\nLive theatre is fully alive in Lagos this November! From the Lagos Fringe Festival to world-class performances, here are 8 stage plays you cannot miss:\n\n1. 🎭 Put It On My Head (Mofe Duncan, Charles Born) — Nov. 6th • J. Randle Centre\n2. 🎤 Rite Of Passage (Akah Nnani Live) — Nov. 8th • J. Randle Centre\n3. 🗣️ Mentality: What Men Don’t Say (Seun Kentebe) — Nov. 7th • J. Randle Centre\n4. 🎟️ The Lottery Ticket (Prof. Ahmed Yerima) — Nov. 7th–8th • Freedom Park\n5. 💍 Where’s My Groom? (Joy Isi Bewaji) — Nov. 7th–8th • British Council\n6. 🚪 My Room My Doom (Yemi Akande) — Nov. 7th–8th • J. Randle Centre\n7. 💃 Terrapolis (QDance Company) — Nov. 7th–8th • J. Randle Centre\n8. 🍚 There Is Rice At Home (Musical) — Nov. 7th–8th • J. Randle Centre\n\n👉 Swipe through for show dates and venues! Full festival schedules on muvidb.com`;

  console.log('\n--- Delivering Carousels to Telegram ---');
  await sendCarouselToTelegram(cinemaCaption, cinemaSlides, 'November Cinema Carousel');
  await sendCarouselToTelegram(theatreCaption, theatreSlides, 'November Stage Plays Carousel');

  console.log('\n🎉 ALL DONE! Both 10-slide carousels generated and dispatched!');
}

main().catch(console.error);
