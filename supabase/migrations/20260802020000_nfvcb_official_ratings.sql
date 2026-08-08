-- Align the nfvcb_rating enum with the official NFVCB classification set.
--
-- The Board publishes seven symbols (nfvcb.gov.ng/classification):
--   G, PG, 12, 12A, 15, 18, RE
--
-- The enum currently holds: G, PG, PG-13, 15, 18
--
--   - '12', '12A' and 'RE' were missing entirely.
--   - 'PG-13' is an American MPAA rating, not a Nigerian one. It is the most
--     used value in the table (307 films) and is left in place here; remapping
--     those rows is a separate, reversible data migration once the target is
--     decided ('12' is a hard age bar, '12A' is advisory — PG-13 is advisory,
--     so 12A is the closer match by meaning).
--
-- Postgres cannot drop a value from an enum in place, so retiring 'PG-13'
-- later means recreating the type. Nothing here removes it.
--
-- ALTER TYPE ... ADD VALUE is safe inside a transaction on PG12+ provided the
-- new values are not used in the same transaction. They are not.

alter type public.nfvcb_rating add value if not exists '12' after 'PG';
alter type public.nfvcb_rating add value if not exists '12A' after '12';
alter type public.nfvcb_rating add value if not exists 'RE' after '18';

comment on type public.nfvcb_rating is
  'Official NFVCB classification. NULL means the film has not been classified '
  '— it does not mean unrestricted. PG-13 is a legacy MPAA value pending remap.';
