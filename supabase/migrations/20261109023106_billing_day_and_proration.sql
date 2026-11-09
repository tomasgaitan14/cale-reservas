alter table public.business_billing
  add column billing_day smallint not null default 10,
  add column initial_charge_amount numeric(12, 2),
  add column billing_day_configured_at timestamptz;

alter table public.business_billing
  add constraint business_billing_billing_day_check
    check (billing_day between 1 and 28),
  add constraint business_billing_initial_charge_amount_check
    check (initial_charge_amount is null or initial_charge_amount > 0);
