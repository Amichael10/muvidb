import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { supabase } from './lib/db';

const cohereKey = process.env.COHERE_API_KEY || process.env.COHERE_API_KEY_1;
const cohereModel = process.env.COHERE_CHAT_MODEL || 'command-r-plus-08-2024';
const groqKey = process.env.GROQ_API_KEY;

const STATE_FILE = path.resolve('scratch/sweep_enrich_state.json');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

const INVALID_ACTOR_WORDS = new Set([
  'a beast', 'a fiddle', 'mel brooks', 'titled man', 'full movie', 'latest movie',
  'nigerian movie', 'yoruba movie', 'uchenancy movies', 'sisterhood of riches',
  'epic movie', 'blockbuster', 'must watch', 'cinema movie', 'part 1', 'part 2',
  'part 3', 'part 4', 'part 5', 'part 6', 'part 7', 'part 8', 'part 9', 'part 10',
  'part 11', 'part 12', 'part 13', 'part 14', 'part 15', 'part 16', 'part 17', 'part 18',
  'part 19', 'part 20', 'season 1', 'season 2', 'season 3', 'season 4', 'season 5',
  'season 6', 'episode 1', 'episode 2', 'episode 3', 'episode 4', 'episode 5',
  'episode 6', 'episode 10', 'episode 12', 'episode 24', 'the original', 'official trailer',
  'teaser', 'soundtrack', 'jeriod 2', 'krimi', 'der tote im westfjord', 'new hit movie',
  'hit movie', 'new movie', 'movies'
]);

export function cleanActorName(rawName: string): string | null {
  let n = rawName.trim().replace(/^[-–—/|•,:.]+|[-–—/|•,:.]+$/g, '').trim();
  if (n.length < 3) return null;
  if (INVALID_ACTOR_WORDS.has(n.toLowerCase())) return null;

  if (/\b(part\s*\d+|season\s*\d+|episode\s*\d+|ep\s*\d+|\d{3,}|https?:\/\/)\b/i.test(n)) {
    return null;
  }

  n = n.replace(/\b[a-z]/g, c => c.toUpperCase());

  const words = n.split(/\s+/);
  const famousSingleNames = ['Sanyeri', 'Alapinni', 'Saje', 'Ibu', 'Aki', 'Pawpaw', 'Bello'];
  if (words.length === 1 && famousSingleNames.includes(n)) {
    return n;
  }

  if (words.length >= 2 && words.length <= 4 && /^[A-Za-z.'-]+(\s+[A-Za-z.'-]+)+$/.test(n)) {
    if (/\b(Yoruba|Igbo|Hausa|Movie|Film|Cinema|Drama|Full|Part|Season|Episode|Trailer)\b/i.test(n)) {
      return null;
    }
    return n;
  }

  return null;
}

