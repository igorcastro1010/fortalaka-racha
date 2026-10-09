-- Executar após avaliacoes.sql e finalizar-rodada.sql. Preserva notas e regras de gravação.
begin;
create or replace function public.ler_avaliacoes_atual(p_racha uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r public.rachas%rowtype; my_team uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para avaliar.'; end if;
  select * into r from public.rachas
  where p_racha is null or id=p_racha
  order by data desc nulls last,created_at desc,id desc
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

revoke all on function public.ler_avaliacoes_atual(uuid) from public,anon;
grant execute on function public.ler_avaliacoes_atual(uuid) to authenticated;
commit;
