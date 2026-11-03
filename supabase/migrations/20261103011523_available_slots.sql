-- Horarios libres de un servicio en un día. Todo se calcula en hora de Argentina.
--
-- Reglas: el primer turno de cada tramo empieza cuando empieza el tramo y los siguientes avanzan de a "lo que dura el servicio" (así la agenda no
-- queda partida en huecos chicos); el turno tiene que terminar antes de que termine el tramo; hoy se ofrecen turnos desde 2 horas después de
-- ahora; y se puede reservar hasta 30 días adelante.

-- Interna: la usan get_available_slots y create_booking. Nadie la llama directo desde la API.
create function public.slots_for(p_business_id uuid, p_service_id uuid, p_date date)
returns table (slot_time time)
language sql
stable
security definer
set search_path = ''
as $$
  with service as (
    select duration_minutes
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
  order by 1;
$$;

revoke execute on function public.slots_for(uuid, uuid, date) from public, anon, authenticated;

-- Lo que usa la página pública: los horarios libres como lista de 'HH:MM'
create function public.get_available_slots(p_slug text, p_service_id uuid, p_date date)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(to_char(slot.slot_time, 'HH24:MI') order by slot.slot_time), '{}')
  from public.businesses business
  cross join lateral public.slots_for(business.id, p_service_id, p_date) slot
  where business.slug = p_slug;
$$;

revoke execute on function public.get_available_slots(text, uuid, date) from public;
grant execute on function public.get_available_slots(text, uuid, date) to anon, authenticated;
