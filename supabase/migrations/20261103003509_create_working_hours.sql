-- Horario semanal del negocio, en hora de Argentina. Un día puede tener varios tramos (así se arman los descansos).
-- Los tramos se guardan de una sola vez con replace_working_hours: la tabla no admite escrituras directas.

create extension if not exists btree_gist with schema extensions;

-- Tramo del día, con el inicio incluido y el fin excluido: 09:00-13:00 y 13:00-18:00 no se pisan
create type public.time_span as range (subtype = time without time zone);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- 0 es domingo y 6 es sábado
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  constraint working_hours_day_range check (day_of_week between 0 and 6),
  constraint working_hours_end_after_start check (end_time > start_time),
  -- Dos tramos del mismo negocio y el mismo día no pueden superponerse
  constraint working_hours_no_overlap exclude using gist (
    business_id with =,
    day_of_week with =,
    public.time_span(start_time, end_time) with &&
  )
);

alter table public.working_hours enable row level security;

create policy "members read their working hours"
  on public.working_hours for select to authenticated
  using (public.is_business_member(business_id));

-- Siete días con hasta diez tramos cada uno: más que eso no es un horario real
create function public.replace_working_hours(p_business_id uuid, p_ranges jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' then
    raise exception 'ranges_must_be_a_list' using errcode = '22023';
  end if;

  if jsonb_array_length(p_ranges) > 70 then
    raise exception 'too_many_ranges' using errcode = '23514';
  end if;

  delete from public.working_hours where business_id = p_business_id;

  insert into public.working_hours (business_id, day_of_week, start_time, end_time)
  select
    p_business_id,
    (range ->> 'day_of_week')::smallint,
    (range ->> 'start_time')::time,
    (range ->> 'end_time')::time
  from jsonb_array_elements(p_ranges) as range;
end;
$$;

revoke execute on function public.replace_working_hours(uuid, jsonb) from public, anon;
grant execute on function public.replace_working_hours(uuid, jsonb) to authenticated;
