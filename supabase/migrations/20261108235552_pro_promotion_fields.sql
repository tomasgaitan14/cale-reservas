alter table public.business_billing
  add column promotion_code text,
  add column promotion_price numeric(12, 2),
  add column promotion_applied_at timestamptz;

alter table public.business_billing
  add constraint business_billing_promotion_price_check
  check (promotion_price is null or promotion_price > 0);
