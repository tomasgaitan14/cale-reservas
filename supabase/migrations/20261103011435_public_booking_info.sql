-- Lo que puede ver cualquiera, sin sesión, en la página de reservas de un negocio: el nombre, los servicios activos y los días que
-- atiende. No devuelve el WhatsApp ni ningún dato interno. Un slug que no existe devuelve vacío (null).

create function public.get_public_booking_info(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', business.name,
    'slug', business.slug,
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
