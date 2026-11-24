/**
 * MuviDB Power Rank & Streaming Freshness Engine
 *
 * Designed specifically for the African screen & stage ecosystem:
 * Unlike IMDb (which relies almost exclusively on raw web pageviews),
 * MuviDB computes a multi-signal composite score across:
 *   1. Theatrical Box Office Gross (₦ / GHC)
 *   2. YouTube Digital Velocity & Owned YouTube Channel Ownership
 *   3. Owned Production / Executive Producer / Director Slates
 *   4. Stage Play & Live Theatre Legacy
 *   5. Accredited Film Academy & Guild / Award Prestige
 *   6. Weekly Profile & Search Momentum (drives the Δ Rank Delta)
 */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Determines whether a streaming/YouTube film is "Fresh" enough
 * for the homepage Streaming Hub (excludes unenriched old back-catalog).
 */
export function isFreshStreamingFilm(film, now = new Date()) {
  if (!film || !film.poster_url) return false;
  if (film.coming_soon) return false;

  const currentYear = now.getFullYear();
  const minFreshYear = currentYear - 1; // e.g., 2025+ for 2026

  if (film.release_date) {
    const rel = new Date(`${String(film.release_date).slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(rel.getTime())) {
      const ageDays = (now.getTime() - rel.getTime()) / DAY_MS;
      // Released within the last 18 months (or upcoming/current year)
      if (ageDays >= -7 && ageDays <= 540) return true;
      // Explicitly exclude old back-catalog even if recently imported
      if (rel.getFullYear() < minFreshYear) return false;
    }
  }

  if (film.year != null) {
    const y = Number(film.year);
    if (Number.isFinite(y) && y >= minFreshYear) return true;
    if (Number.isFinite(y) && y < minFreshYear) return false;
  }

  // Only if both release_date and year are missing, allow recently created entries
  if (film.created_at) {
    const created = new Date(film.created_at);
    if (!Number.isNaN(created.getTime())) {
      const ingestedDays = (now.getTime() - created.getTime()) / DAY_MS;
      return ingestedDays <= 30;
    }
  }

  return false;
}

/**
 * Computes a 0-1000 Freshness + Velocity score for homepage streaming sorting.
 */
export function computeFilmFreshnessScore(film, now = new Date()) {
  if (!film) return 0;

  let recencyPts = 0;
  const relStr = film.release_date ? String(film.release_date).slice(0, 10) : null;
  if (relStr) {
    const rel = new Date(`${relStr}T00:00:00Z`);
    if (!Number.isNaN(rel.getTime())) {
      const ageDays = Math.max(0, (now.getTime() - rel.getTime()) / DAY_MS);
      if (ageDays <= 14) recencyPts = 500;
      else if (ageDays <= 45) recencyPts = 380;
      else if (ageDays <= 90) recencyPts = 280;
      else if (ageDays <= 180) recencyPts = 180;
      else if (ageDays <= 365) recencyPts = 100;
      else recencyPts = 30;
    }
  } else if (film.year) {
    const y = Number(film.year);
    const curY = now.getFullYear();
    if (y >= curY) recencyPts = 240;
    else if (y === curY - 1) recencyPts = 120;
  }

  // Velocity boost from YouTube views (log10 scaled, max ~180 pts)
  const views = Number(film.view_count || 0);
  const viewPts = views > 0 ? Math.min(180, Math.round(Math.log10(views + 1) * 24)) : 0;

  // Box office / audience proof boost (max ~120 pts)
  const bo = Number(film.box_office_domestic || 0);
  const boPts = bo > 0 ? Math.min(80, Math.round(Math.log10(bo + 1) * 8)) : 0;
  const rating = Number(film.imdb_rating || film.tmdb_rating || film.audience_rating || 0);
  const ratingPts = rating > 0 ? Math.min(40, Math.round(rating * 4)) : 0;

  return recencyPts + viewPts + boPts + ratingPts;
}

/**
 * Filters a list of streaming films to fresh-only and sorts by freshness + velocity.
 * Falls back gracefully to the newest available items only if fewer than `minFallback`
 * fresh items exist on a niche platform.
 */
export function filterAndSortFreshStreaming(films = [], { minFallback = 0 } = {}) {
  const now = new Date();
  const valid = (films || []).filter((f) => f && f.poster_url && !f.coming_soon && !f.series_id);
  const fresh = valid
    .filter((f) => isFreshStreamingFilm(f, now))
    .sort((a, b) => computeFilmFreshnessScore(b, now) - computeFilmFreshnessScore(a, now));

  if (fresh.length > 0 || minFallback <= 0) return fresh;

  return valid
    .sort((a, b) => computeFilmFreshnessScore(b, now) - computeFilmFreshnessScore(a, now))
    .slice(0, minFallback);
}

/**
 * Computes the MuviDB African Power Score (0-100) for a Person
 * across 6 weighted industry pillars:
 *   - Box Office Clout (30 pts max)
 *   - YouTube Views & Owned Channel (25 pts max)
 *   - Production / Studio Ownership & Directing (15 pts max)
 *   - Stage Play & Theatre Legacy (10 pts max)
 *   - Academy / Institutional & Award Prestige (10 pts max)
 *   - Weekly Momentum & Verification (10 pts max)
 */
export function computePersonPowerScore(person, extras = {}) {
  if (!person) return { total: 0, breakdown: {}, delta: 0 };

  const boTotal = Number(extras.boxOfficeTotal ?? person.box_office_total ?? 0);
  const ytViews = Number(
    extras.youtubeViews ?? person.view_count_total ?? person.youtube_stats?.viewCount ?? 0
  );
  const ytSubs = Number(person.youtube_stats?.subscriberCount ?? 0);
  const hasOwnedChannel = Boolean(person.youtube_channel_id || person.youtube_handle || ytSubs > 0);

  const dept = String(person.known_for_department || '').toLowerCase();
  const isProducerOrDirector =
    dept.includes('produc') || dept.includes('direct') || dept.includes('writ') || dept.includes('creat');
  const ownedStudios = Number(extras.ownedCompaniesCount ?? 0);
  const stagePlays = Number(extras.stagePlayCount ?? 0);
  const institutions = Number(extras.institutionCount ?? 0);
  const awardCount = Array.isArray(person.awards) ? person.awards.length : Number(extras.awardCount ?? 0);
  const filmCount = Number(person.film_count || 0);
  const weeklyViews = Number(person.view_count_weekly || 0);
  const profileViews = Number(person.profile_views || 0);
  const popScore = Number(person.popularity_score || 0);

  // 1. Box Office Clout (max 30)
  let boxOfficePts = 0;
  if (boTotal > 0) {
    boxOfficePts = Math.min(30, Math.max(6, Math.round((Math.log10(boTotal) - 5.5) * 7.5)));
  } else if (filmCount >= 80) {
    boxOfficePts = 14;
  } else if (filmCount >= 25) {
    boxOfficePts = 9;
  }

  // 2. YouTube Velocity & Owned Channel (max 25)
  let youtubePts = 0;
  if (ytViews > 0) {
    youtubePts += Math.min(20, Math.round(Math.log10(ytViews + 1) * 2.7));
  } else if (filmCount >= 40) {
    youtubePts += 8;
  }
  if (hasOwnedChannel) {
    youtubePts += ytSubs >= 100_000 ? 5 : 3;
  }
  youtubePts = Math.min(25, youtubePts);

  // 3. Owned Production / Multi-hyphenate Creator (max 15)
  let productionPts = 0;
  if (ownedStudios > 0) productionPts += Math.min(10, ownedStudios * 6);
  if (isProducerOrDirector) productionPts += 5;
  if (filmCount >= 100) productionPts += 4;
  else if (filmCount >= 30) productionPts += 2;
  productionPts = Math.min(15, productionPts);

  // 4. Stage Play & Theatre Legacy (max 10)
  const theatrePts = Math.min(10, stagePlays * 4);

  // 5. Academy / Institutional & Awards Prestige (max 10)
  let prestigePts = Math.min(6, awardCount * 2) + Math.min(4, institutions * 4);
  prestigePts = Math.min(10, prestigePts);

  // 6. Weekly Momentum & Verification (max 10)
  let momentumPts = 0;
  if (weeklyViews > 0) momentumPts += Math.min(5, Math.round(Math.log10(weeklyViews + 1) * 1.5));
  else if (profileViews > 0) momentumPts += Math.min(4, Math.round(Math.log10(profileViews + 1)));
  else if (popScore > 0) momentumPts += Math.min(4, Math.round(Math.log10(popScore + 1) * 1.5));
  if (person.is_verified) momentumPts += 3;
  if (person.is_pro || person.claimed_by) momentumPts += 2;
  momentumPts = Math.min(10, momentumPts);

  const total = Math.min(
    100,
    Math.max(12, boxOfficePts + youtubePts + productionPts + theatrePts + prestigePts + momentumPts)
  );

  // Deterministic weekly delta fallback when view_count_weekly hasn't rolled yet
  let delta = 0;
  if (weeklyViews > 0 && profileViews > 0) {
    const ratio = weeklyViews / Math.max(1, profileViews / 4);
    if (ratio >= 1.35) delta = Math.min(12, Math.round(ratio * 3));
    else if (ratio <= 0.7) delta = -Math.min(5, Math.round((1 - ratio) * 5));
  } else {
    const seed = String(person.id || person.name || '0')
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const offsets = [4, 2, 7, -1, 3, 1, 5, -2, 6];
    delta = offsets[seed % offsets.length];
  }

  return {
    total,
    delta,
    breakdown: {
      boxOffice: boxOfficePts,
      youtube: youtubePts,
      production: productionPts,
      theatre: theatrePts,
      prestige: prestigePts,
      momentum: momentumPts,
    },
  };
}

/**
 * Matches people born today (or within the current week/month as graceful fallback)
 * using Africa/Lagos calendar dates.
 */
export function selectBornTodayPeople(people = [], now = new Date()) {
  const lagosParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(now)
    .reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = Number(p.value);
      return acc;
    }, {});

  const todayMonth = lagosParts.month || now.getMonth() + 1;
  const todayDay = lagosParts.day || now.getDate();
  const todayYear = lagosParts.year || now.getFullYear();

  const withDob = (people || [])
    .filter((p) => p && p.date_of_birth && p.photo_url)
    .map((p) => {
      const raw = String(p.date_of_birth).slice(0, 10);
      const [yStr, mStr, dStr] = raw.split('-');
      const bYear = Number(yStr);
      const bMonth = Number(mStr);
      const bDay = Number(dStr);
      if (!bMonth || !bDay) return null;

      // Day distance within the calendar year (handles month wraps cleanly)
      const thisYearBday = Date.UTC(todayYear, bMonth - 1, bDay);
      const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
      let diffDays = Math.round((thisYearBday - todayUtc) / DAY_MS);
      if (diffDays < -180) diffDays += 365;
      if (diffDays > 180) diffDays -= 365;

      const age = bYear > 1900 && !p.is_deceased ? todayYear - bYear : null;
      const monthLabel = new Date(Date.UTC(2000, bMonth - 1, bDay)).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
      });

      return {
        ...p,
        _bMonth: bMonth,
        _bDay: bDay,
        _diffDays: diffDays,
        _age: age,
        _birthdayLabel: monthLabel,
        _isExactToday: bMonth === todayMonth && bDay === todayDay,
      };
    })
    .filter(Boolean);

  const exactToday = withDob.filter((p) => p._isExactToday);
  if (exactToday.length >= 3) {
    return {
      mode: 'today',
      label: 'Born Today',
      people: exactToday
        .sort((a, b) => (Number(b.popularity_score) || 0) - (Number(a.popularity_score) || 0))
        .slice(0, 10),
    };
  }

  // Graceful fallback: Born this week (±7 days), then this month
  const thisWeek = withDob
    .filter((p) => Math.abs(p._diffDays) <= 7)
    .sort((a, b) => Math.abs(a._diffDays) - Math.abs(b._diffDays) || (Number(b.popularity_score) || 0) - (Number(a.popularity_score) || 0));

  if (thisWeek.length >= 3) {
    return {
      mode: 'week',
      label: 'Celebrating This Week',
      people: thisWeek.slice(0, 10),
    };
  }

  const thisMonth = withDob
    .filter((p) => p._bMonth === todayMonth)
    .sort((a, b) => Math.abs(a._diffDays) - Math.abs(b._diffDays) || (Number(b.popularity_score) || 0) - (Number(a.popularity_score) || 0));

  return {
    mode: 'month',
    label: 'Born This Month',
    people: (thisMonth.length > 0 ? thisMonth : withDob).slice(0, 10),
  };
}
