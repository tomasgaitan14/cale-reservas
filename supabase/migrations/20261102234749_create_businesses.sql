-- Negocios y quién pertenece a cada uno. Todo lo demás cuelga de businesses.id.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  -- Minúsculas, números y guiones sueltos entre palabras; de 3 a 40 caracteres
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  constraint businesses_name_length check (char_length(btrim(name)) between 1 and 80),
  -- Solo dígitos, con código de país y sin "+": de 10 a 15 (largo máximo de un número internacional)
  constraint businesses_whatsapp_format check (whatsapp ~ '^[0-9]{10,15}$')
);

-- Nombres que no puede usar un negocio: páginas del sitio y rutas de la app. Los clientes no la pueden leer.
create table public.reserved_slugs (slug text primary key);
insert into public.reserved_slugs (slug) values
  ('privacidad'), ('terminos'), ('empezar'), ('eliminar-datos'), ('panel'), ('api');
alter table public.reserved_slugs enable row level security;

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  primary key (business_id, user_id)
);

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

create policy "members read their memberships"
  on public.business_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "members read their businesses"
  on public.businesses for select to authenticated
  using (exists (
    select 1 from public.business_members member
    where member.business_id = businesses.id
      and member.user_id = (select auth.uid())
  ));

-- Única forma de crear un negocio: lo crea y deja al usuario como dueño en el mismo paso
create function public.create_business(p_name text, p_slug text, p_whatsapp text)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_business public.businesses;
begin
  if exists (select 1 from public.reserved_slugs where slug = p_slug) then
    raise exception 'slug_reserved' using errcode = '23514';
  end if;

  insert into public.businesses (name, slug, whatsapp)
  values (p_name, p_slug, p_whatsapp)
  returning * into new_business;

  insert into public.business_members (business_id, user_id)
  values (new_business.id, (select auth.uid()));

  return new_business;
end;
$$;

-- Postgres le da permiso de ejecutar a todos por defecto: solo pueden crear negocios los usuarios con sesión
revoke execute on function public.create_business(text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;
