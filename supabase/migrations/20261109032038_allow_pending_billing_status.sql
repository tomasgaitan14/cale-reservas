alter table public.business_billing
  drop constraint if exists business_billing_billing_status_check;

alter table public.business_billing
  add constraint business_billing_billing_status_check
  check (billing_status in ('free', 'pending', 'active', 'past_due', 'canceled'));
