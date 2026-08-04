import { supabase } from './supabase';

/**
 * Ceremony catalogue for the Awards page — order, copy, timing, submissions.
 * Display labels stay short; `about` / `when` / `submissions` power the explainer.
 */
export const AWARD_ORGS = [
  {
    id: 'AMVCA',
    label: 'AMVCA',
    full: 'Africa Magic Viewers’ Choice Awards',
    accent: '#FF5A1F',
    about:
      'Africa’s biggest film and television night — a mix of jury categories and audience votes that crowns the year’s most watched and critically celebrated work across the continent.',
    when:
      'Usually held in Lagos in May. Call for entries typically opens in January and runs into mid‑February for titles released the previous calendar year.',
    submissions:
      'Filmmakers and TV producers submit online via the official Africa Magic portal with a full preview copy as screened or broadcast. Feature films need a cinema, TV, or streaming release in the eligibility window. Categories include indigenous-language awards alongside mainstream film and series prizes.',
    submitUrl: 'https://www.africamagic.tv/amvca',
    submitLabel: 'AMVCA submissions',
  },
  {
    id: 'AMAA',
    label: 'AMAA',
    full: 'Africa Movie Academy Awards',
    accent: '#C9A227',
    about:
      'Often called the “African Oscars” — a pan‑African academy honouring craft across acting, directing, writing, and technical categories, with a strong focus on cinema rather than TV.',
    when:
      'The ceremony typically lands in the second half of the year (often late summer / autumn), after a nomination cycle that follows the previous year’s theatrical and festival slate.',
    submissions:
      'Eligible titles are usually submitted by producers or distributors during the academy’s open call. Features and relevant shorts must meet theatrical or festival exhibition rules for the award year — check the official AMAA call for the current window and formats.',
    submitUrl: null,
    submitLabel: null,
  },
  {
    id: 'TINFF',
    label: 'TINFF',
    full: 'The Industry Nollywood Film Festival',
    accent: '#E11D48',
    about:
      'A festival-and-awards platform that spotlights Nollywood and diaspora storytelling — less red‑carpet TV spectacle, more industry showcase with competitive categories for features and emerging work.',
    when:
      'Festival editions and awards typically cluster mid‑year; exact dates shift by host city and edition. Watch the official TINFF channels for each year’s programme.',
    submissions:
      'Films enter through the festival’s submission process (often via festival platforms). Accepted titles can screen in the programme and compete in TINFF award categories — useful for independent and diaspora productions seeking industry visibility.',
    submitUrl: null,
    submitLabel: null,
  },
];

function normOrg(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Other';
  const upper = s.toUpperCase();
  if (upper.includes('AMVCA') || upper.includes('AFRICA MAGIC')) return 'AMVCA';
  if (upper.includes('AMAA') || upper.includes('AFRICA MOVIE ACADEMY')) return 'AMAA';
  if (upper.includes('TINFF') || upper.includes('INDUSTRY NOLLYWOOD')) return 'TINFF';
  return s;
}

async function pageTable(table, cols) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    // Rows with at least one award object in the jsonb array
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .not('awards', 'eq', '[]')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Flatten people.awards + films.awards into ceremony-ready rows.
 * Film awards dedupe against person awards when the same org/year/category/work
 * already has a person entry (person rows carry richer person links).
 */
