-- Permisos de datos del servidor (service_role) sobre las tablas de WhatsApp.
--
-- En producción, las tablas nuevas de `public` no le dan a service_role ningún permiso de lectura ni de escritura por defecto (en el
-- Supabase local sí: ahí se concede todo), y la migración que creó estas dos tablas no se los dio. Hoy ninguna función del servidor
-- las toca directo, pero la primera que lo haga pasaría los tests locales y fallaría con "permission denied" solo en producción.
--
-- Solo los permisos de datos: ni TRUNCATE, REFERENCES, TRIGGER ni MAINTAIN. anon y authenticated siguen sin ningún permiso.
-- Es idempotente: volver a correrla no cambia nada.
grant select, insert, update, delete on table public.whatsapp_connections to service_role;
grant select, insert, update, delete on table public.reminder_deliveries to service_role;
