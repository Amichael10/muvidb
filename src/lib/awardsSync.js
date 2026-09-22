import { supabase } from './supabase.js';
import { AWARD_ORGS, normOrg } from './awards.js';

/**
 * Common canonical categories available across most award bodies.
 */
export const GENERAL_AWARD_CATEGORIES = [
  'Best Overall Film',
  'Best Feature Film',
  'Best Director',
  'Best Actor in a Leading Role',
  'Best Actress in a Leading Role',
  'Best Supporting Actor',
  'Best Supporting Actress',
  'Best Screenplay',
  'Best Original Screenplay',
  'Best Adapted Screenplay',
  'Best Cinematography',
  'Best Picture Editing',
  'Best Sound Design / Sound Editing',
  'Best Original Score / Soundtrack',
  'Best Costume Design',
  'Best Makeup and Hairstyling',
  'Best Production Design / Art Direction',
  'Best Visual Effects (VFX)',
  'Best Indigenous Language Film',
  'Best Short Film',
  'Best Documentary',
  'Best Animated Film',
  'Best Television / Web Series',
  'Lifetime Achievement Award',
  'Trailblazer Award',
  'Special Recognition Award'
];

/**
 * Curated list of known categories per award organization.
 */
export const KNOWN_CATEGORIES_BY_ORG = {
  AMVCA: [
    'Best Overall Movie',
    'Best Director',
    'Best Actor in a Drama (Movie/TV Series)',
    'Best Actress in a Drama (Movie/TV Series)',
    'Best Actor in a Comedy (Movie/TV Series)',
    'Best Actress in a Comedy (Movie/TV Series)',
    'Best Supporting Actor (Movie/TV Series)',
    'Best Supporting Actress (Movie/TV Series)',
    'Best Cinematographer',
    'Best Picture Editor',
    'Best Sound Editor',
    'Best Costume Designer',
    'Best Makeup',
    'Best Art Director',
    'Best Writer (Movie/TV Series)',
    'Best Original Score',
    'Best Soundtrack',
    'Best Indigenous Language Film - Yoruba',
    'Best Indigenous Language Film - Igbo',
    'Best Indigenous Language Film - Hausa',
    'Best Indigenous Language Film - Swahili',
    'Best Short Film',
    'Best Documentary',
    'Best Television Series',
    'Best Digital Content Creator',
    'Best MultiChoice Talent Factory Film',
    'Industry Merit Award',
    'Trailblazer Award'
  ],
  AMAA: [
    'Best Film',
    'Best Director',
    'Best Actor in a Leading Role',
    'Best Actress in a Leading Role',
    'Best Actor in a Supporting Role',
    'Best Actress in a Supporting Role',
    'Best Screenplay',
    'Best Cinematography',
    'Best Editing',
    'Best Sound',
    'Best Visual Effects',
    'Best Soundtrack',
    'Best Costume Design',
    'Best Makeup',
    'Best Production Design',
    'Best Film in an African Language',
    'Best First Feature Film by a Director',
    'Best Diaspora Feature',
    'Best Diaspora Short',
    'Best Diaspora Documentary',
    'Best Animation',
    'Best Short Film',
    'Best Documentary',
    'Michael Anyiam-Osigwe Award for Best Film by an African Living Abroad',
    'Ousmane Sembene Award for Best Film in an African Language',
    'National Film and Video Censors Board (NFVCB) Award for Best Nigerian Film',
    'Lifetime Achievement Award',
    'Special Jury Prize'
  ],
  DIYMA: [
    'Best Movie of the Year',
    'Best Director of the Year',
    'Best Actor of the Year (Male)',
    'Best Actress of the Year (Female)',
    'Best Supporting Actor',
    'Best Supporting Actress',
    'Best Director of Photography',
    'Best Editor of the Year',
    'Best Sound Recordist of the Year',
    'Best Gaffer of the Year',
    'Best Set Designer of the Year',
    'Best Costumier of the Year',
    'Best Makeup Artist of the Year',
    'Best Story / Screenplay of the Year',
    'Best Indigenous Movie (Yoruba)',
    'Best Comedian Actor',
    'Content Creator of the Year',
    'Trailblazer & Youth Icon Award',
    'Lifetime Achievement & Industry Icon Tribute'
  ],
  OAFP: [
    'Best Movie of the Year',
    'Best Director of the Year',
    'Best Actor of the Year (Male)',
    'Best Actress of the Year (Female)',
    'Best Supporting Actor (Male)',
    'Best Supporting Actress (Female)',
    'Best Director of Photography',
    'Best Sound Recordist of the Year',
    'Best Gaffer of the Year',
    'Best Set Designer of the Year',
    'Traditional Costumier of the Year',
    'Editor of the Year',
    'Producer of the Year',
    'Best Comedian Actor (Male)',
    'Best Comedian Actor (Female)',
    'Best Indigenous Movie of the Year',
    'Best Kid Actor of the Year',
    'Content Creator of the Year',
    'OAFP Star Ambassador & Excellence Award',
    'OAFP Trailblazer & Youth Icon Award',
    'Lifetime Achievement & Industry Icon Tribute',
    'Award of Excellence'
  ],
  BINFF: [
    'Best Film (Nollywood)',
    'Best Director International',
    'Best Action Thriller Film',
    'Best Comedy Film',
    'Best Drama (Nollywood)',
    'Best Actor Short Film',
    'Best Actress (International / Nollywood)',
    'Best Supporting Actor',
    'Best Supporting Actress',
    'Best Screenplay',
    'Best Editing',
    'Best Producer',
    'Best Producer of a Short Film',
    'Best Movie Trailer',
    'Best Narrative Short Film',
    'Best Short Film (Nollywood)',
    'Best Short Film International',
    'Best Short Film Nollywood/Africa',
    'Best Television/Web Series',
    'Merit Award'
  ],
  TINFF: [
    'Best Feature Film',
    'Best Director',
    'Best Actor',
    'Best Actress',
    'Best Supporting Actor',
    'Best Supporting Actress',
    'Best Cinematography',
    'Best Short Film',
    'Best African Film',
    'Best Screenplay',
    'Best Editing',
    'Best Documentary',
    'Special Jury Award'
  ],
  BON: [
    'Movie of the Year',
    'Director of the Year',
    'Best Actor in a Leading Role (English)',
    'Best Actress in a Leading Role (English)',
    'Best Actor in a Leading Role (Yoruba)',
    'Best Actress in a Leading Role (Yoruba)',
    'Best Actor in a Leading Role (Hausa)',
    'Best Actress in a Leading Role (Hausa)',
    'Best Actor in a Leading Role (Igbo)',
    'Best Actress in a Leading Role (Igbo)',
    'Best Supporting Actor (English)',
    'Best Supporting Actress (English)',
    'Best Supporting Actor (Yoruba)',
    'Best Supporting Actress (Yoruba)',
    'Best Screenplay',
    'Best Cinematography',
    'Best Editing',
    'Best Production Design',
    'Best Costume in a Movie',
    'Best Make-up in a Movie',
    'Best Soundtrack',
    'Best Short Film',
    'Best Child Actor',
    'Special Recognition Award'
  ],
  AIFF: [
    'Outstanding Feature Film',
    'Outstanding Director',
    'Outstanding Directing',
    'Outstanding Actor',
    'Outstanding Actress',
    'Outstanding Female Act',
    'Special Recognition Award',
    'Special Recognition / Closing Feature'
  ],
  ZUFF: [
    'Best Feature Film',
    'Best Director',
    'Best Actor',
    'Best Actress',
    'Best Supporting Actor',
    'Best Cinematography',
    'Best Screenplay',
    'Best Documentary',
    'Best Student Film',
    'Lifetime Achievement Award'
  ],
  ELOY: [
    'Actress of the Year (Big Screen)',
    'Actress of the Year (TV and Web Series)',
    'Female Movie Director',
    'Female Movie Producer of the Year',
    'Scriptwriter of the Year',
    'Female Comedian / Entertainer of the Year',
    'ELOY Award for Acting',
    'ELOY Award for Influence',
    'ELOY Iconic Recognition Award'
  ],
  GOLDEN_STARS: [
    'Nollywood Movie Icon of the Year',
    'Nollywood Legendary Pace Setter',
    'Most Influential Movie Icon',
    'Lifetime Achievement Award'
  ],
  KADIFF: [
    'Best Director',
    'Outstanding Lead Actress',
    'Best Actress Nominee',
    'Outstanding Supporting Actress',
    'KADIFF Excellence Award'
  ],
  CCFF: [
    'Best Feature Film',
    'Best Director',
    'Best Lead Act',
    'CCFF Hall of Fame Inductee',
    'Living Legend & Honorary Recognition'
  ],
  NTFF: [
    'Best Nigerian Film',
    'Best Director',
    'Best Actor',
    'Best Actress',
    'Best Cinematographer',
    'Best Music Score',
    'Best Screenplay',
    'Most Outstanding Individual in Nollywood'
  ],
  KILAF: [
    'Best Feature Film',
    'Best Director',
    'Best Actor',
    'Best Supporting Actress',
    'Best Cinematography',
    'Best Screenplay'
  ],
  EKOIFF: [
    'Best Feature Film',
    'Best Actor',
    'Best Indigenous Film'
  ]
};

