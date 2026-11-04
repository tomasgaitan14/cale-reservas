create table public.business_branding (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  primary_color text not null default '#355f46' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#e3e9dc' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#355f46' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text check (logo_path is null or logo_path ~ ('^'||business_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'))
);
alter table public.business_branding enable row level security;
revoke all on public.business_branding from public,anon,authenticated;
grant select,insert,update on public.business_branding to authenticated;
grant all on public.business_branding to service_role;
create policy "members read branding" on public.business_branding for select to authenticated using (public.is_business_member(business_id));
create policy "members create branding" on public.business_branding for insert to authenticated with check (public.is_business_member(business_id));
create policy "members update branding" on public.business_branding for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-logos','business-logos',true,1048576,array['image/png']);

create policy "members upload own business logos" on storage.objects for insert to authenticated with check (
 bucket_id='business-logos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
 and exists(select 1 from public.business_members m where m.user_id=auth.uid() and m.business_id::text=(storage.foldername(name))[1])
);
create policy "members read own logo objects" on storage.objects for select to authenticated using (
 bucket_id='business-logos' and exists(select 1 from public.business_members m where m.user_id=auth.uid() and m.business_id::text=(storage.foldername(name))[1])
);
create policy "members delete own business logos" on storage.objects for delete to authenticated using (
 bucket_id='business-logos' and exists(select 1 from public.business_members m where m.user_id=auth.uid() and m.business_id::text=(storage.foldername(name))[1])
);

create function public.get_business_branding(p_business_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_business_member(p_business_id) then raise insufficient_privilege; end if;
 return (select to_jsonb(b)-'business_id' from public.business_branding b where business_id=p_business_id);
end $$;
create function public.save_business_branding(p_business_id uuid,p_primary text,p_secondary text,p_accent text,p_logo_path text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_business_member(p_business_id) then raise insufficient_privilege; end if;
 if p_logo_path is not null and not exists(select 1 from storage.objects where bucket_id='business-logos' and name=p_logo_path) then raise exception 'logo_not_found'; end if;
 insert into public.business_branding(business_id,primary_color,secondary_color,accent_color,logo_path) values(p_business_id,p_primary,p_secondary,p_accent,p_logo_path)
 on conflict(business_id) do update set primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,logo_path=excluded.logo_path;
end $$;
revoke all on function public.get_business_branding(uuid),public.save_business_branding(uuid,text,text,text,text) from public,anon;
grant execute on function public.get_business_branding(uuid),public.save_business_branding(uuid,text,text,text,text) to authenticated;

-- Solo se agrega diseño a la lectura pública existente.
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
