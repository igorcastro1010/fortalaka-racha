-- V1.2: somente leitura. Aplicar depois dos SQLs de partidas e avaliacoes.
begin;

-- Helpers nao expostos: executados apenas pela RPC autenticada abaixo.
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
 and (p_racha is null or p.racha_id=p_racha)
 and p.time_a_id<>p.time_b_id and p.status='finalizada' and p.placar_a>=0 and p.placar_b>=0;
$$;

create or replace function public.v12_participacoes(p_jogador uuid)
returns table(id uuid,racha_id uuid,nome text,data date,estado text,created_at timestamptz,
 time_a text,time_b text,placar_a integer,placar_b integer,resultado text,gols bigint,assistencias bigint)
language sql stable set search_path=public,pg_temp as $$
 select j.id,j.racha_id,j.nome,j.data,j.estado,j.created_at,j.time_a,j.time_b,j.placar_a,j.placar_b,j.resultado,
 coalesce(e.gols,0),coalesce(e.assistencias,0) from public.v12_jogos(p_jogador) j
 left join lateral (select sum(e.quantidade) filter(where e.tipo='gol' and e.quantidade>0) as gols,
 sum(e.quantidade) filter(where e.tipo='assistencia' and e.quantidade>0) as assistencias
 from public.eventos_partida e where e.partida_id=j.id and e.jogador_id=p_jogador) e on true;
$$;

-- Agregados de todos os avaliados apenas nas rodadas em que o alvo foi avaliado.
create or replace function public.v12_notas(p_jogador uuid)
returns table(racha_id uuid,jogador_id uuid,nome text,data date,quantidade bigint,nota numeric,overall integer)
language sql stable set search_path=public,pg_temp as $$
 with rodadas as (
 select distinct a.racha_id from public.avaliacoes a join public.rachas r on r.id=a.racha_id
 where a.avaliado_id=p_jogador and r.estado='finalizado' and not r.avaliacoes_abertas
 ), validas as (
 select a.* from public.avaliacoes a join rodadas r on r.racha_id=a.racha_id
 where a.avaliador_id<>a.avaliado_id
 and a.passe between 1 and 5 and a.chute between 1 and 5 and a.velocidade between 1 and 5
 and a.defesa between 1 and 5 and a.fisico between 1 and 5
 and exists(select 1 from public.times t where t.id=a.time_id and t.racha_id=a.racha_id and t.confirmado)
 and exists(select 1 from public.v12_jogos(a.avaliado_id,a.racha_id) j where j.time_id=a.time_id)
 and exists(select 1 from public.v12_jogos(a.avaliador_id,a.racha_id) j where j.time_id=a.time_id)
 )
 select a.racha_id,a.avaliado_id,r.nome,r.data,count(*),
 avg((a.passe+a.chute+a.velocidade+a.defesa+a.fisico)::numeric/5)*20,
 round(avg((a.passe+a.chute+a.velocidade+a.defesa+a.fisico)::numeric/5)*20)::integer
 from validas a join public.rachas r on r.id=a.racha_id
 group by a.racha_id,a.avaliado_id,r.nome,r.data having count(distinct a.avaliador_id)>=2;
$$;

