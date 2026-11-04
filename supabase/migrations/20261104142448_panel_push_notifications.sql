-- Suscripciones y cola sin datos de clientes. Solo el servidor lee endpoints y claves.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048 and endpoint ~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/[^?#]+$'),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}=?$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}==?$|^[A-Za-z0-9_-]{22}$'),
  last_test_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_subscriptions_business on public.push_subscriptions(business_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant all on public.push_subscriptions to service_role;

create table public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('new_booking','cancelled','test')),
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  lease_id uuid,
  available_at timestamptz not null default now(),
  unique(subscription_id,appointment_id,kind)
);
create index push_jobs_available on public.push_jobs(available_at);
alter table public.push_jobs enable row level security;
revoke all on public.push_jobs from public, anon, authenticated;
grant all on public.push_jobs to service_role;

create function public.register_push_subscription(p_business_id uuid,p_endpoint text,p_p256dh text,p_auth text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists(select 1 from public.business_members where user_id=uid and business_id=p_business_id) then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,42));
  if (select count(*) from public.push_subscriptions where user_id=uid) >= 10 and not exists(select 1 from public.push_subscriptions where user_id=uid and endpoint=p_endpoint) then raise exception 'device_limit'; end if;
  delete from public.push_jobs where subscription_id in (select id from public.push_subscriptions where user_id=uid and endpoint=p_endpoint and business_id<>p_business_id);
  insert into public.push_subscriptions(user_id,business_id,endpoint,p256dh,auth) values(uid,p_business_id,p_endpoint,p_p256dh,p_auth)
  on conflict(endpoint) do update set business_id=excluded.business_id,p256dh=excluded.p256dh,auth=excluded.auth
  where push_subscriptions.user_id=uid;
  if not found then raise insufficient_privilege; end if;
end $$;

create function public.remove_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  delete from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid();
end $$;

create function public.request_push_test(p_endpoint text)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  update public.push_subscriptions s set last_test_at=now()
  where s.endpoint=p_endpoint and s.user_id=auth.uid()
    and (s.last_test_at is null or s.last_test_at < now()-interval '1 minute')
    and exists(select 1 from public.business_members m where m.user_id=s.user_id and m.business_id=s.business_id)
  returning id into sid;
  if sid is null then raise exception 'test_unavailable'; end if;
  insert into public.push_jobs(subscription_id,kind) values(sid,'test');
end $$;

create function public.queue_appointment_push()
returns trigger language plpgsql security definer set search_path='' as $$
declare event_kind text;
begin
  if TG_OP='INSERT' then
    if new.source <> 'web' then return new; end if;
    event_kind:='new_booking';
  elsif new.status='cancelled' and old.status is distinct from new.status then event_kind:='cancelled';
  else return new; end if;
  insert into public.push_jobs(subscription_id,appointment_id,kind)
    select s.id,new.id,event_kind from public.push_subscriptions s
    join public.business_members m on m.user_id=s.user_id and m.business_id=s.business_id
    where s.business_id=new.business_id
    on conflict do nothing;
  return new;
end $$;
create trigger appointment_push_insert after insert on public.appointments for each row execute function public.queue_appointment_push();
create trigger appointment_push_cancel after update of status on public.appointments for each row execute function public.queue_appointment_push();

-- Arrendamiento de cinco minutos para no procesar una entrega en dos workers a la vez.
create function public.claim_push_jobs()
returns table(id uuid,lease_id uuid,subscription_id uuid,endpoint text,p256dh text,auth text,kind text)
language plpgsql security definer set search_path='' as $$
begin
  delete from public.push_jobs j where j.created_at<now()-interval '1 hour' or (j.attempts>=4 and j.available_at<=now())
    or not exists(select 1 from public.push_subscriptions s join public.business_members m on m.user_id=s.user_id and m.business_id=s.business_id where s.id=j.subscription_id);
  return query with candidates as (
    select j.id from public.push_jobs j where j.available_at<=now() order by j.created_at limit 20 for update skip locked
  ), claimed as (
    update public.push_jobs j set lease_id=gen_random_uuid(),available_at=now()+interval '5 minutes',attempts=j.attempts+1
    from candidates c where j.id=c.id returning j.*
  ) select c.id,c.lease_id,s.id,s.endpoint,s.p256dh,s.auth,c.kind from claimed c join public.push_subscriptions s on s.id=c.subscription_id;
end $$;

create function public.finish_push_job(p_id uuid,p_lease_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
  if p_status not in ('sent','expired','retry') then raise exception 'invalid_status'; end if;
  select subscription_id into sid from public.push_jobs where id=p_id and lease_id=p_lease_id for update;
  if sid is null then return; end if;
  if p_status='expired' then delete from public.push_subscriptions where id=sid;
  elsif p_status='sent' then delete from public.push_jobs where id=p_id;
  else update public.push_jobs set available_at=now()+interval '1 minute',lease_id=null where id=p_id; end if;
end $$;

revoke all on function public.register_push_subscription(uuid,text,text,text), public.remove_push_subscription(text), public.request_push_test(text), public.queue_appointment_push(), public.claim_push_jobs(), public.finish_push_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.register_push_subscription(uuid,text,text,text),public.remove_push_subscription(text),public.request_push_test(text) to authenticated;
grant execute on function public.claim_push_jobs(),public.finish_push_job(uuid,uuid,text) to service_role;

create function public.has_push_subscription(p_business_id uuid,p_endpoint text)
returns boolean language sql security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.push_subscriptions s join public.business_members m on m.user_id=s.user_id and m.business_id=s.business_id where s.user_id=auth.uid() and s.business_id=p_business_id and s.endpoint=p_endpoint);
$$;
revoke all on function public.has_push_subscription(uuid,text) from public,anon,authenticated;
grant execute on function public.has_push_subscription(uuid,text) to authenticated;
