import { professionalRoleLabel } from './professionalRoles';

export const CAREER_PASSPORT_WIDTH = 1080;
export const CAREER_PASSPORT_HEIGHT = 1350;

const ORANGE = '#ff4d0a';
const BLACK = '#101112';
const MUTED = '#626262';
const LINE = '#d7d7d7';
const SOFT = '#f7f7f7';

function uniqueFilms(credits = []) {
  const seen = new Set();
  return credits.filter((credit) => {
    const film = credit?.films || {};
    const key = film.id || credit.film_id || film.slug || film.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countryCode(value = '') {
  const normalized = String(value).toLowerCase();
  const codes = { nigerian: 'NG', nigeria: 'NG', ghanaian: 'GH', ghana: 'GH', kenyan: 'KE', kenya: 'KE', southafrican: 'ZA', 'south african': 'ZA', ugandan: 'UG', uganda: 'UG' };
  return codes[normalized.replace(/\s+/g, '')] || codes[normalized] || 'AF';
}

function stableNumber(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 1_000_000;
}

export function getCareerPassportId(person = {}) {
  if (person.muvidb_id) return person.muvidb_id;
  return `MVP-${countryCode(person.nationality)}-${String(stableNumber(person.id || person.slug || person.name)).padStart(6, '0')}`;
}

function detectFormats(credits = [], stageCredits = []) {
  const formats = new Set();
  for (const credit of credits) {
    const film = credit?.films || {};
    const release = String(film.release_type || film.source || '').toLowerCase();
    if (release.includes('youtube') || film.youtube_watch_url || film.trailer_youtube_id) formats.add('YouTube');
    if (release.includes('cinema') || release.includes('theatr')) formats.add('Cinema');
    if (release.includes('tv') || release.includes('television') || film.content_type === 'series') formats.add('TV');
    if (release.includes('stream') || Array.isArray(film.streaming_links) && film.streaming_links.length) formats.add('Streaming');
  }
  if (stageCredits.length) formats.add('Theatre');
  return [...formats];
}

function clipText(value, max) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

export function buildCareerPassportModel({ person = {}, credits = [], stageCredits = [], collaboratorCount = 0, baseUrl = 'https://muvidb.com' }) {
  const films = uniqueFilms(credits);
  const selectedCredits = [...films]
    .sort((a, b) => (Number(b.films?.year) || 0) - (Number(a.films?.year) || 0))
    .slice(0, 5);
  const roles = [...new Set(credits.map((credit) => professionalRoleLabel(credit.role)).filter(Boolean))];
  if (!roles.length && person.known_for_department) roles.push(professionalRoleLabel(person.known_for_department));
  const slug = person.slug || person.id;
  const profileUrl = `${String(baseUrl).replace(/\/$/, '')}/people/${slug}`;
  return {
    name: person.name || 'MuviDB Professional',
    role: roles.slice(0, 3).join(' · ') || 'Film Professional',
    nationality: person.nationality || 'African',
    bio: clipText(person.bio || person.biography || `${person.name || 'This professional'} is part of Africa’s growing film community.`, 235),
    photoUrl: person.photo_url || '/images/person-placeholder.png',
    claimed: Boolean(person.claimed_by || person.is_claimed || person.claimed),
    productions: films.length,
    credits: credits.length,
    collaborators: Math.max(0, Number(collaboratorCount) || 0),
    formats: detectFormats(credits, stageCredits),
    selectedCredits: selectedCredits.map((credit) => ({
      title: credit.films?.title || 'Untitled production',
      posterUrl: credit.films?.poster_url || '/images/film-placeholder.webp',
    })),
    profileUrl,
    displayUrl: `muvidb.com/people/${slug}`,
    passportId: getCareerPassportId(person),
  };
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke = null, lineWidth = 1) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function safeImage(src, fallback) {
  try { return await loadImage(src); } catch {
    if (!fallback) return null;
    try { return await loadImage(fallback); } catch { return null; }
  }
}

function drawCover(ctx, image, x, y, width, height, radius = 0) {
  if (!image) {
    roundRect(ctx, x, y, width, height, radius, '#e8e8e8');
    return;
  }
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.save();
  roundRect(ctx, x, y, width, height, radius, null);
  ctx.clip();
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
}

function fitText(ctx, text, maxWidth, startSize, family, weight = 400, minSize = 28) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > minSize);
  return size;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else line = candidate;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(' ').length > lines.join(' ').length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]?$/, '')}…`;
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return lines.length;
}

function drawMiniIcon(ctx, type, x, y, color = ORANGE) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'credits') {
    roundRect(ctx, x, y + 8, 34, 26, 5, null, color, 4);
    ctx.beginPath(); ctx.moveTo(x + 3, y + 8); ctx.lineTo(x + 30, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 16, y + 12); ctx.moveTo(x + 21, y + 3); ctx.lineTo(x + 27, y + 9); ctx.stroke();
  } else if (type === 'star') {
    ctx.font = '700 38px Inter, sans-serif'; ctx.fillText('★', x, y + 33);
  } else if (type === 'people') {
    ctx.beginPath(); ctx.arc(x + 12, y + 12, 7, 0, Math.PI * 2); ctx.arc(x + 29, y + 14, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 12, y + 35, 12, Math.PI, Math.PI * 2); ctx.arc(x + 29, y + 35, 10, Math.PI, Math.PI * 2); ctx.fill();
  } else if (type === 'globe') {
    ctx.beginPath(); ctx.arc(x + 18, y + 18, 16, 0, Math.PI * 2); ctx.moveTo(x + 2, y + 18); ctx.lineTo(x + 34, y + 18); ctx.moveTo(x + 18, y + 2); ctx.bezierCurveTo(x + 8, y + 10, x + 8, y + 27, x + 18, y + 34); ctx.moveTo(x + 18, y + 2); ctx.bezierCurveTo(x + 28, y + 10, x + 28, y + 27, x + 18, y + 34); ctx.stroke();
  } else if (type === 'play') {
    roundRect(ctx, x, y + 3, 38, 28, 7, color); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 16, y + 10); ctx.lineTo(x + 27, y + 17); ctx.lineTo(x + 16, y + 24); ctx.closePath(); ctx.fill();
  } else {
    roundRect(ctx, x, y + 2, 36, 30, 6, null, color, 4); ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo(x + 15, y + 6); ctx.moveTo(x + 24, y); ctx.lineTo(x + 18, y + 6); ctx.stroke();
  }
  ctx.restore();
}

export async function generateCareerPassportJpeg(input) {
  if (typeof document === 'undefined') throw new Error('Career Passport can only be generated in a browser');
  const model = input.profileUrl ? input : buildCareerPassportModel(input);
  await Promise.allSettled([
    document.fonts?.load('400 72px "Bebas Neue"'),
    document.fonts?.load('500 60px Barlow'),
    document.fonts?.load('700 36px Inter'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = CAREER_PASSPORT_WIDTH;
  canvas.height = CAREER_PASSPORT_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper depth and decorative dots.
  const glow = ctx.createRadialGradient(850, 90, 0, 850, 90, 560);
  glow.addColorStop(0, '#fff7f1'); glow.addColorStop(1, '#ffffff');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, 520);
  ctx.fillStyle = ORANGE;
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) ctx.beginPath(), ctx.arc(1000 + col * 14, 44 + row * 14, 3, 0, Math.PI * 2), ctx.fill();

  const qrcodeModName = 'qrcode';
  const { default: QRCode } = await import(/* @vite-ignore */ qrcodeModName);
  const [logo, portrait, qr, cinemaIcon, streamingIcon, youtubeIcon, theatreIcon, tvIcon, clapperIcon, starIcon, usersIcon, actorIcon, ...posters] = await Promise.all([
    safeImage('/images/MuviDB%20Brand/MuviDB%20Icon.png', '/images/logo.png'),
    safeImage(model.photoUrl, '/images/person-placeholder.png'),
    loadImage(await QRCode.toDataURL(model.profileUrl, { width: 150, margin: 1, errorCorrectionLevel: 'M', color: { dark: BLACK, light: '#ffffff' } })),
    safeImage('/images/career-passport/solar-reel-outline.svg'),
    safeImage('/images/career-passport/solar-screencast-outline.svg'),
    safeImage('/images/career-passport/youtube.svg'),
    safeImage('/images/career-passport/solar-masks-outline.svg'),
    safeImage('/images/career-passport/solar-tv-outline.svg'),
    safeImage('/images/career-passport/solar-clapperboard-outline.svg'),
    safeImage('/images/career-passport/solar-star-outline.svg'),
    safeImage('/images/career-passport/solar-users-group-rounded-outline.svg'),
    safeImage('/images/career-passport/solar-mask-happly-outline.svg'),
    ...model.selectedCredits.map((credit) => safeImage(credit.posterUrl, '/images/film-placeholder.webp')),
  ]);

  if (logo) ctx.drawImage(logo, 42, 30, 58, 58);
  ctx.fillStyle = BLACK; ctx.font = '700 42px Inter, sans-serif'; ctx.fillText('Muvi', 108, 74);
  ctx.fillStyle = ORANGE; ctx.fillText('DB', 202, 74);
  ctx.fillStyle = BLACK; ctx.font = '600 13px Inter, sans-serif'; ctx.letterSpacing = '3px'; ctx.fillText('DISCOVER. CREDIT. CELEBRATE.', 44, 108); ctx.letterSpacing = '0px';
  ctx.fillStyle = ORANGE; ctx.font = '700 18px Inter, sans-serif'; ctx.fillText('#MuviDB', 900, 58);

  // Portrait panel.
  drawCover(ctx, portrait, 46, 154, 352, 478, 26);
  ctx.save();
  roundRect(ctx, 46, 154, 352, 478, 26, null);
  ctx.clip();
  ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.moveTo(352, 632); ctx.lineTo(398, 575); ctx.lineTo(398, 632); ctx.closePath(); ctx.fill();
  ctx.restore();
  roundRect(ctx, 46, 154, 352, 478, 26, null, ORANGE, 2);

  // Main identity.
  ctx.fillStyle = BLACK; ctx.font = '400 94px "Bebas Neue", Impact, sans-serif'; ctx.fillText('CAREER', 438, 206);
  ctx.fillStyle = ORANGE; ctx.font = '400 98px "Bebas Neue", Impact, sans-serif'; ctx.fillText('PASSPORT', 438, 296);
  roundRect(ctx, 438, 316, 386, 38, 7, BLACK);
  ctx.fillStyle = '#fff'; ctx.font = '700 21px Inter, sans-serif'; ctx.fillText('AFRICAN FILM PROFESSIONAL', 456, 343);
  const nameWidth = model.claimed ? 365 : 570;
  const nameSize = fitText(ctx, model.name.toUpperCase(), nameWidth, 58, 'Barlow, Inter, sans-serif', 500, 32);
  ctx.fillStyle = BLACK; ctx.font = `500 ${nameSize}px Barlow, Inter, sans-serif`; ctx.fillText(model.name.toUpperCase(), 438, 430);
  if (model.claimed) {
    roundRect(ctx, 820, 378, 210, 42, 18, ORANGE);
    ctx.fillStyle = '#fff'; ctx.font = '700 15px Inter, sans-serif'; ctx.fillText('✓ CLAIMED PROFILE', 840, 405);
  }
  ctx.fillStyle = ORANGE; ctx.fillRect(438, 446, 46, 3);
  if (actorIcon) ctx.drawImage(actorIcon, 438, 464, 30, 30);
  ctx.font = '700 22px Inter, sans-serif'; ctx.fillStyle = BLACK; ctx.fillText(model.role, 482, 492);
  drawMiniIcon(ctx, 'globe', 438, 510, ORANGE);
  ctx.font = '600 22px Inter, sans-serif'; ctx.fillText(model.nationality, 482, 540);
  ctx.font = '400 17px Inter, sans-serif'; ctx.fillStyle = BLACK; wrapText(ctx, model.bio, 438, 580, 570, 27, 3);

  // Stats strip.
  roundRect(ctx, 46, 664, 988, 96, 18, '#fff', LINE, 1.5);
  const stats = [[model.productions, 'Productions', clapperIcon], [model.credits, 'Verified credits', starIcon], [model.collaborators || '—', 'Collaborators', usersIcon]];
  stats.forEach(([value, label, icon], index) => {
    const x = 120 + index * 326;
    if (index) { ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 60, 680); ctx.lineTo(x - 60, 744); ctx.stroke(); }
    if (icon) ctx.drawImage(icon, x - 40, 688, 40, 40);
    ctx.fillStyle = BLACK; ctx.font = '700 40px Inter, sans-serif'; ctx.fillText(String(value), x + 18, 715);
    ctx.font = '500 17px Inter, sans-serif'; ctx.fillText(label, x + 18, 739);
  });

  // Work formats.
  roundRect(ctx, 46, 776, 988, 78, 16, '#fff', LINE, 1.5);
  ctx.fillStyle = BLACK; ctx.font = '800 18px Inter, sans-serif'; ctx.fillText('WORK', 78, 807); ctx.fillText('ACROSS', 78, 829);
  const formatList = [
    ['Cinema', cinemaIcon],
    ['Streaming', streamingIcon],
    ['YouTube', youtubeIcon],
    ['Theatre', theatreIcon],
    ['TV', tvIcon],
  ];
  formatList.forEach(([format, icon], index) => {
    const x = 205 + index * 160;
    const active = model.formats.includes(format);
    ctx.globalAlpha = active ? 1 : 0.35;
    if (icon) ctx.drawImage(icon, x, 791, 38, 38);
    ctx.fillStyle = BLACK; ctx.font = '600 15px Inter, sans-serif'; ctx.fillText(format, x + 46, 818);
    ctx.globalAlpha = 1;
  });

  // Selected credits.
  roundRect(ctx, 46, 870, 988, 340, 16, '#fff', LINE, 1.5);
  ctx.fillStyle = ORANGE; ctx.fillRect(62, 892, 4, 24);
  ctx.fillStyle = BLACK; ctx.font = '800 19px Inter, sans-serif'; ctx.fillText('SELECTED CREDITS', 80, 912);
  const cardWidth = 174;
  for (let index = 0; index < 5; index += 1) {
    const credit = model.selectedCredits[index];
    const x = 64 + index * 193;
    drawCover(ctx, posters[index] || null, x, 932, cardWidth, 220, 10);
    ctx.fillStyle = BLACK; ctx.font = '500 14px Inter, sans-serif';
    const title = credit?.title || 'More work coming soon';
    const size = fitText(ctx, title, cardWidth, 14, 'Inter, sans-serif', 500, 11);
    ctx.font = `500 ${size}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(clipText(title, 28), x + cardWidth / 2, 1180); ctx.textAlign = 'left';
  }

  // Profile CTA and professional ID.
  const bar = ctx.createLinearGradient(46, 0, 680, 0); bar.addColorStop(0, ORANGE); bar.addColorStop(1, '#ff7a00');
  roundRect(ctx, 46, 1225, 650, 94, 18, bar);
  roundRect(ctx, 66, 1243, 66, 60, 12, BLACK);
  drawMiniIcon(ctx, 'globe', 81, 1255, '#fff');
  ctx.fillStyle = '#fff'; ctx.font = '500 19px Inter, sans-serif'; ctx.fillText('View Full Profile', 150, 1261);
  const urlSize = fitText(ctx, model.displayUrl, 390, 27, 'Inter, sans-serif', 800, 17);
  ctx.font = `800 ${urlSize}px Inter, sans-serif`; ctx.fillText(model.displayUrl, 150, 1294);
  roundRect(ctx, 586, 1237, 98, 72, 10, '#fff'); ctx.drawImage(qr, 598, 1243, 60, 60);
  roundRect(ctx, 714, 1225, 320, 94, 18, '#fff', LINE, 1.5);
  ctx.fillStyle = ORANGE; ctx.font = '700 16px Inter, sans-serif'; ctx.fillText('MuviDB ID', 748, 1260);
  ctx.fillStyle = BLACK; ctx.font = '800 26px Inter, sans-serif'; ctx.fillText(model.passportId, 748, 1294);

  return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create Career Passport')), 'image/jpeg', 0.94));
}

export function careerPassportShareText(person, personalized = false) {
  return personalized
    ? `Check out my Career Passport on MuviDB — every film, every credit.`
    : `Check out ${person?.name || 'this film professional'}'s Career Passport on MuviDB.`;
}

export function careerPassportFilename(person = {}) {
  const safe = String(person.name || 'muvidb-professional').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${safe || 'muvidb-professional'}-career-passport.jpg`;
}
