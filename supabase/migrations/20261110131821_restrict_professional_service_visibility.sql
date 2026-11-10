-- Un profesional solo necesita leer los servicios que tiene asignados.
-- Owner y admin conservan la vista completa para administrar el negocio.
drop policy if exists "members read their services" on public.services;
create policy "members read visible services"
  on public.services for select to authenticated
  using (
    public.is_business_admin(business_id)
    or professional_id = (select auth.uid())
  );
