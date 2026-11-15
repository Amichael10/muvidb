import { supabase } from './lib/db';

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getOrCreatePerson(name: string, bio?: string) {
  if (!name || !name.trim()) return null;
  const cleanName = name.trim();

  const { data: existing } = await supabase
    .from('people')
    .select('id, name, awards')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const slug = `${slugify(cleanName)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      bio: bio || null,
      awards: [],
    })
    .select('id, name, awards')
    .single();

  if (error) {
    console.warn(`Could not create person "${cleanName}":`, error.message);
    return null;
  }
  console.log(`✨ Created person: ${cleanName} (${created.id})`);
  return created;
}

async function getOrCreateFilm(title: string, year: number, format: 'feature' | 'short' | 'animation' | 'documentary' = 'feature', synopsis?: string) {
  if (!title || !title.trim()) return null;
  const cleanTitle = title.trim();

  const { data: existing } = await supabase
    .from('films')
    .select('id, title, awards')
    .ilike('title', cleanTitle)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const slug = `${slugify(cleanTitle)}-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title: cleanTitle,
      slug,
      year,
      synopsis: synopsis || null,
      is_published: true,
      awards: [],
    })
    .select('id, title, awards')
    .single();

  if (error) {
    console.warn(`Could not create film "${cleanTitle}":`, error.message);
    return null;
  }
  console.log(`🎬 Created film: ${cleanTitle} (${created.id})`);
  return created;
}

async function addAwardToFilm(filmId: string, award: any) {
  const { data: film } = await supabase.from('films').select('id, title, awards').eq('id', filmId).single();
  if (!film) return;
  const current = Array.isArray(film.awards) ? [...film.awards] : [];
  const exists = current.some(
    (a: any) =>
      a.organization === award.organization &&
      Number(a.year) === Number(award.year) &&
      a.category?.toLowerCase() === award.category?.toLowerCase()
  );
  if (exists) {
    console.log(`  ℹ️ Film "${film.title}" already has ${award.category}`);
    return;
  }
  current.push(award);
  await supabase.from('films').update({ awards: current }).eq('id', film.id);
  console.log(`  ✅ Added to film "${film.title}": ${award.category}`);
}

async function addAwardToPerson(personId: string, award: any) {
  const { data: person } = await supabase.from('people').select('id, name, awards').eq('id', personId).single();
  if (!person) return;
  const current = Array.isArray(person.awards) ? [...person.awards] : [];
  const exists = current.some(
    (a: any) =>
      a.organization === award.organization &&
      Number(a.year) === Number(award.year) &&
      a.category?.toLowerCase() === award.category?.toLowerCase()
  );
  if (exists) {
    console.log(`  ℹ️ Person "${person.name}" already has ${award.category}`);
    return;
  }
  current.push(award);
  await supabase.from('people').update({ awards: current }).eq('id', person.id);
  console.log(`  ✅ Added to person "${person.name}": ${award.category}`);
}

