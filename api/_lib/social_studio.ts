import type { User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase.js';
import { parseGenerateDraftRequest } from './social-studio/domain/validation.js';
import type { SocialContentType } from './social-studio/domain/content-types.js';

export { parseGenerateDraftRequest };

type SocialActor = { id: string; email?: string; role: 'admin' };
type HttpError = Error & { status?: number };

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function bearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token && token !== 'undefined' ? token : null;
}

/** Authentication remains available to editorial tools that are not publishers. */
export async function requireSocialStudioAdmin(req: VercelRequest): Promise<SocialActor> {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Missing admin session');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw httpError(401, 'Invalid admin session');

  const user = data.user as User;
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile || !['admin', 'admin_limited'].includes(String(profile.role).toLowerCase())) {
    throw httpError(403, 'Administrator access required');
  }
  return { id: user.id, email: user.email, role: 'admin' };
}

const RETIRED_MESSAGE = 'The legacy Social Studio publishing pipeline has been retired while a new workflow is designed.';
async function retired(..._args: any[]): Promise<any> { throw httpError(410, RETIRED_MESSAGE); }

export function isSocialStudioEnabled(): boolean { return false; }
export function getSocialPublishMode(): 'disabled' { return 'disabled'; }
export async function requireSocialPublisherAuth(): Promise<void> { throw httpError(410, RETIRED_MESSAGE); }
export async function getSocialStudioSummary() { return { enabled: false, publishMode: 'disabled', retired: true }; }
export async function runSocialPublisher() { return { skipped: true, reason: 'legacy_social_publisher_retired', processed: 0, results: [] }; }
export async function pruneSocialAssets() { return { skipped: true, reason: 'legacy_social_publisher_retired', items: 0, objects: 0, bytes: 0 }; }

export const createEditorVideoDraft = retired;
export const resetSocialStudioData = retired;
export const publishContentItemNow = retired;
export const retryFailedVariants = retired;
export const createUniversalSocialPost = retired;
export const cleanupContentItemAssets = retired;
export const syncContentItemWithSource = retired;
export const syncAllScheduledContentItems = retired;
export const refreshStreamingPoster = retired;
export const generateSocialDraft = retired;
export const updateSocialVariantCaption = retired;
export const updateSocialVariantOptions = retired;
export const prepareSocialContentItemForEdit = retired;
export const updateSocialContentItemDraft = retired;
export const deleteSocialContentItem = retired;
export const reviewContentItem = retired;
export const scheduleContentItem = retired;
export const cancelContentSchedule = retired;
export const attachCustomAsset = retired;
export const updateSocialVariantAsset = retired;
export const attachCarouselAssets = retired;
export const reorderCarouselAssets = retired;
export const getEditorialCalendar = retired;
export const updateEditorialCalendarSlot = retired;
export const approveEditorialSlot = retired;
export const seedEditorialCalendarSlots = retired;

export type SocialReviewAction = 'submit' | 'approve' | 'reject' | 'request_changes';
export function isSocialReviewAction(value: unknown): value is SocialReviewAction {
  return ['submit', 'approve', 'reject', 'request_changes'].includes(String(value));
}

export function defaultContentTypeForSeries(seriesSlug: string, candidateType: string): SocialContentType {
  if (candidateType === 'play' || seriesSlug === 'whats_on_stage') return 'whats_on_stage';
  if (candidateType === 'person') return 'actor_spotlight';
  if (seriesSlug === 'critics_say' || seriesSlug === 'the_critic') return 'critics_say';
  if (seriesSlug === 'where_to_watch') return 'where_to_watch';
  if (seriesSlug === 'weekend_watchlist') return 'weekend_watchlist';
  if (seriesSlug === 'film_conversation') return 'film_conversation';
  return 'upcoming_movie';
}

export function defaultTemplateSlugForSeries(seriesSlug: string, candidateType: string): string {
  const aliases: Record<string, string> = {
    behind_the_camera: 'behind-camera-simple-v1',
    film_conversation: 'film-conversation-simple-v1',
    muvidb_by_the_numbers: 'by-the-numbers-simple-v1',
    new_and_upcoming: 'new-upcoming-simple-v1',
    one_film_two_takes: 'one-film-two-takes-simple-v1',
    stage_to_screen: 'stage-to-screen-simple-v1',
    the_critic: 'critic-spotlight-simple-v1',
    filmography: 'filmography-simple-v1',
    weekend_watchlist: 'weekend-watchlist-simple-v1',
    critics_say: 'critics-say-simple-v1',
    whats_on_stage: 'on-stage-simple-v1',
    where_to_watch: 'where-to-watch-simple-v1',
    you_know_the_face: 'you-know-the-face-simple-v1',
  };
  return aliases[seriesSlug] || (candidateType === 'person' ? 'you-know-the-face-simple-v1' : 'new-upcoming-simple-v1');
}

export function socialHttpErrorPayload(error: unknown) {
  const candidate = error as HttpError;
  return { status: candidate?.status || 500, message: candidate?.message || 'Unexpected error' };
}
