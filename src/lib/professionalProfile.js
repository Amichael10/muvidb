const hasText = (value) => Boolean(String(value || '').trim());

export const PROFILE_CHECKS = [
  { key: 'photo', label: 'Add a professional headshot', test: (person) => hasText(person?.photo_url) },
  { key: 'bio', label: 'Write a short professional bio', test: (person) => hasText(person?.bio) },
  { key: 'department', label: 'Choose your primary profession', test: (person) => hasText(person?.known_for_department) },
  { key: 'nationality', label: 'Add your nationality', test: (person) => hasText(person?.nationality) },
  { key: 'birthplace', label: 'Add your birthplace', test: (person) => hasText(person?.birthplace) },
  {
    key: 'social',
    label: 'Connect at least one professional social',
    test: (person) => ['instagram_url', 'twitter_url', 'tiktok_url', 'facebook_url', 'youtube_channel_id', 'youtube_handle'].some((key) => hasText(person?.[key])),
  },
  { key: 'credit', label: 'Publish your first verified credit', test: (_person, credits) => (credits?.length || 0) > 0 },
];

export function getProfileProgress(person, credits = []) {
  const checks = PROFILE_CHECKS.map((check) => ({ ...check, complete: check.test(person, credits) }));
  const completed = checks.filter((check) => check.complete).length;
  return { checks, completed, total: checks.length, percent: Math.round((completed / checks.length) * 100) };
}

export function getChangedProfileFields(person, values) {
  const fields = {};
  for (const [key, rawValue] of Object.entries(values || {})) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    const current = person?.[key] == null ? '' : String(person[key]).trim();
    if (String(value || '') !== current) fields[key] = value || null;
  }
  return fields;
}
