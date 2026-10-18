/** Never send account mentions from Social Studio. Preserve known display names. */
export function namesOnlyCaption(caption: string, snapshot?: any): string {
  const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
  const people = [snapshot, ...list(snapshot?.topCast), ...list(snapshot?.cast), ...list(snapshot?.creditedPeople)].filter(Boolean);
  const names = new Map<string, string>();
  for (const person of people) {
    if (!person.name) continue;
    for (const handle of [person.handle, person.instagramHandle, person.tiktokHandle]) {
      if (typeof handle === 'string' && handle.startsWith('@')) names.set(handle.toLowerCase(), person.name);
    }
  }
  return caption.replace(/(^|[^\w@])(@[a-zA-Z0-9._]+)/g, (_match, prefix, token) => `${prefix}${names.get(token.toLowerCase()) || ''}`).trim();
}
