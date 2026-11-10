-- Apply after notificacoes.sql and pagamentos.sql. No historical backfill.
begin;

create or replace function public.push_endpoint_valido(p_endpoint text)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(length(p_endpoint) between 1 and 2048 and p_endpoint ~
 '^https://(fcm[.]googleapis[.]com|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+notify[.]windows[.]com)/[A-Za-z0-9._~!$&''()*+,;=:@%/?-]+$', false)
$$;
revoke all on function public.push_endpoint_valido(text) from public,anon,authenticated;

create or replace function public.push_chaves_validas(p_p256dh text,p_auth text)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select case when coalesce(p_p256dh ~ '^B[A-P][A-Za-z0-9_-]{84}[AEIMQUYcgkosw048]$'
  and p_auth ~ '^[A-Za-z0-9_-]{21}[AQgw]$',false) then
   octet_length(decode(translate(p_p256dh,'-_','+/')||'=','base64'))=65
   and get_byte(decode(translate(p_p256dh,'-_','+/')||'=','base64'),0)=4
   and octet_length(decode(translate(p_auth,'-_','+/')||'==','base64'))=16
  else false end
$$;
revoke all on function public.push_chaves_validas(text,text) from public,anon,authenticated;

create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique check(public.push_endpoint_valido(endpoint)),
 p256dh text not null,
 auth text not null,
 version uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(public.push_chaves_validas(p256dh,auth))
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,delete on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
 using(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active));
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated
 using(user_id=auth.uid());

