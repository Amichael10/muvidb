import { supabase } from './lib/db';

async function getOrCreateFilm(title: string, year: number, extra: { genres?: string[]; synopsis?: string } = {}) {
  let { data: existing } = await supabase
    .from('films')
    .select('id, title, year, awards')
    .ilike('title', title)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${year}`.slice(0, 80);
  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title,
      slug,
      year,
      countries: ['Nigeria'],
      genres: extra.genres || ['Drama'],
      synopsis: extra.synopsis || `${title} is an acclaimed Nollywood production recognized at international film festivals.`,
      is_nollywood: true,
      status: 'released',
      awards: []
    })
    .select('id, title, year, awards')
    .single();

  if (error) {
    console.error(`  ⚠️ Failed creating film "${title}":`, error.message);
    return null;
  }
  console.log(`  🎬 Created missing film: "${title}" (${created.id})`);
  return created;
}

async function getOrCreatePerson(name: string, defaultBio?: string) {
  let { data: existing } = await supabase
    .from('people')
    .select('id, name, awards')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name,
      slug,
      nationality: 'Nigerian',
      bio: defaultBio || `${name} is a celebrated Nigerian filmmaker and creative recognized internationally.`,
      source: 'binff_awards_sync',
      awards: []
    })
    .select('id, name, awards')
    .single();

  if (error) {
    console.error(`  ⚠️ Failed creating person "${name}":`, error.message);
    return null;
  }
  console.log(`  👤 Created missing person: "${name}" (${created.id})`);
  return created;
}

async function syncBINFF() {
  console.log('🏆 Starting BINFF (Brampton International Nollywood Film Festival) Awards Sync...\n');
  console.log('Spotlighting Nollywood & Nigerian Cinema Honourees (2024 - 2026)\n');

  // 1. Film Awards List (Nollywood / Nigeria)
  const filmAwardsData = [
    // 2025 Edition
    {
      filmTitle: 'The Waiter',
      year: 2025,
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Film (Nollywood)',
          title: 'Best Film (Nollywood) - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Darlington Abuda'],
        },
        {
          organization: 'BINFF',
          category: 'Best Movie Trailer',
          title: 'Best Movie Trailer - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Waiter'],
        }
      ]
    },
    {
      filmTitle: 'IYI – The Hearse Driver',
      year: 2025,
      genres: ['Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Drama (Nollywood)',
          title: 'Best Drama (Nollywood) - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['IYI – The Hearse Driver'],
        }
      ]
    },
    {
      filmTitle: "Don't Dull",
      year: 2025,
      genres: ['Short', 'Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Short Film (Nollywood)',
          title: 'Best Short Film (Nollywood) - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ["Don't Dull"],
        }
      ]
    },
    {
      filmTitle: "Don't Judge Me",
      year: 2025,
      genres: ['Comedy'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Comedy Film',
          title: 'Best Comedy Film - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ["Don't Judge Me"],
        }
      ]
    },
    {
      filmTitle: 'Moji',
      year: 2025,
      genres: ['Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Editing',
          title: 'Best Editing - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Moji'],
        }
      ]
    },
    {
      filmTitle: 'The Thing About Pain',
      year: 2025,
      genres: ['Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Web Series',
          title: 'Best Web Series - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Thing About Pain'],
        }
      ]
    },
    {
      filmTitle: 'A Christmas Bride',
      year: 2025,
      genres: ['Romance', 'Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Supporting Actress',
          title: 'Best Supporting Actress - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Rosabelle Jeanne Iyafokhai'],
        }
      ]
    },
    {
      filmTitle: 'Through Her Eyes',
      year: 2025,
      genres: ['Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Supporting Actor',
          title: 'Best Supporting Actor - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Philip Asaya'],
        }
      ]
    },
    {
      filmTitle: 'Good Country',
      year: 2025,
      genres: ['Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Actress (International / Nollywood)',
          title: 'Best Actress (International) - Brampton International Nollywood Film Festival 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Shamsiyyah Jibo'],
        }
      ]
    },

    // 2024 Edition
    {
      filmTitle: 'Nigeria Laughs',
      year: 2024,
      genres: ['Documentary', 'Comedy'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Film Nollywood',
          title: 'Best Film Nollywood - Brampton International Nollywood Film Festival 2024',
          year: 2024,
          season: 2024,
          won: true,
          recipients: ['Owen Gee'],
        }
      ]
    },
    {
      filmTitle: 'Toxic',
      year: 2024,
      genres: ['Short', 'Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Short Film Nollywood/Africa',
          title: 'Best Short Film Nollywood/Africa - Brampton International Nollywood Film Festival 2024',
          year: 2024,
          season: 2024,
          won: true,
          recipients: ['Toxic'],
        }
      ]
    },

    // 2026 Edition
    {
      filmTitle: 'Son of the Soil',
      year: 2026,
      genres: ['Action', 'Thriller', 'Crime'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Action Thriller Film',
          title: 'Best Action Thriller Film - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: true,
          recipients: ['Chee Keong Cheung'],
        },
        {
          organization: 'BINFF',
          category: 'Best Director International',
          title: 'Best Director International - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: true,
          recipients: ['Chee Keong Cheung'],
        },
        {
          organization: 'BINFF',
          category: 'Best Supporting Actress',
          title: 'Best Supporting Actress Nominee - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: false,
          recipients: ['Patience Ozokwor'],
        },
        {
          organization: 'BINFF',
          category: 'Best Supporting Actor',
          title: 'Best Supporting Actor Nominee - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: false,
          recipients: ['Razaaq Adoti'],
        }
      ]
    },
    {
      filmTitle: 'Sands of Time',
      year: 2026,
      genres: ['Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Television/Web Series',
          title: 'Best Television/Web Series - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: true,
          recipients: ['Stellamaris Duru'],
        }
      ]
    },
    {
      filmTitle: 'City of Secrets',
      year: 2026,
      genres: ['Mystery', 'Thriller'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Web Series',
          title: 'Best Web Series - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: true,
          recipients: ['Spunky Studios'],
        }
      ]
    },
    {
      filmTitle: 'Èlédà Àyànmọ̀',
      year: 2026,
      genres: ['Short', 'Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Short Film International',
          title: 'Best Short Film International Nominee - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: false,
          recipients: ['Adeoluwa Okusaga'],
        },
        {
          organization: 'BINFF',
          category: 'Best Actor Short Film',
          title: 'Best Actor Short Film Nominee - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: false,
          recipients: ['Adeoluwa Okusaga'],
        }
      ]
    },
    {
      filmTitle: 'TOO LATE',
      year: 2026,
      genres: ['Short', 'Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Narrative Short Film',
          title: 'Best Narrative Short Film Nominee - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: false,
          recipients: ['TOO LATE'],
        }
      ]
    },
    {
      filmTitle: 'At the Mercy of Faith',
      year: 2026,
      genres: ['Short', 'Drama'],
      awards: [
        {
          organization: 'BINFF',
          category: 'Best Producer of a Short Film',
          title: 'Best Producer of a Short Film - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: true,
          recipients: ['At the Mercy of Faith'],
        },
        {
          organization: 'BINFF',
          category: 'Best Screenplay',
          title: 'Best Screenplay - Brampton International Nollywood Film Festival 2026',
          year: 2026,
          season: 2026,
          won: true,
          recipients: ['At the Mercy of Faith'],
        }
      ]
    }
  ];

  // 2. People Awards List (Nollywood / Nigeria)
  const peopleAwardsData = [
    {
      personName: 'Darlington Abuda',
      award: {
        organization: 'BINFF',
        category: 'Best Producer',
        title: 'Best Producer (BINFF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'The Waiter',
      }
    },
    {
      personName: 'Owen Gee',
      award: {
        organization: 'BINFF',
        category: 'Best Film Nollywood',
        title: 'Best Film Nollywood (BINFF 2024)',
        year: 2024,
        season: 2024,
        won: true,
        work: 'Nigeria Laughs',
      }
    },
    {
      personName: 'Chee Keong Cheung',
      award: {
        organization: 'BINFF',
        category: 'Best Director International',
        title: 'Best Director International (BINFF 2026)',
        year: 2026,
        season: 2026,
        won: true,
        work: 'Son of the Soil',
      }
    },
    {
      personName: 'Patience Ozokwor',
      award: {
        organization: 'BINFF',
        category: 'Merit Award',
        title: 'Honorary Nollywood Merit Award (BINFF 2026)',
        year: 2026,
        season: 2026,
        won: true,
        work: 'Lifetime Achievement / Nollywood Contribution',
      }
    },
    {
      personName: 'Patience Ozokwor',
      award: {
        organization: 'BINFF',
        category: 'Best Supporting Actress',
        title: 'Best Supporting Actress Nominee (BINFF 2026)',
        year: 2026,
        season: 2026,
        won: false,
        work: 'Son of the Soil',
      }
    },
    {
      personName: 'Razaaq Adoti',
      award: {
        organization: 'BINFF',
        category: 'Best Supporting Actor',
        title: 'Best Supporting Actor Nominee (BINFF 2026)',
        year: 2026,
        season: 2026,
        won: false,
        work: 'Son of the Soil',
      }
    },
    {
      personName: 'Okusaga Adeoluwa',
      award: {
        organization: 'BINFF',
        category: 'Best Actor Short Film',
        title: 'Best Actor Short Film Nominee (BINFF 2026)',
        year: 2026,
        season: 2026,
        won: false,
        work: 'Èlédà Àyànmọ̀',
      }
    },
    {
      personName: 'Stellamaris Duru',
      award: {
        organization: 'BINFF',
        category: 'Best Television/Web Series',
        title: 'Best Television/Web Series (BINFF 2026)',
        year: 2026,
        season: 2026,
        won: true,
        work: 'Sands of Time',
      }
    },
    {
      personName: 'Philip Asaya',
      award: {
        organization: 'BINFF',
        category: 'Best Supporting Actor',
        title: 'Best Supporting Actor (BINFF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Through Her Eyes',
      }
    },
    {
      personName: 'Rosabelle Jeanne Iyafokhai',
      award: {
        organization: 'BINFF',
        category: 'Best Supporting Actress',
        title: 'Best Supporting Actress (BINFF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'A Christmas Bride',
      }
    },
    {
      personName: 'Shamsiyyah Jibo',
      award: {
        organization: 'BINFF',
        category: 'Best Actress (International / Nollywood)',
        title: 'Best Actress International (BINFF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Good Country',
      }
    }
  ];

  // 3. Sync Film Awards
  console.log('🎬 Syncing BINFF Film Awards...');
  let filmsUpdated = 0;
  for (const item of filmAwardsData) {
    const film = await getOrCreateFilm(item.filmTitle, item.year, { genres: item.genres });
    if (!film) continue;

    const currentAwards = Array.isArray(film.awards) ? [...film.awards] : [];
    let added = 0;

    for (const aw of item.awards) {
      const exists = currentAwards.some(
        (a: any) =>
          (a.organization === 'BINFF' || a.organization === 'Brampton International Nollywood Film Festival') &&
          Number(a.year) === aw.year &&
          a.category?.toLowerCase() === aw.category.toLowerCase()
      );

      if (!exists) {
        currentAwards.push({
          ...aw,
          film_id: film.id,
          work: film.title,
        });
        added++;
      }
    }

    if (added > 0) {
      const { error: updateErr } = await supabase
        .from('films')
        .update({ awards: currentAwards })
        .eq('id', film.id);

      if (updateErr) {
        console.error(`  ❌ Error updating awards for "${film.title}":`, updateErr.message);
      } else {
        console.log(`  ✅ Added ${added} BINFF award(s) to "${film.title}"`);
        filmsUpdated++;
      }
    } else {
      console.log(`  ℹ️ "${film.title}" already up to date with BINFF awards.`);
    }
  }

  // 4. Sync People Awards
  console.log('\n👤 Syncing BINFF People Awards...');
  let peopleUpdated = 0;
  for (const item of peopleAwardsData) {
    const person = await getOrCreatePerson(item.personName);
    if (!person) continue;

    const currentAwards = Array.isArray(person.awards) ? [...person.awards] : [];
    const exists = currentAwards.some(
      (a: any) =>
        (a.organization === 'BINFF' || a.organization === 'Brampton International Nollywood Film Festival') &&
        Number(a.year) === item.award.year &&
        a.category?.toLowerCase() === item.award.category.toLowerCase()
    );

    if (!exists) {
      currentAwards.push(item.award);
      const { error: updateErr } = await supabase
        .from('people')
        .update({ awards: currentAwards })
        .eq('id', person.id);

      if (updateErr) {
        console.error(`  ❌ Error updating awards for "${person.name}":`, updateErr.message);
      } else {
        console.log(`  ✅ Added BINFF ${item.award.category} (${item.award.year}) to "${person.name}"`);
        peopleUpdated++;
      }
    } else {
      console.log(`  ℹ️ "${person.name}" already has ${item.award.category} (${item.award.year}).`);
    }
  }

  console.log('\n🎉 BINFF Awards Synchronization Completed!');
  console.log(`Films Synced: ${filmsUpdated}`);
  console.log(`People Synced: ${peopleUpdated}`);
}

syncBINFF().catch(console.error);