export function parseNoisyFilmTitle(rawTitle: string): {
  cleanTitle: string;
  extractedYear: number | null;
  extractedActors: string[];
  isTarget: boolean;
} {
  let title = rawTitle.trim();
  let extractedYear: number | null = null;
  const extractedActors: string[] = [];
  let isTarget = false;

  // Pattern 1: Scraped photo captions "Actor A, Actor B, and Actor C in Movie Title"
  const captionMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)*(?:\s*(?:,|and|&)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+))\s+in\s+([A-Z0-9].*)$/);
  if (captionMatch) {
    const rawActors = captionMatch[1];
    const realTitle = captionMatch[2].replace(/[.\s]+$/, '').trim();
    const parts = rawActors.split(/,|\band\b|&/i).map(cleanActorName).filter(Boolean) as string[];
    if (parts.length >= 2 && realTitle.length > 2) {
      title = realTitle;
      extractedActors.push(...parts);
      isTarget = true;
    }
  }

  // Pattern 2: Extract Year tag (2024-2027) if combined with promo noise or actors
  const hasPromoWord = /\b(nollywood|nigerian\s*movie|yoruba\s*movie|african\s*movie|latest|trending|full\s*movie|epic\s*movie|blockbuster)\b/i.test(title);
  const yearMatch = title.match(/\b(202[3-7])\b/);
  if (yearMatch && (hasPromoWord || title.includes('-') || title.includes('|') || title.includes('/'))) {
    extractedYear = parseInt(yearMatch[1], 10);
    isTarget = true;
  }

  // Pattern 3: Separator followed by multiple actor names
  const sepMatch = title.match(/^(.*?)\s*(?:[-–—|•]{1,}|[.]{2,}|\bstarring\b|\bfeaturing\b|\bfeat\.?\b|\bft\.?\b)\s*(.+)$/i);
  if (sepMatch) {
    const head = sepMatch[1].trim();
    const tail = sepMatch[2].trim();

    const rawCandidates = tail.split(/[,/|•;&]|\band\b|[.]{2,}/i).map(cleanActorName).filter(Boolean) as string[];

    if (rawCandidates.length >= 1 && head.length >= 2) {
      let cleanedHead = head
        .replace(/\b(latest\s+(?:nollywood|yoruba|nigerian|african)?\s*movie|trending\s+movie|full\s+movie|epic\s+movie|drama|yoruba\s+movie|nigerian\s+movie|nollywood\s+movie|african\s+movie|202[3-7])\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/[-–—/|:.]+\s*$/, '')
        .trim();

      if (cleanedHead.length >= 2) {
        title = cleanedHead;
        extractedActors.push(...rawCandidates);
        isTarget = true;
      }
    }
  }

  // Pattern 4: Embedded actors without explicit separator
  const embeddedMatch = title.match(/^(.*?)(?:\s+(?:202[3-7])?\s*(?:Yoruba|Nigeria|Nollywood|African)?\s*Movie)?\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+\s+[A-Z][a-z]+)+)\s*(?:[-–—/|]*\s*202[3-7])?$/i);
  if (embeddedMatch && embeddedMatch[1].length >= 2) {
    const head = embeddedMatch[1].trim();
    const actorList = embeddedMatch[2].split(',').map(cleanActorName).filter(Boolean) as string[];
    if (actorList.length >= 2) {
      title = head;
      extractedActors.push(...actorList);
      isTarget = true;
    }
  }

  // Pattern 5: "Unforgettable Love/ Deza the Great Mercy Isoyip 2025 Nigeria Movie"
  const slashMatch = title.match(/^(.*?)\s*\/\s*([A-Za-z\s]+?)\s+(202[3-7].*)$/i);
  if (slashMatch) {
    const head = slashMatch[1].trim();
    const namesPart = slashMatch[2].trim();
    const names = namesPart.split(/[,&]|\s{2,}/).map(cleanActorName).filter(Boolean) as string[];
    if (names.length >= 1 && head.length >= 2) {
      title = head;
      extractedActors.push(...names);
      isTarget = true;
    }
  }

  // Clean trailing promo tags & years if it's a target
  if (isTarget || hasPromoWord) {
    title = title
      .replace(/\b(latest\s+(?:nollywood|yoruba|nigerian|african)?\s*movie|trending\s+movie|full\s+movie|epic\s+movie|blockbuster|must\s+watch|cinema\s+movie)\b/gi, '')
      .replace(/\b(202[3-7])\b/g, '')
      .replace(/\s*[-–—/|:.]+\s*$/, '')
      .replace(/^\s*[-–—/|:.]+\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (hasPromoWord && title !== rawTitle.trim()) {
      isTarget = true;
    }
  }

  // Trailing punctuation garbage (e.g. "BIG JOE –, , .")
  if (/[-–—,.\s]{3,}$/.test(rawTitle)) {
    title = title.replace(/[-–—,.\s]+$/, '').trim();
    if (title !== rawTitle) isTarget = true;
  }

  if (title.endsWith(' ! the Landlord') || title.endsWith(' ! The Landlord')) {
    title = title.replace(/\s*!\s*the Landlord/i, ': The Landlord');
    isTarget = true;
  }

  return {
    cleanTitle: title || rawTitle,
    extractedYear,
    extractedActors: Array.from(new Set(extractedActors)),
    isTarget: isTarget && title.length >= 2,
  };
}

