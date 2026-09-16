-- Migration: Grant reset queue & logs permissions to admin users and add reset RPC function

create or replace function public.reset_credit_harvest_queue_and_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin()) then
    raise exception 'Permission denied: admin access required';
  end if;

  delete from public.credit_candidates where status = 'pending';
  delete from public.credit_metadata_candidates where status = 'pending';
  delete from public.credit_harvest_logs;
  delete from public.credit_harvest_jobs;
end;
$$;

grant execute on function public.reset_credit_harvest_queue_and_logs() to authenticated;

grant select, delete on public.credit_harvest_logs to authenticated;
grant select, delete on public.credit_harvest_jobs to authenticated;

drop policy if exists "credit_harvest_logs admin delete" on public.credit_harvest_logs;
create policy "credit_harvest_logs admin delete" on public.credit_harvest_logs
  for delete to authenticated using (public.is_admin());

drop policy if exists "credit_harvest_jobs admin delete" on public.credit_harvest_jobs;
create policy "credit_harvest_jobs admin delete" on public.credit_harvest_jobs
  for delete to authenticated using (public.is_admin());
