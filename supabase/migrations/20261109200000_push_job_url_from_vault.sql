-- Corrige el job del push (20261104142607) en los proyectos donde ya estaba aplicado con la URL de producción escrita en el comando:
-- ahora la URL sale de Vault (`cale_functions_base_url`) y cada proyecto llama a sus propias funciones. Es idempotente: cron.schedule
-- con el mismo nombre reemplaza el comando del job y en un proyecto nuevo (donde la original ya trae esta forma) no cambia nada.
-- Antes de aplicarla en un proyecto, cargar en Vault `cale_functions_base_url` (https://<ref>.supabase.co/functions/v1, sin barra final);
-- sin ese secreto la migración falla a propósito, para que el job nunca vuelva a apuntar a otro entorno.
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
