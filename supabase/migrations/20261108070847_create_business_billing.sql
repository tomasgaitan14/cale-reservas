create table public.business_billing (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  billing_status text not null default 'free' check (billing_status in ('free', 'active', 'past_due', 'canceled', 'exempt')),
  billing_exempt boolean not null default false,
  mercadopago_subscription_id text unique,
  current_period_end timestamptz,
  last_payment_status text,
  updated_at timestamptz not null default now()
);

alter table public.business_billing enable row level security;

revoke all privileges on public.business_billing from anon, authenticated;
grant select on public.business_billing to authenticated;
grant all privileges on public.business_billing to service_role;

create policy "members read their billing"
  on public.business_billing for select to authenticated
  using (public.is_business_member(business_id));

create or replace function public.ensure_business_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_billing (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.ensure_business_billing() from public, anon, authenticated;
create trigger business_billing_on_business_created
  after insert on public.businesses
  for each row execute function public.ensure_business_billing();

insert into public.business_billing (business_id)
select id from public.businesses
on conflict (business_id) do nothing;
