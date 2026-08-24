import type { CandidateEntity } from './candidate_service.js';
import { classifyFilmLifecycle, getSeriesIntent } from './candidate_strategy.js';

export type EditorialEventSignal = {
  entityId?: string | null;
  title?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  urgency?: string | null;
};

export type EditorialAssessment = {
  eligible: boolean;
  score: number;
  whyNow: string;
  reasons: string[];
  warnings: string[];
  signals: {
    timeliness: number;
    audience: number;
    currentProject: number;
    visual: number;
    completeness: number;
    conversation: number;
    priority: number;
    penalties: number;
  };
};

export type EditorialRankingContext = {
  referenceDate?: Date;
  recentlyFeaturedIds?: Set<string>;
  reservedIds?: Set<string>;
  reservedIdentities?: Set<string>;
  eventsByEntityId?: Map<string, EditorialEventSignal[]>;
};

const DAY_MS = 86_400_000;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown): number | null {
  if (!value) return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function hasMeaningfulImage(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  return !/(placeholder|no[-_ ]?poster|no[-_ ]?image|default[-_ ]?(poster|profile)|missing[-_ ]?image|lorem[-_ ]?ipsum)/i.test(url);
}

export function editorialIdentity(candidate: CandidateEntity): string {
  const raw = candidate.type === 'movie'
    ? String(candidate.name || '').split('|')[0].replace(/\([^)]*\)/g, '')
    : String(candidate.name || '');
  return raw
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[’']/g, '')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bs\b$/g, '')
    .trim();
}

function recentCredit(candidate: CandidateEntity, referenceDate: Date): { title: string; year?: number } | null {
  const knownFor = Array.isArray(candidate.data?.knownFor) ? candidate.data.knownFor : [];
  const minimumYear = referenceDate.getFullYear() - 1;
  const match = knownFor.find((credit: any) => numberValue(credit?.year) >= minimumYear);
  return match?.title ? { title: String(match.title), year: numberValue(match.year) || undefined } : null;
}

function activeEvent(candidate: CandidateEntity, context: EditorialRankingContext): EditorialEventSignal | null {
  return context.eventsByEntityId?.get(candidate.id)?.[0] || null;
}

function eventDescription(event: EditorialEventSignal): string {
  const type = String(event.eventType || '').replace(/_/g, ' ');
  if (event.title) return String(event.title);
  return type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'Current editorial event';
}

export function assessEditorialCandidate(
  candidate: CandidateEntity,
  seriesSlug: string,
  context: EditorialRankingContext = {},
): EditorialAssessment {
  const referenceDate = context.referenceDate || new Date();
  const intent = getSeriesIntent(seriesSlug);
  const data = candidate.data || {};
  const reasons: string[] = [];
  const warnings: string[] = [];
  const event = activeEvent(candidate, context);
  const imageReady = hasMeaningfulImage(candidate.imageUrl);
  const isReserved = context.reservedIds?.has(candidate.id) || context.reservedIdentities?.has(editorialIdentity(candidate));
  const isCoolingDown = context.recentlyFeaturedIds?.has(candidate.id);

  let timeliness = 0;
  let audience = 0;
  let currentProject = 0;
  let visual = imageReady ? 10 : 0;
  let completeness = Math.min(10, Math.round(numberValue(candidate.completenessScore || 0.6) * 10));
  let conversation = 0;
  let priority = 0;
  let penalties = 0;
  let whyNow = '';

  if (!imageReady) warnings.push('No reliable editorial image');
  if (event) {
    timeliness = event.urgency === 'urgent' ? 30 : event.urgency === 'high' ? 27 : 23;
    priority = 5;
    whyNow = eventDescription(event);
    reasons.push(`Current event: ${whyNow}`);
  }

  if (candidate.type === 'person') {
    const credits = Math.max(0, numberValue(data.film_count));
    const popularity = Math.max(0, numberValue(data.popularity_score));
    const profileViews = Math.max(0, numberValue(data.profile_views));
    const knownFor = Array.isArray(data.knownFor) ? data.knownFor : [];
    const currentCredit = recentCredit(candidate, referenceDate);
    const hasContext = Boolean(data.bio && (data.handle || data.instagram_url || knownFor.length >= 3));

    // Logarithmic/capped audience scoring prevents bad raw counters from taking over.
    audience = Math.min(20, Math.round(
      Math.log10(1 + popularity) * 2.4 +
      Math.log10(1 + profileViews) * 2.5 +
      Math.min(credits, 40) / 5,
    ));
    conversation = Math.min(10, knownFor.length * 2 + (data.bio ? 3 : 0));

    if (currentCredit) {
      currentProject = 15;
      if (!whyNow) {
        timeliness = 22;
        whyNow = `Connected to the recent project ${currentCredit.title}`;
      }
      reasons.push(`Recent verified credit: ${currentCredit.title}`);
    }

    if (!whyNow && audience >= 12 && credits >= 8) {
      timeliness = 12;
      whyNow = 'Strong audience recognition and a substantial verified filmography';
    }

    if (intent === 'people' && /face|rising|supporting/i.test(seriesSlug)) {
      const emergingRange = credits >= 3 && credits <= 15;
      if (!emergingRange) warnings.push('Outside the emerging-talent credit range');
      if (!currentCredit) warnings.push('No recent verified project connection');
      if (!hasContext) warnings.push('Insufficient context to introduce this professional');
      if (!emergingRange || !currentCredit || !hasContext) penalties -= 45;
      reasons.push('Evaluated as emerging talent');
    } else if (credits < 3 || knownFor.length === 0) {
      warnings.push('Filmography is too thin for a standalone profile feature');
      penalties -= 40;
    }

    if (intent === 'crew' && !data.department && !data.known_for_department) {
      warnings.push('No verified craft department');
      penalties -= 35;
    }
  } else if (candidate.type === 'movie') {
    const lifecycle = data.lifecycle || classifyFilmLifecycle(data, referenceDate);
    const views = Math.max(0, numberValue(data.view_count));
    const rating = Math.max(0, numberValue(data.liked_percent || data.imdb_rating));
    const synopsisReady = typeof data.synopsis === 'string' && data.synopsis.trim().length >= 40;
    const release = dateValue(data.release_date);
    const daysFromRelease = release === null ? null : Math.round((release - referenceDate.getTime()) / DAY_MS);

    audience = Math.min(20, Math.round(Math.log10(1 + views) * 4 + (rating > 0 ? 5 : 0)));
    conversation = Math.min(10, (synopsisReady ? 6 : 0) + (Array.isArray(data.topCast) && data.topCast.length ? 2 : 0) + (rating > 0 ? 2 : 0));
    completeness = Math.min(10, completeness + (synopsisReady ? 2 : 0));

    if (lifecycle === 'now_streaming' && data.platformDisplayName) {
      timeliness = 30;
      currentProject = 15;
      priority = ['NolliStream', 'Docuth'].includes(data.platformDisplayName) ? 5 : 3;
      whyNow = `Now available on ${data.platformDisplayName}`;
      reasons.push(whyNow);
    } else if (lifecycle === 'upcoming' && daysFromRelease !== null && daysFromRelease >= 0) {
      timeliness = daysFromRelease <= 30 ? 30 : daysFromRelease <= 90 ? 25 : 18;
      currentProject = data.trailer_youtube_id || data.trailer_external_url ? 15 : 10;
      whyNow = `Releases in ${daysFromRelease} day${daysFromRelease === 1 ? '' : 's'}`;
      reasons.push(whyNow);
    } else if (lifecycle === 'now_in_cinemas') {
      timeliness = 28;
      currentProject = 15;
      whyNow = 'Currently in cinemas';
      reasons.push(whyNow);
    } else if (!whyNow && (views > 0 || rating > 0) && synopsisReady) {
      timeliness = 10;
      whyNow = 'Verified audience activity makes it suitable for conversation';
    }

    if (!synopsisReady && intent === 'catalogue') {
      warnings.push('Not enough story context for a conversation post');
      penalties -= 30;
    }
    if (intent === 'critics' && !data.criticReview?.quote) {
      warnings.push('No verified critic material');
      penalties -= 60;
    }
  } else if (candidate.type === 'play') {
    const start = dateValue(data.run_start_date);
    const end = dateValue(data.run_end_date);
    const active = (!start || start <= referenceDate.getTime() + 30 * DAY_MS) && (!end || end >= referenceDate.getTime());
    timeliness = active ? 30 : 0;
    currentProject = active ? 15 : 0;
    conversation = data.synopsis ? 8 : 4;
    whyNow = active ? `Current or upcoming stage production${data.venue ? ` at ${data.venue}` : ''}` : '';
    if (!active) {
      warnings.push('Theatre production is not currently actionable');
      penalties -= 60;
    }
  }

  if (isCoolingDown) {
    warnings.push('Featured within the editorial cooldown window');
    penalties -= 100;
  }
  if (isReserved) {
    warnings.push('Already selected elsewhere in this plan');
    penalties -= 100;
  }
  if (!whyNow) {
    warnings.push('No defensible “why now” signal');
    penalties -= 35;
  }
  if (!imageReady) penalties -= 40;

  const rawScore = timeliness + audience + currentProject + visual + completeness + conversation + priority + penalties;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const eligible = score >= 55 && penalties > -60 && Boolean(whyNow) && imageReady;

  reasons.push(`Editorial score: ${score}/100`);
  return {
    eligible,
    score,
    whyNow: whyNow || 'No timely editorial reason available',
    reasons,
    warnings,
    signals: { timeliness, audience, currentProject, visual, completeness, conversation, priority, penalties },
  };
}

export function rankEditorialCandidates(
  candidates: CandidateEntity[],
  seriesSlug: string,
  context: EditorialRankingContext = {},
): Array<{ candidate: CandidateEntity; assessment: EditorialAssessment }> {
  const seen = new Set<string>();
  return (candidates || [])
    .map(candidate => ({ candidate, assessment: assessEditorialCandidate(candidate, seriesSlug, context) }))
    .filter(({ candidate, assessment }) => {
      const identity = editorialIdentity(candidate);
      if (!assessment.eligible || !identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .sort((a, b) => b.assessment.score - a.assessment.score || a.candidate.name.localeCompare(b.candidate.name));
}

export function shouldSuppressCalendarSlot(input: {
  status?: string;
  seriesSlug: string;
  dailyPeopleCount: number;
  weeklyPeopleCount: number;
  seriesAlreadyUsedToday: boolean;
}): string | null {
  if (input.status && input.status !== 'planned') return null;
  const intent = getSeriesIntent(input.seriesSlug);
  const isDailyProfile = intent === 'people' || intent === 'crew';
  if (input.seriesAlreadyUsedToday) return 'Duplicate content series on the same day';
  if (isDailyProfile && input.dailyPeopleCount >= 1) return 'Only one professional/profile feature is allowed per day';
  if (intent === 'people' && input.weeklyPeopleCount >= 2) return 'Weekly professional/profile feature limit reached';
  return null;
}
