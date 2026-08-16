-- Let the admin notification bell update as soon as an actor claim changes.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profile_claims'
  ) then
    alter publication supabase_realtime add table public.profile_claims;
  end if;
end $$;
