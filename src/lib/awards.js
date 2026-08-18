import { supabase } from './supabase';

/**
 * Ceremony catalogue for the Awards page — order, copy, timing, submissions.
 * Display labels stay short; `about` / `when` / `submissions` power the explainer.
 */
export const AWARD_ORGS = [
  {
    id: 'YOMAFA',
    label: 'YOMAFA',
    full: 'Yomafa Global Awards',
    accent: '#FAB80F',
    about:
      'Pan-African showbiz honours spanning film, music, media and culture — audience voting across dozens of categories each season.',
    when:
      'Season 18 (2026) voting is live on yomafaglobal.com. Past seasons are archived by the organisers.',
    submissions:
      'Nominees are registered through the Yomafa platform during the open nomination window each season.',
    submitUrl: 'https://yomafaglobal.com/',
    submitLabel: 'Yomafa Global Awards',
  },
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
  {
    id: 'GOLDEN_STARS',
    label: 'Golden Stars',
    full: 'Golden Stars Awards',
    accent: '#F59E0B',
    about:
      'Annual African entertainment and industry honours recognizing excellence across acting, Nollywood performances, music, and media personalities in Lagos, Nigeria.',
    when:
      'Annual ceremony held mid-year in Lagos. Past winners include prominent Nollywood actors, producers, and entertainment leaders.',
    submissions:
      'Nominees are registered and accredited via the official Golden Stars Awards platform.',
    submitUrl: 'https://goldenstarsaward.com/',
    submitLabel: 'Golden Stars Portal',
  },
  {
    id: 'BON',
    label: 'BON',
    full: 'Best of Nollywood Awards',
    accent: '#10B981',
    about:
      'One of Nigeria’s premier film award bodies honoring technical craft, lead acting, and supporting performances across Indigenous and English-language Nollywood cinema.',
    when:
      'Annual ceremony held in November. Honors theatrical and streaming films released in the eligibility window.',
    submissions:
      'Producers submit physical and digital film screeners to the BON panel.',
    submitUrl: null,
    submitLabel: null,
  },
  {
    id: 'LIFACC',
    label: 'LIFACC',
    full: 'Lagos International Film and Cinema Convention',
    accent: '#14B8A6',
    about:
      'Industry-facing honours recognizing the business, exhibition, distribution, infrastructure, leadership, and regulatory work that powers African cinema.',
    when:
      'Held as part of the Lagos International Film and Cinema Convention; the 2026 Cinema Achievement Awards were announced for July 15, 2026 in Lagos.',
    submissions:
      'LIFACC recognition categories are announced by the convention organisers and focus on measurable industry contribution rather than open public voting.',
    submitUrl: 'https://lifacc.com/',
    submitLabel: 'LIFACC',
  },
  {
    id: 'AIFF',
    label: 'AIFF',
    full: 'Abuja International Film Festival',
    accent: '#059669',
    about:
      'One of West Africa’s longest-running international film festivals, founded in 2004 by Fidelis Duker, celebrating Nigerian, African, and international cinema across competitive feature, documentary, acting, and craft categories.',
    when:
      'Annual festival held in November at Silverbird Cinemas in Abuja, Nigeria, featuring screenings, masterclasses, and the Golden Jury Awards.',
    submissions:
      'Submissions open annually via FilmFreeway and the official AIFF portal for feature films, shorts, documentaries, animations, and student/experimental cinema.',
    submitUrl: 'https://abujafilmfestival.org/',
    submitLabel: 'AIFF Portal',
  },
  {
    id: 'ZUFF',
    label: 'ZUMA',
    full: 'Zuma Film Festival',
    accent: '#EA580C',
    about:
      'Nigeria’s official national film festival, organized annually by the Nigerian Film Corporation (NFC), celebrating artistic excellence, cultural heritage, and indigenous storytelling across Africa and the diaspora.',
    when:
      'Annual national festival held in December in Abuja, hosted by the Nigerian Film Corporation.',
    submissions:
      'Open to Nigerian, African, and international entries across feature films, documentaries, student cinema, indigenous language films, animations, and shorts via FilmFreeway and the official NFC portal.',
    submitUrl: 'https://zumafilmfest.com/',
    submitLabel: 'Zuma Festival Portal',
  },
  {
    id: 'KILAF',
    label: 'KILAF',
    full: 'Kano Indigenous Languages of Africa Film Festival',
    accent: '#7C3AED',
    about:
      'An annual pan-African film market and festival in Kano, Nigeria, founded by Alhaji Abdul-Kareem Mohammed, dedicated to celebrating, marketing, and elevating cinematic storytelling produced in native African indigenous languages.',
    when:
      'Annual festival and market held in November in Kano, Nigeria, featuring continental film screenings, academic symposia, and grand awards.',
    submissions:
      'Open to African indigenous language features, shorts, documentaries, student films, and animations through FilmFreeway and the official KILAF portal.',
    submitUrl: 'https://kilaf.org/',
    submitLabel: 'KILAF Portal',
  },
  {
    id: 'KADIFF',
    label: 'KADIFF',
    full: 'Kaduna International Film Festival',
    accent: '#0284C7',
    about:
      'An annual international film festival founded by Israel Kashim Audu in Kaduna, Nigeria, dedicated to using cinema as a tool for social change, celebrating African narratives, and fostering emerging and veteran filmmakers across the globe.',
    when:
      'Annual festival held in August in Kaduna, Nigeria, featuring masterclasses, screenings, and gala excellence awards.',
    submissions:
      'Open to international and African feature films, documentaries, short films, student cinema, animations, and indigenous language productions via FilmFreeway and the official festival website.',
    submitUrl: 'https://www.kadunafilmfestival.com/',
    submitLabel: 'KADIFF Portal',
  },
  {
    id: 'CCFF',
    label: 'CCFF',
    full: 'Coal City Film Festival',
    accent: '#D97706',
    about:
      'An annual international film festival founded by filmmaker Uche Agbo in Enugu, Nigeria—the historic coal city and cradle of Nollywood—celebrating African and global cinema, cultural tourism, and industry legends.',
    when:
      'Annual festival held in March / April in Enugu, Nigeria, featuring city tours, screenings, masterclasses, and the Hall of Fame gala.',
    submissions:
      'Open to African and international feature films, documentaries, shorts, animations, and student cinema via FilmFreeway and the official CCFF portal.',
    submitUrl: 'https://coalcityfilmfestival.org/',
    submitLabel: 'CCFF Portal',
  },
  {
    id: 'WRIFF',
    label: 'WRIFF',
    full: 'Warien Rose International Film Festival',
    accent: '#E11D48',
    about:
      'An annual international film festival in Lagos, Nigeria, founded under the Warien Rose Academy and Foundation by Prof. Doc. Efe Anaughe, championing "Great Stories, Global Impact" and celebrating films that spotlight social justice, cultural preservation, and transformative African narratives.',
    when:
      'Annual international film festival hosted in Lagos, Nigeria, featuring screenings, masterclasses, and social impact awards.',
    submissions:
      'Open to feature films, documentaries, shorts, and advocacy cinema via the Warien Rose Academy portal and FilmFreeway.',
    submitUrl: 'https://www.warienroseacademy.com',
    submitLabel: 'Warien Rose Academy',
  },
  {
    id: 'AFFIF',
    label: 'AFFIF',
    full: 'Africa Films For Impact Festival',
    accent: '#0D9488',
    about:
      'An annual social impact film festival and fellowship organized by the Films For Impact Foundation in Abuja, Nigeria, dedicated to using cinema, human rights narratives, and advocacy as catalysts for positive social transformation.',
    when:
      'Annual festival held in October / November at Silverbird Cinemas in Abuja, Nigeria, featuring masterclasses, impact fellowships, and the Impact Awards.',
    submissions:
      'Open to narrative features, documentaries, shorts, animations, and student impact films via FilmFreeway and the official AFFIF website.',
    submitUrl: 'https://affif.org/',
    submitLabel: 'AFFIF Portal',
  },
  {
    id: 'OAFP',
    label: 'OAFP',
    full: 'Odunlade Adekola Films Production Awards',
    accent: '#6B21A8',
    about:
      'An annual film awards gala and academy convocation founded by Nollywood icon Odunlade Adekola in Abeokuta, Ogun State, established to celebrate, reward, and elevate actors, emerging talents, production crew, and veteran legends across Nigerian cinema.',
    when:
      'Annual awards gala and academy convocation held in December at the Olusegun Obasanjo Presidential Library (OOPL) and Cultural Centre in Abeokuta, Nigeria.',
    submissions:
      'Recognitions and merit awards are conferred across academy graduating cohorts, mainstream Nollywood performers, technical crew, and industry honorees by the OAFP jury.',
    submitUrl: 'https://www.instagram.com/odunomoadekola/',
    submitLabel: 'OAFP Portal',
  },
  {
    id: 'EKO_STAR',
    label: 'Eko Star',
    full: 'Eko Star Film & TV Awards',
    accent: '#DB2777',
    about:
      'A Nigerian International Film Summit-linked recognition platform spotlighting women and leaders across Nigerian film and television.',
    when:
      'The NIFS gallery archives the Eko Star Film & TV Awards edition dated April 16, 2021.',
    submissions:
      'Awardee profiles are published by the Nigerian International Film Summit. Check NIFS channels for current recognition cycles.',
    submitUrl: 'https://nifsummit.com/eko-star/awardees',
    submitLabel: 'Eko Star awardees',
  },
];

