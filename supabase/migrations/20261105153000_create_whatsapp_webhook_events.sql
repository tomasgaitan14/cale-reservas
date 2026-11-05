-- Bandeja de entrada de los webhooks de WhatsApp (Meta).
--
-- La Edge Function `whatsapp-webhook` guarda cada mensaje y cada estado que avisa Meta con `ingest_whatsapp_events` y recién entonces
-- responde 200. El procesamiento va aparte (`process_whatsapp_events`): hoy solo aplica los estados de entrega (enviado, entregado,
-- leído, fallido) a `reminder_deliveries`. Los mensajes entrantes se guardan sin procesar (`stored`) para una etapa posterior.
-- Nada de esto se programa acá: el procesador y la purga no corren hasta que se los programe con pg_cron en una migración aparte.
--
-- Política de reintentos y vencimientos (todo en `apply_whatsapp_status_event` y `record_whatsapp_event_error`):
--   * Conexión desconocida (el `phone_number_id` todavía no está en `whatsapp_connections`): se reintenta con espera creciente
--     (5 min, 10, 20… hasta 6 h) durante 7 días. Pasado ese plazo queda `expired`, sin borrarse: `requeue_whatsapp_events` lo reabre.
--   * Mensaje sin entrega asociada (Meta puede avisar antes de que quien envió guarde el id del mensaje): se reintenta con espera
--     creciente (30 s hasta 30 min) durante 2 horas; si sigue sin aparecer queda `ignored` (típico de los envíos de prueba).
--   * Error inesperado al procesar: hasta 8 intentos con espera creciente (1 min hasta 1 h); después queda `failed`.
--   * Un evento `processing` cuyo lease venció (el procesador murió a mitad de camino) lo vuelve a tomar `claim_whatsapp_events`.
--
-- Retención (`purge_whatsapp_webhook_events`): procesados e ignorados, 30 días; fallidos y vencidos, 90 días; mensajes entrantes
-- sin procesar, 90 días. Se borra la fila entera (el contenido trae teléfonos, nombres y textos de clientes).

create table public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  -- Clave de deduplicación: Meta no manda un id por entrega y puede repetir o desordenar los avisos.
  --   mensaje: msg:<wamid>   estado: status:<wamid>:<estado>:<timestamp de Meta>   otro: other:<sha256 del contenido>
  -- Con el timestamp en la clave, dos avisos distintos del mismo estado (por ejemplo, un `failed` reintentado) no se pisan.
  event_key text not null unique check (char_length(event_key) <= 400),
  kind text not null check (kind in ('message', 'status', 'other')),
  waba_id text,
  phone_number_id text,
  meta_message_id text check (char_length(meta_message_id) <= 255),
  status_value text,
  error_code text,
  event_at timestamptz,
  payload jsonb not null,
  process_status text not null default 'pending'
    check (process_status in ('pending', 'processing', 'processed', 'ignored', 'failed', 'expired', 'stored')),
  result_code text,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  processed_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  constraint whatsapp_webhook_events_message_has_id check (kind <> 'message' or meta_message_id is not null),
  constraint whatsapp_webhook_events_status_fields check (
    kind <> 'status' or (meta_message_id is not null and status_value in ('sent', 'delivered', 'read', 'failed'))
  ),
  constraint whatsapp_webhook_events_lease_matches_state check (
    (process_status = 'processing') = (lease_id is not null and lease_expires_at is not null)
  )
);

comment on table public.whatsapp_webhook_events is
  'Webhook inbox from Meta. Contains customer phone numbers, names and message text: server-side only, purged by retention.';

alter table public.whatsapp_webhook_events enable row level security;
revoke all on table public.whatsapp_webhook_events from anon, authenticated;
grant all privileges on table public.whatsapp_webhook_events to service_role;

create index whatsapp_webhook_events_due_idx on public.whatsapp_webhook_events (next_attempt_at)
  where kind = 'status' and process_status = 'pending';
create index whatsapp_webhook_events_lease_idx on public.whatsapp_webhook_events (lease_expires_at)
  where process_status = 'processing';
