-- Somente leitura. Executar no SQL Editor antes da correcao.
select indexname,indexdef from pg_indexes
where schemaname='public' and tablename='racha_participantes';

select pg_get_functiondef('public.inscricao_rodada(uuid,text,boolean)'::regprocedure);

select racha_id,jogador_id,count(*) as quantidade,
  array_agg(id order by created_at,id) as participantes_ids
from public.racha_participantes where jogador_id is not null
group by racha_id,jogador_id having count(*) > 1;
