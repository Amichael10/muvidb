import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

interface Comment {
  user: string;
  text: string;
  likes: string;
}

interface WatchlistMovie {
  rank: number;
  title: string;
  posterFile: string;
  rating: string;
  liked: string;
  views: string;
  category: string;
  comments: Comment[];
}

const MOVIES: WatchlistMovie[] = [
  {
    rank: 1,
    title: 'User Friendly',
    posterFile: 'poster_1.webp',
    rating: '8.0 / 10',
    liked: '78%',
    views: '678K+ views',
    category: 'Rom-Com / Drama',
    comments: [
      { user: '@bimbo_fan', text: 'The storyline is actually fresh and unpredictable, acting was top tier!', likes: '342' },
      { user: '@nollywood_pulse', text: 'Finally a romcom with real substance and great comedic timing.', likes: '198' },
    ],
  },
  {
    rank: 2,
    title: 'Parents by Accident',
    posterFile: 'poster_2.jpg',
    rating: '7.3 / 10',
    liked: '72%',
    views: '1.7M+ views (24h Breakout)',
    category: 'Family Comedy',
    comments: [
      { user: '@temi_culture', text: 'Crossing 1.7M in 24 hours says it all! Super relatable family dynamics.', likes: '521' },
      { user: '@kemi_adams', text: 'Laughed from start to finish, the casting was so spot on.', likes: '284' },
    ],
  },
  {
    rank: 3,
    title: 'Omo Iroko',
    posterFile: 'poster_3.webp',
    rating: '7.0 / 10',
    liked: '70%',
    views: '27K+ views',
    category: 'Yoruba Epic Drama',
    comments: [
      { user: '@yoruba_cinema', text: 'The cinematography and cultural representation are deeply authentic.', likes: '156' },
      { user: '@dayo_films', text: 'Intense storyline with captivating traditional elements.', likes: '94' },
    ],
  },
  {
    rank: 4,
    title: 'The Last Driver',
    posterFile: 'poster_4.webp',
    rating: '7.2 / 10',
    liked: '73%',
    views: '45K+ views',
    category: 'Urban Drama / Romance',
    comments: [
      { user: '@lagos_driver', text: 'Raw portrayal of daily survival and unexpected romance in Lagos.', likes: '210' },
      { user: '@grace_o', text: 'The chemistry between the leads carried the entire film effortlessly.', likes: '145' },
    ],
  },
  {
    rank: 5,
    title: 'A Tale of Silent Sisters',
    posterFile: 'poster_5.webp',
    rating: '7.6 / 10',
    liked: '76%',
    views: '155K+ views',
    category: 'Sisterhood Drama',
    comments: [
      { user: '@faith_ebube', text: 'Emotional rollercoaster. The silence in certain scenes speaks volumes.', likes: '315' },
      { user: '@chidi_reviews', text: 'Strong character depth. One of the best sisterhood stories this year.', likes: '180' },
    ],
  },
  {
    rank: 6,
    title: 'Iya Omo 2',
    posterFile: 'poster_6.jpg',
    rating: '7.5 / 10',
    liked: '75%',
    views: '592K+ views',
    category: 'Emotional Drama',
    comments: [
      { user: '@bukola_ade', text: 'Part 2 delivered even more emotional weight than the first!', likes: '440' },
      { user: '@tunde_vibe', text: 'Nollywood drama at its best, pure tearjerker.', likes: '260' },
    ],
  },
  {
    rank: 7,
    title: 'The Second Yes',
    posterFile: 'poster_7.webp',
    rating: '7.8 / 10',
    liked: '78%',
    views: '328K+ views',
    category: 'Mature Romance',
    comments: [
      { user: '@ronke_love', text: 'Mature love story done right. The second chances theme hit home.', likes: '390' },
      { user: '@uche_movies', text: 'Clean directing, soothing music score, very enjoyable watch.', likes: '175' },
    ],
  },
  {
    rank: 8,
    title: "The Billionaire's Wife",
    posterFile: 'poster_8.jpg',
    rating: '7.3 / 10',
    liked: '72%',
    views: '148K+ views',
    category: 'High Society Drama',
    comments: [
      { user: '@mercy_d', text: 'The plot twists towards the ending kept me glued to the screen.', likes: '280' },
      { user: '@austin_k', text: 'High production value and classy costumes throughout.', likes: '162' },
    ],
  },
];

