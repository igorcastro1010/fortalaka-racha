# Painel do Organizador

Central de leitura e atalhos na Home, acima do card principal, exclusiva para perfil ativo com `role = organizador`. Não cria rota nem executa transições da rodada.

## Fontes e reaproveitamento

- Rodada e participantes: `useCurrentRound`, já carregados pela Home.
- Contagem de confirmados, suplentes e ausentes: `getRoundParticipantCounts`, compartilhada entre o painel e o card principal. Mantém a regra existente: confirmados comuns e legados são participantes; suplentes são secundários.
- Partidas, placar atual e fila: mesma chamada `getRoundMatches` usada pela Home. O painel não relê as partidas.
- Times, inclusive rascunhos: `getCurrentRoundTeamsState(client, loadedRound)` aceita a rodada já carregada e evita repetir as leituras de rodada, participantes e avatares. A assinatura antiga continua válida.
- Avaliações: `getEvaluationProgress`, uma RPC agregada. Sua métrica é **jogadores que responderam**, não quantidade de avaliações individuais.
- Fluxo Lista → Times → Racha → Avaliação: reutiliza `RoundProgress`. Fechadas com respondentes marca a etapa final concluída, apenas na apresentação.

A Home do organizador executa seis leituras: rodada, participantes, avatares, times, partidas e progresso. Cada uma ocorre uma vez por carga. Não há N+1, polling ou request por indicador. O card pessoal de avaliações é substituído pelo painel apenas para organizadores, evitando uma RPC pessoal redundante. A Home do jogador conserva suas cinco leituras e não carrega times/progresso do painel. Atualizações de inscrição do jogador não provocam novas leituras de partidas.

## Estados, ações e limites

`buildOrganizerOverview` deriva contadores, alertas e uma única ação principal dos estados persistidos. Os atalhos navegam para as áreas existentes; não chamam funções de escrita. Em particular, **ABRIR AVALIAÇÕES navega para a aba Avaliação**, onde a confirmação e as regras anteriores continuam valendo.

Times podem aparecer como não sorteados, rascunho ou confirmados. Partidas registradas incluem todos os registros, enquanto finalizadas são contadas separadamente. O placar atual exige partida aberta; a fila é preservada e identificada como tal após encerrar.

Avaliações aparecem como abertas, fechadas ou encerradas. Fechadas com respondentes indicam uso anterior. Fechadas sem respostas **não provam que nunca foram abertas**; o alerta usa a frase neutra “Racha finalizado. Avaliações fechadas.” Não foi criado campo ou estado de banco para essa distinção.

Dados não carregados ou com erro ficam como “—”, sem falsos zeros. Erros parciais mantêm os demais dados e permitem atualizar o painel. Rodada inexistente oferece o atalho para a criação existente. Composição de outra rodada/status é rejeitada e partidas com status divergente não são exibidas como snapshot atual.

## Segurança

O componente e a Home verificam perfil ativo e role. Jogadores não montam o painel nem executam suas leituras. Nenhuma ação administrativa foi movida para URL, endpoint novo ou código de escrita no painel. RPCs e RLS existentes continuam sendo a proteção das operações; testes PostgreSQL confirmam que jogadores não gerenciam lista, times, placar ou encerramento.

Não houve SQL novo, mudança de RLS, alteração de regras ou escrita no Supabase remoto. Não há SQL pendente para esta feature.

## Verificação

- `npm run build` e `npm run lint`: aprovados.
- Dez testes unitários do painel: estados, contadores, rascunho, partida aberta, fila, CTA, avaliações e snapshots ausentes/divergentes.
- Navegação com componentes reais e PostgreSQL isolado: organizador vê painel, jogador não vê; requests não duplicadas; atalhos respeitam as áreas e não abrem avaliações automaticamente; fluxo existente de inscrição, times, partidas, avaliação, Perfil e Ranking preservado.
- Dez cenários PostgreSQL do fluxo sem posições/RLS e teste do repositório de participantes: aprovados.
- Playwright MCP: lista aberta vazia e com participantes, lista fechada, rascunho, times confirmados, partida em andamento, rodada finalizada, avaliações abertas e jogador comum.
- Respostas locais simuladas: rodada inexistente e falha HTTP 503 de times/progresso. Indicadores desconhecidos ficam como “—”; atualizar recupera os dados. Falhas controladas são exclusivas desses testes.
- Mobile 360×800, 375×812, 390×844 e 430×932: sem overflow, rótulos/números completos e botões de pelo menos 44 px.
- Chrome DevTools MCP em contexto isolado: seis requests de leitura HTTP 200; nenhum erro/aviso de console.
- Toda escrita necessária aos cenários de teste ocorreu somente no PostgreSQL local com dados sintéticos; produção não foi alterada.

Graphify é atualizado localmente e permanece ignorado pelo Git. Deploy não faz parte desta entrega.