create or replace function public.ler_evolucao_jogador(p_jogador uuid,p_secao text default 'resumo',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare resposta jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active)
 or not exists(select 1 from public.profiles where id=p_jogador and active) then
 raise exception 'Perfil indisponivel.' using errcode='42501'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>100000 or p_secao not in('resumo','partidas','rodadas','notas') or p_secao is null then
 raise exception 'Consulta invalida.' using errcode='22023'; end if;

 if p_secao='partidas' then
 with candidatas as materialized (select * from public.v12_jogos(p_jogador)
 order by data desc nulls last,created_at desc,id desc limit 13 offset p_pagina*12),
 pagina as (select * from candidatas order by data desc nulls last,created_at desc,id desc limit 12),
 linhas as (select p.*,coalesce(e.gols,0) as gols,coalesce(e.assistencias,0) as assistencias from pagina p
 left join lateral (select sum(e.quantidade) filter(where e.tipo='gol' and e.quantidade>0) as gols,
 sum(e.quantidade) filter(where e.tipo='assistencia' and e.quantidade>0) as assistencias
 from public.eventos_partida e where e.partida_id=p.id and e.jogador_id=p_jogador) e on true)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(linhas)-'time_id' order by data desc nulls last,created_at desc,id desc),'[]'),
 'hasMore',(select count(*)>12 from candidatas)) into resposta from linhas;
 return resposta;
 elsif p_secao='rodadas' then
 with grupos as (select racha_id,nome,data,estado,count(*) as jogos,sum(gols) as gols,
 count(*) filter(where resultado='V') as vitorias,count(*) filter(where resultado='E') as empates,
 count(*) filter(where resultado='D') as derrotas from public.v12_participacoes(p_jogador)
 group by racha_id,nome,data,estado), linhas as (select *,count(*) over() as total from grupos
 order by data desc nulls last,racha_id desc limit 12 offset p_pagina*12)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(linhas)-'total'),'[]'),
 'hasMore',coalesce(max(total),0)>(p_pagina+1)*12) into resposta from linhas;
 return resposta;
 elsif p_secao='notas' then
 with linhas as (select racha_id,nome,data,quantidade,overall,count(*) over() as total
 from public.v12_notas(p_jogador) where jogador_id=p_jogador
 order by data desc nulls last,racha_id desc limit 12 offset p_pagina*12)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(linhas)-'total'),'[]'),
 'hasMore',coalesce(max(total),0)>(p_pagina+1)*12) into resposta from linhas;
 return resposta;
 end if;

 with jogos as materialized (select * from public.v12_participacoes(p_jogador)),
 notas as materialized (select * from public.v12_notas(p_jogador)),
 minhas_notas as (select * from notas where jogador_id=p_jogador),
 ultimas as (select * from minhas_notas where data is not null order by data desc,racha_id desc limit 2),
 presencas as (select racha_id,min(data) as data from jogos where estado='finalizado' group by racha_id),
 acumulados as (select *,sum(gols) over w as gols_total,sum(assistencias) over w as assistencias_total,
 count(*) over w as jogos_total,count(*) filter(where resultado='V') over w as vitorias_total
 from jogos window w as (order by data nulls last,created_at,id)),
 ordem as (
 -- Inclui registros incompletos como barreira: nao permite pular uma derrota desconhecida.
 select p.id,r.data,p.created_at,j.resultado,
 count(*) over(partition by r.data,p.created_at) as simultaneas
 from public.partida_jogadores pj join public.partidas p on p.id=pj.partida_id
 join public.rachas r on r.id=p.racha_id left join jogos j on j.id=p.id
 where pj.jogador_id=p_jogador and pj.participou and p.status='finalizada'
 ), ilhas as (select *,sum(case when resultado='V' and data is not null and simultaneas=1 then 0 else 1 end)
 over(order by data nulls last,created_at,id) as grupo from ordem),
 sequencias as (select *,count(*) filter(where resultado='V' and data is not null and simultaneas=1)
 over(partition by grupo order by data nulls last,created_at,id) as sequencia from ilhas),
 gols_rodada as (
 select p.racha_id,j.jogador_id,coalesce(sum(e.quantidade) filter(where e.tipo='gol'),0) as gols,
 coalesce(sum(e.quantidade) filter(where e.tipo='assistencia'),0) as assistencias
 from presencas alvo join public.partidas p on p.racha_id=alvo.racha_id and p.status='finalizada'
 join public.times ta on ta.id=p.time_a_id and ta.racha_id=p.racha_id
 join public.times tb on tb.id=p.time_b_id and tb.racha_id=p.racha_id
 join public.partida_jogadores j on j.partida_id=p.id and j.participou and j.time_id in(p.time_a_id,p.time_b_id)
 join public.eventos_partida e on e.partida_id=p.id and e.jogador_id=j.jogador_id and e.quantidade>0
 where p.placar_a>=0 and p.placar_b>=0 and p.time_a_id<>p.time_b_id group by p.racha_id,j.jogador_id
 ), artilharias as (select g.racha_id,r.data from gols_rodada g join presencas r using(racha_id)
 where g.jogador_id=p_jogador and g.gols>0 and g.gols=(select max(g2.gols) from gols_rodada g2 where g2.racha_id=g.racha_id)),
 garcons as (select g.racha_id,r.data from gols_rodada g join presencas r using(racha_id)
 where g.jogador_id=p_jogador and g.assistencias>0 and g.assistencias=(select max(g2.assistencias) from gols_rodada g2 where g2.racha_id=g.racha_id)),
 destaques as (select n.racha_id,n.data from minhas_notas n
 where (select count(*) from notas n2 where n2.racha_id=n.racha_id)>=2
 and n.overall=(select max(n2.overall) from notas n2 where n2.racha_id=n.racha_id)),
 marcos as (
 select 'gols-'||v as id,(select count(*)>0 from acumulados where gols_total>=v) as earned,
 (select min(data) from acumulados where gols_total>=v) as data from unnest(array[1,10,25,50]) v
 union all select 'presencas-'||v,(select count(*) from presencas)>=v,
 (select data from presencas order by data nulls last,racha_id offset v-1 limit 1) from unnest(array[5,10,20]) v
 union all select 'vitoria-1',exists(select 1 from jogos where resultado='V'),(select min(data) from jogos where resultado='V')
 union all select 'sequencia-'||v,exists(select 1 from sequencias where sequencia>=v),
 (select min(data) from sequencias where sequencia>=v) from unnest(array[3,5]) v
 union all select 'artilheiro',exists(select 1 from artilharias),(select min(data) from artilharias)
 union all select 'destaque',exists(select 1 from destaques),(select min(data) from destaques)
 union all select 'garcom',exists(select 1 from garcons),(select min(data) from garcons)
 union all select 'jogos-'||v,exists(select 1 from acumulados where jogos_total>=v),
 (select min(data) from acumulados where jogos_total>=v) from unnest(array[10,25,50]) v
 union all select 'vitorias-'||v,exists(select 1 from acumulados where vitorias_total>=v),
 (select min(data) from acumulados where vitorias_total>=v) from unnest(array[10,25]) v
 union all select 'assistencias-'||v,exists(select 1 from acumulados where assistencias_total>=v),
 (select min(data) from acumulados where assistencias_total>=v) from unnest(array[1,10,25]) v
 )
 select jsonb_build_object(
 'stats',jsonb_build_object('jogos',count(*),'gols',coalesce(sum(gols),0),'assistencias',coalesce(sum(assistencias),0),
 'vitorias',count(*) filter(where resultado='V'),'empates',count(*) filter(where resultado='E'),
 'derrotas',count(*) filter(where resultado='D'),'rodadas',(select count(*) from presencas),
 'sequencia',coalesce((select max(sequencia) from sequencias),0),
 'artilharias',(select count(*) from artilharias),'destaques',(select count(*) from destaques),'garcons',(select count(*) from garcons)),
 'overall',jsonb_build_object('media',(select round(sum(nota*quantidade)/nullif(sum(quantidade),0)) from minhas_notas),
 'melhor',(select max(overall) from minhas_notas),
 'ultimas',coalesce((select jsonb_agg(jsonb_build_object('racha_id',racha_id,'data',data,'overall',overall) order by data desc,racha_id desc) from ultimas),'[]'),
 'rodadas',(select count(*) from minhas_notas)),
 'marcos',(select jsonb_object_agg(id,jsonb_build_object('earned',earned,'data',data)) from marcos)
 ) into resposta from jogos;
 return resposta;
end; $$;

revoke all on function public.v12_jogos(uuid,uuid),public.v12_participacoes(uuid),public.v12_notas(uuid) from public,anon,authenticated;
revoke all on function public.ler_evolucao_jogador(uuid,text,integer) from public,anon;
grant execute on function public.ler_evolucao_jogador(uuid,text,integer) to authenticated;
commit;
