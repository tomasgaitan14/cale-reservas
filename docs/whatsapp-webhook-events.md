# Bandeja de entrada de los webhooks de WhatsApp

Cómo se guardan y se procesan los avisos que manda Meta (mensajes y estados de entrega). La migración es
`supabase/migrations/20261105153000_create_whatsapp_webhook_events.sql`. La Edge Function que los recibe vive en `cale-api`
(`whatsapp-webhook`); el esquema, acá (ver [`migrations.md`](migrations.md)).

## Flujo

1. Meta llama a `whatsapp-webhook`, que valida el token (GET) o la firma HMAC (POST).
2. Con la firma válida, la función arma un ítem por cada mensaje y cada estado del aviso y los guarda con `ingest_whatsapp_events`.
   **Recién cuando se guardaron responde 200.** Si la base falla responde 500 y Meta reintenta.
3. `process_whatsapp_events` (programado con pg_cron, en una etapa aparte) toma los estados pendientes y los aplica a
   `reminder_deliveries`.
4. Los mensajes entrantes se guardan como `stored` y **no se procesan** todavía (botones, cancelaciones y bajas son otra etapa).

Mientras el procesador y la purga no estén programados, la tabla solo acumula.

## Estados de un evento

| `process_status` | Significado |
|---|---|
| `pending` | Un estado esperando su turno (`next_attempt_at`) o un reintento. |
| `processing` | Tomado por un procesador, con un lease (`lease_id`, `lease_expires_at`). |
| `processed` | Aplicado a `reminder_deliveries` (`result_code = applied`). |
| `ignored` | Se descartó con motivo: `no_delivery_for_message`. |
| `failed` | Necesita revisión: `ownership_mismatch` o `processing_error`. |
| `expired` | Esperó una conexión que nunca apareció (`connection_not_found`). **No se borra al vencer**; se puede reabrir. |
| `stored` | Mensaje entrante u otro tipo guardado, sin procesar. |

## Deduplicación

Meta puede repetir un aviso o mandarlo desordenado, y no manda un id único por entrega. La clave `event_key` (única) es:

- mensaje: `msg:<wamid>`
- estado: `status:<wamid>:<estado>:<timestamp de Meta>`
- otro tipo: `other:<sha256 del contenido>`

El timestamp está en la clave a propósito: un `failed` reintentado por Meta con otra hora es un evento legítimo y se guarda
aparte. Un aviso idéntico repetido se descarta (`duplicates` en la respuesta de `ingest_whatsapp_events`).

## Avisos desordenados

El estado de una entrega solo sube: `sent` (1) < `failed` (2) < `delivered` (3) < `read` (4). Cada aviso completa su propia hora
(`sent_at`, `delivered_at`, `read_at`; si hay repetidos, queda la más temprana) y el estado queda en el más avanzado, llegue en el
orden que llegue (un test prueba las 6 permutaciones). Un `failed` tardío no pisa una entrega ya entregada o leída, y una
entrega `cancelled` conserva su estado. El resultado no depende del orden.

## Aislamiento entre negocios

El procesador solo modifica una entrega si todo coincide: el `phone_number_id` del aviso es de una conexión
(`whatsapp_connections`), el `waba_id` coincide cuando ambos están, y la entrega es de **esa misma conexión y del mismo
negocio**. Si no, no toca nada y el evento queda `failed` con `ownership_mismatch` para revisarlo a mano. Esos eventos no se
reabren solos ni con `requeue_whatsapp_events`.

## Reintentos y vencimientos

| Situación | Qué pasa |
|---|---|
| `phone_number_id` sin conexión todavía | Se reintenta con espera creciente (5 min, 10, 20… tope 6 h) durante **7 días**. Después queda `expired`, con el contenido intacto. `requeue_whatsapp_events(<phone_number_id>)` lo reabre cuando la conexión ya existe. |
| Mensaje sin entrega asociada (Meta avisa antes de que se guarde el id) | Espera creciente (30 s, 1 min… tope 30 min) durante **2 horas**; después `ignored` (típico de los envíos de prueba). |
| Excepción inesperada | Hasta **8 intentos** con espera creciente (1 min… tope 1 h); después `failed` / `processing_error`, con el SQLSTATE en `last_error_code`. |

