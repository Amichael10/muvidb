import dotenv from 'dotenv';
dotenv.config();

// Collect every configured Firecrawl key. Supports the primary FIRECRAWL_API_KEY
// plus numbered fallbacks (FIRECRAWL_API_KEY_2 … _5). Each key carries its own
// credit balance, so rotating across them multiplies the search ceiling.
const FIRECRAWL_KEYS: string[] = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
  process.env.FIRECRAWL_API_KEY_4,
  process.env.FIRECRAWL_API_KEY_5,
].filter((k): k is string => !!k && k.trim().length > 0);

let fcKeyIdx = 0; // persists across calls so we stay on a working key

// A key is "dead" (rotate to the next) when it's out of credits (402), rate-
// limited (429), or rejected as invalid/unauthorized (401/403).
const fcKeyDead = (status: number) =>
  status === 402 || status === 429 || status === 401 || status === 403;

/**
 * POST to Firecrawl /v1/search with automatic key rotation. Returns the parsed
 * JSON on success, or null when every key is unusable / the request fails.
 */
async function firecrawlSearch(body: Record<string, unknown>): Promise<any | null> {
  if (!FIRECRAWL_KEYS.length) {
    console.warn('FIRECRAWL_API_KEY is missing. Search skipped.');
    return null;
  }

  let lastDetail = '';
  // Try each key at most once per call, starting from the current one.
  for (let attempt = 0; attempt < FIRECRAWL_KEYS.length; attempt++) {
    const key = FIRECRAWL_KEYS[fcKeyIdx];
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) return await response.json();

      const errorText = await response.text();
      lastDetail = `${response.status}: ${errorText.slice(0, 140)}`;

      if (fcKeyDead(response.status)) {
        console.warn(`[firecrawl] key #${fcKeyIdx + 1}/${FIRECRAWL_KEYS.length} unusable (${response.status}), rotating…`);
        fcKeyIdx = (fcKeyIdx + 1) % FIRECRAWL_KEYS.length;
        continue; // retry with the next key
      }

      // Non-rotatable error (e.g. 400/500) — don't burn other keys on it.
      console.error(`Firecrawl Search Failed [${response.status}]:`, errorText);
      return null;
    } catch (error: any) {
      lastDetail = error?.message ?? String(error);
      fcKeyIdx = (fcKeyIdx + 1) % FIRECRAWL_KEYS.length;
    }
  }

  console.error(`Firecrawl: all ${FIRECRAWL_KEYS.length} key(s) unusable (${lastDetail})`);
  return null;
}

export async function searchActorBio(actorName: string): Promise<string> {
  const data = await firecrawlSearch({
    query: `${actorName} Nollywood biography Instagram Facebook`,
    limit: 3, // Get top 3 results for context
    scrapeOptions: { formats: ['markdown'] },
  });

  if (!data?.success || !data.data?.length) return '';

  // Combine the markdown results into a single context block
  let context = `Search Results for "${actorName}":\n\n`;
  for (const result of data.data) {
    context += `Source: ${result.url}\n`;
    context += `Content:\n${result.markdown?.substring(0, 2000) || result.description || ''}\n\n`;
  }
  return context;
}

export async function searchDiscoverList(region: string): Promise<string> {
  const data = await firecrawlSearch({
    query: `upcoming ${region} nollywood actors listicle 2024 2025`,
    limit: 3,
    scrapeOptions: { formats: ['markdown'] },
  });

  if (!data?.success || !data.data) return '';

  let context = `Search Results for Discovery:\n\n`;
  for (const result of data.data) {
    context += `Source: ${result.url}\n`;
    context += `Content:\n${result.markdown?.substring(0, 3000) || result.description || ''}\n\n`;
  }
  return context;
}