create index whatsapp_webhook_events_phone_idx on public.whatsapp_webhook_events (phone_number_id);
create index whatsapp_webhook_events_received_idx on public.whatsapp_webhook_events (received_at);

-- Cuántos eventos hay por tipo, estado y motivo: para mirar la salud del procesamiento sin leer el contenido
create view public.whatsapp_webhook_events_health with (security_invoker = true) as
select kind, process_status, coalesce(result_code, '') as result_code, count(*) as events, min(received_at) as oldest_received_at
from public.whatsapp_webhook_events
group by kind, process_status, coalesce(result_code, '');

revoke all on table public.whatsapp_webhook_events_health from anon, authenticated;
grant select on table public.whatsapp_webhook_events_health to service_role;

-- Orden de los estados de una entrega. Un evento solo sube el estado: así el resultado no depende del orden en que lleguen.
-- `cancelled` no está (devuelve null): una entrega cancelada no cambia de estado aunque llegue un aviso.
create function public.whatsapp_delivery_rank(p_status text)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_status
    when 'pending' then 0
    when 'processing' then 0
    when 'sent' then 1
    when 'failed' then 2
    when 'delivered' then 3
    when 'read' then 4
  end;
$$;

-- Guarda un lote de eventos ya armados por la Edge Function. Idempotente: un evento repetido no se vuelve a guardar.
-- Cada ítem: { kind, waba_id, phone_number_id, meta_message_id, status, error_code, timestamp, payload }.
create function public.ingest_whatsapp_events(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_items constant integer := 1000;
  v_received integer;
  v_inserted integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'whatsapp_items_must_be_an_array' using errcode = '22023';
  end if;
  v_received := jsonb_array_length(p_items);
  if v_received > c_max_items then
    raise exception 'whatsapp_too_many_items' using errcode = '22023';
  end if;

  insert into public.whatsapp_webhook_events
    (event_key, kind, waba_id, phone_number_id, meta_message_id, status_value, error_code, event_at, payload, process_status)
  select
    case shaped.kind
      when 'message' then 'msg:' || shaped.meta_message_id
      when 'status' then 'status:' || shaped.meta_message_id || ':' || shaped.status_value || ':' || coalesce(shaped.raw_timestamp, '')
      else 'other:' || encode(sha256(convert_to(shaped.payload::text, 'UTF8')), 'hex')
    end,
    shaped.kind, shaped.waba_id, shaped.phone_number_id, shaped.meta_message_id, shaped.status_value, shaped.error_code,
    case when shaped.raw_timestamp ~ '^[0-9]{1,12}$' then to_timestamp(shaped.raw_timestamp::bigint) end,
    shaped.payload,
    case shaped.kind when 'status' then 'pending' else 'stored' end
  from (
    select
      item ->> 'kind' as kind,
      nullif(item ->> 'waba_id', '') as waba_id,
      nullif(item ->> 'phone_number_id', '') as phone_number_id,
      nullif(item ->> 'meta_message_id', '') as meta_message_id,
      nullif(item ->> 'status', '') as status_value,
      nullif(item ->> 'error_code', '') as error_code,
      nullif(item ->> 'timestamp', '') as raw_timestamp,
      item -> 'payload' as payload
    from jsonb_array_elements(p_items) as elements (item)
  ) as shaped
  on conflict (event_key) do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('received', v_received, 'inserted', v_inserted, 'duplicates', v_received - v_inserted);
end;
$$;

-- Toma un lote de estados para procesar y les pone un lease. También recupera los que quedaron `processing` con el lease vencido
-- (el procesador murió antes de terminarlos). Cada toma cuenta como un intento: un evento que tumba al procesador una y otra vez
-- llega al máximo de intentos y queda `failed` en vez de bloquear la cola para siempre.
create function public.claim_whatsapp_events(p_limit integer default 100, p_lease_seconds integer default 300)
returns table (id uuid, lease_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_batch constant integer := 500;
  v_lease uuid := gen_random_uuid();
begin
  return query
  with due as (
    select e.id
    from public.whatsapp_webhook_events e
    where e.kind = 'status'
      and ((e.process_status = 'pending' and e.next_attempt_at <= now())
        or (e.process_status = 'processing' and e.lease_expires_at < now()))
    order by e.next_attempt_at
    limit least(greatest(p_limit, 1), c_max_batch)
    for update skip locked
  )
  update public.whatsapp_webhook_events e
  set process_status = 'processing',
      lease_id = v_lease,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 1)),
      attempts = e.attempts + 1
  from due
  where e.id = due.id
  returning e.id, e.lease_id;
