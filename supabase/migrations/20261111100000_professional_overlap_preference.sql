-- Por defecto, distintos profesionales pueden atender turnos en el mismo horario.
alter table public.business_preferences
  add column if not exists allow_cross_professional_overlap boolean not null default true;

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
  schedule as (
    select
      service.duration_minutes,
      case when exists (
        select 1 from public.working_hours custom_hours
        where custom_hours.business_id = p_business_id and custom_hours.professional_id = service.professional_id
      ) then service.professional_id else owner.user_id end as schedule_professional_id
    from service
    join public.business_members owner on owner.business_id = p_business_id and owner.role = 'owner'
  ),
  settings as (
    select coalesce((
      select preferences.allow_cross_professional_overlap
      from public.business_preferences preferences where preferences.business_id = p_business_id
    ), true) as allow_cross_professional_overlap
  ),
  local_today as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as day)
  select distinct candidate.local_start::time
  from schedule
  cross join settings
  cross join local_today
  join public.working_hours hours
    on hours.business_id = p_business_id
   and hours.professional_id = schedule.schedule_professional_id
   and hours.day_of_week = extract(dow from p_date)
  cross join lateral generate_series(
    p_date + hours.start_time,
    p_date + hours.end_time - make_interval(mins => schedule.duration_minutes),
    make_interval(mins => schedule.duration_minutes)
  ) as candidate(local_start)
  where p_date between local_today.day and local_today.day + 30
    and (candidate.local_start at time zone 'America/Argentina/Buenos_Aires') >= now() + interval '2 hours'
    and not exists (
      select 1 from public.appointments appointment
      where appointment.business_id = p_business_id and appointment.status <> 'cancelled'
        and (not settings.allow_cross_professional_overlap or appointment.professional_id is null or appointment.professional_id = (select professional_id from service))
        and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => schedule.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
    and not exists (
      select 1 from public.time_blocks block
      where block.business_id = p_business_id and (block.professional_id is null or block.professional_id = (select professional_id from service))
        and tstzrange(block.starts_at, block.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => schedule.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
  order by 1;
$$;

create or replace function public.create_owner_booking(
  p_business_id uuid, p_service_id uuid, p_date date, p_time time, p_client_name text,
  p_client_phone text default null, p_reminders boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  service_record public.services;
  allow_cross_professional_overlap boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  appointment_id uuid;
begin
  select role into current_role from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());
  if current_role is null then raise exception 'not_a_member' using errcode = '42501'; end if;

  select * into service_record from public.services where id = p_service_id and business_id = p_business_id;
  if not found then raise exception 'service_not_found'; end if;
  if current_role = 'professional' and service_record.professional_id <> (select auth.uid()) then
    raise exception 'professional_assignment_forbidden' using errcode = '42501';
  end if;

  select coalesce(preferences.allow_cross_professional_overlap, true) into allow_cross_professional_overlap
  from public.business_preferences preferences where preferences.business_id = p_business_id;
  allow_cross_professional_overlap := coalesce(allow_cross_professional_overlap, true);

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  v_starts_at := (p_date + p_time) at time zone 'America/Argentina/Buenos_Aires';
  if v_starts_at < now() then raise exception 'in_the_past'; end if;
  if p_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date + 365 then raise exception 'too_far'; end if;
  v_ends_at := v_starts_at + make_interval(mins => service_record.duration_minutes);

  if not allow_cross_professional_overlap and exists (
    select 1 from public.appointments appointment
    where appointment.business_id = p_business_id and appointment.status <> 'cancelled'
      and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(v_starts_at, v_ends_at)
  ) then raise exception 'slot_unavailable'; end if;

  if exists (
    select 1 from public.time_blocks as block
    where block.business_id = p_business_id
      and (block.professional_id is null or block.professional_id = service_record.professional_id)
      and tstzrange(block.starts_at, block.ends_at) && tstzrange(v_starts_at, v_ends_at)
  ) then raise exception 'slot_unavailable'; end if;

  begin
    insert into public.appointments (business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone, source, consented_at, professional_id)
    values (p_business_id, service_record.id, service_record.name, v_starts_at, v_ends_at, btrim(p_client_name), p_client_phone, 'manual', case when p_reminders and p_client_phone is not null then now() end, service_record.professional_id)
    returning id into appointment_id;
  exception when exclusion_violation then raise exception 'slot_unavailable';
  end;
  return appointment_id;
end;
$$;
