-- Add AI genre to public.genres table
insert into public.genres (name)
select 'AI'
where not exists (
  select 1
  from public.genres existing
  where lower(trim(existing.name)) = 'ai'
);
