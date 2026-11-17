import { supabase, withRetry } from '../db.js';

export async function getBoxOfficeRankings(args: {
  timeframe?: 'all_time' | 'yearly';
  year?: number;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50);

  let query = supabase
    .from('films')
    .select('id, title, year, poster_url, distributor, box_office_domestic, box_office_worldwide, box_office_currency')
    .not('box_office_domestic', 'is', null)
    .order('box_office_domestic', { ascending: false })
    .limit(limit);

  if (args.year) {
    query = query.eq('year', args.year);
  }

  const { data: films } = await withRetry(() => query);

  const rankings = (films || []).map((f: any, idx: number) => ({
    rank: idx + 1,
    id: f.id,
    title: f.title,
    year: f.year,
    poster_url: f.poster_url,
    distributor: f.distributor,
    currency: f.box_office_currency || 'NGN',
    domestic_gross: f.box_office_domestic,
    formatted_domestic_gross: f.box_office_domestic ? `₦${Number(f.box_office_domestic).toLocaleString()}` : 'N/A',
    worldwide_gross: f.box_office_worldwide
  }));

  return {
    timeframe: args.year ? `Year ${args.year}` : 'All-Time Nollywood Domestic Box Office',
    results_count: rankings.length,
    rankings
  };
}
