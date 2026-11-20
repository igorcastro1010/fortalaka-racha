-- Aplicar depois da V1.2 e detalhes_avaliacoes_organizador. Nao altera dados ao instalar.
begin;
create table if not exists public.presencas_rodada (
  racha_id uuid not null references public.rachas(id),
  jogador_id uuid not null references public.profiles(id),
  presente boolean not null,
  atualizado_por uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(racha_id,jogador_id)
);
create table if not exists public.correcoes_presenca (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id),
  jogador_id uuid not null references public.profiles(id),
  presente boolean not null,
  responsavel uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  avaliacoes_invalidadas jsonb not null default '[]'::jsonb
);
alter table public.presencas_rodada enable row level security;
alter table public.correcoes_presenca enable row level security;
revoke all on public.presencas_rodada,public.correcoes_presenca from public,anon,authenticated;

-- Helper interno: ausencia nao inventa nem zera notas historicas.
create or replace function public.faltou_rodada(p_racha uuid,p_jogador uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.presencas_rodada where racha_id=p_racha and jogador_id=p_jogador and not presente);
$$;
revoke all on function public.faltou_rodada(uuid,uuid) from public,anon;
grant execute on function public.faltou_rodada(uuid,uuid) to authenticated;

create or replace function public.ler_presencas_rodada(p_racha uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_organizer(auth.uid()) or not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception 'Somente organizadores ativos podem consultar presencas.';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nome',p.name,'avatar_url',p.avatar_url,
    'presente',s.presente,'avaliacoes',(select count(*) from public.avaliacoes a where a.racha_id=p_racha and (a.avaliador_id=p.id or a.avaliado_id=p.id))) order by p.name,p.id)
    from public.profiles p left join public.presencas_rodada s on s.racha_id=p_racha and s.jogador_id=p.id
    where exists(select 1 from public.racha_participantes rp where rp.racha_id=p_racha and rp.jogador_id=p.id and rp.status<>'removido')
      or exists(select 1 from public.partida_jogadores j join public.partidas m on m.id=j.partida_id where m.racha_id=p_racha and j.jogador_id=p.id)),'[]'::jsonb);
end; $$;

create or replace function public.registrar_presenca(p_racha uuid,p_jogador uuid,p_presente boolean,p_avaliacoes_esperadas integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare notas jsonb; quantidade integer;
begin
  if not public.is_organizer(auth.uid()) or not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception 'Somente organizadores ativos podem registrar presenca.';
  end if;
  if p_presente is null then raise exception 'Informe a presenca.'; end if;
  perform 1 from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada nao encontrada.'; end if;
  if not exists(select 1 from public.racha_participantes where racha_id=p_racha and jogador_id=p_jogador)
    and not exists(select 1 from public.partida_jogadores j join public.partidas m on m.id=j.partida_id where m.racha_id=p_racha and j.jogador_id=p_jogador) then
    raise exception 'Jogador nao pertence a rodada.';
  end if;
  if exists(select 1 from public.presencas_rodada where racha_id=p_racha and jogador_id=p_jogador and presente=p_presente) then
    return jsonb_build_object('invalidadas',0);
  end if;
  notas := '[]'::jsonb;
  if not p_presente then
    select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb),count(*) into notas,quantidade
      from public.avaliacoes a where a.racha_id=p_racha and (a.avaliador_id=p_jogador or a.avaliado_id=p_jogador);
    if quantidade is distinct from p_avaliacoes_esperadas then raise exception 'PRESENCA_DESATUALIZADA'; end if;
    -- Uma falta contradiz eventos positivos; nao apagar gols ou assistencias automaticamente.
    if exists(select 1 from public.eventos_partida e join public.partidas m on m.id=e.partida_id
      where m.racha_id=p_racha and e.jogador_id=p_jogador and e.quantidade>0 and m.status<>'cancelada') then
      raise exception 'PRESENCA_COM_EVENTOS';
    end if;
  end if;
  insert into public.correcoes_presenca(racha_id,jogador_id,presente,responsavel,avaliacoes_invalidadas)
    values(p_racha,p_jogador,p_presente,auth.uid(),notas);
  insert into public.presencas_rodada(racha_id,jogador_id,presente,atualizado_por)
    values(p_racha,p_jogador,p_presente,auth.uid()) on conflict(racha_id,jogador_id) do update
    set presente=excluded.presente,atualizado_por=excluded.atualizado_por,updated_at=now();
  if not p_presente then
    delete from public.avaliacoes where racha_id=p_racha and (avaliador_id=p_jogador or avaliado_id=p_jogador);
  end if;
  -- Reutiliza a invalidacao realtime existente, sem novo polling.
  update public.rachas set updated_at=now() where id=p_racha;
  return jsonb_build_object('invalidadas',jsonb_array_length(notas));
