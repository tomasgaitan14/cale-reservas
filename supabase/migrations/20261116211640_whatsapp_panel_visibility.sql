-- Browser access is read-only and excludes credentials and provider identifiers.
grant select (business_id, display_phone_number, connection_status, connected_at) on public.whatsapp_connections to authenticated;
create policy whatsapp_admin_read on public.whatsapp_connections for select to authenticated using (public.is_business_admin(business_id));
grant select (id, business_id, appointment_id, scheduled_for, status, sent_at, delivered_at, read_at, last_error_code) on public.reminder_deliveries to authenticated;
create policy reminders_admin_read on public.reminder_deliveries for select to authenticated using (public.is_business_admin(business_id));

-- A public reservation must not require permission to receive WhatsApp messages.
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
      case when p_consent is true then now() end,
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
