-- Apply only AFTER web-push.sql, Edge Function deployment and Vault setup.
-- This SQL contains no keys. Never grant clients access to Vault/net queues.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'fortalaka_push_project_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'fortalaka_push_dispatch_secret') then
    raise exception 'Configure os dois secrets do push no Vault antes de ativar o agendamento.';
  end if;
end;
$$;

-- cron.schedule updates the existing named job instead of creating duplicates.
select cron.schedule('fortalaka-enviar-push', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fortalaka_push_project_url') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fortalaka_push_dispatch_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) where exists (
    select 1 from public.push_deliveries
    where status in ('pending', 'processing')
  );
$job$);
commit;
