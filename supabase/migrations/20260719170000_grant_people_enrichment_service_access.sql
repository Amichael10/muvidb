-- Server-side enrichment jobs use the service role. Table privileges are
-- still required even though that role bypasses row-level security.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.people_enrichment_queue
  TO service_role;

GRANT SELECT, INSERT
  ON TABLE public.people_enrichment_history
  TO service_role;
