-- Turnos reservados. La tabla no admite escrituras directas: se reserva con create_booking (abierta a cualquiera, sin sesión) y el negocio
-- cancela con cancel_appointment. Un negocio tiene una sola agenda: dos turnos activos no pueden superponerse.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Si el negocio borra el servicio, el turno queda con el nombre que tenía al reservarse
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  client_name text not null,
  -- Solo dígitos, con código de país y sin "+": de 10 a 15 (largo máximo de un número internacional)
  client_phone text not null,
  status text not null default 'pending',
  -- Cuándo aceptó recibir recordatorios por WhatsApp
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint appointments_client_name_length check (char_length(btrim(client_name)) between 1 and 80),
  constraint appointments_client_phone_format check (client_phone ~ '^[0-9]{10,15}$'),
  constraint appointments_status_values check (status in ('pending', 'confirmed', 'cancelled')),
  constraint appointments_end_after_start check (ends_at > starts_at),
  -- Dos turnos activos del mismo negocio no se pisan, aunque lleguen a la vez: lo garantiza la base
  constraint appointments_no_overlap exclude using gist (
    business_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index appointments_business_phone_idx on public.appointments (business_id, client_phone);

alter table public.appointments enable row level security;

create policy "members read their appointments"
  on public.appointments for select to authenticated
  using (public.is_business_member(business_id));

-- Los horarios libres ahora también descartan los que se superponen con un turno activo
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
  order by 1;
$$;

-- Reserva un turno. Todos los rechazos de reglas de negocio dicen por qué en el mensaje del error:
-- business_not_found, consent_required, slot_unavailable y too_many_bookings.
create function public.create_booking(
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
    insert into public.appointments (business_id, service_id, service_name, starts_at, ends_at, client_name, client_phone)
    values (
      v_business.id,
      v_service.id,
      v_service.name,
      v_starts_at,
      v_starts_at + make_interval(mins => v_service.duration_minutes),
      btrim(p_client_name),
      p_client_phone
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

revoke execute on function public.create_booking(text, uuid, date, time, text, text, boolean) from public;
grant execute on function public.create_booking(text, uuid, date, time, text, text, boolean) to anon, authenticated;

-- El negocio cancela un turno: el horario vuelve a estar libre. Cancelar uno ya cancelado no hace nada.
create function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  if not public.is_business_member(v_business_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  update public.appointments set status = 'cancelled' where id = p_appointment_id;
end;
$$;

revoke execute on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;
