-- Activa con pg_cron el procesador y la purga de la bandeja de webhooks de WhatsApp (ver docs/whatsapp-webhook-events.md).
--
--   cale-whatsapp-events-process  cada minuto   call public.process_whatsapp_events(100)
--       Toma hasta 100 estados pendientes por corrida y los aplica a reminder_deliveries. Con la bandeja vacía no hace nada: una
--       consulta sobre un índice parcial. Si una corrida dura más que un minuto, pg_cron no arranca otra encima, y aunque lo hiciera
--       claim_whatsapp_events usa SKIP LOCKED. Los eventos que una corrida dejó `processing` (se cayó) los retoma la siguiente.
--   cale-whatsapp-events-purge    todos los días a las 06:00 UTC (03:00 en Argentina)   select public.purge_whatsapp_webhook_events()
--       Borra los eventos viejos según los plazos de whatsapp_events_retention.
--
-- Es idempotente: cron.schedule con el mismo nombre actualiza el job en vez de duplicarlo. Falla sin crear nada si todavía no se aplicó
-- la migración de la bandeja. Para pausar sin borrar:
--   update cron.job set active = false where jobname like 'cale-whatsapp-events-%';
-- Para quitarlos: select cron.unschedule('cale-whatsapp-events-process'); select cron.unschedule('cale-whatsapp-events-purge');
create extension if not exists pg_cron;

do $$
begin
  if to_regprocedure('public.process_whatsapp_events(integer)') is null
     or to_regprocedure('public.purge_whatsapp_webhook_events()') is null then
    raise exception 'apply_the_whatsapp_webhook_events_migration_first';
  end if;
end $$;

select cron.schedule('cale-whatsapp-events-process', '* * * * *', $job$call public.process_whatsapp_events(100)$job$);
select cron.schedule('cale-whatsapp-events-purge', '0 6 * * *', $job$select public.purge_whatsapp_webhook_events()$job$);