export async function loadAwardsCatalog() {
  const [people, films] = await Promise.all([
    pageTable('people', 'id, name, slug, photo_url, awards'),
    pageTable('films', 'id, title, slug, poster_url, year, awards'),
  ]);

  const filmById = new Map(films.map((f) => [f.id, f]));
  const rows = [];
  const seen = new Set();
  /** Slots already covered by person.awards — skip film.recipient duplicates. */
  const personSlots = new Set();

  const slotKey = (org, year, season, category, work) =>
    [org, year, season, category, work || ''].join('|').toLowerCase();
  const rowKey = (org, year, season, category, work, who) =>
    `${slotKey(org, year, season, category, work)}|${who || ''}`.toLowerCase();

  const filmPayload = (film, fallbackTitle) =>
    film
      ? {
          id: film.id,
          title: film.title,
          slug: film.slug,
          poster_url: film.poster_url,
          year: film.year,
        }
      : fallbackTitle
        ? { id: null, title: fallbackTitle, slug: null, poster_url: null, year: null }
        : null;

  for (const person of people) {
    const awards = Array.isArray(person.awards) ? person.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || a.title || '').trim() || null;
      const film = a.film_id ? filmById.get(a.film_id) : null;
      const k = rowKey(org, year, season, category, work, person.id);
      if (seen.has(k)) continue;
      seen.add(k);
      personSlots.add(slotKey(org, year, season, category, work));
      rows.push({
        org,
        year,
        season,
        category,
        work,
        won: !!a.won,
        person: {
          id: person.id,
          name: person.name,
          slug: person.slug,
          photo_url: person.photo_url,
        },
        film: film
          ? filmPayload(film)
          : filmPayload(null, work),
      });
    }
  }

  for (const film of films) {
    const awards = Array.isArray(film.awards) ? film.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || film.title || '').trim() || film.title;
      const recipients = Array.isArray(a.recipients) ? a.recipients.filter(Boolean) : [];
      const slot = slotKey(org, year, season, category, work);

      if (recipients.length === 0) {
        const k = rowKey(org, year, season, category, work, `film:${film.id}`);
        if (seen.has(k) || personSlots.has(slot)) continue;
        seen.add(k);
        rows.push({
          org,
          year,
          season,
          category,
          work,
          won: !!a.won,
          person: null,
          film: filmPayload(film),
        });
        continue;
      }

      if (personSlots.has(slot)) continue;

      for (const name of recipients) {
        const k = rowKey(org, year, season, category, work, `name:${name}`);
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({
          org,
          year,
          season,
          category,
          work,
          won: !!a.won,
          person: { id: null, name, slug: null, photo_url: null },
          film: filmPayload(film),
        });
      }
    }
  }

  // Hydrate any missing film posters referenced only by film_id on people
  const missingIds = [
    ...new Set(
      rows
        .filter((r) => r.film?.id && !r.film.poster_url && !filmById.has(r.film.id))
        .map((r) => r.film.id)
    ),
  ];
  if (missingIds.length) {
    const { data: extra } = await supabase
      .from('films')
      .select('id, title, slug, poster_url, year')
      .in('id', missingIds);
    for (const f of extra || []) filmById.set(f.id, f);
    for (const r of rows) {
      if (r.film?.id && filmById.has(r.film.id)) {
        const f = filmById.get(r.film.id);
        r.film = {
          id: f.id,
          title: f.title,
          slug: f.slug,
          poster_url: f.poster_url,
          year: f.year,
        };
      }
    }
  }

  const orgs = [...new Set(rows.map((r) => r.org))].sort((a, b) => {
    const ai = AWARD_ORGS.findIndex((o) => o.id === a);
    const bi = AWARD_ORGS.findIndex((o) => o.id === b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });

  const years = [...new Set(rows.map((r) => r.year).filter(Boolean))].sort((a, b) => b - a);

  return { rows, orgs, years, stats: { people: people.length, films: films.length, entries: rows.length } };
}

/** Group flat rows into org → year → category → { winners, nominees }. */
export function groupAwards(rows, { org, year } = {}) {
  let list = rows;
  if (org) list = list.filter((r) => r.org === org);
  if (year) list = list.filter((r) => r.year === year);

  const byCategory = new Map();
  for (const r of list) {
    const cat = r.category || 'Award';
    if (!byCategory.has(cat)) byCategory.set(cat, { category: cat, winners: [], nominees: [] });
    const bucket = byCategory.get(cat);
    if (r.won) bucket.winners.push(r);
    else bucket.nominees.push(r);
  }

  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
}
