-- Separa la base de clientes general del administrador de la base de cada profesional.
alter table public.clients add column professional_id uuid references auth.users(id) on delete cascade;

alter table public.clients drop constraint clients_business_phone_key;
create unique index clients_business_scope_phone_key
  on public.clients (business_id, professional_id, phone)
  where phone is not null;
create index clients_business_professional_updated_idx
  on public.clients (business_id, professional_id, updated_at desc);

drop policy if exists "members read clients" on public.clients;
drop policy if exists "admins insert clients" on public.clients;
drop policy if exists "admins update clients" on public.clients;
drop policy if exists "admins delete clients" on public.clients;

create policy "admins read general clients"
  on public.clients for select to authenticated
  using (professional_id is null and public.is_business_admin(business_id));

create policy "professionals read own clients"
  on public.clients for select to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create policy "admins insert general clients"
  on public.clients for insert to authenticated
  with check (professional_id is null and public.is_business_admin(business_id));

create policy "professionals insert own clients"
  on public.clients for insert to authenticated
  with check (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create policy "admins update general clients"
  on public.clients for update to authenticated
  using (professional_id is null and public.is_business_admin(business_id))
  with check (professional_id is null and public.is_business_admin(business_id));

create policy "professionals update own clients"
  on public.clients for update to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id))
  with check (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create policy "admins delete general clients"
  on public.clients for delete to authenticated
  using (professional_id is null and public.is_business_admin(business_id));

create policy "professionals delete own clients"
  on public.clients for delete to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id));

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
  on conflict do update
    set name = excluded.name,
        updated_at = now()
  returning id into v_client_id;

  new.client_id := v_client_id;
  return new;
end;
$$;

revoke execute on function public.sync_appointment_client() from public, anon, authenticated;
