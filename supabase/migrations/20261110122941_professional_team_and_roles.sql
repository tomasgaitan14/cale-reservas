-- Equipo, roles e invitaciones. Los permisos administrativos se verifican en la base,
-- no solo ocultando botones en el cliente.

alter table public.business_members
  add column display_name text,
  add column email text,
  add column created_at timestamptz not null default now();

alter table public.business_members
  add constraint business_members_role_check
  check (role in ('owner', 'admin', 'professional'));

update public.business_members member
set
  email = lower(auth_user.email),
  display_name = coalesce(
    nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(auth_user.email, ''), '@', 1)
  )
from auth.users auth_user
where auth_user.id = member.user_id;

create index business_members_business_role_idx
  on public.business_members (business_id, role);

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'professional')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint business_invitations_email_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint business_invitations_display_name_length check (char_length(btrim(display_name)) between 1 and 80)
);

create unique index business_invitations_one_pending_email
  on public.business_invitations (business_id, lower(email))
  where status = 'pending';

create index business_invitations_business_status_idx
  on public.business_invitations (business_id, status, created_at desc);

alter table public.business_invitations enable row level security;
revoke all privileges on public.business_invitations from anon, authenticated;
grant select on public.business_invitations to authenticated;
grant all privileges on public.business_invitations to service_role;

create or replace function public.is_business_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  );
$$;

revoke execute on function public.is_business_admin(uuid) from public, anon;
grant execute on function public.is_business_admin(uuid) to authenticated;

drop policy if exists "members read their memberships" on public.business_members;
create policy "members read their memberships"
  on public.business_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_business_admin(business_id));

create policy "admins read their invitations"
  on public.business_invitations for select to authenticated
  using (public.is_business_admin(business_id));

revoke insert, update, delete on public.business_members from authenticated;
grant select on public.business_members to authenticated;

-- Al crear el negocio, el primer miembro conserva su identidad visible para el equipo.
create or replace function public.create_business(p_name text, p_slug text, p_whatsapp text)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_business public.businesses;
  current_user_record auth.users;
