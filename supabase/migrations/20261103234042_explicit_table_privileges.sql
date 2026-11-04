-- Permisos explícitos: no depender de los privilegios por defecto del proyecto.
revoke all privileges on table public.businesses, public.business_members,
  public.reserved_slugs, public.services, public.working_hours,
  public.appointments, public.time_blocks from anon, authenticated;
grant select on table public.businesses, public.business_members, public.services,
  public.working_hours, public.appointments, public.time_blocks to authenticated;
grant insert, update, delete on table public.services to authenticated;
grant all privileges on table public.businesses, public.business_members,
  public.reserved_slugs, public.services, public.working_hours,
  public.appointments, public.time_blocks to service_role;
