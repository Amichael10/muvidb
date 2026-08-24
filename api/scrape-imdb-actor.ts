import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './_lib/scrape_imdb_actor_handler.js';

export const maxDuration = 60;

export default async function scrapeImdbActor(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