## Eventos en `processing` que quedaron colgados

`claim_whatsapp_events` pone el evento en `processing` con un lease de 5 minutos y **lo confirma** antes de procesar (por eso
`process_whatsapp_events` es un procedimiento con `COMMIT`; verificado también corriendo bajo pg_cron). Si el procesador se cae
a mitad de camino (reinicio, timeout, conexión cortada), esos eventos quedan `processing` con el lease vencido y **la siguiente
corrida los retoma sola**: la misma consulta que toma los pendientes toma también los `processing` con `lease_expires_at` en el
pasado. Cada toma cuenta como un intento, así que un evento que tumba al procesador una y otra vez termina en `failed` a los 8
intentos en vez de bloquear la cola. Quien perdió el lease (`lease_lost`) no puede aplicar nada.

Para mirarlos: `select * from public.whatsapp_webhook_events where process_status = 'processing' and lease_expires_at < now();`
Si el cron estuviera apagado, se procesa a mano con `call public.process_whatsapp_events(100);`.

## Retención y qué se borra

`purge_whatsapp_webhook_events()` borra **la fila entera** (el contenido trae teléfonos, nombres y textos de clientes). Los plazos
no están en el código: viven en `whatsapp_events_retention`, una tabla de una sola fila.

| Eventos | Columna | Por defecto | Por qué |
|---|---|---|---|
| `processed`, `ignored` | `processed_days` | 30 días | El resultado ya quedó en `reminder_deliveries`; el evento crudo solo sirve para diagnosticar. |
| `failed`, `expired` | `failed_days` | 90 días | Hay que poder investigar un `ownership_mismatch` o una conexión que apareció tarde, y eso puede tardar. |
| `stored` (mensajes entrantes sin procesar) | `stored_days` | 90 días (provisorio) | Ver abajo. |
| `pending`, `processing` | — | nunca | Siempre terminan en uno de los estados de arriba. |

**Por qué 90 días para los mensajes entrantes sin procesar (provisorio).** Hoy ninguna etapa los procesa (botones, cancelaciones y
bajas son otra etapa), pero son los mensajes reales de los clientes: perderlos antes de construir esa etapa sería perder
confirmaciones o pedidos de baja. 90 días da margen para construirla y para reprocesar lo acumulado, y es el mismo plazo que los
fallidos, que tampoco están resueltos. Es un plazo largo para datos personales, así que **se revisa cuando exista la etapa que los
procesa** (entonces pasan a `processed` y a los 30 días).

**Cómo se cambia.** Un `UPDATE` de la fila, sin tocar código, cron ni funciones:

```sql
update public.whatsapp_events_retention set stored_days = 60, updated_at = now();
```

Cada plazo admite de 1 a 365 días (un error de tipeo no borra todo de golpe ni guarda datos para siempre) y la tabla solo la
leen y escriben el servidor y quien administra la base. En producción, cambiarlo es un cambio de configuración: pide aprobación. Si
la fila faltara, la purga falla con `55000` y no borra nada (en vez de borrar con un plazo inventado).

**Efecto en la auditoría.** Esta tabla es una bandeja operativa, no un registro de auditoría. Lo que perdura es el resultado en
`reminder_deliveries` (estado, `sent_at`, `delivered_at`, `read_at`, `last_error_code`, `last_error_at`), que no se purga. Pasado el plazo de
cada grupo ya no se puede reproducir un aviso ni ver su contenido original. Tampoco hay deduplicación contra avisos más viejos que
la retención: Meta reintenta avisos fallidos por un plazo acotado (verificar el plazo exacto en su documentación antes de acortar
`processed_days`). Si alguna vez hace falta una auditoría más larga, se guarda aparte lo que se necesite sin el contenido (por ejemplo,
solo ids y estados), no se alarga la retención del contenido.

## Salud

`select * from public.whatsapp_webhook_events_health;` cuenta los eventos por tipo, estado y motivo, sin mostrar contenido.
Señales de problema: `failed`, `expired` o `pending` con `oldest_received_at` muy viejo.

## Qué no hace todavía

Responder a los botones (confirmar, cancelar, cambiar horario), la baja automática, crear los recordatorios (los registros de
`reminder_deliveries` los creará el programador de recordatorios) y programar el procesador y la purga con pg_cron.
