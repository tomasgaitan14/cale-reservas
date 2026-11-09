alter table public.businesses
  add column plan text not null default 'gratis';

alter table public.businesses
  add constraint businesses_plan_check check (plan in ('gratis', 'pro', 'enterprise'));

grant update (plan) on public.businesses to authenticated;
