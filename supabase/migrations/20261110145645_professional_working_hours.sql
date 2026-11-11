-- Cada profesional tiene su propia semana de atención. Los horarios que ya
-- existían se asignan al dueño para conservar la configuración actual.
alter table public.working_hours
  add column professional_id uuid;

update public.working_hours hours
set professional_id = (
  select member.user_id
  from public.business_members member
  where member.business_id = hours.business_id
  order by case member.role when 'owner' then 0 when 'admin' then 1 else 2 end, member.created_at nulls first
  limit 1
);

do $$
begin
  if exists (select 1 from public.working_hours where professional_id is null) then
    raise exception 'working_hours_requires_professional';
  end if;
end;
$$;

alter table public.working_hours
  alter column professional_id set not null,
  add constraint working_hours_business_professional_fk
    foreign key (business_id, professional_id)
    references public.business_members (business_id, user_id)
    on delete cascade;

alter table public.working_hours drop constraint working_hours_no_overlap;
alter table public.working_hours add constraint working_hours_no_overlap exclude using gist (
  business_id with =,
  professional_id with =,
  day_of_week with =,
  public.time_span(start_time, end_time) with &&
);

drop policy if exists "members read their working hours" on public.working_hours;
create policy "members read visible working hours"
  on public.working_hours for select to authenticated
  using (public.is_business_admin(business_id) or professional_id = (select auth.uid()));

-- Guarda o reemplaza la semana de un profesional. La administración puede
-- editar a cualquier miembro; un profesional solo podría editar la propia si
-- alguna pantalla futura lo habilita explícitamente.
create or replace function public.replace_working_hours(
  p_business_id uuid,
  p_ranges jsonb,
  p_professional_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());

  if caller_role is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if p_professional_id is null or not exists (
    select 1
    from public.business_members
    where business_id = p_business_id and user_id = p_professional_id
  ) then
    raise exception 'professional_not_found' using errcode = '22023';
  end if;
  if caller_role = 'professional' and p_professional_id <> (select auth.uid()) then
    raise exception 'professional_assignment_forbidden' using errcode = '42501';
  end if;
  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' then
    raise exception 'ranges_must_be_a_list' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ranges) > 70 then
    raise exception 'too_many_ranges' using errcode = '23514';
  end if;

  delete from public.working_hours
  where business_id = p_business_id and professional_id = p_professional_id;

  insert into public.working_hours (business_id, professional_id, day_of_week, start_time, end_time)
  select
    p_business_id,
    p_professional_id,
    (range ->> 'day_of_week')::smallint,
    (range ->> 'start_time')::time,
    (range ->> 'end_time')::time
  from jsonb_array_elements(p_ranges) as range;
end;
$$;

-- Compatibilidad con llamadas antiguas: actualiza los horarios del usuario
-- autenticado sin permitir que pueda tocar los de otra persona.
create or replace function public.replace_working_hours(p_business_id uuid, p_ranges jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.replace_working_hours(p_business_id, p_ranges, (select auth.uid()));
end;
$$;

revoke execute on function public.replace_working_hours(uuid, jsonb, uuid), public.replace_working_hours(uuid, jsonb) from public, anon;
grant execute on function public.replace_working_hours(uuid, jsonb, uuid), public.replace_working_hours(uuid, jsonb) to authenticated;

-- Las reservas públicas usan los horarios del profesional asignado al servicio.
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
   and hours.professional_id = service.professional_id
   and hours.day_of_week = extract(dow from p_date)
  cross join lateral generate_series(
    p_date + hours.start_time,
    p_date + hours.end_time - make_interval(mins => service.duration_minutes),
    make_interval(mins => service.duration_minutes)
  ) as candidate(local_start)
  where p_date between local_today.day and local_today.day + 30
    and (candidate.local_start at time zone 'America/Argentina/Buenos_Aires') >= now() + interval '2 hours'
    and not exists (
      select 1 from public.appointments appointment
      where appointment.business_id = p_business_id
        and appointment.status <> 'cancelled'
        and (appointment.professional_id is null or appointment.professional_id = service.professional_id)
        and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => service.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
    and not exists (
      select 1 from public.time_blocks block
      where block.business_id = p_business_id
        and (block.professional_id is null or block.professional_id = service.professional_id)
        and tstzrange(block.starts_at, block.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => service.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
  order by 1;
$$;

create or replace function public.get_public_booking_info(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'branding', (select to_jsonb(brand)-'business_id' from public.business_branding brand where brand.business_id=business.id),
    'name', business.name,
    'slug', business.slug,
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', service.id, 'name', service.name, 'duration_minutes', service.duration_minutes)
        order by service.created_at
      )
      from public.services service
      where service.business_id = business.id and service.active
    ), '[]'::jsonb),
    'open_days', coalesce((
      select jsonb_agg(distinct hours.day_of_week order by hours.day_of_week)
      from public.working_hours hours
      where hours.business_id = business.id
        and exists (
          select 1
          from public.services service
          where service.business_id = business.id
            and service.active
            and service.professional_id = hours.professional_id
        )
    ), '[]'::jsonb)
  )
  from public.businesses business
  where business.slug = p_slug;
$$;
