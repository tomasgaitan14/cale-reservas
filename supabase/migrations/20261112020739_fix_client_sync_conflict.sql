create or replace function public.sync_appointment_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  if new.client_phone is null or btrim(new.client_phone) = '' then
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
