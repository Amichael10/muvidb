/**
 * Vercel SSR entry (invert packaging).
 *
 * Do NOT set framework:"react-router" / vercelPreset() — that zeroes out api/.
 * Catch-all document routes rewrite here; /api/* stay as separate functions.
 * See docs/WORK_LOG.md § "The fix: invert it".
 */
import { handleSsrRequest } from './_lib/rrHandler';

export default function ssr(request: Request): Promise<Response> {
  return handleSsrRequest(request);
}
