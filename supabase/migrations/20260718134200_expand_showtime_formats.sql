alter table public.showtimes
  drop constraint if exists showtimes_format_check;

alter table public.showtimes
  add constraint showtimes_format_check
  check (format in ('Standard', '2D', '3D', 'IMAX', '4DX', 'VIP', 'Recliner'));
