-- Keep destination approval rows and activity history in sync with Social Studio.
create or replace function public.sync_content_channel_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare destination uuid;
begin
  select destination_id into destination from public.social_content_items where id = new.content_item_id;
  if destination is not null then
    insert into public.content_channel_approvals(content_item_id, destination_id, platform, status)
    values (new.content_item_id, destination, new.platform::text, case when new.status::text = 'published' then 'published' else 'pending' end)
    on conflict (content_item_id, destination_id, platform) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists social_variant_channel_approval_sync on public.social_platform_variants;
create trigger social_variant_channel_approval_sync after insert on public.social_platform_variants
  for each row execute function public.sync_content_channel_approval();

create or replace function public.sync_content_channel_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text in ('approved','rejected','published') then
    update public.content_channel_approvals
      set status = new.status::text, reviewed_at = case when new.status::text in ('approved','rejected') then now() else reviewed_at end,
          updated_at = now()
      where content_item_id = new.id;
  end if;
  if old.status is distinct from new.status then
    insert into public.content_engine_activity_logs(content_item_id, destination_id, event_type, status, message, metadata)
      values (new.id, new.destination_id, 'content_status_changed', 'success', old.status::text || ' → ' || new.status::text,
        jsonb_build_object('from', old.status::text, 'to', new.status::text));
  end if;
  return new;
end;
$$;

drop trigger if exists social_content_engine_status_sync on public.social_content_items;
create trigger social_content_engine_status_sync after update of status on public.social_content_items
  for each row execute function public.sync_content_channel_status();