end;
$$;

-- Cierra un evento con su resultado final. Solo lo usan las funciones de procesamiento.
create function public.finish_whatsapp_event(p_event_id uuid, p_status text, p_result_code text)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.whatsapp_webhook_events
  set process_status = p_status,
      result_code = p_result_code,
      processed_at = now(),
      lease_id = null,
      lease_expires_at = null,
      last_error_code = case when p_status = 'failed' then p_result_code else last_error_code end,
      last_error_at = case when p_status = 'failed' then now() else last_error_at end
  where id = p_event_id
  returning p_status;
$$;

-- Deja un evento esperando algo que todavía no existe (una conexión, una entrega). Mientras dura el plazo lo reprograma con espera
-- creciente; vencido el plazo lo cierra con el estado y el motivo finales que se le indiquen.
create function public.defer_whatsapp_event(
  p_event_id uuid,
  p_waiting_code text,
  p_final_status text,
  p_final_code text,
  p_wait interval,
  p_backoff_base interval,
  p_backoff_max interval
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_backoff_exponent constant integer := 20;
  v_event public.whatsapp_webhook_events%rowtype;
begin
  select * into v_event from public.whatsapp_webhook_events where id = p_event_id;
  if now() - v_event.received_at >= p_wait then
    return public.finish_whatsapp_event(p_event_id, p_final_status, p_final_code);
  end if;
  update public.whatsapp_webhook_events
  set process_status = 'pending',
      result_code = p_waiting_code,
      next_attempt_at = now() + least(p_backoff_base * power(2, least(greatest(v_event.attempts - 1, 0), c_max_backoff_exponent)), p_backoff_max),
      lease_id = null,
      lease_expires_at = null
  where id = p_event_id;
  return 'deferred';
end;
$$;

-- Aplica un estado de entrega. Resultado: processed, ignored, expired, failed, deferred o lease_lost.
-- Seguridad entre negocios: el aviso solo toca la entrega si su `phone_number_id` es de una conexión y esa entrega es de esa misma
-- conexión y del mismo negocio. Si no coincide, no se modifica nada y el evento queda `failed` con `ownership_mismatch`.
create function public.apply_whatsapp_status_event(p_event_id uuid, p_lease_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_connection_wait constant interval := interval '7 days';
  c_connection_backoff_base constant interval := interval '5 minutes';
  c_connection_backoff_max constant interval := interval '6 hours';
  c_delivery_wait constant interval := interval '2 hours';
  c_delivery_backoff_base constant interval := interval '30 seconds';
  c_delivery_backoff_max constant interval := interval '30 minutes';
  v_event public.whatsapp_webhook_events%rowtype;
  v_connection public.whatsapp_connections%rowtype;
  v_delivery public.reminder_deliveries%rowtype;
  v_at timestamptz;
  v_failed_applies boolean;
begin
  -- Si otro procesador retomó el evento (lease vencido), este ya no es el dueño y no hace nada
  select * into v_event
  from public.whatsapp_webhook_events e
  where e.id = p_event_id and e.process_status = 'processing' and e.lease_id = p_lease_id
  for update;
  if not found then
    return 'lease_lost';
  end if;
  if v_event.kind <> 'status' then
    raise exception 'whatsapp_event_is_not_a_status' using errcode = '22023';
  end if;

  select * into v_connection from public.whatsapp_connections c where c.phone_number_id = v_event.phone_number_id;
  if not found then
    return public.defer_whatsapp_event(v_event.id, 'waiting_connection', 'expired', 'connection_not_found',
      c_connection_wait, c_connection_backoff_base, c_connection_backoff_max);
  end if;
  if v_connection.waba_id is not null and v_event.waba_id is not null and v_connection.waba_id <> v_event.waba_id then
    return public.finish_whatsapp_event(v_event.id, 'failed', 'ownership_mismatch');
  end if;

  select * into v_delivery from public.reminder_deliveries d where d.meta_message_id = v_event.meta_message_id for update;
  if not found then
    return public.defer_whatsapp_event(v_event.id, 'waiting_delivery', 'ignored', 'no_delivery_for_message',
      c_delivery_wait, c_delivery_backoff_base, c_delivery_backoff_max);
  end if;
  if v_delivery.connection_id is distinct from v_connection.id or v_delivery.business_id <> v_connection.business_id then
    return public.finish_whatsapp_event(v_event.id, 'failed', 'ownership_mismatch');
  end if;

  v_at := coalesce(v_event.event_at, v_event.received_at);
  -- Un `failed` no pisa a una entrega que ya se entregó o se leyó (llegó desordenado)
  v_failed_applies := v_event.status_value = 'failed' and public.whatsapp_delivery_rank(v_delivery.status) < public.whatsapp_delivery_rank('delivered');

  update public.reminder_deliveries d
  set sent_at = case when v_event.status_value = 'sent' then least(coalesce(d.sent_at, v_at), v_at) else d.sent_at end,
      delivered_at = case when v_event.status_value = 'delivered' then least(coalesce(d.delivered_at, v_at), v_at) else d.delivered_at end,
      read_at = case when v_event.status_value = 'read' then least(coalesce(d.read_at, v_at), v_at) else d.read_at end,
      status = case
        when public.whatsapp_delivery_rank(d.status) is not null
         and public.whatsapp_delivery_rank(v_event.status_value) > public.whatsapp_delivery_rank(d.status) then v_event.status_value
        else d.status
      end,
      last_error_code = case when v_failed_applies then v_event.error_code else d.last_error_code end,
      last_error_at = case when v_failed_applies then v_at else d.last_error_at end,
      updated_at = now()
  where d.id = v_delivery.id;

  return public.finish_whatsapp_event(v_event.id, 'processed', 'applied');
end;
$$;

-- Registra que un intento falló con una excepción inesperada: reprograma con espera creciente o, agotados los intentos, lo da por fallido
create function public.record_whatsapp_event_error(p_event_id uuid, p_lease_id uuid, p_error_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_attempts constant integer := 8;
  c_backoff_base constant interval := interval '1 minute';
  c_backoff_max constant interval := interval '1 hour';
  c_max_backoff_exponent constant integer := 20;
  v_event public.whatsapp_webhook_events%rowtype;
begin
  select * into v_event
  from public.whatsapp_webhook_events e
  where e.id = p_event_id and e.process_status = 'processing' and e.lease_id = p_lease_id
  for update;
  if not found then
    return 'lease_lost';
  end if;

  if v_event.attempts >= c_max_attempts then
    perform public.finish_whatsapp_event(p_event_id, 'failed', 'processing_error');
    -- Queda el código real del error (SQLSTATE), no el motivo genérico con el que lo cierra finish_whatsapp_event
    update public.whatsapp_webhook_events set last_error_code = p_error_code where id = p_event_id;
    return 'failed';
  end if;

  update public.whatsapp_webhook_events
  set process_status = 'pending',
      result_code = 'retrying',
      next_attempt_at = now() + least(c_backoff_base * power(2, least(greatest(v_event.attempts - 1, 0), c_max_backoff_exponent)), c_backoff_max),
      last_error_code = p_error_code,
      last_error_at = now(),
      lease_id = null,
      lease_expires_at = null
  where id = p_event_id;
  return 'retrying';
end;
$$;

-- Procesador: toma un lote (y lo confirma, para que el lease quede a la vista) y aplica cada evento en su propia transacción.
-- Si se cae a mitad de camino, los eventos tomados quedan `processing` y se recuperan cuando vence su lease.
-- Es un procedimiento sin SET ni SECURITY DEFINER porque PostgreSQL no permite COMMIT en los que los tienen.
create procedure public.process_whatsapp_events(p_limit integer default 100)
language plpgsql
as $$
declare
  v_batch jsonb;
  v_index integer;
  v_id uuid;
  v_lease uuid;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'lease_id', c.lease_id)), '[]'::jsonb)
  into v_batch
  from public.claim_whatsapp_events(p_limit) c;
  commit;

  for v_index in 0 .. jsonb_array_length(v_batch) - 1 loop
    v_id := (v_batch -> v_index ->> 'id')::uuid;
    v_lease := (v_batch -> v_index ->> 'lease_id')::uuid;
    begin
      perform public.apply_whatsapp_status_event(v_id, v_lease);
    exception when others then
      perform public.record_whatsapp_event_error(v_id, v_lease, sqlstate);
    end;
    commit;
  end loop;
