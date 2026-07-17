-- Credits are public catalogue data used by actor and film detail pages.
alter table public.credits enable row level security;

drop policy if exists "credits_public_read" on public.credits;
create policy "credits_public_read"
on public.credits
for select
to anon, authenticated
using (true);

grant select on table public.credits to anon, authenticated;
