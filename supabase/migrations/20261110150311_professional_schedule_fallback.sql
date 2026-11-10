-- Mientras un profesional no tenga una semana propia, sus servicios siguen
-- usando la semana del dueño. En cuanto se guarda al menos un tramo propio,
-- esa configuración pasa a ser la fuente de verdad para ese profesional.
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
        select 1
        from public.working_hours custom_hours
        where custom_hours.business_id = p_business_id
          and custom_hours.professional_id = service.professional_id
      ) then service.professional_id else owner.user_id end as schedule_professional_id
    from service
    join public.business_members owner
      on owner.business_id = p_business_id and owner.role = 'owner'
  ),
  local_today as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date as day
  )
  select distinct candidate.local_start::time
  from schedule
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
      where appointment.business_id = p_business_id
        and appointment.status <> 'cancelled'
        and (appointment.professional_id is null or appointment.professional_id = (select professional_id from service))
        and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => schedule.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
    and not exists (
      select 1 from public.time_blocks block
      where block.business_id = p_business_id
        and (block.professional_id is null or block.professional_id = (select professional_id from service))
        and tstzrange(block.starts_at, block.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => schedule.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
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
          join public.business_members owner
            on owner.business_id = business.id and owner.role = 'owner'
          where service.business_id = business.id
            and service.active
            and hours.professional_id = case when exists (
              select 1
              from public.working_hours custom_hours
              where custom_hours.business_id = business.id
                and custom_hours.professional_id = service.professional_id
            ) then service.professional_id else owner.user_id end
        )
    ), '[]'::jsonb)
  )
  from public.businesses business
  where business.slug = p_slug;
$$;
