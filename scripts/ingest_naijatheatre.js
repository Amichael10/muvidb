import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const itemLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

function decodeHtml(html) {
  if (!html) return '';
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&#8211;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExcludedArticle(raw) {
  return /annual report|internship|job|audition|casting call|competition|monologue challenge|workshop|yellow pages|fellowship|scholarship|call for plays|calls for|calls for plays|calling for sponsors|grant|shortlists 11|shortlist|wins first place|wins 6th|wins award|theatre festival|festival begins|festival kicks off|festival slated|festival goes live|review and critic|different voices|culture unmasked|celebrates 10 years|stage plays in one|returns to lagos with two|brings two stage plays|poetry theatre showcase|mud festival|actors training exercise/i.test(raw);
}

function cleanPersonName(raw) {
  if (!raw) return null;
  let name = raw
    .replace(/^(this\s+is\s+how\s+the\s+review\s+of\s+|a\s+veteran\s+of\s+nigerian\s+theatre\s+|nigerian\s+playwright\s+|theatre\s+director\s+|celebrated\s+writer\s+)/i, '')
    .replace(/\s+(and\s+produced\s+by|and\s+directed\s+by|and\s+assisted\s+by|and\s+performed\s+by|and\s+will\s+be|is\s+now|is\s+on\s+stage|as\s+directed\s+by|for\s+pawstudios).*$/i, '')
    .replace(/\s+Directed\s+by.*$/i, '')
    .replace(/\s+Produced\s+by.*$/i, '')
    .replace(/\s+and\s+directed.*$/i, '')
    .replace(/\s+and\s+published.*$/i, '')
    .replace(/\s+and$/i, '')
    .replace(/^['"‘“]|['"’”]$/g, '')
    .replace(/[,;:.]$/, '')
    .trim();

  if (name.length < 3 || name.length > 50) return null;
  if (/^(the\s+play|when\s+orwell|truly\s+successful|every\s+man|one\s+thing|arguably|there\s+was|who\s+lives|describing|featuring|terra\s+kulture)$/i.test(name)) return null;
  if (/showing|theatre|tickets|culture|lawn|hall|centre|museum|production|drama|fair\b/i.test(name)) return null;
  return name;
}

function cleanTitle(raw) {
  let title = raw
    .replace(/^['"‘“]|['"’”]$/g, '')
    .replace(/\s*[-–—:]\s*(a\s+man,\s+three\s+wives.*|the\s+story\s+of\s+every\s+man.*|final\s+serving.*|a\s+stage\s+play.*|a\s+musical.*)/i, '')
    .replace(/\s+(is\s+)?(now\s+)?(coming\s+to|showing|hits|back\s+in|back\s+on\s+stage|goes\s+on\s+stage|on\s+stage|live\s+on\s+stage)\s+.*$/i, '')
    .replace(/\s+(theatre\s+production|contemporary\s+theatre\s+production|a\s+theatre\s+comedy\s+play|an\s+easter\s+opera|opera\s+play|opera|improv\s+show|interactive\s+play|solo\s+play|initiation\s+play|immersive\s+theatre).*$/i, '')
    .replace(/\s*,?\s*free\s+theatre\s+.*$/i, '')
    .replace(/\s*,?\s*a\s+solo\s+play\s+.*$/i, '')
    .replace(/\s+stage\s+play(\s+.*)?$/i, '')
    .replace(/\s+a\s+one-man\s+play.*$/i, '')
    .replace(/\s+by\s+cheta\s+igbokwe.*$/i, '')
    .replace(/\s*[-–—]\s*a\s+comedy.*$/i, '')
    .replace(/\s*[-–—]\s*a\s+wedding\s+you\s+will\s+not\s+forget.*$/i, '')
    .replace(/\s+showing\s+(this|in|at).*$/i, '')
    .replace(/^Stage Play\s*[-–—:]\s*/i, '')
    .replace(/^Popular Nigerian Stage Play\s+/i, '')
    .replace(/^Watch\s+/i, '')
    .replace(/Stage\s+Play.*$/i, '')
    .replace(/\s+in\s+(lagos|london|abuja|ibadan|enugu|osun|kebbi|california|the\s+uk|the\s+us|sheffield|okene).*$/i, '')
    .replace(/\s+this\s+(january|february|march|april|may|june|july|august|september|october|november|december).*$/i, '')
    .replace(/\s+on\s+march\s+\d+.*$/i, '')
    .replace(/\s*,?\s*theatre\s+production.*$/i, '')
    .trim();

  // Review headline cleaning
  if (/^Femi Branch shines in (.*)/i.test(title)) title = title.replace(/^Femi Branch shines in /i, '');
  if (/^The Technical Triumph of (.*)/i.test(title)) title = title.replace(/^The Technical Triumph of /i, '');
  if (/^Dance as a storytelling device:\s*The (.*) example/i.test(title)) title = title.replace(/^Dance as a storytelling device:\s*The /i, '').replace(/\s+example/i, '');
  if (/^The three elements that carried (.*)/i.test(title)) title = title.replace(/^The three elements that carried /i, '');
  if (/^Effort Outshines All Else in (.*)/i.test(title)) title = title.replace(/^Effort Outshines All Else in /i, '');
  if (/^Activist Theatre:\s*(.*)\s+draws from/i.test(title)) title = title.replace(/^Activist Theatre:\s*/i, '').replace(/\s+draws from.*/i, '');
  if (/Blurring Realities:.*Black Eye/i.test(title)) return 'Black Eye';
  if (/^['"‘“]?Yemoja['"’”]?:\s*When Myth/i.test(title)) title = 'Yemoja';
  if (/^Homecoming:\s*Another reason/i.test(title)) title = 'Homecoming';
  if (/^Mammy Water weds Environmentalist/i.test(title)) title = "Mammy Water's Wedding";
  if (/^All Else is Sinking Sand/i.test(title)) title = 'Once Upon Four Robbers';
  if (/\s+on\s+YouTube$/i.test(title)) title = title.replace(/\s+on\s+YouTube$/i, '');
  if (/^Dike Chukwumerije's\s+/i.test(title)) title = title.replace(/^Dike Chukwumerije's\s+/i, '');
  if (/^Ahmed Yerima’s\s+/i.test(title)) title = title.replace(/^Ahmed Yerima’s\s+/i, '');

  // Substring standardizations for known plays
  if (/^Anatomy of a Woman/i.test(title)) return 'Anatomy of a Woman';
  if (/^Man Enough/i.test(title)) return 'Man Enough';
  if (/^The Polygamist/i.test(title)) return 'The Polygamist';
  if (/^Chief\b/i.test(title)) return 'Chief';
  if (/^Whispers at the Pandarus/i.test(title)) return 'Whispers at the Pandarus';
  if (/^Panty Liners/i.test(title)) return 'Panty Liners';
  if (/^Konji('?s)?\s+Harvest/i.test(title) || /^Kongi('?s)?\s+Harvest/i.test(title)) return "Kongi's Harvest";
  if (/^Omugwo/i.test(title)) return 'Omugwo';
  if (/^Waterside/i.test(title)) return 'Waterside';
  if (/^Kaineto/i.test(title)) return 'Kaineto';
  if (/^Osaro/i.test(title)) return 'Osaro';
  if (/^Quest Of Thrones/i.test(title)) return 'Quest of Thrones';
  if (/^Baba's Shop/i.test(title)) return "Baba's Shop";
  if (/^Our Husband has Gone Mad Again/i.test(title)) return 'Our Husband Has Gone Mad Again';
  if (/^The Marriage of Anansewa/i.test(title)) return 'The Marriage of Anansewa';
  if (/^The Wizard of Law/i.test(title)) return 'The Wizard of Law';
  if (/^The Swamp Dwellers/i.test(title)) return 'The Swamp Dwellers';
  if (/^Wedlock of the Gods/i.test(title)) return 'Wedlock of the Gods';
  if (/^The Forest of Talking Drums/i.test(title)) return 'The Forest of Talking Drums';
  if (/^A True Christmas Story/i.test(title)) return 'A True Christmas Story';

  // Clean trailing prepositions, articles, or dashes in a loop
  let prev = '';
  while (prev !== title) {
    prev = title;
    title = title
      .replace(/\s*,\s*(a|an|the|an\s+experiential)\s*$/i, '')
      .replace(/\s+[-–—]\s*$/i, '')
      .replace(/\s+(the|a|an|is|are|in|at|on|for|with|and|of|to|into|from)\s*$/i, '')
      .replace(/\s*[-–—:]\s*$/i, '')
      .trim();
  }

  return title.replace(/[,;:.]$/, '').trim();
}

function cleanSynopsisParagraph(text) {
  let s = text.trim();
  s = s.replace(/\bDate\s*:\s*.*$/i, '');
  s = s.replace(/\bTime\s*:\s*.*$/i, '');
  s = s.replace(/\bVenue\s*:\s*.*$/i, '');
  s = s.replace(/\bTickets\s*:\s*.*$/i, '');
  s = s.replace(/\b(For\s+)?tickets?,?\s+times?\s+and\s+other\s+details\s+.*$/i, '');
  s = s.replace(/\bTo\s+buy\s+tickets\s+.*$/i, '');
  s = s.replace(/\bTo\s+get\s+your\s+tickets\s+.*$/i, '');
  s = s.replace(/\bGet\s+tickets\s+.*$/i, '');
  s = s.replace(/\bFor\s+ticket\s+purchase\s+.*$/i, '');
  s = s.replace(/\bFor\s+enquir(y|ies)\s+.*$/i, '');
  s = s.replace(/\bFollow\s+@\w+\s+.*$/i, '');
  s = s.replace(/^[‘'“"]|[’'"”]$/g, '');
  return s.trim();
}

function parsePage(html, url, defaultTitle = '', isReview = false) {
  const ogImageRaw = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
  let poster_url = null;
  if (ogImageRaw) {
    poster_url = decodeHtml(ogImageRaw).split('?')[0]; // Full-resolution original
  }

  // Links (Outbound ticket links only)
  const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  let ticketUrl = null;
  const excludedDomains = [
    'naijatheatre.com', 'framer.com', 'twitter.com', 'x.com', 'facebook.com', 
    'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com',
    'vanguardngr.com', 'thelagosreview.ng', 'punchng.com', 'theguardian.com', 'thisdaylive.com', 'dailypost.ng', 'medium.com'
  ];

  for (const [_, href, rawAnchor] of links) {
    const anchor = decodeHtml(rawAnchor).toLowerCase();
    const cleanHref = href.trim();
    if (!cleanHref.startsWith('http')) continue;
    if (excludedDomains.some(d => cleanHref.includes(d))) continue;

    const isTicketPlatform = /paystack\.com|ariiyatickets\.com|tix\.africa|rieticket\.com|allevents\.in|eventbrite|nairabox|quickteller|terrakulture\.com|immersia|sohoplayhouse\.com/i.test(cleanHref);
    const isTicketAnchor = /ticket|buy|book|here|register|attend|seat|pass/i.test(anchor);

    if (isTicketPlatform || isTicketAnchor) {
      ticketUrl = cleanHref;
      break;
    }
  }

  // Extract paragraphs
  const rawPs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decodeHtml(m[1].replace(/<[^>]+>/g, ' ')))
    .filter(Boolean);

  let playwright = null;
  let director = null;
  let producer = null;
  let venue = null;
  let city = null;
  let year = null;
  const cast = [];
  const cleanParagraphs = [];

  for (let idx = 0; idx < rawPs.length; idx++) {
    const p = rawPs[idx];
    const lower = p.toLowerCase();

    // In reviews, P1 is often the reviewer byline (e.g. "Paul Ogbonna")
    if (isReview && idx === 0 && p.length < 35 && !lower.includes('play') && !lower.includes('written') && !lower.includes('theatre')) {
      continue;
    }

    // Check year in text
    const yearMatch = p.match(/\b(202[0-6]|201\d|19\d\d)\b/);
    if (yearMatch && !year) {
      year = parseInt(yearMatch[1], 10);
    }

    // Date stamp check: e.g. "Jul 18, 2023", "Aug 3, 2023"
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}$/i.test(p.trim())) continue;
    if (/^author\s*:\s*/i.test(lower) && p.length < 50) continue;

    // Check playwright & director
    if (/written\s+and\s+directed\s+by\s+([^,.\n]+)/i.test(p)) {
      const m = p.match(/written\s+and\s+directed\s+by\s+([^,.\n]+)/i);
      if (m) {
        const name = cleanPersonName(m[1]);
        if (name) {
          playwright = playwright || name;
          director = director || name;
        }
      }
    } else {
      if (/written\s+by\s*:?\s*([^,.\n]+)/i.test(p)) {
        const m = p.match(/written\s+by\s*:?\s*([^,.\n]+)/i);
        if (m) {
          const name = cleanPersonName(m[1]);
          if (name) playwright = playwright || name;
        }
      }
      if (/directed\s+by\s*:?\s*([^,.\n]+)/i.test(p)) {
        const m = p.match(/directed\s+by\s*:?\s*([^,.\n]+)/i);
        if (m) {
          const name = cleanPersonName(m[1]);
          if (name) director = director || name;
        }
      }
    }

    if (/produced\s+by\s*:?\s*([^,.\n]+)/i.test(p)) {
      const m = p.match(/produced\s+by\s*:?\s*([^,.\n]+)/i);
      if (m) {
        const name = cleanPersonName(m[1]);
        if (name) producer = producer || name;
      }
    }

    // Special playwright patterns
    if (!playwright) {
      if (/^([A-Z][a-z]+(\s+[A-Z][a-z]+)+)'s\s+['"‘“]?([A-Za-z\s]+)['"’”]?/i.test(p)) {
        const m = p.match(/^([A-Z][a-z]+(\s+[A-Z][a-z]+)+)'s\s+['"‘“]?([A-Za-z\s]+)['"’”]?/i);
        if (m && m[1] !== 'Date' && m[1] !== 'Time' && m[1] !== 'Venue') {
          playwright = cleanPersonName(m[1]);
        }
      } else if (/^A\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)+)\s+play\b/i.test(p)) {
        const m = p.match(/^A\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)+)\s+play\b/i);
        if (m) {
          playwright = cleanPersonName(m[1]);
        }
      } else if (/play\s+by\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)+)/i.test(p)) {
        const m = p.match(/play\s+by\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)+)/i);
        if (m) {
          playwright = cleanPersonName(m[1]);
        }
      }
    }

    // Check venue
    if (/venue\s*:\s*([^.\n]+)/i.test(p)) {
      const m = p.match(/venue\s*:\s*([^.\n]+)/i);
      if (m) {
        venue = venue || m[1].trim();
      }
    }

    // Check starring / cast
    if (/starring\s*:?\s*([\s\S]+)/i.test(p)) {
      const m = p.match(/starring\s*:?\s*([\s\S]+)/i);
      if (m) {
        const names = m[1].split(/,|\band\b/i).map(n => cleanPersonName(n)).filter(Boolean);
        cast.push(...names);
      }
    } else if (/cast\s*:?\s*([\s\S]+)/i.test(p)) {
      const m = p.match(/cast\s*:?\s*([\s\S]+)/i);
      if (m) {
        const names = m[1].split(/,|\band\b/i).map(n => cleanPersonName(n)).filter(Boolean);
        cast.push(...names);
      }
    }

    // Identify city
    if (!city) {
      if (/lagos/i.test(p)) city = 'Lagos';
      else if (/ibadan/i.test(p)) city = 'Ibadan';
      else if (/abuja/i.test(p)) city = 'Abuja';
      else if (/enugu/i.test(p)) city = 'Enugu';
      else if (/london/i.test(p)) city = 'London';
      else if (/new york/i.test(p)) city = 'New York';
    }

    // Filter out marketing, ticket, dates, schedules from synopsis
    if (/^date\s*:|^time\s*:|^showing\s+dates|^showing\s+times|^performances?\s+by|^red\s+carpet/i.test(lower)) continue;
    if (/^venue\s*:/i.test(lower)) continue;
    if (/^written\s+by:|^directed\s+by:|^produced\s+by:|^starring:|^cast:/i.test(lower)) continue;
    if (lower.includes('tickets can be purchased') || lower.includes('get your tickets') || lower.includes('tickets here') || lower.includes('book your tickets') || lower.includes('tickets, times and other details')) continue;
    if (lower.includes('ticket ranges and prices') || lower.startsWith('regular :') || lower.startsWith('premium :') || lower.startsWith('vip :') || lower.startsWith('table :')) continue;
    if (lower.includes('follow @') && (lower.includes('twitter') || lower.includes('instagram'))) continue;
    if (lower.startsWith('this is how the review') && lower.includes('opened in the lagos review')) continue;
    if (lower.startsWith('to buy tickets and get further details')) continue;
    if (lower.startsWith('for enquires and sponsorship') || lower.startsWith('for ticket purchase')) continue;
    if (/^starting\s+at\s+the\s+end\s+of\s+.*showing\s+all\s+through/i.test(lower)) continue;
    if (/^july\s+\d+th.*and\s+\d+th/i.test(lower)) continue;
    if (p.length < 20) continue;

    let cleanP = p
      .replace(/^[\s\S]*introduces the production,\s*thus\s*:?\s*/i, '')
      .replace(/^Here is how it has been described\s*[-–—:]\s*/i, '')
      .trim();

    cleanP = cleanSynopsisParagraph(cleanP);
    if (cleanP && cleanP.length > 25) {
      cleanParagraphs.push(cleanP);
    }
  }

  const synopsis = cleanParagraphs.join('\n\n').trim();

  return {
    poster_url,
    ticketUrl,
    playwright,
    director,
    producer,
    venue,
    city: city || 'Lagos',
    year: year || 2023,
    cast: [...new Set(cast)],
    synopsis
  };
}

