create table public.whatsapp_connections (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null unique references public.businesses(id) on delete cascade,
 waba_id text,
 phone_number_id text unique,
 display_phone_number text,
 credential_reference text,
 connection_status text not null default 'pending' check (connection_status in ('pending','connected','disconnected','error')),
 connected_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint connected_requires_ids check (connection_status <> 'connected' or (waba_id is not null and phone_number_id is not null and credential_reference is not null))
);
comment on column public.whatsapp_connections.credential_reference is 'Server-side secret reference only. Never store access tokens here or expose this table to browser clients.';
alter table public.whatsapp_connections enable row level security;
revoke all on public.whatsapp_connections from anon, authenticated;
create index whatsapp_connections_waba_idx on public.whatsapp_connections(waba_id);

create table public.reminder_deliveries (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null unique references public.appointments(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 connection_id uuid references public.whatsapp_connections(id) on delete set null,
 scheduled_for timestamptz not null,
 reminder_hours integer not null check (reminder_hours in (2,24,48)),
 status text not null default 'pending' check (status in ('pending','processing','sent','delivered','read','failed','cancelled')),
 meta_message_id text unique,
 attempts integer not null default 0 check (attempts >= 0),
 last_error_code text,
 last_error_at timestamptz,
 sent_at timestamptz,
 delivered_at timestamptz,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;
create index reminder_deliveries_due_idx on public.reminder_deliveries(scheduled_for) where status = 'pending';
create index reminder_deliveries_business_idx on public.reminder_deliveries(business_id, created_at desc);

