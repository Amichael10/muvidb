-- Switch Genesis Cinemas from the AI-dependent `firecrawl` adapter to the new
-- deterministic `genesis` adapter (parses the Jacro WordPress plugin's HTML —
-- free, no AI provider needed). Resets the failure counter so they re-fetch.
--
-- Run once in the Supabase SQL editor.
UPDATE public.cinemas
SET scrape_adapter      = 'genesis',
    scrape_failure_count = 0,
    scrape_last_error    = NULL
WHERE (scrape_config->>'url') ILIKE '%genesiscinemas.com%'
  AND scrape_adapter = 'firecrawl';
