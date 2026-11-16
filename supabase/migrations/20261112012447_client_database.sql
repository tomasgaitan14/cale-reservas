-- Base de clientes por negocio. Se alimenta automáticamente desde las reservas.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint clients_phone_format check (phone is null or phone ~ '^[0-9]{10,15}$'),
  constraint clients_email_length check (email is null or char_length(email) <= 254)
);

alter table public.clients add constraint clients_business_phone_key unique (business_id, phone);
create index clients_business_updated_idx on public.clients (business_id, updated_at desc);

alter table public.appointments add column client_id uuid references public.clients (id) on delete set null;
create index appointments_client_idx on public.appointments (client_id, starts_at desc);

alter table public.clients enable row level security;
revoke all privileges on public.clients from anon;
grant select on public.clients to authenticated;
grant insert, update, delete on public.clients to authenticated;

create policy "members read clients"
  on public.clients for select to authenticated
  using (public.is_business_member(business_id));

create policy "admins insert clients"
  on public.clients for insert to authenticated
  with check (public.is_business_admin(business_id));

create policy "admins update clients"
  on public.clients for update to authenticated
  using (public.is_business_admin(business_id))
  with check (public.is_business_admin(business_id));

create policy "admins delete clients"
  on public.clients for delete to authenticated
  using (public.is_business_admin(business_id));

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

  insert into public.clients (business_id, name, phone, updated_at)
  values (new.business_id, btrim(new.client_name), new.client_phone, now())
  on conflict (business_id, phone) do update
    set name = excluded.name,
        updated_at = now()
  returning id into v_client_id;

  new.client_id := v_client_id;
  return new;
end;
$$;

revoke execute on function public.sync_appointment_client() from public, anon, authenticated;

create trigger appointment_sync_client
  before insert or update of business_id, client_name, client_phone on public.appointments
  for each row execute function public.sync_appointment_client();

-- Vincula también las reservas existentes sin sobrescribir datos del negocio.
insert into public.clients (business_id, name, phone)
select distinct on (business_id, client_phone)
  business_id, btrim(client_name), client_phone
from public.appointments
where client_phone is not null
order by business_id, client_phone, created_at desc
on conflict (business_id, phone) do nothing;

update public.appointments appointment
set client_id = client.id
from public.clients client
where appointment.client_id is null
  and appointment.client_phone is not null
  and client.business_id = appointment.business_id
  and client.phone = appointment.client_phone;
