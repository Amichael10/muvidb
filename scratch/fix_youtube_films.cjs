const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ── Title Cleanup Logic ──────────────────────────────────────────────
function cleanTitle(raw) {
  if (!raw) return raw;
  let title = raw.trim();

  // 1. Strip channel codes at the end like "/ JES/", "/ OPM/", "/CTM./", "/ MFA/"
  title = title.replace(/\s*\/\s*[A-Z]{2,5}\.?\s*\/?\s*$/i, '');

  // 2. Strip " - Watch Actor1, Actor2..." pattern (space before dash required)
  title = title.replace(/\s+[-–—]\s*Watch\s+.*/i, '');

  // 3. Strip " - LATEST..." or " -LATEST..." (space before dash required)
  title = title.replace(/\s+[-–—]\s*LATEST\s*.*/i, '');

  // 4. Strip " -sNEW" or "-s NEW" suffixes
  title = title.replace(/\s+[-–—]s\s*NEW\s*$/i, '');

  // 5. Strip "#trending", "#movie", "#nollywood", "#shorts" etc.
  title = title.replace(/\s*#\w+/g, '');

  // 6. Strip " - Nigerian..." / " - Nollywood..." / " - African..." (space-dash-space)
  title = title.replace(/\s+[-–—]\s+Nigerian\s*.*/i, '');
  title = title.replace(/\s+[-–—]\s+Nollywood\s*.*/i, '');
  title = title.replace(/\s+[-–—]\s+African\s*.*/i, '');
  // Also without space after dash
  title = title.replace(/\s+[-–—]Nigerian\s*.*/i, '');
  title = title.replace(/\s+[-–—]Nollywood\s*.*/i, '');
  title = title.replace(/\s+[-–—]African\s*.*/i, '');

  // 7. Strip "Latest Nigerian/Nollywood Movie" anywhere near the end
  title = title.replace(/\s*Latest\s*(Nigerian|Nollywood|Yoruba|Igbo)?\s*(Epic\s*)?(New\s*)?(Drama\s*)?(Movie|Film|Movies|Films)s?\s*$/i, '');

  // 8. Strip standalone " - " followed by actor names (comma-separated names pattern)
  //    e.g. " - Stephen Odimgbe /Rosabelle Andrew"
  //    Only match space-dash-space to avoid splitting compound words
  title = title.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*[\/,]\s*[A-Z].*$/i, '');

  // 9. Strip "Full Movie" or "Complete Movie" or "Complete Season" suffixes
  title = title.replace(/\s*(Full|Complete)\s*(Movie|Film|Season)\s*$/i, '');

  // 10. Strip " | Moments with Mo" and similar show name suffixes
  title = title.replace(/\s*\|\s*(Moments with Mo|MWM)\s*$/i, '');

  // 11. Strip "feat." sections at the very end if followed by names and then "(Latest...)"
  title = title.replace(/\s*\(Latest\s*(Comedy\s*)?(Drama\s*)?(Action\s*)?(Movie|Film|Movies|Films)\s*\)\s*$/i, '');

  // 12. Strip long descriptions masquerading as titles
  //     If the "title" is longer than 80 chars, try to find a natural break
  //     Only split at " - " (space dash space) to preserve compound words
  if (title.length > 80) {
    const dashParts = title.split(/\s+[-–—]\s+/);
    if (dashParts[0].length >= 3 && dashParts[0].length <= 70) {
      title = dashParts[0];
    }
  }

  // 13. Trim and clean up multiple spaces
  title = title.replace(/\s{2,}/g, ' ').trim();

  // 14. Remove trailing punctuation artifacts (but not hyphens in compound words)
  title = title.replace(/\s*[,|]\s*$/, '').trim();
  title = title.replace(/\s+[-–—]\s*$/, '').trim();

  return title;
}

// ── Main ─────────────────────────────────────────────────────────────
async function run() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const mode = DRY_RUN ? '🔍 DRY RUN (preview only)' : '🔧 LIVE MODE (applying changes)';
  console.log(`\n=== FIX YOUTUBE FILMS — ${mode} ===\n`);

  // ── Part 1: Fix missing backdrops ──────────────────────────────────
  console.log('── PART 1: Copy poster_url → backdrop_url for missing backdrops ──\n');

  // Fetch films with poster but no backdrop
  const { data: noBackdrop, error: e1 } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url')
    .not('poster_url', 'is', null)
    .neq('poster_url', '')
    .or('backdrop_url.is.null,backdrop_url.eq.""');

  if (e1) {
    console.error('Error fetching films without backdrops:', e1.message);
    return;
  }

  console.log(`Found ${noBackdrop.length} films with poster but no backdrop.`);

  if (noBackdrop.length > 0) {
    // Show preview
    noBackdrop.slice(0, 10).forEach(f => {
      console.log(`   📷 "${f.title}" → will use poster as backdrop`);
    });
    if (noBackdrop.length > 10) console.log(`   ... and ${noBackdrop.length - 10} more`);

    if (!DRY_RUN) {
      // Batch update in chunks of 50
      let updated = 0;
      for (let i = 0; i < noBackdrop.length; i += 50) {
        const batch = noBackdrop.slice(i, i + 50);
        for (const film of batch) {
          const { error } = await supabase
            .from('films')
            .update({ backdrop_url: film.poster_url })
            .eq('id', film.id);
          if (!error) updated++;
          else console.error(`   ❌ Failed for "${film.title}":`, error.message);
        }
      }
      console.log(`   ✅ Updated ${updated}/${noBackdrop.length} backdrops.\n`);
    }
  }

  // ── Part 2: Clean up YouTube titles ────────────────────────────────
  console.log('\n── PART 2: Clean up YouTube-style titles ──\n');

  // Fetch films that have youtube_watch_url (these are YouTube-sourced)
  const { data: ytFilms, error: e2 } = await supabase
    .from('films')
    .select('id, title, youtube_watch_url, source')
    .not('youtube_watch_url', 'is', null)
    .neq('youtube_watch_url', '')
    .order('created_at', { ascending: false });

  if (e2) {
    console.error('Error fetching YouTube films:', e2.message);
    return;
  }

  console.log(`Found ${ytFilms.length} films with youtube_watch_url.\n`);

  // Find titles that need cleaning
  const toClean = [];
  for (const film of ytFilms) {
    const cleaned = cleanTitle(film.title);
    if (cleaned !== film.title) {
      toClean.push({ id: film.id, original: film.title, cleaned });
    }
  }

  console.log(`${toClean.length} titles need cleaning:\n`);

  // Show preview (all of them if < 50, otherwise first 30)
  const previewCount = Math.min(toClean.length, 30);
  toClean.slice(0, previewCount).forEach(f => {
    console.log(`   BEFORE: "${f.original}"`);
    console.log(`   AFTER:  "${f.cleaned}"`);
    console.log('');
  });
  if (toClean.length > previewCount) {
    console.log(`   ... and ${toClean.length - previewCount} more\n`);
  }

  if (!DRY_RUN && toClean.length > 0) {
    let updated = 0;
    for (const film of toClean) {
      const { error } = await supabase
        .from('films')
        .update({ title: film.cleaned })
        .eq('id', film.id);
      if (!error) updated++;
      else console.error(`   ❌ Failed for "${film.original}":`, error.message);
    }
    console.log(`   ✅ Updated ${updated}/${toClean.length} titles.\n`);
  }

  console.log('=== DONE ===');
}

run().catch(console.error);
