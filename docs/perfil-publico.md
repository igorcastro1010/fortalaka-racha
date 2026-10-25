# Perfil publico dos jogadores

Rota: `/perfil/[jogadorId]`. Publico dentro da comunidade autenticada: continua
exigindo sessao e perfil ativo, sem tornar dados acessiveis anonimamente.

## Fontes e privacidade

- Nome, avatar, jogos, gols, assistencias, vitorias e overall usam a RPC existente
  `ler_estatisticas_jogadores`, filtrada por `p_jogador`.
- A projecao publica tem lista explicita de campos. Nao consulta e-mails, roles,
  telefone, votos individuais nem identidade dos avaliadores.
- Overall e radar respeitam o minimo de duas respostas; ausencias usam `--`.
- `medias_jogador` continua autorizada pelo banco apenas para o proprio jogador
  e organizadores. O frontend nao tenta consultar atributos de terceiros como
  jogador comum. Mostra `--` e informa a indisponibilidade nessa situacao.
- Nao consulta a view de votos como atalho e nao amplia RLS ou permissoes.
- No maximo duas leituras agregadas por perfil, em paralelo; nenhum fetch por
  linha nas listas. Falha de atributos nao impede exibir estatisticas permitidas.
- SQL novo: NAO. SQL pendente de aplicacao: NAO. RLS alterada: NAO.

## Navegacao

`PlayerIdentity` reutiliza `PlayerAvatar` e liga avatar/nome ao perfil. Aplicado
ao Ranking, Racha, Times, Resumo, Avaliacao e participantes/eventos das partidas.
O modo de troca de jogadores dos Times mantem botoes de selecao sem links.
Identidades legadas sem jogador cadastrado continuam como texto, sem link falso.

History API nativa, suportada pelo Next.js instalado, mantem a tela de origem
montada. Voltar restaura filtro, rolagem e foco; formularios ainda nao enviados
permanecem intactos. Link direto/reload usa a rota protegida no App Router.
Abrir em nova aba continua funcionando. As acoes privadas seguem no Meu Perfil.

## Validacao

- Build e lint.
- `public-profile-data.test.mjs`: dez casos de projecao, permissao de atributos,
  concorrencia limitada, dados ausentes, ID invalido e minimo de respostas.
- `public-profile-ui.test.mjs`: Playwright/Chrome CDP com PostgreSQL isolado;
  Ranking/Racha/Times/Resumo/Historico/Avaliacao, voltar, proprio, inexistente,
  sem avatar/dados, rascunho, filtro/rolagem/foco e ausencia de consultas privadas.
- Mobile: 360x800, 375x812, 390x844 e 430x932. Capturas em pasta temporaria.
- Suites existentes de navegacao, ranking, artilharia, avaliacoes e privacidade.

Os MCPs de navegador nao estao expostos nesta sessao. Testes equivalentes usam
a biblioteca Playwright e Chrome CDP, sem escrever dados em producao.

## Arquivos

```text
src/app/perfil/[jogadorId]/page.tsx
src/components/app/FortalakaApp.tsx
src/components/players/PlayerIdentity.tsx
src/components/players/PublicPlayerProfile.tsx
src/components/players/PlayerPerformance.tsx
src/components/players/StatisticsViews.tsx
src/components/ratings/EvaluationScreen.tsx
src/components/results/PostRoundSummary.tsx
src/components/rounds/MatchesPanel.tsx
src/components/rounds/RachaScreen.tsx
src/components/teams/TeamsScreen.tsx
src/lib/players/public-profile.ts
tests/public-profile-data.test.mjs
tests/public-profile-ui.test.mjs
tests/navigation.test.mjs
tests/post-round-summary.test.mjs
tests/preview-sorteio.mjs
docs/perfil-publico.md
```
