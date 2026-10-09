-- Incremental: executar apos schema.sql, sorteio-times.sql, validacao-sorteio-avatars.sql e partidas-estatisticas.sql.
begin;

alter table public.rachas add column if not exists avaliacoes_abertas boolean not null default false;

create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id) on delete cascade,
  avaliador_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  avaliado_id uuid not null references public.profiles(id) on delete cascade,
  time_id uuid not null references public.times(id),
  passe smallint not null check(passe between 1 and 5),
  chute smallint not null check(chute between 1 and 5),
  velocidade smallint not null check(velocidade between 1 and 5),
  defesa smallint not null check(defesa between 1 and 5),
  fisico smallint not null check(fisico between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(racha_id,avaliador_id,avaliado_id),
  check(avaliador_id<>avaliado_id)
);
create index if not exists avaliacoes_avaliado_idx on public.avaliacoes(avaliado_id);
create index if not exists avaliacoes_racha_idx on public.avaliacoes(racha_id);
alter table public.avaliacoes enable row level security;

create or replace function public.time_participante_avaliacao(p_racha uuid,p_jogador uuid)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare
  tid uuid;
begin
  select j.time_id into tid
  from public.partida_jogadores j
  join public.partidas p on p.id=j.partida_id
  join public.times t on t.id=j.time_id
  where p.racha_id=p_racha
    and p.status='finalizada'
    and j.participou
    and j.jogador_id=p_jogador
    and t.racha_id=p_racha
    and t.confirmado
  group by j.time_id
  order by count(*) desc,j.time_id
  limit 1;
  return tid;
end;
$$;

