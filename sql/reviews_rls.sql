-- Reviews access policy — the REAL enforcement of the review rules.
-- The client checks in useReviews.js/ReviewSection.jsx are UX only and are
-- trivially bypassable (the anon key is public), so these RLS policies are what
-- actually guarantee the product rules:
--   * only signed-in users can create a review, and only as themselves
--   * a review can be edited/deleted for 5 minutes after creation, then it is
--     permanent (the DB itself refuses changes afterwards)
--   * everyone can read reviews
--
-- Run this once in the Supabase SQL editor. Safe to re-run (drops policies first).

alter table public.reviews enable row level security;

-- Read: reviews are public.
drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews for select
  using (true);

-- Create: must be signed in, and the row must belong to the caller.
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Edit: only your own review, only within 5 minutes of creation.
-- (USING gates which rows you may target; WITH CHECK gates the new values.)
drop policy if exists "reviews_update_own_window" on public.reviews;
create policy "reviews_update_own_window"
  on public.reviews for update
  to authenticated
  using (auth.uid() = user_id and created_at > now() - interval '5 minutes')
  with check (auth.uid() = user_id);

-- Delete: only your own review, only within 5 minutes of creation.
drop policy if exists "reviews_delete_own_window" on public.reviews;
create policy "reviews_delete_own_window"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = user_id and created_at > now() - interval '5 minutes');
