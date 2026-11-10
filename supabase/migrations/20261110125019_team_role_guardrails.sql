-- Un admin puede gestionar profesionales, pero solo el owner puede otorgar
-- o quitar permisos de administrador.
create or replace function public.change_business_member_role(p_business_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role
  from public.business_members
  where business_id = p_business_id and user_id = (select auth.uid());
  if caller_role not in ('owner', 'admin') then
    raise exception 'not_business_admin' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'professional') then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;
  if caller_role = 'admin' and p_role <> 'professional' then
    raise exception 'admin_can_only_manage_professionals' using errcode = '42501';
  end if;

  select role into target_role
  from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
  if target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'owner_role_locked' using errcode = '42501';
  end if;
  if caller_role = 'admin' and target_role <> 'professional' then
    raise exception 'admin_can_only_manage_professionals' using errcode = '42501';
  end if;

  update public.business_members
  set role = p_role
  where business_id = p_business_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.change_business_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.change_business_member_role(uuid, uuid, text) to authenticated;
