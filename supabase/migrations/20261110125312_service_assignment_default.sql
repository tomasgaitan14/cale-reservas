-- Si un cliente interno crea un servicio sin elegir explícitamente otro
-- profesional, se asigna a la persona autenticada. Nunca queda sin responsable.
create or replace function public.assign_service_professional()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if new.professional_id is null then
    new.professional_id := current_user_id;
  end if;
  if new.professional_id is null or not exists (
    select 1
    from public.business_members member
    where member.business_id = new.business_id
      and member.user_id = new.professional_id
  ) then
    raise exception 'professional_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.assign_service_professional() from public, anon, authenticated, service_role;

drop trigger if exists services_assign_professional on public.services;
create trigger services_assign_professional
before insert or update of business_id, professional_id on public.services
for each row execute function public.assign_service_professional();