end;
$$;

-- Reabre los estados que esperaban una conexión (todavía esperando, o vencidos) para cuando la conexión ya existe.
-- No toca los `ownership_mismatch`: esos necesitan una revisión humana.
create function public.requeue_whatsapp_events(p_phone_number_id text)
returns integer
language sql
security definer
set search_path = ''
as $$
  with reopened as (
    update public.whatsapp_webhook_events
    set process_status = 'pending',
        result_code = 'requeued',
        attempts = 0,
        next_attempt_at = now(),
        processed_at = null
    where phone_number_id = p_phone_number_id
      and kind = 'status'
      and process_status in ('pending', 'expired')
      and result_code in ('waiting_connection', 'connection_not_found')
    returning 1
  )
  select count(*)::integer from reopened;
$$;

-- Retención: borra por completo los eventos viejos (ver el encabezado). Devuelve cuántos borró por estado.
create function public.purge_whatsapp_webhook_events()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.whatsapp_webhook_events e
    where (e.process_status in ('processed', 'ignored') and e.processed_at < now() - interval '30 days')
       or (e.process_status in ('failed', 'expired') and coalesce(e.processed_at, e.received_at) < now() - interval '90 days')
       or (e.process_status = 'stored' and e.received_at < now() - interval '90 days')
    returning e.process_status
  )
  select coalesce(jsonb_object_agg(process_status, events), '{}'::jsonb)
  from (select process_status, count(*) as events from deleted group by process_status) as per_status;
