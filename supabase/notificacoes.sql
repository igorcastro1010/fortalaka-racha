-- Incremental e não destrutiva. Executar após fluxo-principal.sql, avaliacoes.sql
-- e finalizar-rodada.sql. Sem backfill, sem subscriptions ou secrets de push.
begin;
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 round_id uuid references public.rachas(id) on delete set null,
 event_key text not null,
 title text not null,
 body text not null,
 destination text not null check(destination in ('racha','teams','results','evaluate','profile')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_id,event_key)
);
create index if not exists notifications_recipient_date_idx on public.notifications(recipient_id,created_at desc,id desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (
 recipient_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
);

create or replace function public.marcar_notificacoes_lidas(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para consultar suas notificações.'; end if;
 update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null and (p_ids is null or id=any(p_ids));
 get diagnostics changed=row_count;
 return changed;
end; $$;
revoke all on function public.marcar_notificacoes_lidas(uuid[]) from public,anon;
grant execute on function public.marcar_notificacoes_lidas(uuid[]) to authenticated;

create or replace function public.notificar_estado_rodada()
returns trigger language plpgsql security definer set search_path=public as $$
declare kind text; heading text; detail text; target text;
begin
 if tg_op='INSERT' or new.estado is distinct from old.estado then
  case new.estado
   when 'aberto' then kind:='lista_aberta';heading:='Lista aberta';detail:='A lista da rodada está aberta para inscrições.';target:='racha';
   when 'lista_fechada' then kind:='lista_fechada';heading:='Lista fechada';detail:='A lista foi fechada. Aguarde a confirmação dos times.';target:='racha';
   when 'times_confirmados' then kind:='times_confirmados';heading:='Times confirmados';detail:='Confira a composição dos times da rodada.';target:='teams';
   when 'em_andamento' then kind:='rodada_iniciada';heading:='Rodada iniciada';detail:='As partidas da rodada começaram.';target:='results';
   when 'finalizado' then kind:='rodada_finalizada';heading:='Rodada finalizada';detail:='O resumo e os resultados já estão disponíveis.';target:='results';
   else null;
  end case;
  if kind is not null then
   insert into public.notifications(recipient_id,round_id,event_key,title,body,destination)
   select p.id,new.id,new.id::text||':'||kind||':'||coalesce(new.updated_at,now())::text,heading,detail,target from public.profiles p where p.active
   on conflict(recipient_id,event_key) do nothing;
  end if;
 end if;
 if tg_op='UPDATE' and new.avaliacoes_abertas is distinct from old.avaliacoes_abertas then
  insert into public.notifications(recipient_id,round_id,event_key,title,body,destination)
  select p.id,new.id,new.id::text||':avaliacoes:'||new.avaliacoes_abertas::text||':'||coalesce(new.updated_at,now())::text,
   case when new.avaliacoes_abertas then 'Avaliações abertas' else 'Avaliações encerradas' end,
   case when new.avaliacoes_abertas then 'Avalie os companheiros elegíveis do seu time.' else 'O período de avaliação desta rodada foi encerrado.' end,'evaluate'
  from public.profiles p where p.active and (p.role='organizador' or exists(
   select 1 from public.partida_jogadores j join public.partidas m on m.id=j.partida_id where m.racha_id=new.id and m.status='finalizada' and j.participou and j.jogador_id=p.id))
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.notificar_estado_rodada() from public,anon,authenticated;
drop trigger if exists notificar_estado_rodada on public.rachas;
create trigger notificar_estado_rodada after insert or update of estado,avaliacoes_abertas on public.rachas for each row execute function public.notificar_estado_rodada();

-- O rascunho é privado dos organizadores; não anunciar times não confirmados aos jogadores.
create or replace function public.notificar_rascunho_times()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not new.confirmado then
  insert into public.notifications(recipient_id,round_id,event_key,title,body,destination)
  select p.id,new.racha_id,new.racha_id::text||':rascunho_times','Times definidos','Revise a composição antes de confirmar os times.','teams'
  from public.profiles p where p.active and p.role='organizador' on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.notificar_rascunho_times() from public,anon,authenticated;
drop trigger if exists notificar_rascunho_times on public.times;
create trigger notificar_rascunho_times after insert on public.times for each row execute function public.notificar_rascunho_times();

-- Marcos são eventos de comunicação, não outra fonte de estatísticas ou conquistas.
create or replace function public.notificar_marcos_jogadores()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='finalizada' then
  insert into public.notifications(recipient_id,round_id,event_key,title,body,destination)
  select s.jogador_id,new.racha_id,'marco:'||v.metric||':'||v.target::text,'Nova conquista',
    case when v.metric='gols' and v.target=1 then 'Primeiro gol registrado.' when v.metric='assistencias' and v.target=1 then 'Primeira assistência registrada.'
    else v.target::text||' '||case v.metric when 'gols' then 'gols' when 'jogos' then 'jogos' when 'assistencias' then 'assistências' else 'vitórias' end||' em partidas finalizadas.' end,'profile'
  from public.estatisticas_jogadores s join public.profiles p on p.id=s.jogador_id and p.active
  cross join (values ('gols',1),('gols',10),('gols',25),('gols',50),('jogos',10),('jogos',25),('jogos',50),('assistencias',1),('assistencias',10),('assistencias',25),('vitorias',10),('vitorias',25)) v(metric,target)
  where exists(select 1 from public.partida_jogadores j where j.partida_id=new.id and j.jogador_id=s.jogador_id and j.participou)
   and case v.metric when 'gols' then s.gols when 'jogos' then s.jogos when 'assistencias' then s.assistencias else s.vitorias end>=v.target
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.notificar_marcos_jogadores() from public,anon,authenticated;
drop trigger if exists notificar_marcos_jogadores on public.partidas;
create trigger notificar_marcos_jogadores after update on public.partidas for each row execute function public.notificar_marcos_jogadores();
commit;
