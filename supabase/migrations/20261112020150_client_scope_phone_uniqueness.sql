drop index if exists public.clients_business_scope_phone_key;

create unique index clients_business_scope_phone_key
  on public.clients (
    business_id,
    coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid),
    phone
  )
  where phone is not null;