create or replace function public.registrar_push(p_endpoint text,p_p256dh text,p_auth text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 -- Serialize per-user registrations so concurrent devices cannot exceed the cap.
 perform 1 from public.profiles where id=auth.uid() and active for update;
 if not found then
  raise exception 'Entre para ativar notificacoes.';
 end if;
 if not public.push_endpoint_valido(p_endpoint) or not public.push_chaves_validas(p_p256dh,p_auth) then
  raise exception 'Inscricao push invalida.';
 end if;
 if not exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid())
    and (select count(*) from public.push_subscriptions where user_id=auth.uid())>=10 then
  raise exception 'Limite de dispositivos atingido.';
 end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth)
 values(auth.uid(),p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,
  version=gen_random_uuid(),updated_at=now()
 where push_subscriptions.user_id=auth.uid()
 returning id into result;
 if result is null then raise exception 'Endpoint indisponivel.'; end if;
 return result;
end; $$;

create or replace function public.remover_push(p_endpoint text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null then
  raise exception 'Entre para remover notificacoes.';
 end if;
 delete from public.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint;
 return found;
end; $$;

create or replace function public.push_ativo(p_endpoint text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.push_subscriptions s join public.profiles p on p.id=s.user_id
  where s.user_id=auth.uid() and p.active and s.endpoint=p_endpoint)
$$;

create table if not exists public.push_deliveries (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 claim_token uuid,
 subscription_version uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(notification_id,subscription_id),
 check((status='processing')=(claim_token is not null and lease_until is not null))
);
create index if not exists push_deliveries_pending_idx on public.push_deliveries(next_attempt_at,created_at)
 where status='pending';
create index if not exists push_deliveries_lease_idx on public.push_deliveries(lease_until) where status='processing';
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public,anon,authenticated;

create or replace function public.enfileirar_push()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 insert into public.push_deliveries(notification_id,subscription_id)
 select new.id,s.id from public.push_subscriptions s join public.profiles p on p.id=s.user_id
 where s.user_id=new.recipient_id and p.active
 on conflict(notification_id,subscription_id) do nothing;
 return new;
end; $$;
revoke all on function public.enfileirar_push() from public,anon,authenticated;
drop trigger if exists enfileirar_push on public.notifications;
create trigger enfileirar_push after insert on public.notifications for each row execute function public.enfileirar_push();

-- ACLs restrict these RPCs to service_role; each lease gets a fresh fencing token.
create or replace function public.reclamar_push(p_limite integer default 50)
returns table(id uuid,claim_token uuid,endpoint text,p256dh text,auth text,
 notification_id uuid,title text,body text,destination text,round_id uuid)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'Limite invalido.'; end if;
 with exhausted as (
  select d.id from public.push_deliveries d join public.notifications n on n.id=d.notification_id
  where (d.attempts>=5 or n.created_at<=now()-interval '24 hours')
   and (d.status='pending' or (d.status='processing' and d.lease_until<=now()))
  order by d.id limit p_limite for update of d skip locked
 )
 update public.push_deliveries d set status='failed',claim_token=null,lease_until=null,updated_at=now()
 from exhausted e where d.id=e.id;
 return query
 with candidates as (
  select d.id from public.push_deliveries d
  join public.push_subscriptions s on s.id=d.subscription_id
  join public.profiles p on p.id=s.user_id and p.active
  join public.notifications n on n.id=d.notification_id and n.recipient_id=s.user_id
  where d.attempts<5 and n.created_at>now()-interval '24 hours'
   and ((d.status='pending' and d.next_attempt_at<=now())
    or (d.status='processing' and d.lease_until<=now()))
  order by d.created_at,d.id limit p_limite for update of d skip locked
 ), claimed as (
  update public.push_deliveries d set status='processing',attempts=d.attempts+1,
   claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now(),
   subscription_version=s.version
  from candidates c,public.push_subscriptions s where d.id=c.id and s.id=d.subscription_id
  returning d.*
 )
 select c.id,c.claim_token,s.endpoint,s.p256dh,s.auth,n.id,n.title,n.body,n.destination,n.round_id
 from claimed c join public.push_subscriptions s on s.id=c.subscription_id
 join public.notifications n on n.id=c.notification_id;
end; $$;

create or replace function public.finalizar_push(p_id uuid,p_claim_token uuid,p_resultado text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare delivery public.push_deliveries%rowtype;
begin
 if p_resultado is null or p_resultado not in ('sent','retry','gone','failed') then
  raise exception 'Resultado invalido.';
 end if;
 select * into delivery from public.push_deliveries d where d.id=p_id and d.status='processing'
  and d.claim_token=p_claim_token and d.lease_until>now() for update;
 if not found then return false; end if;
 if p_resultado='gone' then
  -- A delayed provider response must never delete a renewed subscription.
  delete from public.push_subscriptions where id=delivery.subscription_id and version=delivery.subscription_version;
 end if;
 update public.push_deliveries set
  status=case when p_resultado='sent' then 'sent'
   when p_resultado='retry' and attempts<5 then 'pending' else 'failed' end,
  next_attempt_at=case when p_resultado='retry' then now()+make_interval(secs=>least(3600,30*(2^(attempts-1))::integer)) else next_attempt_at end,
  claim_token=null,lease_until=null,updated_at=now()
 where push_deliveries.id=p_id;
 return true;
end; $$;

create or replace function public.notificar_pagamento_recebido()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if old.status_pagamento='pendente' and new.status_pagamento='recebido' then
  insert into public.notifications(recipient_id,round_id,event_key,title,body,destination)
  select p.id,new.racha_id,'pagamento_recebido:'||new.id::text,
   'Pagamento confirmado','O pagamento da sua participacao foi confirmado.','racha'
  from public.profiles p where p.id=new.jogador_id and p.active
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.notificar_pagamento_recebido() from public,anon,authenticated;
drop trigger if exists notificar_pagamento_recebido on public.racha_participantes;
create trigger notificar_pagamento_recebido after update of status_pagamento on public.racha_participantes
 for each row execute function public.notificar_pagamento_recebido();

revoke all on function public.registrar_push(text,text,text),public.remover_push(text),public.push_ativo(text) from public,anon,authenticated;
grant execute on function public.registrar_push(text,text,text),public.remover_push(text),public.push_ativo(text) to authenticated;
revoke all on function public.reclamar_push(integer),public.finalizar_push(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reclamar_push(integer),public.finalizar_push(uuid,uuid,text) to service_role;
commit;