/**
 * Get category suggestions for a given award organization.
 */
export function getCategoriesForOrg(org) {
  const norm = normOrg(org);
  const specific = KNOWN_CATEGORIES_BY_ORG[norm] || KNOWN_CATEGORIES_BY_ORG[org] || [];
  const set = new Set([...specific, ...GENERAL_AWARD_CATEGORIES]);
  return Array.from(set);
}

/**
 * Match two award records to see if they refer to the same award slot.
 */
function isSameAward(a, b) {
  if (!a || !b) return false;
  const orgA = normOrg(a.organization);
  const orgB = normOrg(b.organization);
  if (orgA !== orgB) return false;

  const yearA = a.year ? parseInt(a.year, 10) : null;
  const yearB = b.year ? parseInt(b.year, 10) : null;
  const seasonA = a.season ? parseInt(a.season, 10) : null;
  const seasonB = b.season ? parseInt(b.season, 10) : null;

  if (yearA && yearB && yearA !== yearB) return false;
  if (seasonA && seasonB && seasonA !== seasonB) return false;

  const catA = (a.category || a.title || '').trim().toLowerCase();
  const catB = (b.category || b.title || '').trim().toLowerCase();
  if (catA && catB && catA !== catB) return false;

  return true;
}

/**
 * Sync person awards to linked films.
 * Called after saving a person profile in AdminPeople.
 */
