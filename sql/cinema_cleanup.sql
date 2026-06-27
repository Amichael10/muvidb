-- Cinema scraper cleanup.
-- 1. Disable cinemas pointed at the non-existent `custom` adapter. There is no
--    `custom` in the adapter registry, so these have been silently skipped every
--    run while still appearing "enabled". Turn them off until a real adapter
--    exists, so the scrape list reflects reality.
UPDATE public.cinemas
SET scrape_enabled = false
WHERE scrape_adapter = 'custom';

-- 2. Disable veezi rows with no siteToken — these are duplicate Silverbird rows
--    of locations we already scrape via a sibling row that DOES have the token
--    (e.g. "Galleria VI" dup of "Galleria", "Jabi Lake Mall" dup of "Jabi Lake").
UPDATE public.cinemas
SET scrape_enabled = false
WHERE scrape_adapter = 'veezi'
  AND (scrape_config->>'siteToken') IS NULL;