const POPCORN_SVG = `<svg viewBox="0 0 64 64" width="76" height="76"><path fill="#edd8b4" d="M51 11.9c1.9-5.8-5.4-9-8.4-5.8c-3.9-6.4-12.2-1.8-12.2-1.8s-4.5-5-10.3-.4c-2.1-2.1-8.4-2.6-8.2 7.6c-7 .6-6.9 10.4-3.7 11.9l46.2 4c4.5-1.8 6.2-13.8-3.4-15.5"/><path fill="#fff8d6" d="M21.8 4.8C22.3.5 14 1.3 15.3 6c-3.1 1.1-.9 5.8 1.6 4.6c.1 3.7 6.3 2.8 5.4-1.1c2.3 1 4.3-5.2-.5-4.7"/><path fill="#edd8b4" d="M20.7 6.1c.9-1.6-2.1-3.4-2.3-.5c-1.8-1.5-4.1 2.7-.9 2.8c-1.5 2.3 2.4 3.7 3.1 1.5c3.1-.3 2.2-4.3.1-3.8"/><path fill="#c9ae81" d="M20.8 7.7c-1.2-.3-1-.4-.9-1.3c.2-1.7-.8-1.7-.7-.1c.1 1-.1 1.4-1.1.6c-1.3-.9-1.4.1-.2.5c1.1.5.7.2.7 1.6c0 1.1.6 1.4.7 0s0-1.3 1.1-.6c1.1.6 1.5-.4.4-.7"/><path fill="#fff8d6" d="M17.9 15.8c2.3-2-3.3-7.4-5.4-1.9c-4.4-2.7-6.5 5.4-2.2 7.7c2.1 1.2 14.2.4 7.6-5.8"/><path fill="#edd8b4" d="M13.3 15.8c-1.2-1.8-4.8.5-1.9 2.3c-6.3 2.9 11.4 5 5.9-.3c1.4-3.6-3.3-4.6-4-2"/><path fill="#c9ae81" d="M15.1 16.5c-1 1.1-1 .9-1.9.4c-1.7-1.1-2.3.6-.4 1.4c1.1.4 1 .6 2.5 1.4c1.2.6 1.8 0 .3-.8s-1.4-.6 0-1.5c1.3-1.1.4-2-.5-.9"/><path fill="#fff8d6" d="M55.6 18.6c2.1-1.8-2.9-6.6-4.8-1.7c-3.9-2.4-7.3 6-2 6.9c-.4 3.6 5.2 3.6 5.2.6c3.6 1.7 5.9-4.8 1.6-5.8"/><path fill="#edd8b4" d="M51.5 18.6c-1.1-1.6-4.4.4-1.7 2c-2.4 1.1.6 5.2 2.3 2.1c1.6 2.5 4.8-.7 3.1-2.4c1.1-3.1-3.1-4-3.7-1.7"/><path fill="#c9ae81" d="M53.1 19.2c-.9 1-.9.8-1.7.3c-1.5-1-2.1-.1-.4.6c1 .4 1.3.7 0 1.4c-1.5.8-.5 1.4.4.5c1-1 .5-.7 1.8 0c1.1.5 1.6 0 .3-.7s-1.3-.6 0-1.4c1.2-.8.4-1.7-.4-.7"/><path fill="#fff8d6" d="M35.8 7c2.2-1.9-3.1-6.9-5-1.8c-4.1-2.5-7.6 6.2-2.1 7.2c-.4 3.7 5.4 3.8 5.5.6c3.7 1.8 6-5 1.6-6"/><path fill="#edd8b4" d="M31.5 7c-1.1-1.7-4.5.4-1.8 2.1c-2.5 1.1.6 5.4 2.4 2.2c1.6 2.6 5-.7 3.2-2.5c1.3-3.3-3.2-4.2-3.8-1.8"/><path fill="#c9ae81" d="M33.1 7.6c-1 1.1-.9.9-1.8.4c-1.6-1-2.2-.1-.4.6c1 .4 1.3.8.1 1.4c-1.6.9-.6 1.5.4.5s.5-.7 1.9 0c1.1.6 1.7 0 .3-.7c-1.4-.8-1.3-.6 0-1.4c1.2-.9.4-1.7-.5-.8"/><path fill="#fff8d6" d="M27.6 16.1c.6-2.9-7-4-5.3 1.6c-5 .4-2.9 7.4 2.9 7.4c8.2-.1 6.7-10.9 2.4-9"/><path fill="#edd8b4" d="M23.2 18.8c-1.6 7.9 9.9 5 5.1-.8c-1-3.6-4.5-1.8-5.1.8"/><path fill="#c9ae81" d="M25.7 18.2c-.1 1.5-1.2.8-2 1.5c-2.3 2 3.9 3.9 4.9.3c.2-.9-2.6.1-2.1-1.4c.6-1.5-.6-1.7-.8-.4"/><path fill="#fff8d6" d="M45.3 9.3c.6-2.9-6.9-3.9-5.2 1.6c-4.9.4-2.3 9.7 2.8 7.2c2 3.3 6.8-.1 4.9-2.7c4.1-.9 1.8-7.9-2.5-6.1"/><path fill="#edd8b4" d="M41.8 11.9c-2-.7-3.4 3.1-.1 2.8c-1.3 2.4 3.9 4.1 3.3.4c3 1.2 3.7-3.6 1.1-3.9c-1.1-3.6-5.3-1.7-4.3.7"/><path fill="#c9ae81" d="M43.6 11.4c-.1 1.5-.2 1.3-1.2 1.3c-1.9.1-1.8 1.2 0 .8c1.1-.3 1.6-.2.9 1.2c-.8 1.7.5 1.6.7.1s0-.9 1.5-1.1c1.3-.2 1.4-1-.2-.8s-1.4.3-.9-1.2c.5-1.4-.7-1.6-.8-.3"/><path fill="#ed4c5c" d="M7.8 22.4L15.7 62h6.5l-5.3-39.6c-.4-5.6-9.9-5.6-9.1 0"/><path fill="#f9f9f9" d="M16.9 22.4L22.2 62h6.5L26 22.4c0-5.6-9.5-5.6-9.1 0"/><path fill="#ed4c5c" d="M26 22.4L28.7 62h6.5V22.4c.3-5.6-9.2-5.6-9.2 0"/><path fill="#f9f9f9" d="M35.2 22.4V62h6.4l2.7-39.6c.6-5.6-8.8-5.6-9.1 0"/><path fill="#c94747" d="m41.6 62l4.1-2.8l1.9-35.5c.6-4.3-3-5.9-3.4-1.3z"/><path fill="#e8e8e8" d="M49.2 56.8L51.1 25c.7-4-2.8-5.6-3.4-1.3l-1.9 35.5z"/><path fill="#c94747" d="m52.1 54.9l2.3-28.5c.8-3.7-2.6-5.3-3.3-1.3l-1.9 31.8z"/><path fill="#e8e8e8" d="m54 53.6l2.3-26c.2-2.9-1.6-3.9-1.9-1.2l-2.3 28.5z"/></svg>`;

