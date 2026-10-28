# Historico de Rodadas

## Desenho e auditoria

Resultados > Historico reutiliza a navegacao existente. Lista compacta de rodadas
finalizadas, data decrescente (created_at e id estabilizam empates), oito por pagina.
O detalhe e somente leitura. As partidas da rodada atual ficam em disclosure
separado, preservando a gestao existente.

Apple design, primeira passada: listas curtas, indicador de navegacao, toque de
44 px ou mais, foco visivel, retorno com contexto, estados de carregamento/erro.
Referencias: lists-and-tables.md (Content), layout.md, accessibility.md, loading.md.
Manter preto/branco/vermelho e PlayerIdentity/PlayerAvatar, sem cards aninhados.

## Dados

Uma consulta paginada com relacionamentos para a lista, sem eventos ou perfis.
Detalhes somente da rodada selecionada; RPC ler_partidas_rodada, tabelas existentes
e avatars_da_rodada, respeitando RLS. Metricas compartilham getRoundMetrics;
getRoundShareSummary continua sendo a fonte do resumo e do WhatsApp.
Gols pelo placar; participantes unicos efetivamente em campo em partidas finalizadas.
Composicao dos times vem de time_jogadores, nao de inferencia pelos resultados.

Nao ha agregado autorizado de notas por rodada nas RPCs existentes. O historico
omite maiores notas; nao transforma overall historico em nota da rodada nem le votos.
Nenhum SQL novo, nenhuma mudanca de regra, autenticacao ou RLS.

## Implementacao e verificacao

1. Compartilhar metricas e adicionar repositorio de consultas historicas.
2. Lista/detalhe mobile, reutilizando resumo, avatares, perfil e WhatsApp.
3. Testes de filtro/ordenacao/paginacao/isolamento, vazio/erro e navegacao.
4. Playwright/CDP locais: quatro larguras, console/rede/overflow/duplicatas/imagens.
5. Segunda revisao Apple/React, build, lint, Graphify, diff, commit e push.
6. Deploy autorizado pelo pedido mais recente; validar SHA e disponibilidade.

MCPs Playwright e Chrome DevTools indisponiveis nesta sessao: usar as bibliotecas
locais equivalentes sem declarar execucao via MCP.

## Revisao final

Apple design, segunda passada: removidos cabecalho de marca repetido no detalhe,
resumo da rodada atual no historico e estado vazio de partidas que contradizia a
lista preenchida. Numeros/resultados antecedem rankings; times e participantes
recolhiveis. Foco e scroll retornam a linha selecionada, inclusive apos perfil.
Preto #0a0a0a e zinc-600 #52525b sobre branco: contraste acima de 4.5:1;
alvos novos de pelo menos 44px. Sem animacoes novas ou cards aninhados.

React: efeitos com limpeza, respostas antigas ignoradas, cache local de detalhes,
controle sincrono de pedidos concorrentes, keys por ID, sem leitura de avaliacoes
individuais ou recriacao de componentes durante render.

## Skills

Usadas: Graphify (.codex/skills/graphify), fortalaka-ui, fortalaka-backend,
fortalaka-release, apple-design (duas passadas), find-skills e React Best Practices.
Busca find-skills: React Best Practices ja disponivel; UI UX Pro Max duplica as
skills de design locais. Busca conjunta timeline/sports statistics/data visualization
nao retornou resultados. Nenhuma skill instalada.

## Arquivos da entrega

- src/components/results/RoundHistory.tsx
- src/components/results/PostRoundSummary.tsx
- src/components/results/ResultsScreen.tsx
- src/components/rounds/MatchesPanel.tsx
- src/lib/results/round-history.ts
- src/lib/results/round-share.ts
- tests/round-history-ui.test.mjs
- tests/round-share.test.mjs
- tests/preview-sorteio.mjs
- tests/navigation.test.mjs
- tests/public-profile-ui.test.mjs
- tests/visual-remodel.test.mjs
- docs/historico-rodadas.md
