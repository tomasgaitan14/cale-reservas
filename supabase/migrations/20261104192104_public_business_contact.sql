-- Contacto público del negocio para consultas sobre reservas.
-- No se amplían permisos sobre la tabla businesses ni se exponen datos de clientes.
create or replace function public.get_public_booking_info(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'branding', (select to_jsonb(brand)-'business_id' from public.business_branding brand where brand.business_id=business.id),
    'name', business.name,
    'slug', business.slug,
    'whatsapp', business.whatsapp,
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', service.id, 'name', service.name, 'duration_minutes', service.duration_minutes)
        order by service.created_at
      )
      from public.services service
      where service.business_id = business.id and service.active
    ), '[]'::jsonb),
    'open_days', coalesce((
      select jsonb_agg(distinct hours.day_of_week order by hours.day_of_week)
      from public.working_hours hours
      where hours.business_id = business.id
    ), '[]'::jsonb)
  )
  from public.businesses business
  where business.slug = p_slug;
$$;

revoke execute on function public.get_public_booking_info(text) from public;
grant execute on function public.get_public_booking_info(text) to anon, authenticated;