begin
  if exists (select 1 from public.reserved_slugs where slug = p_slug) then
    raise exception 'slug_reserved' using errcode = '23514';
  end if;

  select * into current_user_record from auth.users where id = (select auth.uid());
  if current_user_record.id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.businesses (name, slug, whatsapp)
  values (p_name, p_slug, p_whatsapp)
  returning * into new_business;

  insert into public.business_members (business_id, user_id, role, display_name, email)
  values (
    new_business.id,
    current_user_record.id,
    'owner',
    coalesce(
      nullif(btrim(current_user_record.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(current_user_record.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(current_user_record.email, ''), '@', 1)
    ),
    lower(current_user_record.email)
  );

  return new_business;
end;
$$;

-- Solo owner/admin pueden administrar invitaciones y roles. Un admin no puede modificar a otro admin.
create function public.change_business_member_role(p_business_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role
  from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());
  if caller_role not in ('owner', 'admin') then
    raise exception 'not_business_admin' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'professional') then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;

  select role into target_role
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
  if target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'owner_role_locked' using errcode = '42501';
  end if;
  if caller_role = 'admin' and target_role <> 'professional' then
    raise exception 'admin_can_only_manage_professionals' using errcode = '42501';
  end if;

  update public.business_members
  set role = p_role
  where business_id = p_business_id and user_id = p_user_id;
end;
$$;

create function public.remove_business_member(p_business_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role
  from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());
  if caller_role not in ('owner', 'admin') then
    raise exception 'not_business_admin' using errcode = '42501';
  end if;
  select role into target_role
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
  if target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if target_role = 'owner' or p_user_id = (select auth.uid()) then
    raise exception 'owner_or_self_locked' using errcode = '42501';
  end if;
  if caller_role = 'admin' and target_role <> 'professional' then
    raise exception 'admin_can_only_manage_professionals' using errcode = '42501';
  end if;

  delete from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
end;
$$;

create function public.revoke_business_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_business_id uuid;
  caller_role text;
begin
  select business_id into invitation_business_id
  from public.business_invitations
  where id = p_invitation_id and status = 'pending';
  if invitation_business_id is null then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  select role into caller_role
  from public.business_members
  where business_id = invitation_business_id and user_id = (select auth.uid());
  if caller_role not in ('owner', 'admin') then
    raise exception 'not_business_admin' using errcode = '42501';
  end if;
  update public.business_invitations set status = 'revoked' where id = p_invitation_id;
end;
$$;

create function public.claim_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  invitation record;
  claimed_count integer := 0;
begin
  if current_user_id is null then return 0; end if;
  select lower(email) into current_email from auth.users where id = current_user_id;
  if current_email is null then return 0; end if;

  for invitation in
    select *
    from public.business_invitations
    where lower(email) = current_email
      and status = 'pending'
      and expires_at > now()
    order by created_at
  loop
    insert into public.business_members (business_id, user_id, role, display_name, email)
    values (invitation.business_id, current_user_id, invitation.role, invitation.display_name, current_email)
    on conflict (business_id, user_id) do update
      set role = case when public.business_members.role = 'owner' then 'owner' else excluded.role end,
          display_name = coalesce(nullif(excluded.display_name, ''), public.business_members.display_name),
          email = excluded.email;

    update public.business_invitations
    set status = 'accepted', accepted_at = now()
    where id = invitation.id;
    claimed_count := claimed_count + 1;
  end loop;

  return claimed_count;
end;
$$;

revoke execute on function public.change_business_member_role(uuid, uuid, text), public.remove_business_member(uuid, uuid), public.revoke_business_invitation(uuid), public.claim_pending_invitations() from public, anon;
grant execute on function public.change_business_member_role(uuid, uuid, text), public.remove_business_member(uuid, uuid), public.revoke_business_invitation(uuid), public.claim_pending_invitations() to authenticated;

-- Los profesionales pueden consultar servicios y horarios, pero solo owner/admin los modifican.
drop policy if exists "members manage their services" on public.services;
create policy "members read their services"
  on public.services for select to authenticated
  using (public.is_business_member(business_id));
create policy "admins create their services"
  on public.services for insert to authenticated
  with check (public.is_business_admin(business_id));
create policy "admins update their services"
  on public.services for update to authenticated
  using (public.is_business_admin(business_id))
  with check (public.is_business_admin(business_id));
create policy "admins delete their services"
  on public.services for delete to authenticated
  using (public.is_business_admin(business_id));

create or replace function public.replace_working_hours(p_business_id uuid, p_ranges jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_admin(p_business_id) then
    raise exception 'not_business_admin' using errcode = '42501';
  end if;
  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' then
    raise exception 'ranges_must_be_a_list' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ranges) > 70 then
    raise exception 'too_many_ranges' using errcode = '23514';
  end if;
  delete from public.working_hours where business_id = p_business_id;
  insert into public.working_hours (business_id, day_of_week, start_time, end_time)
  select p_business_id, (range ->> 'day_of_week')::smallint, (range ->> 'start_time')::time, (range ->> 'end_time')::time
  from jsonb_array_elements(p_ranges) as range;
end;
$$;

drop policy if exists "members update their business" on public.businesses;
create policy "admins update their business"
  on public.businesses for update to authenticated
  using (public.is_business_admin(id))
  with check (public.is_business_admin(id));

drop policy if exists "members create their preferences" on public.business_preferences;
drop policy if exists "members update their preferences" on public.business_preferences;
create policy "admins create their preferences" on public.business_preferences for insert to authenticated
  with check (public.is_business_admin(business_id));
create policy "admins update their preferences" on public.business_preferences for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

drop policy if exists "members create branding" on public.business_branding;
drop policy if exists "members update branding" on public.business_branding;
create policy "admins create branding" on public.business_branding for insert to authenticated
  with check (public.is_business_admin(business_id));
create policy "admins update branding" on public.business_branding for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

drop policy if exists "members upload own business logos" on storage.objects;
drop policy if exists "members delete own business logos" on storage.objects;
create policy "admins upload business logos" on storage.objects for insert to authenticated with check (
  bucket_id = 'business-logos'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
  and public.is_business_admin((storage.foldername(name))[1]::uuid)
);
create policy "admins delete business logos" on storage.objects for delete to authenticated using (
  bucket_id = 'business-logos'
  and public.is_business_admin((storage.foldername(name))[1]::uuid)
);

drop policy if exists "members read their billing" on public.business_billing;
create policy "admins read their billing" on public.business_billing for select to authenticated
  using (public.is_business_admin(business_id));

-- Agenda por profesional. Las reservas públicas quedan sin asignar; las cargas manuales
-- pueden asignarse a un miembro y luego cada profesional solo ve sus propios turnos.
alter table public.appointments add column professional_id uuid references auth.users (id) on delete set null;
create index appointments_business_professional_starts_idx
  on public.appointments (business_id, professional_id, starts_at);

alter table public.time_blocks add column professional_id uuid references auth.users (id) on delete set null;
create index time_blocks_business_professional_starts_idx
  on public.time_blocks (business_id, professional_id, starts_at);

drop policy if exists "members read their appointments" on public.appointments;
create policy "members read visible appointments" on public.appointments for select to authenticated
  using (public.is_business_admin(business_id) or professional_id = (select auth.uid()));

drop policy if exists "members read their time blocks" on public.time_blocks;
create policy "members read visible time blocks" on public.time_blocks for select to authenticated
  using (public.is_business_admin(business_id) or professional_id = (select auth.uid()));

drop function if exists public.create_owner_booking(uuid, uuid, date, time, text, text, boolean);
create function public.create_owner_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_client_name text,
  p_client_phone text default null,
  p_reminders boolean default false,
  p_professional_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  assigned_professional uuid := p_professional_id;
  service_record public.services;
  starts_at timestamptz;
  ends_at timestamptz;
  appointment_id uuid;
begin
  select role into current_role
  from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());
  if current_role is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if current_role = 'professional' then
    if p_professional_id is not null and p_professional_id <> (select auth.uid()) then
      raise exception 'professional_assignment_forbidden' using errcode = '42501';
    end if;
    assigned_professional := (select auth.uid());
  elsif assigned_professional is not null and not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = assigned_professional and role in ('owner', 'admin', 'professional')
  ) then
    raise exception 'professional_not_found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  select * into service_record from public.services where id = p_service_id and business_id = p_business_id;
  if not found then raise exception 'service_not_found'; end if;
  starts_at := (p_date + p_time) at time zone 'America/Argentina/Buenos_Aires';
  if starts_at < now() then raise exception 'in_the_past'; end if;
  if p_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date + 365 then raise exception 'too_far'; end if;
  ends_at := starts_at + make_interval(mins => service_record.duration_minutes);
  if exists (select 1 from public.time_blocks block where block.business_id = p_business_id and tstzrange(block.starts_at, block.ends_at) && tstzrange(starts_at, ends_at)) then
    raise exception 'slot_unavailable';
  end if;

  begin
    insert into public.appointments (business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone, source, consented_at, professional_id)
    values (p_business_id, service_record.id, service_record.name, starts_at, ends_at, btrim(p_client_name), p_client_phone, 'manual', case when p_reminders and p_client_phone is not null then now() end, assigned_professional)
    returning id into appointment_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;
  return appointment_id;
