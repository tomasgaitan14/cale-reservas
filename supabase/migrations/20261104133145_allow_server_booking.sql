-- Permite reservar desde la Edge Function tras validar Turnstile.
-- La revocación de clientes se hará después de publicar la nueva interfaz.
grant execute on function public.create_booking(text, uuid, date, time without time zone, text, text, boolean) to service_role;
