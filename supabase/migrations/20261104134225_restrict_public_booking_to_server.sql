-- Tras publicar el formulario con Turnstile, solo el servidor puede crear reservas públicas.
revoke execute on function public.create_booking(text, uuid, date, time without time zone, text, text, boolean) from public, anon, authenticated;
