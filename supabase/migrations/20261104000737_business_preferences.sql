-- Preferencias del negocio y avance del alta, compartidos entre dispositivos.
create table public.business_preferences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  reminder_hours integer not null default 24 check (reminder_hours in (2, 24, 48)),
  whatsapp_waitlist boolean not null default false,
  reminders_reviewed boolean not null default false,
  onboarding_completed boolean not null default false
);
alter table public.business_preferences enable row level security;
revoke all privileges on public.business_preferences from anon, authenticated;
grant select, insert, update on public.business_preferences to authenticated;
grant all privileges on public.business_preferences to service_role;
create policy "members read their preferences" on public.business_preferences for select to authenticated
  using (public.is_business_member(business_id));
create policy "members create their preferences" on public.business_preferences for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "members update their preferences" on public.business_preferences for update to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
-- Los datos editables del negocio conservan las restricciones de nombre, slug y WhatsApp.
grant update (name, slug, whatsapp) on public.businesses to authenticated;
create policy "members update their business" on public.businesses for update to authenticated
  using (public.is_business_member(id)) with check (public.is_business_member(id));
-- También al editar se respetan las rutas reservadas.
create function public.check_business_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.reserved_slugs where slug = new.slug) then
    raise exception 'slug_reserved' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_business_slug() from public, anon, authenticated;
create trigger business_slug_reserved before insert or update of slug on public.businesses
  for each row execute function public.check_business_slug();
