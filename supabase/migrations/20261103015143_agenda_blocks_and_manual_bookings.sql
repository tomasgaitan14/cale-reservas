-- La agenda del negocio: bloqueos de horario, turnos cargados a mano y el candado que evita que un bloqueo y una reserva se pisen.

-- Un turno cargado a mano puede no tener celular, y solo tiene consentimiento de recordatorios si el negocio dice que el cliente aceptó.
-- La reserva de la página pública sigue guardando el consentimiento (lo pone create_booking) y queda marcada como "web".
-- El formato del celular (appointments_client_phone_format) sigue valiendo: un CHECK deja pasar el valor nulo
alter table public.appointments alter column client_phone drop not null;
alter table public.appointments alter column consented_at drop not null;
alter table public.appointments alter column consented_at drop default;
alter table public.appointments add column source text not null default 'web';
alter table public.appointments add constraint appointments_source_values check (source in ('web', 'manual'));

-- Horarios en los que el negocio no atiende (vacaciones, un trámite). No admite escrituras directas: se crean con create_time_block.
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint time_blocks_end_after_start check (ends_at > starts_at),
  -- Hasta 90 días seguidos: más que eso no es un bloqueo, es cerrar el negocio
  constraint time_blocks_max_length check (ends_at - starts_at <= interval '90 days'),
  constraint time_blocks_reason_length check (reason is null or char_length(reason) <= 80)
);

create index time_blocks_business_starts_idx on public.time_blocks (business_id, starts_at);

alter table public.time_blocks enable row level security;

create policy "members read their time blocks"
  on public.time_blocks for select to authenticated
  using (public.is_business_member(business_id));

-- Los horarios libres ahora también descartan los que se superponen con un bloqueo
create or replace function public.slots_for(p_business_id uuid, p_service_id uuid, p_date date)
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
    and not exists (
      select 1
      from public.appointments appointment
      where appointment.business_id = p_business_id
        and appointment.status <> 'cancelled'
        and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => service.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
    and not exists (
      select 1
      from public.time_blocks block
      where block.business_id = p_business_id
        and tstzrange(block.starts_at, block.ends_at) && tstzrange(
          candidate.local_start at time zone 'America/Argentina/Buenos_Aires',
          (candidate.local_start + make_interval(mins => service.duration_minutes)) at time zone 'America/Argentina/Buenos_Aires'
        )
    )
  order by 1;
$$;

-- Reservar, bloquear y cargar un turno a mano toman el mismo candado del negocio: así una reserva y un bloqueo del mismo horario
-- que llegan a la vez se atienden de a uno, y el segundo ve lo que dejó el primero.
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

  -- Un servicio pausado, inexistente o de otro negocio se trata como un horario que no está
  select * into v_service
  from public.services
  where id = p_service_id and business_id = v_business.id and active;

  if not found or not exists (
    select 1 from public.slots_for(v_business.id, p_service_id, p_date) slot where slot.slot_time = p_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  -- Contra reservas en masa: un celular no puede juntar más de 3 turnos próximos en el mismo negocio
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
      business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone, consented_at
    )
    values (
      v_business.id,
      v_service.id,
      v_service.name,
      v_starts_at,
      v_starts_at + make_interval(mins => v_service.duration_minutes),
      btrim(p_client_name),
      p_client_phone,
      now()
    );
  exception
    -- Otra persona se quedó con el horario justo antes
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

-- Bloquea un rango de fechas y horas (puede ser de varios días). Devuelve el id del bloqueo.
-- Rechaza uno que ya pasó (in_the_past) o que se pisa con un turno reservado (overlaps_appointment): hay que cancelar esos turnos antes.
create function public.create_time_block(
  p_business_id uuid,
  p_start_date date,
  p_start_time time,
  p_end_date date,
  p_end_time time,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_id uuid;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));

  v_starts_at := (p_start_date + p_start_time) at time zone 'America/Argentina/Buenos_Aires';
  v_ends_at := (p_end_date + p_end_time) at time zone 'America/Argentina/Buenos_Aires';

  if v_ends_at <= now() then
    raise exception 'in_the_past';
  end if;

  -- Un rango al revés lo rechaza la tabla (time_blocks_end_after_start): acá no se puede armar
  if v_ends_at > v_starts_at and exists (
    select 1
    from public.appointments appointment
    where appointment.business_id = p_business_id
      and appointment.status <> 'cancelled'
      and tstzrange(appointment.starts_at, appointment.ends_at) && tstzrange(v_starts_at, v_ends_at)
  ) then
    raise exception 'overlaps_appointment';
  end if;

  insert into public.time_blocks (business_id, starts_at, ends_at, reason)
  values (p_business_id, v_starts_at, v_ends_at, nullif(btrim(p_reason), ''))
  returning id into v_id;

  return v_id;
end;
$$;

create function public.delete_time_block(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from public.time_blocks where id = p_block_id;
  if not found then
    raise exception 'block_not_found';
  end if;

  if not public.is_business_member(v_business_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  delete from public.time_blocks where id = p_block_id;
end;
$$;

-- El negocio carga un turno a mano (por teléfono, en persona). A diferencia de la reserva de la página pública, puede ser a cualquier
-- hora, aunque no caiga en la grilla ni dentro del horario, con un servicio pausado, sin las 2 horas de anticipación y sin tope por celular.
-- No puede pisar otro turno ni un bloqueo, ni ser del pasado ni de más de un año adelante. Devuelve el id del turno.
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
  v_service public.services;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_id uuid;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));

  select * into v_service from public.services where id = p_service_id and business_id = p_business_id;
  if not found then
    raise exception 'service_not_found';
  end if;

  v_starts_at := (p_date + p_time) at time zone 'America/Argentina/Buenos_Aires';
  if v_starts_at < now() then
    raise exception 'in_the_past';
  end if;
  if p_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date + 365 then
    raise exception 'too_far';
  end if;

  v_ends_at := v_starts_at + make_interval(mins => v_service.duration_minutes);

  if exists (
    select 1
    from public.time_blocks block
    where block.business_id = p_business_id
      and tstzrange(block.starts_at, block.ends_at) && tstzrange(v_starts_at, v_ends_at)
  ) then
    raise exception 'slot_unavailable';
  end if;

  begin
    insert into public.appointments (
      business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone, source, consented_at
    )
    values (
      p_business_id,
      v_service.id,
      v_service.name,
      v_starts_at,
      v_ends_at,
      btrim(p_client_name),
      p_client_phone,
      'manual',
      case when p_reminders and p_client_phone is not null then now() end
    )
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable';
  end;

  return v_id;
end;
$$;

revoke execute on function public.create_time_block(uuid, date, time, date, time, text) from public, anon;
grant execute on function public.create_time_block(uuid, date, time, date, time, text) to authenticated;
revoke execute on function public.delete_time_block(uuid) from public, anon;
grant execute on function public.delete_time_block(uuid) to authenticated;
revoke execute on function public.create_owner_booking(uuid, uuid, date, time, text, text, boolean) from public, anon;
grant execute on function public.create_owner_booking(uuid, uuid, date, time, text, text, boolean) to authenticated;
