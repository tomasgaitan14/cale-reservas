-- Servicios que ofrece cada negocio (nombre y duración; sin precio en el MVP).

-- ¿La persona con sesión es miembro de ese negocio? Las políticas de todas las tablas del negocio usan esta función.
-- Es security definer para leer business_members sin pasar por sus propias políticas.
create function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_business_member(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  duration_minutes integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint services_name_length check (char_length(btrim(name)) between 1 and 80),
  -- De 5 minutos a 8 horas
  constraint services_duration_range check (duration_minutes between 5 and 480)
);

-- Un negocio no repite el nombre de un servicio, sin importar mayúsculas ni espacios de los costados
create unique index services_business_name_unique on public.services (business_id, lower(btrim(name)));

alter table public.services enable row level security;

create policy "members manage their services"
  on public.services for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
