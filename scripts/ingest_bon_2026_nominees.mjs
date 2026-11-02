import fs from 'fs';
import { supabase, sleep } from './lib/supabase_reliable.mjs';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Zero-duplicate person finder/creator
async function getOrCreatePerson(name) {
  const cleanName = name.trim();
  if (!cleanName) return null;

  // 1. Search exact or case-insensitive name match
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, slug, awards')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 2. Check aliases if available
  try {
    const { data: aliasMatch } = await supabase
      .from('person_aliases')
      .select('person_id, people(id, name, slug, awards)')
      .ilike('alias', cleanName)
      .limit(1);

    if (aliasMatch && aliasMatch.length > 0 && aliasMatch[0].people) {
      return aliasMatch[0].people;
    }
  } catch (err) {
    // Ignore
  }

  // 3. Create new person
  let slug = slugify(cleanName);
  const { data: slugCheck } = await supabase.from('people').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    slug = `${slug}-${Math.floor(Math.random() * 8999 + 1000)}`;
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: slug,
      known_for_department: 'Acting',
      awards: []
    })
    .select('id, name, slug, awards')
    .single();

  if (error) {
    console.error(`Error creating person "${cleanName}":`, error.message);
    return null;
  }
  console.log(`+ Created new person: ${created.name} (${created.slug})`);
  return created;
}

// Zero-duplicate film finder/creator
async function getOrCreateFilm(title) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;

  // Special alias mapping for known variants
  const searchTitle = cleanTitle.toLowerCase() === 'colors of fire' ? 'Colours of Fire' : cleanTitle;

  // 1. Check title match
  const { data: existing } = await supabase
    .from('films')
    .select('id, title, slug, awards, year')
    .ilike('title', searchTitle)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 2. Create film
  let slug = slugify(cleanTitle);
  const { data: slugCheck } = await supabase.from('films').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    slug = `${slug}-${Math.floor(Math.random() * 8999 + 1000)}`;
  }

  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title: cleanTitle,
      slug: slug,
      year: 2026,
      is_published: true,
      content_type: 'movie',
      awards: []
    })
    .select('id, title, slug, awards, year')
    .single();

  if (error) {
    console.error(`Error creating film "${cleanTitle}":`, error.message);
    return null;
  }
  console.log(`+ Created new film: "${created.title}" (${created.slug})`);
  return created;
}

// Add award to person's awards jsonb array if not already present
async function addPersonAward(person, awardObj) {
  const currentAwards = Array.isArray(person.awards) ? [...person.awards] : [];
  
  // Check duplicate
  const exists = currentAwards.some(a => 
    a.organization === 'BON' && 
    a.year === 2026 && 
    a.category?.toLowerCase() === awardObj.category?.toLowerCase() &&
    a.work?.toLowerCase() === awardObj.work?.toLowerCase()
  );

  if (exists) {
    return false;
  }

  currentAwards.push(awardObj);

  const { error } = await supabase
    .from('people')
    .update({ awards: currentAwards })
    .eq('id', person.id);

  if (error) {
    console.error(`Error updating awards for person ${person.name}:`, error.message);
    return false;
  }
  return true;
}

// Add award to film's awards jsonb array if not already present
async function addFilmAward(film, awardObj) {
  const currentAwards = Array.isArray(film.awards) ? [...film.awards] : [];

  // Check duplicate
  const exists = currentAwards.some(a => 
    a.organization === 'BON' && 
    a.year === 2026 && 
    a.category?.toLowerCase() === awardObj.category?.toLowerCase()
  );

  if (exists) {
    // If existing has no recipients, update with recipients
    if (awardObj.recipients && awardObj.recipients.length > 0) {
      const idx = currentAwards.findIndex(a => 
        a.organization === 'BON' && 
        a.year === 2026 && 
        a.category?.toLowerCase() === awardObj.category?.toLowerCase()
      );
      if (idx !== -1 && (!currentAwards[idx].recipients || currentAwards[idx].recipients.length === 0)) {
        currentAwards[idx].recipients = awardObj.recipients;
        await supabase.from('films').update({ awards: currentAwards }).eq('id', film.id);
        return true;
      }
    }
    return false;
  }

  currentAwards.push(awardObj);

  const { error } = await supabase
    .from('films')
    .update({ awards: currentAwards })
    .eq('id', film.id);

  if (error) {
    console.error(`Error updating awards for film ${film.title}:`, error.message);
    return false;
  }
  return true;
}

async function main() {
  const categories = JSON.parse(fs.readFileSync('scratch_bon_clean.json', 'utf8'));
  console.log(`Processing BON 2026 Enugu Nominations (${categories.length} categories)...`);

  let totalFilmAwardsAdded = 0;
  let totalPeopleAwardsAdded = 0;

  for (const cat of categories) {
    const categoryName = cat.c;
    console.log(`\n============================================================`);
    console.log(`Category: "${categoryName}" (${cat.n.length} nominees)`);

    for (const nom of cat.n) {
      const rawPerson = nom[0]?.trim();
      const rawFilm = nom[1]?.trim();

      // 1. Get or create film
      const film = await getOrCreateFilm(rawFilm);
      if (!film) continue;
      await sleep(100);

      // Separate people if multiple (e.g. "Bayo Tijani & Abbey Lanre", "Vine Olugu & Mercy Aigbe")
      let personNames = [];
      if (rawPerson) {
        if (rawPerson.includes(' & ')) {
          personNames = rawPerson.split(' & ').map(s => s.trim()).filter(Boolean);
        } else {
          personNames = [rawPerson];
        }
      }

      // 2. Process each nominated individual
      const matchedPersons = [];
      for (const pName of personNames) {
        const person = await getOrCreatePerson(pName);
        if (person) {
          matchedPersons.push(person);

          const personAward = {
            organization: 'BON',
            year: 2026,
            category: categoryName,
            title: 'Best of Nollywood Awards 2026',
            work: film.title,
            film_id: film.id,
            won: false,
            status: 'Nominated',
            edition: '18th Edition',
            host_city: 'Enugu'
          };

          const added = await addPersonAward(person, personAward);
          if (added) {
            totalPeopleAwardsAdded++;
            console.log(`  ✓ Award added to Person: ${person.name} (${categoryName})`);
          } else {
            console.log(`  - Person already had award: ${person.name}`);
          }
          await sleep(100);
        }
      }

      // 3. Add to film's awards
      const filmAward = {
        organization: 'BON',
        year: 2026,
        category: categoryName,
        title: 'Best of Nollywood Awards 2026',
        status: 'Nominated',
        won: false,
        recipients: matchedPersons.map(p => p.name),
        edition: '18th Edition',
        host_city: 'Enugu'
      };

      const filmAdded = await addFilmAward(film, filmAward);
      if (filmAdded) {
        totalFilmAwardsAdded++;
        console.log(`  ✓ Award added to Film: "${film.title}" (${categoryName})`);
      } else {
        console.log(`  - Film already had nomination: "${film.title}" (${categoryName})`);
      }
      await sleep(100);
    }
  }

  console.log(`\n============================================================`);
  console.log(`BON 2026 Ingestion Complete!`);
  console.log(`Total Person Awards Added: ${totalPeopleAwardsAdded}`);
  console.log(`Total Film Awards Added: ${totalFilmAwardsAdded}`);
}

main();
