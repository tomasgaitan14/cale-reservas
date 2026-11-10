-- Directorio público mínimo para mostrar negocios que ya usan Cale en la landing.
-- No expone teléfonos, usuarios ni datos de reservas.
create or replace function public.get_public_businesses()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', business.name,
        'slug', business.slug,
        'logo_path', brand.logo_path
      )
      order by business.created_at
    ),
    '[]'::jsonb
  )
  from public.businesses business
  left join public.business_branding brand on brand.business_id = business.id;
$$;

revoke execute on function public.get_public_businesses() from public;
grant execute on function public.get_public_businesses() to anon, authenticated;