async function main() {
  console.log('================================================================');
  console.log('  15th AFRIFF GLOBE AWARDS 2026 - FULL WINNERS & HONOREES SYNC  ');
  console.log('  Lagos Oriental Hotel, Victoria Island · November 7, 2026      ');
  console.log('================================================================\n');

  // 1. BEST FEATURE FILM: Slum Bomber (Maureen Jolly Nankya)
  console.log('1. Best Feature Film');
  const slumBomber = await getOrCreateFilm('Slum Bomber', 2026, 'feature', 'Inspired by the true life story of Ugandan female boxer Julie Aloyo.');
  const maureenNankya = await getOrCreatePerson('Maureen Jolly Nankya');
  if (slumBomber) {
    await addAwardToFilm(slumBomber.id, {
      organization: 'AFRIFF',
      category: 'Best Feature Film',
      title: 'Best Feature Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Slum Bomber', 'Maureen Jolly Nankya'],
    });
  }
  if (maureenNankya) {
    await addAwardToPerson(maureenNankya.id, {
      organization: 'AFRIFF',
      category: 'Best Feature Film',
      title: 'Best Feature Film - Slum Bomber (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'Slum Bomber',
      film_id: slumBomber?.id,
    });
  }

  // 2. BEST DIRECTOR: Olive Nwosu (Lady)
  console.log('\n2. Best Director');
  const lady = await getOrCreateFilm('Lady', 2026, 'feature');
  const oliveNwosu = await getOrCreatePerson('Olive Nwosu');
  if (lady) {
    await addAwardToFilm(lady.id, {
      organization: 'AFRIFF',
      category: 'Best Director',
      title: 'Best Director - Olive Nwosu (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Olive Nwosu'],
    });
  }
  if (oliveNwosu) {
    await addAwardToPerson(oliveNwosu.id, {
      organization: 'AFRIFF',
      category: 'Best Director',
      title: 'Best Director - Lady (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'Lady',
      film_id: lady?.id,
    });
  }

  // 3 & 4. BEST SCREENPLAY & BEST INTERNATIONAL FEATURE: The Tropic Sun and His Eyes (Elisee Junior St. Preux)
  console.log('\n3 & 4. Best Screenplay & Best International Feature Film');
  const tropicSun = await getOrCreateFilm('The Tropic Sun and His Eyes', 2026, 'feature', 'An evocative international drama directed by Elisee Junior St. Preux.');
  const eliseePreux = await getOrCreatePerson('Elisee Junior St. Preux');
  const stevensonJean = await getOrCreatePerson('Stevenson Jean');
  if (tropicSun) {
    await addAwardToFilm(tropicSun.id, {
      organization: 'AFRIFF',
      category: 'Best International Feature Film',
      title: 'Best International Feature Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['The Tropic Sun and His Eyes', 'Elisee Junior St. Preux'],
    });
    await addAwardToFilm(tropicSun.id, {
      organization: 'AFRIFF',
      category: 'Best Screenplay',
      title: 'Best Screenplay - Elisee Junior St. Preux (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Elisee Junior St. Preux'],
    });
  }
  if (eliseePreux) {
    await addAwardToPerson(eliseePreux.id, {
      organization: 'AFRIFF',
      category: 'Best Screenplay',
      title: 'Best Screenplay - The Tropic Sun and His Eyes (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'The Tropic Sun and His Eyes',
      film_id: tropicSun?.id,
    });
    await addAwardToPerson(eliseePreux.id, {
      organization: 'AFRIFF',
      category: 'Best International Feature Film',
      title: 'Best International Feature Film - The Tropic Sun and His Eyes (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'The Tropic Sun and His Eyes',
      film_id: tropicSun?.id,
    });
  }
  if (stevensonJean) {
    await addAwardToPerson(stevensonJean.id, {
      organization: 'AFRIFF',
      category: 'Best Male Actor',
      title: 'Best Male Actor - The Tropic Sun and His Eyes (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'The Tropic Sun and His Eyes',
      film_id: tropicSun?.id,
    });
  }

  // 5. BEST SHORT FILM & PULSE AWARD FOR EMERGING FILMMAKER: The Spectacular Death of Prisca (Kaelo Iyizoba)
  console.log('\n5. Best Short Film & Pulse Award for Emerging Filmmaker');
  const prisca = await getOrCreateFilm('The Spectacular Death of Prisca', 2026, 'short', 'A Nigerian short film starring Rita Dominic.');
  const kaeloIyizoba = await getOrCreatePerson('Kaelo Iyizoba');
  if (prisca) {
    await addAwardToFilm(prisca.id, {
      organization: 'AFRIFF',
      category: 'Best Short Film',
      title: 'Best Short Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['The Spectacular Death of Prisca', 'Kaelo Iyizoba'],
    });
    await addAwardToFilm(prisca.id, {
      organization: 'AFRIFF',
      category: 'Pulse Award for Emerging Filmmaker',
      title: 'Pulse Award for Emerging Filmmaker - Kaelo Iyizoba (AFRIFF 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Kaelo Iyizoba'],
    });
  }
  if (kaeloIyizoba) {
    await addAwardToPerson(kaeloIyizoba.id, {
      organization: 'AFRIFF',
      category: 'Best Short Film',
      title: 'Best Short Film - The Spectacular Death of Prisca (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'The Spectacular Death of Prisca',
      film_id: prisca?.id,
    });
    await addAwardToPerson(kaeloIyizoba.id, {
      organization: 'AFRIFF',
      category: 'Pulse Award for Emerging Filmmaker',
      title: 'Pulse Award for Emerging Filmmaker (AFRIFF 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'The Spectacular Death of Prisca',
      film_id: prisca?.id,
    });
  }

  // 6. BEST INTERNATIONAL SHORT FILM: The Little Soldier (Roxana Karmi)
  console.log('\n6. Best International Short Film');
  const littleSoldier = await getOrCreateFilm('The Little Soldier', 2026, 'short');
  const roxanaKarmi = await getOrCreatePerson('Roxana Karmi');
  if (littleSoldier) {
    await addAwardToFilm(littleSoldier.id, {
      organization: 'AFRIFF',
      category: 'Best International Short Film',
      title: 'Best International Short Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['The Little Soldier', 'Roxana Karmi'],
    });
  }
  if (roxanaKarmi) {
    await addAwardToPerson(roxanaKarmi.id, {
      organization: 'AFRIFF',
      category: 'Best International Short Film',
      title: 'Best International Short Film - The Little Soldier (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'The Little Soldier',
      film_id: littleSoldier?.id,
    });
  }

  // 7. BEST ANIMATION FILM: Lice N' Shine (Maria Byoma)
  console.log('\n7. Best Animation Film');
  const liceNShine = await getOrCreateFilm("Lice N' Shine", 2026, 'animation', 'Ugandan animated short directed by Maria Byoma.');
  const mariaByoma = await getOrCreatePerson('Maria Byoma');
  if (liceNShine) {
    await addAwardToFilm(liceNShine.id, {
      organization: 'AFRIFF',
      category: 'Best Animation Film',
      title: 'Best Animation Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ["Lice N' Shine", 'Maria Byoma'],
    });
  }
  if (mariaByoma) {
    await addAwardToPerson(mariaByoma.id, {
      organization: 'AFRIFF',
      category: 'Best Animation Film',
      title: "Best Animation Film - Lice N' Shine (AFRIFF Globe Awards 2026)",
      year: 2026,
      season: 2026,
      won: true,
      work: "Lice N' Shine",
      film_id: liceNShine?.id,
    });
  }

  // 8. BEST DOCUMENTARY FILM: Miss Jobson (Amanda Sans Pantling)
  console.log('\n8. Best Documentary Film');
  const missJobson = await getOrCreateFilm('Miss Jobson', 2026, 'documentary', 'Feature documentary directed by Amanda Sans Pantling.');
  const amandaPantling = await getOrCreatePerson('Amanda Sans Pantling');
  if (missJobson) {
    await addAwardToFilm(missJobson.id, {
      organization: 'AFRIFF',
      category: 'Best Documentary Film',
      title: 'Best Documentary Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Miss Jobson', 'Amanda Sans Pantling'],
    });
  }
  if (amandaPantling) {
    await addAwardToPerson(amandaPantling.id, {
      organization: 'AFRIFF',
      category: 'Best Documentary Film',
      title: 'Best Documentary Film - Miss Jobson (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'Miss Jobson',
      film_id: missJobson?.id,
    });
  }

  // 9. BEST FEMALE ACTOR: Sarah Karei (One Woman, One Bra)
  console.log('\n9. Best Female Actor');
  const oneWomanOneBra = await getOrCreateFilm('One Woman, One Bra', 2026, 'feature');
  const sarahKarei = await getOrCreatePerson('Sarah Karei');
  if (sarahKarei) {
    await addAwardToPerson(sarahKarei.id, {
      organization: 'AFRIFF',
      category: 'Best Female Actor',
      title: 'Best Female Actor - One Woman, One Bra (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'One Woman, One Bra',
      film_id: oneWomanOneBra?.id,
    });
  }
  if (oneWomanOneBra) {
    await addAwardToFilm(oneWomanOneBra.id, {
      organization: 'AFRIFF',
      category: 'Best Female Actor',
      title: 'Best Female Actor - Sarah Karei (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Sarah Karei'],
    });
  }

  // 10. AUDIENCE CHOICE AWARD: Adanne (Orobosa Ikponmwen)
  console.log('\n10. Audience Choice Award');
  const adanne = await getOrCreateFilm('Adanne', 2026, 'feature');
  const orobosa = await getOrCreatePerson('Orobosa Ikponmwen');
  if (adanne) {
    await addAwardToFilm(adanne.id, {
      organization: 'AFRIFF',
      category: 'Audience Choice Award',
      title: 'Audience Choice Award (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Adanne', 'Orobosa Ikponmwen'],
    });
  }
  if (orobosa) {
    await addAwardToPerson(orobosa.id, {
      organization: 'AFRIFF',
      category: 'Audience Choice Award',
      title: 'Audience Choice Award - Adanne (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'Adanne',
      film_id: adanne?.id,
    });
  }

  // 11. SPECIAL JURY PRIZE FOR OUTSTANDING FILM: Variations on a Theme (Jason Jacobs & Devon Delmar)
  console.log('\n11. Special Jury Prize for Outstanding Film');
  const variations = await getOrCreateFilm('Variations on a Theme', 2026, 'feature', 'Co-directed by Jason Jacobs and Devon Delmar.');
  const jasonJacobs = await getOrCreatePerson('Jason Jacobs');
  const devonDelmar = await getOrCreatePerson('Devon Delmar');
  if (variations) {
    await addAwardToFilm(variations.id, {
      organization: 'AFRIFF',
      category: 'Special Jury Prize for Outstanding Film',
      title: 'Special Jury Prize for Outstanding Film (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      recipients: ['Variations on a Theme', 'Jason Jacobs', 'Devon Delmar'],
    });
  }
  if (jasonJacobs) {
    await addAwardToPerson(jasonJacobs.id, {
      organization: 'AFRIFF',
      category: 'Special Jury Prize for Outstanding Film',
      title: 'Special Jury Prize for Outstanding Film - Variations on a Theme (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'Variations on a Theme',
      film_id: variations?.id,
    });
  }
  if (devonDelmar) {
    await addAwardToPerson(devonDelmar.id, {
      organization: 'AFRIFF',
      category: 'Special Jury Prize for Outstanding Film',
      title: 'Special Jury Prize for Outstanding Film - Variations on a Theme (AFRIFF Globe Awards 2026)',
      year: 2026,
      season: 2026,
      won: true,
      work: 'Variations on a Theme',
      film_id: variations?.id,
    });
  }

  // 12. AFRIFF LOYALTY & HERBERT WIGWE AWARDS FOR EXCELLENCE (HONOREES)
  console.log('\n12. AFRIFF Loyalty & Herbert Wigwe Awards for Excellence (Honorees)');
  const honorees = [
    { name: 'Kene Okwuosa', title: 'Herbert Wigwe Trailblazer & Industry Leadership Award' },
    { name: 'Danielle Brooks', title: 'AFRIFF Excellence in International Acting & Culture Award' },
    { name: 'Francis Nebot', title: 'AFRIFF Loyalty & Industry Partnership Award' },
    { name: 'Joel Chikapa Phiri', title: 'AFRIFF Pioneer of African Cinema Distribution Award' },
  ];

  for (const h of honorees) {
    const person = await getOrCreatePerson(h.name);
    if (person) {
      await addAwardToPerson(person.id, {
        organization: 'AFRIFF',
        category: 'AFRIFF Excellence & Loyalty Award',
        title: `${h.title} (AFRIFF 2026)`,
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      });
    }
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 14 AFRIFF 2026 GLOBE AWARDS CATEGORIES & HONOREES SYNCED!');
  console.log('================================================================');
}

main().catch(console.error);
