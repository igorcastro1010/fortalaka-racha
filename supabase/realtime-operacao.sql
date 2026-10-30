-- Habilita entrega de eventos das tabelas operacionais, sem mudar dados ou RLS.
-- Executar no SQL Editor do projeto correto, após as migrations operacionais.
begin;
do $$
declare table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach table_name in array array['rachas','racha_participantes','times','time_jogadores','partidas','partida_jogadores','eventos_partida','fila_times'] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Tabela operacional ausente: %', table_name;
    end if;
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then
      raise exception 'RLS precisa estar habilitada em public.%', table_name;
    end if;
    if not exists (select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
commit;

-- Conferência após executar (as oito tabelas devem aparecer):
select schemaname, tablename from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
and tablename in ('rachas','racha_participantes','times','time_jogadores','partidas','partida_jogadores','eventos_partida','fila_times')
order by tablename;
-- Não publicar profiles, avaliacoes ou notificacoes por este script.
-- Não altera REPLICA IDENTITY nem envia dados de autoria das avaliações.