end;
$$;

revoke execute on function public.create_owner_booking(uuid, uuid, date, time, text, text, boolean, uuid) from public, anon;
grant execute on function public.create_owner_booking(uuid, uuid, date, time, text, text, boolean, uuid) to authenticated;

drop function if exists public.create_time_block(uuid, date, time, date, time, text);
create function public.create_time_block(
  p_business_id uuid,
  p_start_date date,
  p_start_time time,
  p_end_date date,
  p_end_time time,
  p_reason text default null,
  p_professional_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  assigned_professional uuid := p_professional_id;
  starts_at timestamptz;
  ends_at timestamptz;
  block_id uuid;
begin
  select role into current_role from public.business_members where business_id = p_business_id and user_id = (select auth.uid());
  if current_role is null then raise exception 'not_a_member' using errcode = '42501'; end if;
  if current_role = 'professional' then
    if p_professional_id is not null and p_professional_id <> (select auth.uid()) then raise exception 'professional_assignment_forbidden' using errcode = '42501'; end if;
    assigned_professional := (select auth.uid());
  elsif assigned_professional is not null and not exists (select 1 from public.business_members where business_id = p_business_id and user_id = assigned_professional) then
    raise exception 'professional_not_found' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  starts_at := (p_start_date + p_start_time) at time zone 'America/Argentina/Buenos_Aires';
  ends_at := (p_end_date + p_end_time) at time zone 'America/Argentina/Buenos_Aires';
  if ends_at <= now() then raise exception 'in_the_past'; end if;
  if ends_at > starts_at and exists (select 1 from public.appointments appointment where appointment.business_id = p_business_id and appointment.status <> 'cancelled' and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(starts_at, ends_at)) then
    raise exception 'overlaps_appointment';
  end if;
  insert into public.time_blocks (business_id, starts_at, ends_at, reason, professional_id)
  values (p_business_id, starts_at, ends_at, nullif(btrim(p_reason), ''), assigned_professional)
  returning id into block_id;
  return block_id;
end;
$$;

revoke execute on function public.create_time_block(uuid, date, time, date, time, text, uuid) from public, anon;
grant execute on function public.create_time_block(uuid, date, time, date, time, text, uuid) to authenticated;

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_business_id uuid;
  assigned_professional uuid;
begin
  select business_id, professional_id into appointment_business_id, assigned_professional from public.appointments where id = p_appointment_id;
  if not found then raise exception 'appointment_not_found'; end if;
  if not public.is_business_admin(appointment_business_id) and assigned_professional <> (select auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.appointments set status = 'cancelled' where id = p_appointment_id;
end;
$$;

create or replace function public.delete_time_block(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  block_business_id uuid;
  assigned_professional uuid;
begin
  select business_id, professional_id into block_business_id, assigned_professional from public.time_blocks where id = p_block_id;
  if not found then raise exception 'block_not_found'; end if;
  if not public.is_business_admin(block_business_id) and assigned_professional <> (select auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.time_blocks where id = p_block_id;
end;
$$;
