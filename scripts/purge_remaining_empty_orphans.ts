import { supabase } from './lib/db';

async function purgeRemaining() {
  console.log('--- Purging Remaining Zero-Credit People Without Photo, Bio, or Awards ---');

  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, photo_url, bio, awards, film_count')
    .or('film_count.is.null,film_count.eq.0');

  if (error) {
    console.error('Error fetching people:', error.message);
    return;
  }

  const otherMonikers = ['abiymo', 'abiayamo', 'osereme'];

  const toDelete: string[] = [];
  let preservedCount = 0;

  for (const p of people || []) {
    if (otherMonikers.includes(p.name.trim().toLowerCase())) {
      preservedCount++;
      continue;
    }

    const hasPhoto = Boolean(p.photo_url && p.photo_url.trim().length > 0);
    const hasBio = Boolean(p.bio && p.bio.trim().length > 0);
    const hasAwards = Boolean(Array.isArray(p.awards) && p.awards.length > 0);

    if (hasPhoto || hasBio || hasAwards) {
      preservedCount++;
    } else {
      toDelete.push(p.id);
    }
  }

  console.log(`Found ${toDelete.length} remaining people without photo, bio, or awards.`);
  console.log(`Preserved ${preservedCount} people with photo, bio, or awards.`);

  // Double check credits table before deleting
  const safeToDelete: string[] = [];
  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100);
    const { data: creds } = await supabase
      .from('credits')
      .select('person_id')
      .in('person_id', chunk);

    const activePids = new Set((creds || []).map(c => c.person_id));
    for (const id of chunk) {
      if (!activePids.has(id)) {
        safeToDelete.push(id);
      }
    }
  }

  console.log(`Verified ${safeToDelete.length} have 0 credits. Deleting in batches of 50...`);

  let deleted = 0;
  for (let i = 0; i < safeToDelete.length; i += 50) {
    const chunk = safeToDelete.slice(i, i + 50);
    const { error: delErr } = await supabase.from('people').delete().in('id', chunk);
    if (delErr) {
      console.error('Delete error:', delErr.message);
    } else {
      deleted += chunk.length;
      process.stdout.write(`\rDeleted ${deleted} / ${safeToDelete.length}...`);
    }
  }

  console.log(`\n\n🎉 Done! Successfully deleted ${deleted} empty orphaned records without photos or bios.`);
}

purgeRemaining();
