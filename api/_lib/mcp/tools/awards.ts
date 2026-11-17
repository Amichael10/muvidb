import { supabase, withRetry } from '../db.js';

export async function getAwardsAndNominations(args: {
  organization?: string;
  year?: number;
  work?: string;
  person?: string;
  winners_only?: boolean;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit || 30, 1), 100);

  // Fetch films with awards
  let query = supabase.from('films').select('id, title, year, poster_url, awards').not('awards', 'is', null);

  if (args.work) {
    query = query.ilike('title', `%${args.work.trim()}%`);
  }

  const { data: films } = await withRetry(() => query.limit(200));

  const results: any[] = [];

  for (const f of films || []) {
    if (!Array.isArray(f.awards)) continue;
    for (const a of f.awards) {
      if (args.organization) {
        const orgMatch = (a.organization || '').toLowerCase() === args.organization.toLowerCase();
        if (!orgMatch) continue;
      }
      if (args.year) {
        if (a.year !== args.year) continue;
      }
      if (args.winners_only) {
        if (a.won !== true) continue;
      }
      if (args.person) {
        const cleanP = args.person.toLowerCase().trim();
        const hasRecipient = Array.isArray(a.recipients) && a.recipients.some((r: string) => r.toLowerCase().includes(cleanP));
        if (!hasRecipient && !((a.nominee || '').toLowerCase().includes(cleanP))) continue;
      }

      results.push({
        organization: a.organization,
        year: a.year,
        edition: a.season || a.edition,
        category: a.category,
        film_id: f.id,
        work: f.title,
        poster_url: f.poster_url,
        recipients: a.recipients || (a.nominee ? [a.nominee] : []),
        won: a.won === true,
        status: a.won === true ? 'Winner' : 'Nominee'
      });
    }
  }

  // Sort by year desc
  results.sort((a, b) => (b.year || 0) - (a.year || 0));

  return {
    total_found: results.length,
    returned_count: Math.min(results.length, limit),
    awards: results.slice(0, limit)
  };
}
