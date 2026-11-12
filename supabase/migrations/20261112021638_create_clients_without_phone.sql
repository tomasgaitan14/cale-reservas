create or replace function public.sync_appointment_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  -- Si se edita un turno que ya tenía cliente, conservar su registro y
  -- actualizar sus datos aunque el teléfono se quite.
  if tg_op = 'UPDATE' and new.client_id is not null then
    update public.clients
    set name = btrim(new.client_name),
        phone = new.client_phone,
        updated_at = now()
    where id = new.client_id;
    return new;
  end if;

  -- Sin teléfono no podemos deduplicar, pero el cliente igual debe quedar
  -- registrado por su nombre para que aparezca en la base del profesional.
  if new.client_phone is null or btrim(new.client_phone) = '' then
    insert into public.clients (business_id, professional_id, name, phone, updated_at)
    values (new.business_id, new.professional_id, btrim(new.client_name), null, now())
    returning id into v_client_id;
    new.client_id := v_client_id;
    return new;
  end if;

  insert into public.clients (business_id, professional_id, name, phone, updated_at)
  values (new.business_id, new.professional_id, btrim(new.client_name), new.client_phone, now())
  on conflict do nothing
  returning id into v_client_id;

  if v_client_id is null then
    select id into v_client_id
    from public.clients
    where business_id = new.business_id
      and professional_id is not distinct from new.professional_id
      and phone = new.client_phone
    limit 1;

    update public.clients
    set name = btrim(new.client_name), updated_at = now()
    where id = v_client_id;
  end if;

  new.client_id := v_client_id;
  return new;
end;
$$;

revoke execute on function public.sync_appointment_client() from public, anon, authenticated;

-- Recupera turnos manuales anteriores que quedaron sin cliente por no tener teléfono.
do $$
declare
  appointment_record record;
  v_client_id uuid;
begin
  for appointment_record in
    select id, business_id, professional_id, client_name, client_phone
    from public.appointments
    where client_id is null and btrim(client_name) <> ''
  loop
    v_client_id := null;
    if appointment_record.client_phone is null then
      insert into public.clients (business_id, professional_id, name, phone, updated_at)
      values (appointment_record.business_id, appointment_record.professional_id, btrim(appointment_record.client_name), null, now())
      returning id into v_client_id;
    else
      insert into public.clients (business_id, professional_id, name, phone, updated_at)
      values (appointment_record.business_id, appointment_record.professional_id, btrim(appointment_record.client_name), appointment_record.client_phone, now())
      on conflict do nothing
      returning id into v_client_id;
      if v_client_id is null then
        select id into v_client_id
        from public.clients
        where business_id = appointment_record.business_id
          and professional_id is not distinct from appointment_record.professional_id
          and phone = appointment_record.client_phone
        limit 1;
      end if;
    end if;
    update public.appointments set client_id = v_client_id where id = appointment_record.id;
  end loop;
end;
$$;
