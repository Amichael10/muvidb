-- Expand the admin film taxonomy without duplicating existing genre names.
insert into public.genres (name)
select proposed.name
from unnest(array[
  'Adventure', 'Coming of Age', 'Experimental', 'Fantasy', 'History',
  'Legal Drama', 'Music', 'Period Drama', 'Political', 'Psychological',
  'Satire', 'Science Fiction', 'Sport', 'Suspense', 'War', 'Western'
]) as proposed(name)
where not exists (
  select 1
  from public.genres existing
  where lower(trim(existing.name)) = lower(proposed.name)
);