$$;

-- Permisos explícitos: solo el servidor (service_role); ningún usuario ni la API pública puede llamarlas
revoke all on function public.whatsapp_delivery_rank(text) from public, anon, authenticated;
revoke all on function public.ingest_whatsapp_events(jsonb) from public, anon, authenticated;
revoke all on function public.claim_whatsapp_events(integer, integer) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_event(uuid, text, text) from public, anon, authenticated;
revoke all on function public.defer_whatsapp_event(uuid, text, text, text, interval, interval, interval) from public, anon, authenticated;
revoke all on function public.apply_whatsapp_status_event(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_whatsapp_event_error(uuid, uuid, text) from public, anon, authenticated;
revoke all on procedure public.process_whatsapp_events(integer) from public, anon, authenticated;
revoke all on function public.requeue_whatsapp_events(text) from public, anon, authenticated;
revoke all on function public.purge_whatsapp_webhook_events() from public, anon, authenticated;

grant execute on function public.ingest_whatsapp_events(jsonb) to service_role;
grant execute on function public.claim_whatsapp_events(integer, integer) to service_role;
grant execute on function public.apply_whatsapp_status_event(uuid, uuid) to service_role;
grant execute on function public.record_whatsapp_event_error(uuid, uuid, text) to service_role;
grant execute on procedure public.process_whatsapp_events(integer) to service_role;
grant execute on function public.requeue_whatsapp_events(text) to service_role;
grant execute on function public.purge_whatsapp_webhook_events() to service_role;
