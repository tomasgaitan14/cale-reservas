alter table public.whatsapp_connections
  add column meta_business_id text,
  add column encrypted_business_token text,
  add column token_expires_at timestamptz,
  add column signup_attempt_id uuid;

comment on column public.whatsapp_connections.encrypted_business_token is
  'AES-GCM ciphertext. The key is held separately in Edge Function secrets. Server access only.';

-- A managed signup configures the webhook for the entire WABA. One WABA cannot serve two Cale businesses.
create unique index whatsapp_connections_managed_waba_idx
  on public.whatsapp_connections(waba_id) where signup_attempt_id is not null;