function buildMoviePulseHtml(movie: WatchlistMovie, posterDataUri: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap');
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
  .poster-bg {
    position: absolute;
    inset: 0;
    width: 1080px;
    height: 1350px;
    object-fit: cover;
    object-position: center 20%;
    filter: brightness(0.55) contrast(1.05);
  }
  .vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(8, 10, 13, 0.78) 0%,
      rgba(8, 10, 13, 0.25) 22%,
      rgba(8, 10, 13, 0.45) 55%,
      rgba(8, 10, 13, 0.95) 82%,
      #080A0D 100%
    );
  }
  .container {
    position: relative;
    z-index: 10;
    width: 1080px;
    height: 1350px;
    padding: 55px 65px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .top-rail {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-text {
    font-family: 'Barlow', sans-serif;
    font-size: 38px;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: #FFFFFF;
  }
  .brand-text span {
    color: #FF5A1F;
  }
  .top-right-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .series-tag {
    font-family: 'Barlow', sans-serif;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #E2E8F0;
  }
  .pill-badge {
    background: #FF5A1F;
    color: #FFFFFF;
    font-family: 'Barlow', sans-serif;
    font-size: 16px;
    font-weight: 900;
    padding: 6px 16px;
    border-radius: 999px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    box-shadow: 0 4px 14px rgba(255, 90, 31, 0.4);
  }
  .comments-stack {
    margin-top: 25px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: relative;
  }
  .comment-card {
    background: rgba(255, 255, 255, 0.96);
    color: #0F172A;
    border-radius: 24px;
    padding: 24px 30px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.5);
  }
  .c-0 {
    margin-left: 20px;
    max-width: 720px;
  }
  .c-1 {
    margin-left: 170px;
    max-width: 740px;
  }
  .c-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .c-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .c-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FF5A1F 0%, #FF8A57 100%);
    color: #FFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 16px;
  }
  .c-name {
    font-weight: 800;
    font-size: 22px;
    color: #FF5A1F;
  }
  .c-likes {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 19px;
    font-weight: 700;
    color: #1E293B;
  }
  .c-likes svg {
    width: 20px;
    height: 20px;
    fill: #E11D48;
  }
  .c-body {
    font-size: 23px;
    font-weight: 600;
    line-height: 1.35;
    color: #0F172A;
  }
  .verdict-deck {
    background: rgba(11, 13, 16, 0.93);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 30px;
    padding: 30px 36px;
    backdrop-filter: blur(20px);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .deck-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .verdict-group {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .popcorn-icon {
    width: 76px;
    height: 76px;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.6));
    flex-shrink: 0;
  }
  .score-numbers {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }
  .pct-val {
    font-family: 'Barlow', sans-serif;
    font-size: 76px;
    line-height: 0.88;
    font-weight: 900;
    letter-spacing: -0.05em;
    color: #FF5A1F;
  }
  .pct-lede {
    font-family: 'Barlow', sans-serif;
    font-size: 26px;
    line-height: 1.05;
    font-weight: 800;
    color: #FFFFFF;
    letter-spacing: -0.02em;
  }
  .score-badge {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #FFFFFF;
    font-family: 'Barlow', sans-serif;
    font-size: 22px;
    font-weight: 800;
    padding: 10px 22px;
    border-radius: 999px;
  }
  .deck-title {
    font-family: 'Barlow', sans-serif;
    font-size: 46px;
    font-weight: 900;
    letter-spacing: -0.03em;
    text-transform: uppercase;
    color: #FFFFFF;
    line-height: 1.05;
  }
  .deck-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 20px;
    font-weight: 600;
    color: #CBD5E1;
  }
  .meta-tag {
    background: rgba(255, 90, 31, 0.2);
    border: 1px solid rgba(255, 90, 31, 0.4);
    color: #FF5A1F;
    font-size: 16px;
    font-weight: 800;
    padding: 5px 14px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
  <img class="poster-bg" src="${posterDataUri}" alt="${movie.title}">
  <div class="vignette"></div>
  <div class="container">
    <div class="top-rail">
      <div class="brand-logo">
        <div class="brand-text">Muvi<span>DB</span></div>
      </div>
      <div class="top-right-badge">
        <div class="series-tag">Weekend Watchlist</div>
        <div class="pill-badge">${movie.rank} OF 8 • AUDIENCE PULSE</div>
      </div>
    </div>

    <div class="comments-stack">
      ${movie.comments.map((c, idx) => `
        <div class="comment-card c-${idx}">
          <div class="c-header">
            <div class="c-author">
              <div class="c-avatar">${c.user.charAt(1).toUpperCase()}</div>
              <div class="c-name">${c.user}</div>
            </div>
            <div class="c-likes">
              <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span>${c.likes}</span>
            </div>
          </div>
          <div class="c-body">${c.text}</div>
        </div>
      `).join('')}
    </div>

    <div class="verdict-deck">
      <div class="deck-top">
        <div class="verdict-group">
          <div class="popcorn-icon">${POPCORN_SVG}</div>
          <div class="score-numbers">
            <span class="pct-val">${movie.liked}</span>
            <span class="pct-lede">Like<br>This Film</span>
          </div>
        </div>
        <div class="score-badge">★ ${movie.rating}</div>
      </div>

      <div class="deck-title">${movie.title}</div>

      <div class="deck-meta">
        <span class="meta-tag">Now Streaming</span>
        <span>${movie.views}</span>
        <span>•</span>
        <span>${movie.category}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function renderCover(outPath: string): Promise<void> {
  const coverSource = path.resolve('public/images/social/weekend-watchlist-cover-v1.png');
  await sharp(coverSource)
    .resize(1080, 1350, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(outPath);
  console.log('✓ Slide 1 (Cover) rendered successfully');
}

async function renderBackCover(outPath: string): Promise<void> {
  const backCoverSource = path.resolve('public/images/social/carousel-back-cover-v1.png');
  await sharp(backCoverSource)
    .resize(1080, 1350, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(outPath);
  console.log('✓ Slide 10 (Back Cover) rendered successfully');
}

async function sendCarouselToTelegram(slides: string[]) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '780844382').trim();

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    process.exit(1);
  }

  console.log(`Sending 10-slide carousel to Telegram chat ${chatId}...`);

  const caption = `🍿 WEEKEND WATCHLIST: 8 NEW NOLLYWOOD DROPS (AUDIENCE PULSE) 🇳🇬\n📅 Oct 31 – Nov 1, 2026\n\nHere is the full 10-slide 4:5 Carousel:\n1. 🎬 Cover: What To Watch This Weekend\n2. User Friendly (78% Liked • 678K views)\n3. Parents by Accident (72% Liked • 1.7M+ views)\n4. Omo Iroko (70% Liked • 27K views)\n5. The Last Driver (73% Liked • 45K views)\n6. A Tale of Silent Sisters (76% Liked • 155K views)\n7. Iya Omo 2 (75% Liked • 592K views)\n8. The Second Yes (78% Liked • 328K views)\n9. The Billionaire's Wife (72% Liked • 148K views)\n10. 💬 Closing: "What Are You Watching This Weekend?"\n\nRanked by authentic viewer sentiments, like counts, and streaming velocity from muvidb.com`;

  const formData = new FormData();
  formData.append('chat_id', chatId);

  const mediaArray = slides.map((slidePath, idx) => {
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
    console.log('🎉 SUCCESS! 10-Slide Carousel delivered to Telegram! Message IDs:', body.result?.map((m: any) => m.message_id));
  } else {
    console.error('❌ Telegram error:', body);
    process.exit(1);
  }
}

async function main() {
  const outDir = path.resolve('scratch/watchlist-carousel');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('--- Generating 10-Slide Weekend Watchlist Carousel (4:5, 1080x1350) ---');

  const slidePaths: string[] = [];

  // Slide 1: Cover
  const slide1Path = path.join(outDir, 'slide_01.png');
  await renderCover(slide1Path);
  slidePaths.push(slide1Path);

  // Slides 2 to 9: 8 Movies
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

  const postersDir = path.resolve('scratch/watchlist-carousel/posters');

  for (let i = 0; i < MOVIES.length; i++) {
    const movie = MOVIES[i];
    const slideNumber = i + 2;
    const slideFileName = `slide_0${slideNumber}.png`.replace('_010', '_10');
    const outSlidePath = path.join(outDir, slideFileName);

    console.log(`Rendering Slide ${slideNumber}/10: ${movie.title}...`);
    const posterLocalPath = path.join(postersDir, movie.posterFile);
    const posterBuf = fs.readFileSync(posterLocalPath);
    const mime = movie.posterFile.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const posterDataUri = `data:${mime};base64,${posterBuf.toString('base64')}`;

    const html = buildMoviePulseHtml(movie, posterDataUri);

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await (document as any).fonts?.ready;
    });
    await page.waitForTimeout(400);

    await page.screenshot({
      path: outSlidePath,
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
      type: 'png',
    });
    console.log(`  ✓ Saved ${slideFileName}`);
    slidePaths.push(outSlidePath);
  }

  await browser.close();

  // Slide 10: Back Cover
  const slide10Path = path.join(outDir, 'slide_10.png');
  await renderBackCover(slide10Path);
  slidePaths.push(slide10Path);

  console.log(`\nGenerated all ${slidePaths.length} slides.`);

  // Upload to Telegram
  await sendCarouselToTelegram(slidePaths);
}

main().catch(console.error);