function normOrg(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Other';
  const upper = s.toUpperCase();
  if (upper.includes('YOMAFA') || upper.includes('YOMAFA GLOBAL')) return 'YOMAFA';
  if (upper.includes('AMVCA') || upper.includes('AFRICA MAGIC')) return 'AMVCA';
  if (upper.includes('AMAA') || upper.includes('AFRICA MOVIE ACADEMY')) return 'AMAA';
  if (upper.includes('TINFF') || upper.includes('INDUSTRY NOLLYWOOD')) return 'TINFF';
  if (upper.includes('NTFF') || upper.includes('NOLLYWOOD TRAVEL') || upper.includes('TRAVEL FILM FESTIVAL')) return 'NTFF';
  if (upper.includes('AIFF') || upper.includes('ABUJA INTERNATIONAL') || upper.includes('ABUJA FILM')) return 'AIFF';
  if (upper.includes('ZUMA') || upper.includes('ZUFF')) return 'ZUFF';
  if (upper.includes('KILAF') || upper.includes('KANO INDIGENOUS')) return 'KILAF';
  if (upper.includes('KADIFF') || upper.includes('KADUNA INTERNATIONAL') || upper.includes('KADUNA FILM')) return 'KADIFF';
  if (upper.includes('CCFF') || upper.includes('COAL CITY')) return 'CCFF';
  if (upper.includes('WRIFF') || upper.includes('WARIEN ROSE') || upper.includes('WARIEN')) return 'WRIFF';
  if (upper.includes('AFFIF') || upper.includes('FILMS FOR IMPACT') || upper.includes('AFRICA FILMS FOR IMPACT')) return 'AFFIF';
  if (upper.includes('OAFP') || upper.includes('ODUNLADE ADEKOLA') || upper.includes('ODUNLADE')) return 'OAFP';
  if (upper.includes('GOLDEN STAR') || upper.includes('GOLDENSTARS')) return 'GOLDEN_STARS';
  if (upper.includes('BON') || upper.includes('BEST OF NOLLYWOOD')) return 'BON';
  if (upper.includes('LIFACC') || upper.includes('LAGOS INTERNATIONAL FILM AND CINEMA')) return 'LIFACC';
  if (upper.includes('EKO STAR')) return 'EKO_STAR';
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
  const [people, films, companies, cinemas] = await Promise.all([
    pageTable('people', 'id, name, slug, photo_url, awards'),
    pageTable('films', 'id, title, slug, poster_url, year, awards'),
    pageTable('companies', 'id, name, slug, logo_url, awards'),
    pageTable('cinemas', 'id, name, city, state, logo_url, awards'),
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

  const companyPayload = (company) =>
    company
      ? {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logo_url: company.logo_url,
        }
      : null;

  const cinemaPayload = (cinema) =>
    cinema
      ? {
          id: cinema.id,
          name: cinema.name,
          city: cinema.city,
          state: cinema.state,
          logo_url: cinema.logo_url,
        }
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

  for (const company of companies) {
    const awards = Array.isArray(company.awards) ? company.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || a.title || company.name || '').trim() || null;
      const k = rowKey(org, year, season, category, work, `company:${company.id}`);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({
        org,
        year,
        season,
        category,
        work,
        won: !!a.won,
        person: null,
        film: null,
        company: companyPayload(company),
        cinema: null,
      });
    }
  }

  for (const cinema of cinemas) {
    const awards = Array.isArray(cinema.awards) ? cinema.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || a.title || cinema.name || '').trim() || null;
      const k = rowKey(org, year, season, category, work, `cinema:${cinema.id}`);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({
        org,
        year,
        season,
        category,
        work,
        won: !!a.won,
        person: null,
        film: null,
        company: null,
        cinema: cinemaPayload(cinema),
      });
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

  return {
    rows,
    orgs,
    years,
    stats: {
      people: people.length,
      films: films.length,
      companies: companies.length,
      cinemas: cinemas.length,
      entries: rows.length,
    },
  };
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
