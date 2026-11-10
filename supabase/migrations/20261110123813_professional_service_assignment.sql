-- Cada servicio pertenece a un profesional. La reserva pública sigue mostrando
-- solamente servicios: el profesional se resuelve desde el servicio elegido.

do $$
begin
  if exists (
    select 1 from public.services
    where not exists (
      select 1 from public.business_members member
      where member.business_id = services.business_id
        and member.role in ('owner', 'admin', 'professional')
    )
  ) then
    raise exception 'professional_service_assignment_requires_business_member';
  end if;
end;
$$;

alter table public.services
  add column professional_id uuid;

-- La base de desarrollo puede tener servicios creados antes de esta regla.
-- Si hay un único owner/admin disponible, lo usamos para que la migración sea
-- compatible con esos datos sin inventar un profesional inexistente.
update public.services service
set professional_id = (
  select member.user_id
  from public.business_members member
  where member.business_id = service.business_id
    and member.role in ('owner', 'admin', 'professional')
  order by case member.role when 'owner' then 0 when 'admin' then 1 else 2 end, member.created_at
  limit 1
)
where professional_id is null;

do $$
begin
  if exists (select 1 from public.services where professional_id is null) then
    raise exception 'professional_service_assignment_requires_assignment';
  end if;
end;
$$;

alter table public.services
  alter column professional_id set not null,
  add constraint services_professional_member_fk
    foreign key (business_id, professional_id)
    references public.business_members (business_id, user_id)
    on delete restrict;

create index services_business_professional_idx
  on public.services (business_id, professional_id, active);

-- Los turnos anteriores se vinculan al profesional del servicio. Los turnos
-- cuyo servicio fue eliminado conservan professional_id nulo por compatibilidad.
update public.appointments appointment
set professional_id = service.professional_id
from public.services service
where appointment.service_id = service.id
  and appointment.professional_id is null;

