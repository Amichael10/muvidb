/**
 * clean_titles_v2.ts
 * ------------------
 * Full-DB title cleanup + actor credit extraction.
 * Supersedes clean_actor_titles_and_credit.ts and clean-titles.ts.
 *
 * DRY RUN (default): logs proposed changes, writes nothing.
 * APPLY:  DRY_RUN=false npx tsx scripts/clean_titles_v2.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const PAGE_SIZE = 500;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function toTitleCase(str: string): string {
  const MINOR = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','of','in','with','from','as']);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !MINOR.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

function toSentenceCase(str: string): string {
  if (!str) return '';
  const s = str.trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

// ─── Noise Patterns ──────────────────────────────────────────────────────────

const CHANNEL_WATERMARKS = [
  // Mr Latin variants
  /\b(?:mr\.?\s*latin(?:'?s?)?\s*tv)\b/gi,
  /\bmrlatintv\b/gi,
  /\bbolaji\s*amusan\s*tv\b/gi,
  // YouTube @handles anywhere in title
  /@[\w]+/g,
  // Other common channel watermarks
  /\/?yorubahood\/?/gi,
  /\/?apata\s*tv\/?/gi,
  /\/?parayba\s*tv\/?/gi,
  /\/?nollywood\s*planet\/?/gi,
  /\/?nollyplus\/?/gi,
  /\/?asaba\s*movies\/?/gi,
  /\/?brainstorm\s*productions?\/?/gi,
  /\/?oluchiafundutv\/?/gi,
  /\/?chinedubenjaministv\/?/gi,
  /\/?eloratv\/?/gi,
];

// TV suffix only at end
const TV_SUFFIX_RE = /[\s\-\|~=]+TV(?:\s+Series|\s+Show)?\s*$/i;

// Core YouTube title noise — applied in order
const YOUTUBE_NOISE_CHUNKS = [
  // Starring/Featuring/Ft blocks (strip from keyword to end)
  /\b(?:starring|featuring|ft\.?|cast[:\s]).+$/gi,
  // "Latest [adj] Movie/Film [year]" at end
  /\s*[\|\-\~=\#]*\s*(?:brand\s+new\s+)?(?:latest|new|hot|trending|epic)\s+(?:yoruba|igbo|nigerian|nollywood|african|hausa)?\s*(?:epic\s+)?(?:drama\s+)?(?:action\s+)?(?:comedy\s+)?(?:movie|film)s?\s*(?:202[0-9])?\s*$/gi,
  // "[Adj] Nollywood/Nigerian Movie [year]" at end
  /\s*[\|\-\~=\#]*\s*(?:nigerian|nollywood|yoruba|igbo|african|hausa)\s+(?:latest\s+)?(?:epic\s+)?(?:drama\s+)?(?:movie|film)s?\s*(?:202[0-9])?\s*$/gi,
  // "Latest Movies" / "Latest Nollywood" standalone at end
  /\s*[\|\-\~=\#]*\s*latest\s+(?:nollywood|nigerian|movies?|films?)\s*$/gi,
  // "Nollywood Edition" / "Nollywood Latest" at end
  /\s*[\|\-\~=\#]*\s*nollywood\s+(?:edition|latest|new|movies?)\s*$/gi,
  // "Full Movie" / "Full Film" at end
  /\s*[\|\-\~=\#]*\s*full\s+(?:movie|film)s?\s*$/gi,
  // "Official Trailer/Teaser" at end
  /\s*[\|\-\~=\#]*\s*official\s+(?:trailer|teaser)\s*$/gi,
  // " - Watch [whatever]" at end
  /\s+[\-\–\—]\s*watch\s+.*/gi,
  // "HD" / "4K" / "720p" at end
  /\s*[\|\-\~=\#]*\s*(?:\b\d{3,4}p\b|\bhd\b|\b4k\b)\s*$/gi,
  // Year alone at end (202x or 201x)
  /\s*[\|\-\~=\#]*\s*(?:202[0-9]|201[5-9])\s*$/g,
  // Everything after a pipe "|"
  /\s*\|.+$/gi,
  // Hashtags anywhere
  /\s*#\w+/g,
  // "Short Film" label at end
  /\s*[\|\-\~=\#]*\s*(?:nollywood\s+)?(?:latest\s+)?short\s+film\s*$/gi,
  // "New Movie" / "New Nollywood" at end
  /\s*[\|\-\~=\#]*\s*new\s+(?:nollywood\s+)?(?:movie|film)\s*$/gi,
  // "2025 Latest Movies" / "2026 Latest Nollywood New Movie" patterns
  /\s*[\|\-\~=\#]*\s*(?:202[0-9])\s+(?:latest|new)\s+(?:nollywood\s+)?(?:movie|film)s?\s*$/gi,
  // Slash-separated cast after dash (case-insensitive): "TITLE - NAME/NAME/NOISE"
  /\s*[\/][A-Za-z][^/\n]*(?:\/[A-Za-z][^/\n]*)*/g,
  // "by [Actor Name]" attribution at end of title
  /\s+by\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+\s*$/g,
];

// Patterns that suggest this is NOT a film title but a social media post
const IS_SOCIAL_POST_RE = [
  /^(?:that one|this my|you haven|don't you|stream "|watch "|this movie titled)/i,
  /😭|😂|🔥|😰|😢/,
  /\bshorts?\b/i,
  /\bbbnaija\b/i,
  /\bbigg?brother\b/i,
  /watch ".+" on @/i,
];

// ─── Actor Name Handling ─────────────────────────────────────────────────────

const NON_NAME_WORDS = new Set([
  'nothing','could','satisfy','korean','mafia','boss','caregiver','african',
  'night','years','story','secret','house','village','return','part','season',
  'episode','comedy','series','movie','film','drama','video','official','trailer',
  'husband','wife','brother','sister','mother','father','daughter','son','family',
  'royal','palace','kingdom','prince','princess','king','queen','love','scars',
  'desire','sacrifice','beast','ghetto','dirty','sacred','blood','heart','soul',
  'latest','new','hot','full','nollywood','nigerian','yoruba','igbo','african',
  'action','epic','complete','watch','starring','featuring','cast','production',
  'entertainment','studio','studios','tv','television','channel','network',
  'volume','vol','money','power','revenge','betrayal','war','death','life',
  'rich','poor','evil','good','bad','dangerous','special','divine','holy',
  // extra false positives seen in dry-run
  'romantic','drama','movies','films','edition','shorts','nollywoodmovies',
  'nollywoodfilm','yorubaactresses','oldmovies','yorubamovie',
  // phrases that appear in titles, not names
  'given','taken','version','extended','end','not','brand','resort','opening',
  'zambia','nigeria','live','stream','versus','vs','etc','international',
  'watch','first','interesting','funny','very','latest','full','just','released',
  'today','burst','laughing','while','watching','this','that','silent',
  'mistake','right','wrong','enough','wasnt','never','always','once','upon',
]);

const KNOWN_ACTORS_SEED: string[] = [
  'Odunlade Adekola','Funke Akindele','Femi Adebayo','Lateef Adedimeji',
  'Adedimeji Lateef','Mercy Johnson','Mercy Johnson Okojie','Toyin Abraham',
  'Toyin Aimakhu','Zubby Michael','Destiny Etiko','Ibrahim Chatta',
  'Bolanle Ninalowo','Regina Daniels','Ray Emodi','Maurice Sam','Ken Erics',
  'Yul Edochie','Nkem Owoh','Pete Edochie','Fredrick Leonard','Frederick Leonard',
  'Bimbo Ademoye','Bimbo Oyebade','Kehinde Bankole','Laide Bakare','Ebele Okaro',
  'Ngozi Ezeonu','Queen Nwokoye','Patience Ozokwor','Nosa Rex','Peace Onuoha',
  'Onyi Alex','Bolaji Amusan','Mr Latin','Anike Ami','Ebube Obio','Ebube Nwagbo',
  'Chizzy Alichi','Uche Nancy','Sonia Uche','Luchy Donalds','Maleek Milton',
  'Chioma Akpotha','Chioma Chukwuka','Ini Edo','Falz','Timini Egbuson',
  'Uzor Arukwe','Wunmi Toriola','Chidi Mokeme','Kanayo O Kanayo','Ify Eze',
  'Uche Montana','Ruth Kadiri','Mercy Aigbe','Mide Martins','Nkechi Blessing',
  'Iyabo Ojo','Adunni Ade','Lilian Esoro','Sharon Ooja','Nancy Isime',
  'Bimbo Manuel','Shaffy Bello','Sola Sobowale','Tina Mba','Jide Kosoko',
  'Taiwo Hassan','Yinka Quadri','Adebayo Salami','Saidi Balogun',
  'Kunle Afolayan','Gabriel Afolayan','Ramsey Nouah','Jim Iyke',
  'Mike Ezuruonye','Nonso Diobi','Oge Okoye','Chacha Eke','Ini Dima-Okojie',
  'Tobi Bakre','Alexx Ekubo','IK Ogbonna','Blossom Chukwujekwu','Stan Nze',
  'Deyemi Okanlawon','Daniel Etim Effiong','Eyinna Nwigwe','Mr Macaroni',
  'Broda Shaggi','Sabinus','Tonto Dikeh','Rita Dominic','Uche Jombo',
  'Omoni Oboli','Afeez Owo','Sotayo Gaga','Eniola Badmus','Ronke Odusanya',
  'Muyiwa Ademola','Ibrahim Yekini','Itele D Icon','Lizzy Gold',
  'Chinonso Arubayi','Chioma Nwosu','Doris Ifeka','Uchechi Treasure',
  'Ugezu J Ugezu','Genevieve Nnaji','Omotola Jalade','Richard Mofe Damijo',
  'RMD','Sam Dede','Segun Arinze','Daniel Etim','Daniel Rocky',
  'Wole Ojo','Lolade Okunsanya','Christian Ochiaga','Anthony Woods',
  'Mike Godson','Linda Osifo','Nkechi Nnaji','Akin Lewis','Fathia Williams',
  'Kemi Afolabi','Yinka Salau','Jaiye Kuti','Aisha Hart',
  'Omotunde Adebowale','Juliet Ibrahim','Joseph Benjamin',
  'Emeka Ike','Yemi Sholade','Emeka Enyiocha',
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎬 clean_titles_v2 — DRY_RUN=${DRY_RUN}`);
  console.log('Loading people from DB...\n');

  // 1. Build full people lookup (name → id)
  const personMap = new Map<string, string>();
  let pPage = 0;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name')
      .range(pPage * 1000, (pPage + 1) * 1000 - 1);
    if (error || !data?.length) break;
    for (const p of data) {
      if (p.name) personMap.set(p.name.toLowerCase().trim(), p.id);
    }
    if (data.length < 1000) break;
    pPage++;
  }
  // Include canonical aliases (stage names and distributor spellings) in the
  // same lookup used by title extraction. This prevents names such as
  // "Atoribewu" from being missed when the linked person is stored as
  // "Olaide Olajire Ajani".
  let aliasPage = 0;
  while (true) {
    const { data: aliases, error: aliasError } = await supabase
      .from('person_aliases')
      .select('person_id, alias')
      .range(aliasPage * 1000, (aliasPage + 1) * 1000 - 1);
    if (aliasError || !aliases?.length) break;
    for (const alias of aliases) {
      if (alias.alias && alias.person_id) personMap.set(alias.alias.toLowerCase().trim(), alias.person_id);
    }
    if (aliases.length < 1000) break;
    aliasPage++;
  }
  console.log(`Loaded ${personMap.size} people.`);

  const knownLower = new Set([
    ...KNOWN_ACTORS_SEED.map(n => n.toLowerCase()),
    ...Array.from(personMap.keys()),
  ]);

  // 2. Mr Latin channel IDs
  const { data: latinChannels } = await supabase
    .from('channels')
    .select('id, name')
    .ilike('name', '%latin%');
  const latinChannelIds = new Set<string>((latinChannels || []).map((c: any) => c.id));
  if (latinChannels?.length) {
    console.log(`Found ${latinChannels.length} Mr Latin channel(s):`, latinChannels.map((c: any) => c.name));
  }

  // 3. Mr Latin film IDs
  const latinFilmIds = new Set<string>();
  for (const chId of latinChannelIds) {
    const { data: cvs } = await supabase
      .from('channel_videos')
      .select('film_id')
      .eq('channel_id', chId)
      .not('film_id', 'is', null);
    for (const cv of cvs || []) if (cv.film_id) latinFilmIds.add(cv.film_id);
  }
  if (latinFilmIds.size) console.log(`Mr Latin channel: ${latinFilmIds.size} linked films.\n`);

  let totalFilms = 0, titlesChanged = 0, creditsAdded = 0, slugCollisions = 0, socialPostsSkipped = 0;

  // ─── Process batch ────────────────────────────────────────────────────────
  async function processBatch(films: { id: string; title: string; slug: string | null }[]) {
    const filmIds = films.map(film => film.id);
    const { data: batchCredits } = await supabase
      .from('credits')
      .select('film_id, person_id, people(name)')
      .in('film_id', filmIds);
    const personIds = [...new Set((batchCredits || []).map((credit: any) => credit.person_id).filter(Boolean))];
    const { data: batchAliases } = personIds.length
      ? await supabase.from('person_aliases').select('person_id, alias').in('person_id', personIds)
      : { data: [] };
    const aliasesByPerson = new Map<string, string[]>();
    for (const alias of batchAliases || []) aliasesByPerson.set(alias.person_id, [...(aliasesByPerson.get(alias.person_id) || []), alias.alias]);
    const creditedByFilm = new Map<string, string[]>();
    for (const credit of batchCredits || []) {
      const names = [credit.people?.name, ...(aliasesByPerson.get(credit.person_id) || [])].filter(Boolean);
      creditedByFilm.set(credit.film_id, [...(creditedByFilm.get(credit.film_id) || []), ...names]);
    }
    for (const film of films) {
      totalFilms++;
      if (!film.title) continue;

      const originalTitle = film.title;
      const extractedActors = new Set<string>();

      // Step 0: Decode HTML entities
      let t = decodeHtmlEntities(originalTitle);
      const creditedNames = creditedByFilm.get(film.id) || [];
      // Remove credited canonical names and aliases wherever distributors put
      // them in the title (prefix, suffix, or inline), longest first.
      for (const creditedName of [...new Set(creditedNames)].sort((a, b) => b.length - a.length)) {
        const escaped = creditedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
        if (escaped.length >= 3) t = t.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
      }

      // Step 0c: Strip pipe content FIRST (before noise regexes which use $ anchor)
      const pipeIdx0 = t.indexOf('|');
      if (pipeIdx0 > 3) t = t.slice(0, pipeIdx0).trim();

      // Step 0b: Skip obvious social media posts (not real film titles)
      if (IS_SOCIAL_POST_RE.some(re => re.test(t))) {
        socialPostsSkipped++;
        continue;
      }

      // ── Step 1: Extract names BEFORE stripping ────────────────────────────

      // 1a. Parens: "Film (Actor1, Actor2)"
      const parenMatch = t.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const inside = parenMatch[1];
        if (!/(part|season|episode|official|hd|4k|\d{4})/.test(inside.toLowerCase())) {
          inside.split(/[,&]/).map(s => s.trim()).forEach(candidate => {
            const name = validateName(candidate, knownLower);
            if (name) extractedActors.add(name);
          });
        }
      }

      // 1b. Pipe/dash suffix cast extraction
      const delimMatch = t.match(/^(.+?)\s*[\-\—\–\|:~=]\s*(.+)$/);
      if (delimMatch) {
        const suffix = delimMatch[2].trim();
        // Split by comma, slash, or pipe
        suffix.split(/[,&\/|]/).map(s => s.trim()).forEach(candidate => {
          const name = validateName(candidate, knownLower);
          if (name) extractedActors.add(name);
        });
      }

      // 1c. Trailing comma list
      if (t.includes(',')) {
        const parts = t.split(',').map(s => s.trim());
        for (let i = 1; i < parts.length; i++) {
          const name = validateName(parts[i], knownLower);
          if (name) extractedActors.add(name);
        }
      }

      // 1d. Full-title scan for known actors
      for (const seed of KNOWN_ACTORS_SEED) {
        if (t.toLowerCase().includes(seed.toLowerCase())) {
          extractedActors.add(seed);
        }
      }

      // ── Step 2: Channel watermarks ────────────────────────────────────────
      for (const re of CHANNEL_WATERMARKS) {
        t = t.replace(re, ' ');
      }

      // ── Step 3: TV suffix ─────────────────────────────────────────────────
      t = t.replace(TV_SUFFIX_RE, '');
      t = t.replace(/\s*[\-\|~=]\s*TV\s*$/i, '');

      // ── Step 4: Slash-separated cast after dash (case-insensitive) ─────────
      // "TITLE - NAME1/NAME2/NAME3" → "TITLE"
      t = t.replace(/\s*[\-\—\–]\s*[A-Za-z][A-Za-z\s]+(?:\/[A-Za-z][A-Za-z\s]+){1,}.*$/g, '');

      // ── Step 5: YouTube noise chunks ──────────────────────────────────────
      for (const re of YOUTUBE_NOISE_CHUNKS) {
        t = t.replace(re, '');
      }

      // (pipe already stripped in Step 0c — skip)

      // ── Step 7: Strip trailing cast names after dash/colon ────────────────
      // e.g. "TITLE - NAME, NAME" or "TITLE | NAME, NAME"
      // If what remains after a dash is mostly proper nouns (comma-sep), strip it
      t = t.replace(/\s*[\-\—\–]\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*)?){2,}$/, '');

      // ── Step 8: Clean up punctuation + balance parens ─────────────────────
      t = t
        .replace(/[\s\-\|,;:\~=#*\/\_]+$/, '')
        .replace(/^[\s\-\|,;:()\~=#*\_]+/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      // Balance parentheses — remove unclosed opening paren at end
      const openCount = (t.match(/\(/g) || []).length;
      const closeCount = (t.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        // Strip the last unmatched '(' and everything after it
        t = t.replace(/\s*\([^)]*$/, '').trim();
      }

      // ── Step 9: Casing ────────────────────────────────────────────────────
      if (t.length > 0) {
        if (t === t.toUpperCase() && t.length > 3) {
          t = toTitleCase(t);
        } else if (t === t.toLowerCase()) {
          t = toSentenceCase(t);
        } else {
          t = toSentenceCase(t);
        }
      }

      // ── Step 10: Guard ────────────────────────────────────────────────────
      if (t.length < 2) t = originalTitle;

      const titleChanged = t !== originalTitle && t.length >= 2;
      // Filter out false-positive actors (words that are still noise after extraction)
      const actors = Array.from(extractedActors).filter(a => validateName(a, knownLower));

      if (!titleChanged && actors.length === 0) continue;

      // ── Log ───────────────────────────────────────────────────────────────
      console.log('\n────────────────────────────────────────');
      console.log(`🎬 "${originalTitle}"`);
      if (titleChanged) console.log(`✨ → "${t}"`);
      if (actors.length) console.log(`👥 Actors: ${actors.join(', ')}`);

      if (DRY_RUN) continue;

      // ── Apply: title ──────────────────────────────────────────────────────
      if (titleChanged) {
        let newSlug = generateSlug(t);
        let { error: updateErr } = await supabase
          .from('films')
          .update({ title: t, slug: newSlug })
          .eq('id', film.id);

        if (updateErr?.message?.includes('films_slug_key')) {
          slugCollisions++;
          newSlug = `${newSlug}-${film.id.substring(0, 5)}`;
          const { error: retryErr } = await supabase
            .from('films')
            .update({ title: t, slug: newSlug })
            .eq('id', film.id);
          if (!retryErr) updateErr = null;
        }

        if (updateErr) {
          console.error(`  ✗ Title update failed: ${updateErr.message}`);
        } else {
          titlesChanged++;
        }
      }

      // ── Apply: credits ────────────────────────────────────────────────────
      for (const actorName of actors) {
        const personId = await getOrCreatePerson(actorName, personMap, knownLower);
        if (!personId) continue;

        const { data: existing } = await supabase
          .from('credits')
          .select('id')
          .eq('film_id', film.id)
          .eq('person_id', personId)
          .maybeSingle();

        if (!existing) {
          const { error: creditErr } = await supabase
            .from('credits')
            .insert([{
              film_id: film.id,
              person_id: personId,
              role: 'actor',
              billing_order: 1,
              source: 'title_extraction',
            }]);

          if (creditErr) {
            console.error(`  ✗ Credit insert failed for "${actorName}": ${creditErr.message}`);
          } else {
            creditsAdded++;
          }
        }
      }
    }
  }

  // ─── Pass 1: Mr Latin ─────────────────────────────────────────────────────
  if (latinFilmIds.size > 0) {
    console.log(`\n═══ PASS 1: Mr Latin's ${latinFilmIds.size} films ═══\n`);
    const idArray = Array.from(latinFilmIds);
    for (let i = 0; i < idArray.length; i += PAGE_SIZE) {
      const chunk = idArray.slice(i, i + PAGE_SIZE);
      const { data: films, error } = await supabase
        .from('films').select('id, title, slug').in('id', chunk);
      if (error) { console.error('Fetch error (pass 1):', error.message); continue; }
      if (films?.length) await processBatch(films);
    }
  }

  // ─── Pass 2: All YouTube-source films ─────────────────────────────────────
  console.log('\n═══ PASS 2: All YouTube-source films ═══\n');
  let filmPage = 0;
  const latinIdList = Array.from(latinFilmIds);
  while (true) {
    let query = supabase
      .from('films')
      .select('id, title, slug')
      .eq('source', 'youtube')
      .range(filmPage * PAGE_SIZE, (filmPage + 1) * PAGE_SIZE - 1)
      .order('created_at', { ascending: true });

    if (latinIdList.length > 0) {
      query = query.not('id', 'in', `(${latinIdList.join(',')})`);
    }

    const { data: films, error } = await query;
    if (error) { console.error('Fetch error (pass 2):', error.message); break; }
    if (!films?.length) break;
    await processBatch(films);
    if (films.length < PAGE_SIZE) break;
    filmPage++;
  }

  // ─── Pass 3: Every remaining film ─────────────────────────────────────────
  // The previous implementation filtered this pass to four noise phrases,
  // leaving thousands of existing catalogue rows untouched.
  console.log('\n═══ PASS 3: All remaining films ═══\n');
  filmPage = 0;
  while (true) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, slug')
      .or('source.neq.youtube,source.is.null')
      .range(filmPage * PAGE_SIZE, (filmPage + 1) * PAGE_SIZE - 1)
      .order('created_at', { ascending: true });

    if (error) { console.error('Fetch error (pass 3):', error.message); break; }
    if (!films?.length) break;
    await processBatch(films);
    if (films.length < PAGE_SIZE) break;
    filmPage++;
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`🎉 DONE — DRY_RUN=${DRY_RUN}`);
  console.log(`   Films scanned          : ${totalFilms}`);
  console.log(`   Social posts skipped   : ${socialPostsSkipped}`);
  console.log(`   Titles changed         : ${titlesChanged}${DRY_RUN ? ' (dry-run, not applied)' : ''}`);
  console.log(`   Credits added          : ${creditsAdded}${DRY_RUN ? ' (dry-run, not applied)' : ''}`);
  if (slugCollisions > 0) console.log(`   Slug collisions        : ${slugCollisions} (resolved with ID suffix)`);
  console.log('══════════════════════════════════════════\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateName(raw: string, knownLower: Set<string>): string | null {
  if (!raw) return null;
  let name = raw
    .replace(/[()[\]{}\~=*#@]/g, '')
    .replace(/\b(?:movie|film|drama|full|latest|new|brand|official|trailer|series|part|hd|4k|nollywood|nigerian|yoruba|igbo|african|movies|edition|shorts|romantic|nollywoodmovies)\b/gi, '')
    .replace(/[^a-zA-Z\s.'\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 3) return null;

  const lower = name.toLowerCase();
  const words = lower.split(/\s+/);

  if (words.some(w => NON_NAME_WORDS.has(w))) return null;

  // This legacy-catalogue pass must never promote ordinary title phrases
  // ("The Sequel", "Lost Homeland", etc.) into new people. Only names already
  // present in people or person_aliases are safe extraction candidates.
  const inKnown = knownLower.has(lower);
  if (!inKnown) return null;

  return toTitleCase(name);
}

async function getOrCreatePerson(
  rawName: string,
  personMap: Map<string, string>,
  knownLower: Set<string>
): Promise<string | null> {
  const sanitized = validateName(rawName, knownLower);
  if (!sanitized) return null;

  const norm = sanitized.toLowerCase();
  if (personMap.has(norm)) return personMap.get(norm)!;

  // Use the canonical DB resolver so punctuation, reordered names, and
  // person_aliases are checked atomically before any insert can occur.
  const { data: resolved, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: sanitized,
    p_extra: { nationality: 'Nigerian', source: 'title_extraction' },
  });
  if (error || !resolved) {
    console.error(`  ✗ Failed to resolve person for "${sanitized}": ${error?.message}`);
    return null;
  }

  personMap.set(norm, resolved);
  return resolved;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
