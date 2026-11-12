-- Cada miembro administra únicamente los servicios que pertenecen a su propia agenda.
drop policy if exists "members read visible services" on public.services;
drop policy if exists "admins create their services" on public.services;
drop policy if exists "admins update their services" on public.services;
drop policy if exists "admins delete their services" on public.services;

create policy "members read own services"
  on public.services for select to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create policy "members create own services"
  on public.services for insert to authenticated
  with check (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create policy "members update own services"
  on public.services for update to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id))
  with check (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create policy "members delete own services"
  on public.services for delete to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id));

-- Los horarios visibles y editables también quedan limitados a la agenda propia.
drop policy if exists "members read visible working hours" on public.working_hours;
create policy "members read own working hours"
  on public.working_hours for select to authenticated
  using (professional_id = (select auth.uid()) and public.is_business_member(business_id));

create or replace function public.replace_working_hours(
  p_business_id uuid,
  p_ranges jsonb,
  p_professional_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());

  if caller_role is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if p_professional_id is null or p_professional_id <> (select auth.uid()) then
    raise exception 'professional_assignment_forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = p_professional_id
  ) then
    raise exception 'professional_not_found' using errcode = '22023';
  end if;
  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' then
    raise exception 'ranges_must_be_a_list' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ranges) > 70 then
    raise exception 'too_many_ranges' using errcode = '23514';
  end if;

  delete from public.working_hours
  where business_id = p_business_id and professional_id = p_professional_id;

  insert into public.working_hours (business_id, professional_id, day_of_week, start_time, end_time)
  select
    p_business_id,
    p_professional_id,
    (range ->> 'day_of_week')::smallint,
    (range ->> 'start_time')::time,
    (range ->> 'end_time')::time
  from jsonb_array_elements(p_ranges) as range;
end;
$$;

revoke execute on function public.replace_working_hours(uuid, jsonb, uuid) from public, anon;
grant execute on function public.replace_working_hours(uuid, jsonb, uuid) to authenticated;
