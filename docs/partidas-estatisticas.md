# Partidas e estatísticas reais

## Instalação no Supabase

Execute integralmente `supabase/partidas-estatisticas.sql` no SQL Editor do projeto existente. É uma migração incremental, executada em transação, que preserva os dados atuais. Requer as tabelas e funções das migrações anteriores de rodada, participantes e times.

SQL pendente no Supabase: **SIM**, até sua execução manual. O deploy do frontend não executa essa migração. Antes dela, as telas mostram uma mensagem de instalação necessária; não usam estatísticas fictícias.

## Uso

1. Como organizador, confirme pelo menos dois times na rodada.
2. Em Racha → Partidas → Nova partida, selecione dois times diferentes e crie a partida.
3. Informe o placar, marque quem participou e registre gols e assistências com os controles +/−.
4. Salvar mantém o estado atual. Finalizar partida inclui o resultado nas estatísticas.
5. Para corrigir uma partida finalizada, use Corrigir resultado e salve. Cancelar partida exclui sua contribuição das estatísticas, preservando o registro.
6. Abra Ranking ou Perfil para consultar os totais atualizados.

Jogadores comuns apenas consultam partidas e resultados. As permissões também são aplicadas pelo banco, com RLS e validação das funções RPC.

## Cálculo e histórico

`profiles.id` identifica os jogadores, conforme o modelo existente. Ao criar uma partida, os integrantes dos dois times confirmados são copiados para `partida_jogadores`. Goleiros fixos não são incluídos automaticamente nos times ou na partida.

A view `estatisticas_jogadores` agrega somente partidas finalizadas e participantes com `participou = true`. Jogos contam partidas, inclusive várias na mesma rodada. Vitórias dependem do placar; empates não somam vitória. Gols e assistências vêm dos eventos, sem totais editáveis no perfil. Agregações separadas evitam multiplicar jogos ao juntar eventos.

Ranking e Perfil compartilham `getPlayerStatistics`, que consulta a RPC `ler_estatisticas_jogadores`. O Ranking ordena por vitórias, gols, assistências e jogos, nessa ordem, com nome e ID como desempate. A nota média permanece vazia nesta etapa. A avaliação de atributos existente não foi alterada.

Uma divergência entre gols registrados e placar gera aviso sem impedir o salvamento. Correções usam controle de versão para rejeitar edições concorrentes desatualizadas. Times referenciados por partidas não podem ser apagados ou substituídos por um novo sorteio; use uma nova rodada para preservar o histórico.

## Validação

- `npm run build` e `npm run lint`.
- `tests/partidas-estatisticas.test.mjs`: sete cenários em PostgreSQL isolado, incluindo 3 × 2 com Igor registrando 1 jogo, 2 gols, 1 assistência e 1 vitória; quatro partidas na mesma rodada; participação, empates, correções, cancelamento, concorrência e permissões.
- `tests/preview-sorteio.mjs`: componentes reais conectados ao banco isolado para verificar criação, lançamento, finalização e leitura no Ranking, sem alterar o Supabase real.

Os testes usam PGlite instalado fora do projeto. Execute com `node tests/partidas-estatisticas.test.mjs CAMINHO_PARA_NODE_MODULES_COM_PGLITE`.
