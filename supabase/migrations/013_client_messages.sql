-- 013_client_messages.sql — Client portal Stage 3: turn one-way contact messages into
-- a two-way thread between a client and the site owner. Messages are keyed by the
-- client's email (the thread key); a `sender` marks who wrote each line.
-- Existing rows default to 'client' (they came from the public contact form).

-- 1) Direction of each message.
alter table public.messages
  add column if not exists sender text not null default 'client';

do $$
begin
  alter table public.messages
    add constraint messages_sender_chk check (sender in ('client', 'owner'));
exception
  when duplicate_object then null;
end $$;

-- 2) Let an authenticated OWNER insert their own messages (replies). Reads/updates/
--    deletes already owner-scoped (007). Client sends go through send_my_message below.
drop policy if exists "owner inserts own messages" on public.messages;
create policy "owner inserts own messages" on public.messages
  for insert with check (auth.uid() = owner_id);

-- 3) The signed-in client's full thread with the portal's owner (both directions),
--    oldest first. Bridged by the VERIFIED auth email; owner from the trusted slug.
create or replace function public.get_my_messages(p_site_slug text)
returns table (
  id         uuid,
  sender     text,
  name       text,
  body       text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id,
         m.sender,
         case when m.sender = 'owner' then null else m.name end as name,  -- never ship the owner's name/email to clients
         m.body,
         m.created_at
  from public.messages m
  where m.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by m.created_at asc;
$$;

grant execute on function public.get_my_messages(text) to authenticated;

-- 4) The signed-in client posts a message into their thread. owner + email + name
--    come from trusted sources (sites / JWT / clients), never from caller input.
--    Body trimmed + capped; marked unread so it surfaces in the owner inbox.
create or replace function public.send_my_message(p_site_slug text, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_email text;
  v_name  text;
  v_body  text;
begin
  v_email := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  if v_email is null then
    return 'error';
  end if;

  v_body := nullif(btrim(coalesce(p_body, '')), '');
  if v_body is null then
    return 'error';
  end if;
  v_body := left(v_body, 5000);

  select owner_id into v_owner from public.sites where slug = p_site_slug limit 1;
  if v_owner is null then
    return 'error';
  end if;

  -- Light per-client flood guard (mirrors submit_message in 010): at most 20 of
  -- this client's messages to this owner per rolling minute. Scoped to the
  -- sender's email so one spammer can't block other clients of the same owner.
  if (select count(*) from public.messages
        where owner_id = v_owner
          and lower(email) = v_email
          and created_at > now() - interval '1 minute') >= 20 then
    return 'error';
  end if;

  select coalesce(name, v_email) into v_name
  from public.clients
  where user_id = auth.uid() and owner_id = v_owner;
  if v_name is null then
    v_name := v_email;
  end if;

  insert into public.messages (owner_id, site_slug, name, email, body, read, sender)
  values (v_owner, p_site_slug, v_name, v_email, v_body, false, 'client');

  return 'ok';
end;
$$;

grant execute on function public.send_my_message(text, text) to authenticated;
