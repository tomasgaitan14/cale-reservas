-- Aplicar después de cargar en Vault `cale_push_job_secret` (la misma clave que la Edge Function, PUSH_JOB_SECRET) y
-- `cale_functions_base_url` (URL base de las Edge Functions del proyecto, sin barra final: https://<ref>.supabase.co/functions/v1).
-- La URL del proyecto ya no está escrita acá: cada proyecto (cale-dev, cale-api) declara la suya en Vault, así este job nunca llama a otro
-- entorno. Se editó el 09/11/2026 aunque ya estaba aplicada en cale-api (tenía la URL de producción fija y en cale-dev llamó a producción);
-- 20261109200000_push_job_url_from_vault.sql actualiza el job en los proyectos donde ya existía. Ver docs/migrations.md.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='cale_push_job_secret' and length(decrypted_secret)>=32) then
    raise exception 'configure_cale_push_job_secret_first';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='cale_functions_base_url' and decrypted_secret ~ '^https?://[^/]+/functions/v1$') then
    raise exception 'configure_cale_functions_base_url_first';
  end if;
end $$;
select cron.schedule('cale-push-delivery','* * * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='cale_functions_base_url')||'/push-delivery',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-job-secret',(select decrypted_secret from vault.decrypted_secrets where name='cale_push_job_secret')),
    body:='{}'::jsonb,
    timeout_milliseconds:=30000
  );
$job$);