end; $$;

-- Serializa avaliacoes e correcao de presenca na mesma rodada.
create or replace function public.proteger_avaliacao_presenca() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.rachas where id=new.racha_id for update;
  if public.faltou_rodada(new.racha_id,new.avaliador_id) or public.faltou_rodada(new.racha_id,new.avaliado_id) then
    raise exception 'Jogador ausente nao pode enviar ou receber avaliacoes.';
  end if;
  return new;
end; $$;
drop trigger if exists aa_presenca_avaliacao on public.avaliacoes;
create trigger aa_presenca_avaliacao before insert or update on public.avaliacoes for each row execute function public.proteger_avaliacao_presenca();
revoke all on function public.proteger_avaliacao_presenca() from public,anon,authenticated;

create or replace function public.proteger_evento_presenca() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare rodada uuid;
begin
  select racha_id into rodada from public.partidas where id=new.partida_id;
  perform 1 from public.rachas where id=rodada for update;
  if new.quantidade>0 and public.faltou_rodada(rodada,new.jogador_id) then
    raise exception 'Corrija a presenca antes de registrar eventos para um jogador ausente.';
  end if;
  return new;
end; $$;
drop trigger if exists aa_presenca_evento on public.eventos_partida;
create trigger aa_presenca_evento before insert or update on public.eventos_partida for each row execute function public.proteger_evento_presenca();
revoke all on function public.proteger_evento_presenca() from public,anon,authenticated;

create or replace function public.time_participante_avaliacao(p_racha uuid,p_jogador uuid)
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tid uuid;
begin
  if public.faltou_rodada(p_racha,p_jogador) then return null; end if;
  select j.time_id into tid from public.partida_jogadores j join public.partidas p on p.id=j.partida_id
    join public.times t on t.id=j.time_id
    where p.racha_id=p_racha and p.status='finalizada' and j.participou and j.jogador_id=p_jogador and t.racha_id=p_racha and t.confirmado
    group by j.time_id order by count(*) desc,j.time_id limit 1;
  return tid;
end; $$;

