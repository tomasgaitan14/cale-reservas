-- La carga manual fallaba al comprobar bloqueos porque los nombres de las
-- variables coincidían con las columnas starts_at y ends_at de time_blocks.
-- Usamos nombres inequívocos para que funcione también desde una cuenta profesional.
create or replace function public.create_owner_booking(
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
  v_starts_at timestamptz;
  v_ends_at timestamptz;
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
  v_starts_at := (p_date + p_time) at time zone 'America/Argentina/Buenos_Aires';
  if v_starts_at < now() then raise exception 'in_the_past'; end if;
  if p_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date + 365 then raise exception 'too_far'; end if;
  v_ends_at := v_starts_at + make_interval(mins => service_record.duration_minutes);

  if exists (
    select 1
    from public.time_blocks as block
    where block.business_id = p_business_id
      and (block.professional_id is null or block.professional_id = service_record.professional_id)
      and tstzrange(block.starts_at, block.ends_at) && tstzrange(v_starts_at, v_ends_at)
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
      v_starts_at,
      v_ends_at,
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
