-- Aplicar después de configurar la misma clave en Vault y en la Edge Function.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='cale_push_job_secret' and length(decrypted_secret)>=32) then
    raise exception 'configure_cale_push_job_secret_first';
  end if;
end $$;
select cron.schedule('cale-push-delivery','* * * * *',$job$
  select net.http_post(
    url:='https://vncglaoyuaypeftcxxsj.supabase.co/functions/v1/push-delivery',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-job-secret',(select decrypted_secret from vault.decrypted_secrets where name='cale_push_job_secret')),
    body:='{}'::jsonb,
    timeout_milliseconds:=30000
  );
$job$);