export async function syncPersonAwardsToFilms(personId, personName, personAwards) {
  if (!personName || !Array.isArray(personAwards)) return;

  const cleanAwards = personAwards.filter(
    (a) => a && (a.film_id || a.work) && ((a.organization || '').trim() || (a.category || '').trim())
  );

  for (const award of cleanAwards) {
    let targetFilmId = award.film_id;

    // If film_id is missing but work is given, try finding the film by title
    if (!targetFilmId && award.work?.trim()) {
      const { data: found } = await supabase
        .from('films')
        .select('id, title, awards')
        .ilike('title', award.work.trim())
        .limit(1)
        .maybeSingle();
      if (found) {
        targetFilmId = found.id;
      }
    }

    if (!targetFilmId) continue;

    try {
      const { data: film, error: fetchErr } = await supabase
        .from('films')
        .select('id, title, awards')
        .eq('id', targetFilmId)
        .single();

      if (fetchErr || !film) continue;

      const filmAwards = Array.isArray(film.awards) ? [...film.awards] : [];
      const matchIdx = filmAwards.findIndex((fa) => isSameAward(fa, award));

      if (matchIdx >= 0) {
        // Award exists on film, ensure person is in recipients
        const existing = { ...filmAwards[matchIdx] };
        const recipients = Array.isArray(existing.recipients) ? [...existing.recipients] : [];
        const hasRecipient = recipients.some(
          (r) => r.toLowerCase().trim() === personName.toLowerCase().trim()
        );
        if (!hasRecipient) {
          recipients.push(personName);
        }
        filmAwards[matchIdx] = {
          ...existing,
          recipients,
          won: award.won === true ? true : existing.won,
        };
      } else {
        // New award on film
        filmAwards.push({
          organization: (award.organization || '').trim() || 'AMVCA',
          year: award.year ? parseInt(award.year, 10) : null,
          season: award.season ? parseInt(award.season, 10) : null,
          category: (award.category || '').trim() || null,
          recipients: [personName],
          won: award.won === true,
        });
      }

      await supabase.from('films').update({ awards: filmAwards }).eq('id', targetFilmId);
    } catch (err) {
      console.warn('syncPersonAwardsToFilms error for film:', targetFilmId, err);
    }
  }
}

/**
 * Sync film awards to recipient people.
 * Called after saving a film in AdminFilms.
 */
export async function syncFilmAwardsToPeople(filmId, filmTitle, filmAwards) {
  if (!filmId || !filmTitle || !Array.isArray(filmAwards)) return;

  for (const award of filmAwards) {
    const recipients = Array.isArray(award.recipients) ? award.recipients.filter(Boolean) : [];
    if (!recipients.length) continue;

    for (const recipient of recipients) {
      const cleanName = recipient.trim();
      if (!cleanName) continue;

      try {
        const { data: person, error: fetchErr } = await supabase
          .from('people')
          .select('id, name, awards')
          .ilike('name', cleanName)
          .limit(1)
          .maybeSingle();

        if (fetchErr || !person) continue;

        const personAwards = Array.isArray(person.awards) ? [...person.awards] : [];
        const matchIdx = personAwards.findIndex((pa) => isSameAward(pa, award));

        if (matchIdx >= 0) {
          const existing = { ...personAwards[matchIdx] };
          personAwards[matchIdx] = {
            ...existing,
            work: filmTitle,
            film_id: filmId,
            won: award.won === true ? true : existing.won,
          };
        } else {
          personAwards.push({
            organization: (award.organization || '').trim() || 'AMVCA',
            year: award.year ? parseInt(award.year, 10) : null,
            season: award.season ? parseInt(award.season, 10) : null,
            category: (award.category || '').trim() || null,
            work: filmTitle,
            film_id: filmId,
            won: award.won === true,
          });
        }

        await supabase.from('people').update({ awards: personAwards }).eq('id', person.id);
      } catch (err) {
        console.warn('syncFilmAwardsToPeople error for person:', cleanName, err);
      }
    }
  }
}
