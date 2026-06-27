-- Fix: admin "People" search throws "permission denied for function
-- get_people_with_counts" (Postgres 42501). The function exists and works, but
-- the `authenticated` role (logged-in admins) was never granted EXECUTE in prod,
-- so every search fails. Service role works, which is why backend scripts didn't
-- surface it. Grant EXECUTE to authenticated (and keep anon revoked).
--
-- Run once in the Supabase SQL editor.

REVOKE EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) TO service_role;
