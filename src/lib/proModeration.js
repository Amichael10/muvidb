import { authHeaders } from './apiAuth';
import { suggestPersonEdit } from './contributions';

/**
 * Notifies the Admin via Telegram whenever a verified Pro actor proposes
 * updates (Guilds, Representation, Awards, Media, or Credits) for approval.
 */
export async function notifyProAdminOnTelegram({
  personId,
  personName,
  personSlug,
  updateType = 'general',
  summary = '',
  details = '',
  link = '/admin/contributions'
}) {
  try {
    const res = await fetch('/api/actor-claims', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        action: 'notify-pro-update',
        personId,
        personName,
        personSlug,
        updateType,
        summary,
        details,
        link
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to send Telegram notification to admin:', err);
    return false;
  }
}

/**
 * Submits a proposed update to the `contributions` queue for admin approval,
 * and alerts the editorial admin team immediately on Telegram.
 */
export async function submitProProfileUpdate({
  person,
  updateType,
  proposedFields,
  summary,
  details
}) {
  try {
    const res = await suggestPersonEdit({
      personId: person.id,
      fields: proposedFields,
      note: summary || `Pro Update (${updateType}) submitted for editorial review.`
    });

    if (!res.ok) {
      throw res.error || new Error('Failed to submit contribution.');
    }

    // Trigger Telegram notification in background
    notifyProAdminOnTelegram({
      personId: person.id,
      personName: person.name,
      personSlug: person.slug,
      updateType,
      summary,
      details,
      link: '/admin/contributions'
    }).catch((err) => console.warn('Telegram notification error:', err));

    return { ok: true };
  } catch (err) {
    console.error('submitProProfileUpdate failed:', err);
    return { ok: false, error: err };
  }
}