export function synopsisNeedsRewrite(text: string | null | undefined): boolean {
  if (!text || text.trim().length < 25) return true;
  const t = text.trim();
  const hashtags = t.match(/(^|\s)#[\p{L}\p{N}_-]+/gu) || [];
  if (hashtags.length >= 2) return true;
  if (/https?:\/\/|www\.|youtu\.be|youtube\.com/i.test(t)) return true;
  if (/\b(?:subscribe|like and share|follow us|turn on (?:the )?notification|click (?:the )?link|watch (?:the )?full movie|all rights reserved)\b/i.test(t)) return true;
  if (/\b(?:latest|new)\s+(?:nollywood|yoruba|ghanaian|nigerian)?\s*movies?\s*20\d{2}\b/i.test(t)) return true;
  return false;
}

async function generateOrRewriteSynopsis(title: string, year?: number | null, cast?: string[], existingSynopsis?: string | null): Promise<string | null> {
  const isRewrite = existingSynopsis && existingSynopsis.trim().length > 30;
  const prompt = isRewrite
    ? `You are an expert film editor for MuviDB, the premier African and Nollywood film database.
Rewrite the following raw movie description into a clean, compelling 2-3 sentence cinematic synopsis for "${title}"${year ? ` (${year})` : ''}.
${cast && cast.length > 0 ? `Starring: ${cast.join(', ')}.` : ''}

Raw description:
"""
${existingSynopsis!.slice(0, 1000)}
"""

Strict Rules:
1. Strip all hashtags (#...), channel names, links, subscribe CTAs, promotional buzzwords, and marketing noise.
2. Focus purely on the storyline, character motivations, and dramatic stakes.
3. Return ONLY the polished 2-3 sentence synopsis text, with no introduction or quotes.`
    : `You are an expert film editor for MuviDB, the premier African and Nollywood film database.
Write a clean, compelling 2-3 sentence plot synopsis for the Nollywood movie titled "${title}"${year ? ` (${year})` : ''}.
${cast && cast.length > 0 ? `Starring: ${cast.join(', ')}.` : ''}

Strict Rules:
1. Focus strictly on a plausible, engaging dramatic plot synopsis suitable for African cinema.
2. Do NOT include hashtags, links, actor cast lists, director names, or promotional marketing phrases.
3. Return ONLY the synopsis text, with no introduction or markdown quotes.`;

  // 1. Try Cohere REST API
  if (cohereKey) {
    try {
      const res = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cohereKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cohereModel,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.message?.content?.[0]?.text || data?.text;
        if (text && text.trim().length > 25) {
          return text.trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {
      // fallback
    }
  }

  // 2. Fallback to Groq API
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 300,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && text.trim().length > 25) {
          return text.trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {
      // fallback
    }
  }

  return null;
}

async function getOrCreatePerson(name: string): Promise<string | null> {
  const clean = name.trim();
  const slug = slugify(clean);

  // 1. Check people by direct name or slug
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .or(`name.ilike.${clean},slug.eq.${slug}`)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // 2. Check person_aliases table (stage names, monikers, merged profiles)
  const aliasKey = clean.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (aliasKey) {
    const { data: aliasMatch } = await supabase
      .from('person_aliases')
      .select('person_id')
      .or(`alias_key.eq.${aliasKey},alias.ilike.${clean}`)
      .limit(1);

    if (aliasMatch && aliasMatch.length > 0 && aliasMatch[0].person_id) {
      return aliasMatch[0].person_id;
    }
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: clean,
      slug,
      is_verified: true,
      nationality: 'Nigerian',
    })
    .select('id')
    .single();

  if (error) {
    const { data: retry } = await supabase.from('people').select('id').ilike('name', clean).limit(1);
    return retry?.[0]?.id || null;
  }
  return created?.id || null;
}

async function main() {
  console.log('🚀 Starting Complete Sweep, Title Cleaning, Cast Ingestion & Synopsis AI Enrichment...\n');

  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < 26; i++) {
    batches.push(
      supabase
        .from('films')
        .select('id, title, year, synopsis, source, poster_url, youtube_watch_url, slug')
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
  }
  const results = await Promise.all(batches);
  const allFilms: any[] = [];
  for (const r of results) {
    if (r.data) allFilms.push(...r.data);
  }

  console.log(`Loaded ${allFilms.length} total films from database.`);

  const targets: Array<{
    film: any;
    cleanTitle: string;
    extractedYear: number | null;
    extractedActors: string[];
  }> = [];

  for (const f of allFilms) {
    const parsed = parseNoisyFilmTitle(f.title || '');
    if (parsed.isTarget) {
      targets.push({
        film: f,
        cleanTitle: parsed.cleanTitle,
        extractedYear: parsed.extractedYear,
        extractedActors: parsed.extractedActors,
      });
    }
  }

  console.log(`Identified ${targets.length} high-confidence target films requiring cleanup & enrichment.\n`);

  // Check state
  let processedIds = new Set<string>();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (Array.isArray(st.processedIds)) {
        processedIds = new Set(st.processedIds);
        console.log(`Resuming from checkpoint: ${processedIds.size} films already processed.`);
      }
    } catch (e) {
      // ignore
    }
  }

  let titlesCleaned = 0;
  let creditsCreated = 0;
  let synopsesGenerated = 0;
  let synopsesRewritten = 0;

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    const f = item.film;

    if (processedIds.has(f.id)) {
      continue;
    }

    if (f.source === 'manual') {
      console.log(`  🛡️ Preserving manual curation: "${f.title}"`);
      processedIds.add(f.id);
      continue;
    }

    console.log(`\n[${i + 1}/${targets.length}] Processing: "${f.title}"`);

    const filmUpdates: Record<string, any> = {};

    // 1. Update Title if changed
    if (item.cleanTitle !== f.title) {
      filmUpdates.title = item.cleanTitle;
      filmUpdates.slug = slugify(`${item.cleanTitle}-${item.extractedYear || f.year || 2024}`);
      console.log(`  ✂️ Cleaned Title: "${f.title}" -> "${item.cleanTitle}"`);
      titlesCleaned++;
    }

    // Update Year if extracted
    if (item.extractedYear && (!f.year || f.year === 2024)) {
      filmUpdates.year = item.extractedYear;
      console.log(`  📅 Updated Year: ${item.extractedYear}`);
    }

    // 2. Extract & Link Cast Credits
    if (item.extractedActors.length > 0) {
      console.log(`  🎭 Linking extracted cast: [${item.extractedActors.join(', ')}]`);
      
      const { data: existingCredits } = await supabase
        .from('credits')
        .select('person_id')
        .eq('film_id', f.id);

      const existingPersonIds = new Set((existingCredits || []).map(c => c.person_id));

      for (let billingOrder = 1; billingOrder <= item.extractedActors.length; billingOrder++) {
        const actorName = item.extractedActors[billingOrder - 1];
        const personId = await getOrCreatePerson(actorName);
        if (personId && !existingPersonIds.has(personId)) {
          const { error: credErr } = await supabase.from('credits').insert({
            film_id: f.id,
            person_id: personId,
            role: 'actor',
            billing_order: billingOrder,
            source: 'title_cast_extraction',
          });
          if (!credErr) {
            existingPersonIds.add(personId);
            creditsCreated++;
            console.log(`    ✅ Added Credit: "${actorName}" (Role: Actor, Order: ${billingOrder})`);
          }
        }
      }
    }

    // 3. Synopsis Review & AI Generation
    const needsNewSynopsis = !f.synopsis || f.synopsis.trim().length < 25;
    const isNoisySynopsis = synopsisNeedsRewrite(f.synopsis);

    if (needsNewSynopsis || isNoisySynopsis) {
      console.log(`  🤖 Triggering Cohere Synopsis Engine (${needsNewSynopsis ? 'Generate Missing' : 'Rewrite Noisy'})...`);
      const newSynopsis = await generateOrRewriteSynopsis(
        item.cleanTitle,
        item.extractedYear || f.year,
        item.extractedActors,
        f.synopsis
      );

      if (newSynopsis) {
        filmUpdates.synopsis = newSynopsis;
        filmUpdates.needs_review = false;
        if (needsNewSynopsis) synopsesGenerated++;
        else synopsesRewritten++;
        console.log(`  ✨ Synopsis AI Output: "${newSynopsis.slice(0, 100)}..."`);
      }
    }

    // Apply Film Updates to DB
    if (Object.keys(filmUpdates).length > 0) {
      const { error: upErr } = await supabase.from('films').update(filmUpdates).eq('id', f.id);
      if (upErr) {
        console.error(`  ❌ DB update error for film ${f.id}:`, upErr.message);
      }
    }

    processedIds.add(f.id);
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          processedIds: Array.from(processedIds),
          titlesCleaned,
          creditsCreated,
          synopsesGenerated,
          synopsesRewritten,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );

    await sleep(250);
  }

  console.log('\n======================================================');
  console.log('🎉 COMPLETE SWEEP & ENRICHMENT FINISHED!');
  console.log(`  • Titles Cleaned: ${titlesCleaned}`);
  console.log(`  • Cast Credits Ingested & Linked: ${creditsCreated}`);
  console.log(`  • Missing Synopses Generated: ${synopsesGenerated}`);
  console.log(`  • Noisy/Hashtag Synopses Rewritten: ${synopsesRewritten}`);
  console.log('======================================================\n');
}

main().catch(console.error);
