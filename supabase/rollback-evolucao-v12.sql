-- Reversao da V1.2: remove somente funcoes novas; nenhum dado historico e alterado.
begin;
drop function if exists public.ler_evolucao_jogador(uuid,text,integer);
drop function if exists public.v12_notas(uuid);
drop function if exists public.v12_participacoes(uuid);
drop function if exists public.v12_jogos(uuid,uuid);
commit;