create or replace function public.pode_avaliar_companheiro(p_racha uuid,p_avaliador uuid,p_avaliado uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare
  time_avaliador uuid;
  time_avaliado uuid;
  aberta boolean;
begin
  if p_avaliador is null or p_avaliado is null or p_avaliador=p_avaliado or auth.uid() is distinct from p_avaliador then
    return false;
  end if;
  if not exists(select 1 from public.profiles where id=p_avaliador and active)
    or not exists(select 1 from public.profiles where id=p_avaliado and active) then
    return false;
  end if;
  select r.avaliacoes_abertas into aberta from public.rachas r where r.id=p_racha;
  if not coalesce(aberta,false) then
    return false;
  end if;
  time_avaliador := public.time_participante_avaliacao(p_racha,p_avaliador);
  time_avaliado := public.time_participante_avaliacao(p_racha,p_avaliado);
  return time_avaliador is not null and time_avaliador=time_avaliado;
end;
$$;

create or replace function public.validar_avaliacao() returns trigger
language plpgsql security definer set search_path=public as $$
declare tid uuid;
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.racha_id<>old.racha_id or new.avaliador_id<>old.avaliador_id
      or new.avaliado_id<>old.avaliado_id or new.time_id<>old.time_id then
      raise exception 'A identidade da avaliacao nao pode mudar.';
    end if;
  end if;
  if auth.uid() is distinct from new.avaliador_id then
    raise exception 'A avaliacao deve ser enviada pelo proprio jogador.';
  end if;
  tid := public.time_participante_avaliacao(new.racha_id,new.avaliador_id);
  if tid is null or tid<>public.time_participante_avaliacao(new.racha_id,new.avaliado_id) or tid<>new.time_id then
    raise exception 'Avalie somente companheiros que participaram do mesmo time.';
  end if;
  if not public.pode_avaliar_companheiro(new.racha_id,new.avaliador_id,new.avaliado_id) then
    raise exception 'Avaliacoes fechadas ou jogador invalido.';
  end if;
  new.updated_at=now();
  return new;
end; $$;
drop trigger if exists validar_avaliacao on public.avaliacoes;
create trigger validar_avaliacao before insert or update on public.avaliacoes for each row execute function public.validar_avaliacao();

revoke all on public.avaliacoes from anon,authenticated;
grant select,insert on public.avaliacoes to authenticated;
grant update(passe,chute,velocidade,defesa,fisico) on public.avaliacoes to authenticated;
drop policy if exists avaliacoes_read_own on public.avaliacoes;
create policy avaliacoes_read_own on public.avaliacoes for select to authenticated using(avaliador_id=auth.uid());
drop policy if exists avaliacoes_insert_own on public.avaliacoes;
create policy avaliacoes_insert_own on public.avaliacoes for insert to authenticated
  with check(avaliador_id=auth.uid() and public.pode_avaliar_companheiro(racha_id,avaliador_id,avaliado_id));
drop policy if exists avaliacoes_update_own on public.avaliacoes;
create policy avaliacoes_update_own on public.avaliacoes for update to authenticated
  using(avaliador_id=auth.uid())
  with check(avaliador_id=auth.uid() and public.pode_avaliar_companheiro(racha_id,avaliador_id,avaliado_id));

create or replace view public.medias_avaliacoes_jogadores with(security_invoker=true) as
select
  avaliado_id as jogador_id,
  count(*)::bigint as quantidade_avaliacoes,
  avg(passe)::numeric as media_passe,
  avg(chute)::numeric as media_chute,
  avg(velocidade)::numeric as media_velocidade,
  avg(defesa)::numeric as media_defesa,
  avg(fisico)::numeric as media_fisico,
  ((avg(passe)+avg(chute)+avg(velocidade)+avg(defesa)+avg(fisico))/5)::numeric as nota_geral,
  round(((avg(passe)+avg(chute)+avg(velocidade)+avg(defesa)+avg(fisico))/5)*20)::integer as nota_geral_100
from public.avaliacoes
group by avaliado_id;
revoke all on public.medias_avaliacoes_jogadores from anon;
grant select on public.medias_avaliacoes_jogadores to authenticated;

create or replace function public.alterar_avaliacoes_rodada(p_racha uuid,p_abertas boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare total integer; respondentes integer;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem alterar avaliacoes.'; end if;
  if not exists(select 1 from public.rachas where id=p_racha and estado in('times_confirmados','finalizado') for update) then
    raise exception 'Confirme os times antes de abrir avaliacoes.';
  end if;
  if p_abertas and not exists(select 1 from public.partidas where racha_id=p_racha and status='finalizada') then
    raise exception 'Finalize pelo menos uma partida antes de abrir avaliacoes.';
  end if;
  update public.rachas set avaliacoes_abertas=p_abertas where id=p_racha;
  select count(distinct jogador_id) into total from public.partida_jogadores j join public.partidas p on p.id=j.partida_id where p.racha_id=p_racha and p.status='finalizada' and j.participou;
  select count(distinct avaliador_id) into respondentes from public.avaliacoes where racha_id=p_racha;
  return jsonb_build_object('total',coalesce(total,0),'respondentes',coalesce(respondentes,0),'abertas',p_abertas);
end; $$;

create or replace function public.ler_progresso_avaliacoes(p_racha uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare total integer; respondentes integer; abertas boolean;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso nao autorizado.'; end if;
  select avaliacoes_abertas into abertas from public.rachas where id=p_racha;
  select count(distinct jogador_id) into total from public.partida_jogadores j join public.partidas p on p.id=j.partida_id where p.racha_id=p_racha and p.status='finalizada' and j.participou;
  select count(distinct avaliador_id) into respondentes from public.avaliacoes where racha_id=p_racha;
  return jsonb_build_object('total',coalesce(total,0),'respondentes',coalesce(respondentes,0),'abertas',coalesce(abertas,false));
end; $$;

create or replace function public.ler_avaliacoes_rodada()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r public.rachas%rowtype; my_team uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para avaliar.'; end if;
  select * into r from public.rachas
  where avaliacoes_abertas or estado='finalizado'
  order by avaliacoes_abertas desc,data desc nulls last,created_at desc,id desc
  limit 1;
  if not found then return null; end if;
  my_team := public.time_participante_avaliacao(r.id,auth.uid());
  return jsonb_build_object(
    'roundId',r.id,
    'roundName',r.nome,
    'roundStatus',r.estado,
    'open',r.avaliacoes_abertas,
    'canEvaluate',r.avaliacoes_abertas and my_team is not null,
    'teamId',my_team,
    'players',coalesce((
      select jsonb_agg(jsonb_build_object(
        'jogador_id',p.id,
        'nome',p.name,
        'avatar_url',p.avatar_url,
        'avaliado',a.id is not null,
        'passe',a.passe,
        'chute',a.chute,
        'velocidade',a.velocidade,
        'defesa',a.defesa,
        'fisico',a.fisico
      ) order by p.name,p.id)
      from (
        select distinct j.jogador_id
        from public.partida_jogadores j
        join public.partidas pa on pa.id=j.partida_id
        where pa.racha_id=r.id and pa.status='finalizada' and j.participou and j.time_id=my_team and j.jogador_id<>auth.uid()
      ) eligible
      join public.profiles p on p.id=eligible.jogador_id and p.active
      left join public.avaliacoes a on a.racha_id=r.id and a.avaliador_id=auth.uid() and a.avaliado_id=p.id
    ),'[]'::jsonb)
  );
end; $$;

create or replace function public.salvar_avaliacao(p_racha uuid,p_avaliado uuid,p_passe smallint,p_chute smallint,p_velocidade smallint,p_defesa smallint,p_fisico smallint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare tid uuid;
begin
  tid := public.time_participante_avaliacao(p_racha,auth.uid());
  if tid is null or not public.pode_avaliar_companheiro(p_racha,auth.uid(),p_avaliado) then
    raise exception 'Voce so pode avaliar companheiros do seu time enquanto as avaliacoes estiverem abertas.';
  end if;
  insert into public.avaliacoes(racha_id,avaliador_id,avaliado_id,time_id,passe,chute,velocidade,defesa,fisico)
  values(p_racha,auth.uid(),p_avaliado,tid,p_passe,p_chute,p_velocidade,p_defesa,p_fisico)
  on conflict(racha_id,avaliador_id,avaliado_id) do update
  set passe=excluded.passe,chute=excluded.chute,velocidade=excluded.velocidade,defesa=excluded.defesa,fisico=excluded.fisico,updated_at=now();
  return jsonb_build_object('ok',true);
end; $$;

drop function if exists public.medias_jogador(uuid);
create function public.medias_jogador(p_jogador uuid)
returns table(quantidade bigint,passe numeric,chute numeric,velocidade numeric,defesa numeric,fisico numeric)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active)
    or (p_jogador<>auth.uid() and not public.is_organizer(auth.uid())) then
    raise exception 'Sem permissao para consultar as medias deste jogador.';
  end if;
  return query
  select coalesce(m.quantidade_avaliacoes,0),
    case when coalesce(m.quantidade_avaliacoes,0)>=2 then m.media_passe*2 else null end,
    case when coalesce(m.quantidade_avaliacoes,0)>=2 then m.media_chute*2 else null end,
    case when coalesce(m.quantidade_avaliacoes,0)>=2 then m.media_velocidade*2 else null end,
    case when coalesce(m.quantidade_avaliacoes,0)>=2 then m.media_defesa*2 else null end,
    case when coalesce(m.quantidade_avaliacoes,0)>=2 then m.media_fisico*2 else null end
  from (select p_jogador as id) p left join public.medias_avaliacoes_jogadores m on m.jogador_id=p.id;
end; $$;

drop function if exists public.ler_estatisticas_jogadores(uuid);
create function public.ler_estatisticas_jogadores(p_jogador uuid default null)
returns table(jogador_id uuid,nome text,avatar_url text,jogos bigint,gols bigint,assistencias bigint,vitorias bigint,nota_geral_100 integer,quantidade_avaliacoes bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para consultar as estatisticas.'; end if;
 return query select p.id,p.name,p.avatar_url,coalesce(e.jogos,0),coalesce(e.gols,0),coalesce(e.assistencias,0),coalesce(e.vitorias,0),
   case when coalesce(m.quantidade_avaliacoes,0)>=2 then m.nota_geral_100 else null end,
   coalesce(m.quantidade_avaliacoes,0)
 from public.profiles p
 left join public.estatisticas_jogadores e on e.jogador_id=p.id
 left join public.medias_avaliacoes_jogadores m on m.jogador_id=p.id
 where p.active and (p_jogador is null or p.id=p_jogador)
 order by coalesce(e.vitorias,0) desc,coalesce(e.gols,0) desc,coalesce(e.assistencias,0) desc,coalesce(e.jogos,0) desc,p.name,p.id;
end; $$;

revoke all on function public.time_participante_avaliacao(uuid,uuid),public.pode_avaliar_companheiro(uuid,uuid,uuid),
  public.alterar_avaliacoes_rodada(uuid,boolean),public.ler_progresso_avaliacoes(uuid),public.ler_avaliacoes_rodada(),
  public.salvar_avaliacao(uuid,uuid,smallint,smallint,smallint,smallint,smallint),public.medias_jogador(uuid),
  public.ler_estatisticas_jogadores(uuid) from public,anon;
grant execute on function public.time_participante_avaliacao(uuid,uuid),public.pode_avaliar_companheiro(uuid,uuid,uuid),
  public.alterar_avaliacoes_rodada(uuid,boolean),public.ler_progresso_avaliacoes(uuid),public.ler_avaliacoes_rodada(),
  public.salvar_avaliacao(uuid,uuid,smallint,smallint,smallint,smallint,smallint),public.medias_jogador(uuid),
  public.ler_estatisticas_jogadores(uuid) to authenticated;

commit;