create or replace function public.ler_progresso_avaliacoes(p_racha uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare total integer; respondentes integer; abertas boolean;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso nao autorizado.'; end if;
  select avaliacoes_abertas into abertas from public.rachas where id=p_racha;
  select count(distinct j.jogador_id) into total from public.partida_jogadores j join public.partidas p on p.id=j.partida_id
    where p.racha_id=p_racha and p.status='finalizada' and j.participou and not public.faltou_rodada(p_racha,j.jogador_id);
  select count(distinct avaliador_id) into respondentes from public.avaliacoes where racha_id=p_racha;
  return jsonb_build_object('total',total,'respondentes',respondentes,'abertas',coalesce(abertas,false));
end; $$;

create or replace function public.ler_avaliacoes_atual(p_racha uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r public.rachas%rowtype; my_team uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para avaliar.'; end if;
  select * into r from public.rachas where p_racha is null or id=p_racha order by data desc nulls last,created_at desc,id desc limit 1;
  if not found then return null; end if;
  my_team := public.time_participante_avaliacao(r.id,auth.uid());
  return jsonb_build_object('roundId',r.id,'roundName',r.nome,'roundStatus',r.estado,'open',r.avaliacoes_abertas,
    'canEvaluate',r.avaliacoes_abertas and my_team is not null,'teamId',my_team,
    'players',coalesce((select jsonb_agg(jsonb_build_object('jogador_id',p.id,'nome',p.name,'avatar_url',p.avatar_url,
      'avaliado',a.id is not null,'passe',a.passe,'chute',a.chute,'velocidade',a.velocidade,'defesa',a.defesa,'fisico',a.fisico) order by p.name,p.id)
      from (select distinct j.jogador_id from public.partida_jogadores j join public.partidas pa on pa.id=j.partida_id
        where pa.racha_id=r.id and pa.status='finalizada' and j.participou and j.time_id=my_team and j.jogador_id<>auth.uid()
        and not public.faltou_rodada(r.id,j.jogador_id)) eligible
      join public.profiles p on p.id=eligible.jogador_id and p.active
      left join public.avaliacoes a on a.racha_id=r.id and a.avaliador_id=auth.uid() and a.avaliado_id=p.id),'[]'::jsonb));
end; $$;

revoke all on function public.ler_presencas_rodada(uuid),public.registrar_presenca(uuid,uuid,boolean,integer) from public,anon;
grant execute on function public.ler_presencas_rodada(uuid),public.registrar_presenca(uuid,uuid,boolean,integer) to authenticated;

create or replace function public.v12_jogos(p_jogador uuid,p_racha uuid default null)
returns table(id uuid,racha_id uuid,nome text,data date,estado text,created_at timestamptz,
 time_id uuid,time_a text,time_b text,placar_a integer,placar_b integer,resultado text)
language sql stable set search_path=public,pg_temp as $$
 select p.id,p.racha_id,r.nome,r.data,r.estado,p.created_at,j.time_id,a.nome,b.nome,p.placar_a,p.placar_b,
 case when p.placar_a=p.placar_b then 'E'
 when (j.time_id=p.time_a_id and p.placar_a>p.placar_b) or (j.time_id=p.time_b_id and p.placar_b>p.placar_a) then 'V' else 'D' end
 from public.partida_jogadores j join public.partidas p on p.id=j.partida_id
 join public.rachas r on r.id=p.racha_id
 join public.times a on a.id=p.time_a_id and a.racha_id=p.racha_id
 join public.times b on b.id=p.time_b_id and b.racha_id=p.racha_id
 where j.jogador_id=p_jogador and j.participou and j.time_id in(p.time_a_id,p.time_b_id)
 and not public.faltou_rodada(p.racha_id,p_jogador)
 and (p_racha is null or p.racha_id=p_racha)
 and p.time_a_id<>p.time_b_id and p.status='finalizada' and p.placar_a>=0 and p.placar_b>=0;
$$;
revoke all on function public.v12_jogos(uuid,uuid) from public,anon,authenticated;

create or replace view public.estatisticas_jogadores with(security_invoker=true) as
with participacoes as (
 select j.jogador_id,count(*) as jogos,count(*) filter(where (j.time_id=p.time_a_id and p.placar_a>p.placar_b) or (j.time_id=p.time_b_id and p.placar_b>p.placar_a)) as vitorias
 from public.partida_jogadores j join public.partidas p on p.id=j.partida_id
 where j.participou and p.status='finalizada' and not public.faltou_rodada(p.racha_id,j.jogador_id) group by j.jogador_id
), eventos as (
 select e.jogador_id,coalesce(sum(e.quantidade) filter(where e.tipo='gol'),0) as gols,coalesce(sum(e.quantidade) filter(where e.tipo='assistencia'),0) as assistencias
 from public.eventos_partida e join public.partidas p on p.id=e.partida_id join public.partida_jogadores j on j.partida_id=e.partida_id and j.jogador_id=e.jogador_id
 where p.status='finalizada' and j.participou and not public.faltou_rodada(p.racha_id,j.jogador_id) group by e.jogador_id
)
select p.jogador_id,p.jogos,coalesce(e.gols,0)::bigint as gols,coalesce(e.assistencias,0)::bigint as assistencias,p.vitorias
from participacoes p left join eventos e on e.jogador_id=p.jogador_id;
commit;