function normalizeTitle(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function generateSlug(title) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function getOrCreatePerson(name, role = 'Acting', cache) {
  const cleanName = cleanPersonName(name);
  if (!cleanName) return null;

  const key = cleanName.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  // Look up in Supabase
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, slug')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    cache.set(key, existing[0]);
    return existing[0];
  }

  if (isDryRun) {
    const mockPerson = { id: `dry-run-${generateSlug(cleanName)}`, name: cleanName, slug: generateSlug(cleanName) };
    cache.set(key, mockPerson);
    return mockPerson;
  }

  let slug = generateSlug(cleanName);
  const { data: slugCheck } = await supabase.from('people').select('id').eq('slug', slug).limit(1);
  if (slugCheck && slugCheck.length > 0) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const dept = role === 'Director' ? 'Directing' : role === 'Playwright' ? 'Writing' : 'Acting';
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      known_for_department: dept,
      popularity_score: 10,
      status: 'approved'
    })
    .select('id, name, slug')
    .single();

  if (error) {
    console.warn(`Failed to create person ${cleanName}:`, error.message);
    return null;
  }

  cache.set(key, newPerson);
  return newPerson;
}

async function main() {
  console.log(`=== NaijaTheatre Harvester & Reconciler ===`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (no database writes)' : 'LIVE EXECUTION'}`);
  if (itemLimit) console.log(`Limit: ${itemLimit} items`);

  console.log('1. Loading existing plays from Lumi DB...');
  const { data: dbPlays, error: playErr } = await supabase
    .from('plays')
    .select('id, title, slug, playwright, director, producer, venue, city, poster_url, source_url, synopsis');

  if (playErr) {
    console.error('Error fetching existing plays:', playErr);
    process.exit(1);
  }
  console.log(`Loaded ${dbPlays.length} existing plays from DB.`);

  // Build play lookup map
  const dbPlayMap = new Map();
  for (const p of dbPlays) {
    dbPlayMap.set(p.title.toLowerCase().trim(), p);
    dbPlayMap.set(normalizeTitle(p.title), p);
    if (p.slug) dbPlayMap.set(p.slug.toLowerCase().trim(), p);
  }

  console.log('2. Fetching search index from naijatheatre.com...');
  const indexRes = await fetch('https://framerusercontent.com/sites/4kTfNeTVCKF9QZrVxI8NWT/searchIndex-c4UBdpKhbb0A.json');
  const index = await indexRes.json();
  const allKeys = Object.keys(index).filter(k => k.startsWith('/blog/') || k.startsWith('/reviews/'));

  console.log(`Loaded ${allKeys.length} items from search index.`);

  const candidateItems = [];
  for (const k of allKeys) {
    const item = index[k];
    const rawTitle = item.title || '';
    if (!rawTitle.trim() || rawTitle.trim() === '404') continue;
    if (isExcludedArticle(rawTitle)) continue;

    candidateItems.push({ key: k, rawTitle, item });
  }

  console.log(`Filtered down to ${candidateItems.length} valid theatrical candidates.`);

  const itemsToProcess = itemLimit ? candidateItems.slice(0, itemLimit) : candidateItems;

  const peopleCache = new Map();
  let createdPlaysCount = 0;
  let enrichedPlaysCount = 0;
  let creditsAddedCount = 0;

  console.log(`\n3. Processing ${itemsToProcess.length} theatrical items...`);

  for (let i = 0; i < itemsToProcess.length; i++) {
    const entry = itemsToProcess[i];
    const isReview = entry.key.startsWith('/reviews/');
    const url = 'https://naijatheatre.com' + entry.key;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        console.warn(`[${i+1}/${itemsToProcess.length}] HTTP ${res.status} for ${entry.key}`);
        continue;
      }
      const html = await res.text();
      if (html.includes('<title>404') || html.includes("Oops…. we can't find what you are looking for")) {
        console.log(`[${i+1}/${itemsToProcess.length}] Skipping 404 page: ${entry.key}`);
        continue;
      }

      const parsed = parsePage(html, url, entry.rawTitle, isReview);
      const title = cleanTitle(entry.rawTitle);
      if (!title || title.length < 3) {
        console.log(`[${i+1}/${itemsToProcess.length}] Skipping empty/invalid title: "${entry.rawTitle}"`);
        continue;
      }

      // Check DB match
      const norm = normalizeTitle(title);
      let matchedPlay = dbPlayMap.get(title.toLowerCase().trim()) || dbPlayMap.get(norm);

      if (matchedPlay) {
        // ENRICH EXISTING PLAY IN-PLACE
        const updates = {};
        if ((!matchedPlay.poster_url || matchedPlay.poster_url.includes('placeholder')) && parsed.poster_url) {
          updates.poster_url = parsed.poster_url;
        }
        if (!matchedPlay.source_url && parsed.ticketUrl) {
          updates.source_url = parsed.ticketUrl;
        }
        if ((!matchedPlay.playwright || matchedPlay.playwright === 'Unknown') && parsed.playwright) {
          updates.playwright = parsed.playwright;
        }
        if ((!matchedPlay.director || matchedPlay.director === 'Unknown') && parsed.director) {
          updates.director = parsed.director;
        }
        if (!matchedPlay.producer && parsed.producer) {
          updates.producer = parsed.producer;
        }
        if (!matchedPlay.venue && parsed.venue) {
          updates.venue = parsed.venue;
        }
        if ((!matchedPlay.synopsis || matchedPlay.synopsis.length < 50) && parsed.synopsis && parsed.synopsis.length >= 50) {
          updates.synopsis = parsed.synopsis;
        }

        const hasUpdates = Object.keys(updates).length > 0;
        console.log(`[${i+1}/${itemsToProcess.length}] MATCHED "${matchedPlay.title}" (ID: ${matchedPlay.id}) -> ${hasUpdates ? Object.keys(updates).join(', ') : 'no new fields'}`);

        if (hasUpdates && !isDryRun) {
          const { error } = await supabase.from('plays').update(updates).eq('id', matchedPlay.id);
          if (error) console.error(`Error updating play ${matchedPlay.id}:`, error.message);
          else enrichedPlaysCount++;
        } else if (hasUpdates) {
          enrichedPlaysCount++;
        }

        // Add missing Cast Credits (Zero-Duplicate Actor Guarantee)
        if (parsed.cast && parsed.cast.length > 0) {
          const { data: existingCredits } = await supabase
            .from('stage_credits')
            .select('id, person_id, role, character_name')
            .eq('play_id', matchedPlay.id);

          const existingPersonIds = new Set((existingCredits || []).map(c => c.person_id));

          for (let cIdx = 0; cIdx < parsed.cast.length; cIdx++) {
            const actorName = parsed.cast[cIdx];
            const person = await getOrCreatePerson(actorName, 'Acting', peopleCache);
            if (!person) continue;

            if (!existingPersonIds.has(person.id)) {
              if (!isDryRun) {
                const { error: credErr } = await supabase.from('stage_credits').insert({
                  play_id: matchedPlay.id,
                  person_id: person.id,
                  role: 'Actor',
                  billing_order: (existingCredits?.length || 0) + cIdx + 1
                });
                if (!credErr) {
                  creditsAddedCount++;
                  existingPersonIds.add(person.id);
                }
              } else {
                creditsAddedCount++;
                existingPersonIds.add(person.id);
              }
            }
          }
        }
      } else {
        // CREATE NEW STAGE PLAY
        let slug = generateSlug(title);
        let existingSlug = dbPlays.find(p => p.slug === slug);
        if (existingSlug) {
          slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
        }

        const newPlayData = {
          title,
          slug,
          playwright: parsed.playwright || null,
          director: parsed.director || null,
          producer: parsed.producer || null,
          venue: parsed.venue || null,
          city: parsed.city || 'Lagos',
          country: 'Nigeria',
          poster_url: parsed.poster_url || null,
          synopsis: parsed.synopsis || null,
          source_url: parsed.ticketUrl || null, // NEVER naijatheatre.com
          year: parsed.year || 2023,
          status: 'published'
        };

        console.log(`[${i+1}/${itemsToProcess.length}] NEW PLAY "${title}" (Slug: ${slug}) | Playwright: ${newPlayData.playwright} | Director: ${newPlayData.director} | Ticket: ${newPlayData.source_url ? 'YES' : 'NONE'} | Cast: ${parsed.cast.length}`);

        if (!isDryRun) {
          const { data: insertedPlay, error: insErr } = await supabase
            .from('plays')
            .insert(newPlayData)
            .select('id')
            .single();

          if (insErr) {
            console.error(`Error inserting new play "${title}":`, insErr.message);
            continue;
          }

          createdPlaysCount++;
          dbPlayMap.set(title.toLowerCase().trim(), { id: insertedPlay.id, title, slug });
          dbPlayMap.set(norm, { id: insertedPlay.id, title, slug });

          // Insert Cast Credits
          for (let cIdx = 0; cIdx < parsed.cast.length; cIdx++) {
            const actorName = parsed.cast[cIdx];
            const person = await getOrCreatePerson(actorName, 'Acting', peopleCache);
            if (!person) continue;

            const { error: credErr } = await supabase.from('stage_credits').insert({
              play_id: insertedPlay.id,
              person_id: person.id,
              role: 'Actor',
              billing_order: cIdx + 1
            });
            if (!credErr) creditsAddedCount++;
          }

          // Director in stage_credits
          if (parsed.director) {
            const dirPerson = await getOrCreatePerson(parsed.director, 'Director', peopleCache);
            if (dirPerson) {
              await supabase.from('stage_credits').insert({
                play_id: insertedPlay.id,
                person_id: dirPerson.id,
                role: 'Director',
                billing_order: 0
              });
            }
          }

          // Playwright in stage_credits
          if (parsed.playwright && parsed.playwright !== parsed.director) {
            const pwPerson = await getOrCreatePerson(parsed.playwright, 'Playwright', peopleCache);
            if (pwPerson) {
              await supabase.from('stage_credits').insert({
                play_id: insertedPlay.id,
                person_id: pwPerson.id,
                role: 'Playwright',
                billing_order: 0
              });
            }
          }
        } else {
          createdPlaysCount++;
          creditsAddedCount += parsed.cast.length;
          dbPlayMap.set(title.toLowerCase().trim(), { id: `dry-run-${slug}`, title, slug });
        }
      }
    } catch (e) {
      console.error(`Error processing ${entry.key}:`, e.message);
    }
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Plays Enriched in DB: ${enrichedPlaysCount}`);
  console.log(`New Plays Created:    ${createdPlaysCount}`);
  console.log(`Credits Added:        ${creditsAddedCount}`);
  console.log(`Total Plays in DB now: ${dbPlays.length + (isDryRun ? 0 : createdPlaysCount)}`);
  console.log(`=========================================`);
}

main();