alter table public.appointments
  drop constraint appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap exclude using gist (
    business_id with =,
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled');

create or replace function public.slots_for(p_business_id uuid, p_service_id uuid, p_date date)
returns table (slot_time time)
language sql
stable
security definer
set search_path = ''
as $$
  with service as (
    select duration_minutes, professional_id
    from public.services
    where id = p_service_id and business_id = p_business_id and active
  ),
  local_today as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date as day
  )
  select distinct candidate.local_start::time
  from service
  cross join local_today
  join public.working_hours hours
    on hours.business_id = p_business_id
   and hours.day_of_week = extract(dow from p_date)
  cross join lateral generate_series(
    p_date + hours.start_time,
    p_date + hours.end_time - make_interval(mins => service.duration_minutes),
    make_interval(mins => service.duration_minutes)
  ) as candidate(local_start)
  where p_date between local_today.day and local_today.day + 30
    and (candidate.local_start at time zone 'America/Argentina/Buenos_Aires') >= now() + interval '2 hours'
    and not exists (
      select 1
      from public.appointments appointment
      where appointment.business_id = p_business_id
        and appointment.status <> 'cancelled'
        and (appointment.professional_id is null or appointment.professional_id = service.professional_id)
        and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => service.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
    and not exists (
      select 1
      from public.time_blocks block
      where block.business_id = p_business_id
        and (block.professional_id is null or block.professional_id = service.professional_id)
        and tstzrange(block.starts_at, block.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => service.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
  order by 1;
$$;

create or replace function public.create_booking(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_client_name text,
  p_client_phone text,
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_service public.services;
  v_starts_at timestamptz;
begin
  if p_consent is distinct from true then
    raise exception 'consent_required';
  end if;

  select * into v_business from public.businesses where slug = p_slug;
  if not found then
    raise exception 'business_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_business.id::text, 0));

  select * into v_service
  from public.services
  where id = p_service_id and business_id = v_business.id and active;

  if not found or not exists (
    select 1 from public.slots_for(v_business.id, p_service_id, p_date) slot where slot.slot_time = p_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  if (
    select count(*)
    from public.appointments appointment
    where appointment.business_id = v_business.id
      and appointment.client_phone = p_client_phone
      and appointment.status <> 'cancelled'
      and appointment.starts_at > now()
  ) >= 3 then
    raise exception 'too_many_bookings';
  end if;

  v_starts_at := (p_date + p_time) at time zone 'America/Argentina/Buenos_Aires';

  begin
    insert into public.appointments (
      business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone, consented_at, professional_id
    )
    values (
      v_business.id,
      v_service.id,
      v_service.name,
      v_starts_at,
      v_starts_at + make_interval(mins => v_service.duration_minutes),
      btrim(p_client_name),
      p_client_phone,
      now(),
      v_service.professional_id
    );
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable';
  end;

  return jsonb_build_object(
    'business_name', v_business.name,
    'service_name', v_service.name,
    'date', p_date,
    'time', to_char(p_time, 'HH24:MI')
  );
end;
$$;

-- Las cargas manuales usan el profesional del servicio. Un profesional solo
-- puede cargar servicios que le fueron asignados; administración puede cargar
-- cualquier servicio del negocio.
drop function if exists public.create_owner_booking(uuid, uuid, date, time, text, text, boolean, uuid);
drop function if exists public.create_owner_booking(uuid, uuid, date, time, text, text, boolean);
create function public.create_owner_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_client_name text,
  p_client_phone text default null,
  p_reminders boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
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

  select * into service_record
  from public.services
  where id = p_service_id and business_id = p_business_id;
  if not found then
    raise exception 'service_not_found';
  end if;
  if current_role = 'professional' and service_record.professional_id <> (select auth.uid()) then
    raise exception 'professional_assignment_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  starts_at := (p_date + p_time) at time zone 'America/Argentina/Buenos_Aires';
  if starts_at < now() then raise exception 'in_the_past'; end if;
  if p_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date + 365 then raise exception 'too_far'; end if;
  ends_at := starts_at + make_interval(mins => service_record.duration_minutes);

  if exists (
    select 1
    from public.time_blocks block
    where block.business_id = p_business_id
      and (block.professional_id is null or block.professional_id = service_record.professional_id)
      and tstzrange(block.starts_at, block.ends_at) && tstzrange(starts_at, ends_at)
  ) then
    raise exception 'slot_unavailable';
  end if;

  begin
    insert into public.appointments (
      business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone, source, consented_at, professional_id
    )
    values (
      p_business_id,
      service_record.id,
      service_record.name,
      starts_at,
      ends_at,
      btrim(p_client_name),
      p_client_phone,
      'manual',
      case when p_reminders and p_client_phone is not null then now() end,
      service_record.professional_id
    )
    returning id into appointment_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;
  return appointment_id;
end;
$$;

revoke execute on function public.create_owner_booking(uuid, uuid, date, time, text, text, boolean) from public, anon;
grant execute on function public.create_owner_booking(uuid, uuid, date, time, text, text, boolean) to authenticated;

-- Un bloqueo sin profesional bloquea a todo el negocio; un bloqueo asignado
-- solo bloquea al profesional indicado.
drop function if exists public.create_time_block(uuid, date, time, date, time, text, uuid);
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
    if p_professional_id is not null and p_professional_id <> (select auth.uid()) then
      raise exception 'professional_assignment_forbidden' using errcode = '42501';
    end if;
    assigned_professional := (select auth.uid());
  elsif assigned_professional is not null and not exists (
    select 1 from public.business_members where business_id = p_business_id and user_id = assigned_professional
  ) then
    raise exception 'professional_not_found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  starts_at := (p_start_date + p_start_time) at time zone 'America/Argentina/Buenos_Aires';
  ends_at := (p_end_date + p_end_time) at time zone 'America/Argentina/Buenos_Aires';
  if ends_at <= now() then raise exception 'in_the_past'; end if;
  if ends_at > starts_at and exists (
    select 1
    from public.appointments appointment
    where appointment.business_id = p_business_id
      and appointment.status <> 'cancelled'
      and (appointment.professional_id is null or assigned_professional is null or appointment.professional_id = assigned_professional)
      and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(starts_at, ends_at)
  ) then
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
