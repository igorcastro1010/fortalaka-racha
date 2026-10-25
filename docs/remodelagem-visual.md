# Remodelagem visual do Fortalaka

## Escopo preservado

Frontend na master. Sem alteracoes em repositorios de dados, contratos RPC,
autenticacao, SQL, Supabase, RLS ou regras de negocio. Sem deploy.

## Auditoria inicial: apple-design

O mapeamento Graphify localizou FortalakaApp, RachaScreen, TeamsScreen,
MatchesPanel, ResultsScreen, EvaluationArea, StatisticsViews e PlayerPerformance.
Principais problemas: secoes com cartoes aninhados, raios variados, legendas
pequenas, acoes administrativas concorrentes e telas longas sem separacao de
consulta e gestao.

Referencias locais da skill `.agents/skills/apple-design/references/`:

- `hig/layout.md`, Visual hierarchy: proximidade, divisores e disclosure.
- `hig/buttons.md`, Best practices e Style: alvo de 44 e hierarquia de acoes.
- `hig/accessibility.md`: foco, rotulos, contraste e informacao alem da cor.
- `hig/typography.md`: hierarquia e legibilidade.
- `hig/color.md`: significado consistente das cores.
- `hig/designing-for-ios.md` e `cross-platform.md`: adaptar principios ao web,
  sem copiar controles nativos ou adicionar glassmorphism.
- `hig/disclosure-controls.md`: detalhes secundarios sob demanda.

## Sistema visual

Geist existente, titulos 28/29 px, secoes 18/20 px, corpo 14/16 px,
legendas principalmente 12 px e numeros tabulares. Espacos 4/8/12/16/20/24/32.
Preto e branco com vermelho Fortalaka; verde para confirmacao, ambar para avisos.
Raio principal 8 px, sombra apenas em elementos elevados. Sem fontes ou
bibliotecas adicionais. Tokens e controles compartilhados em globals.css.

AuthShell preserva escudo e formulario sem cartao externo. ViewTabs oferece
selecao, foco e teclado (setas, Home, End). Navegacao inferior tem rotulos e
safe area. Secoes usam divisores; ferramentas de edicao podem ter moldura.

## Fluxos visuais

- Home: rodada, inscricao, acao contextual, progresso e proxima acao do organizador.
- Racha: Lista; Gestao somente para organizador ativo.
- Times: composicao; Ajustes somente para organizador ativo.
- Resultados: Partidas/Ranking; Ao vivo/Historico/Resumo nas partidas.
- Avaliacao: Avaliar/Progresso, gestao recolhida e estado pessoal compartilhado.
- Perfil: Visao geral/Estatisticas/Avaliacoes, ficha esportiva e radar existente.
- Resumo: mesmas estatisticas, artilharia e mensagem do WhatsApp, sem recalculos.

## Segunda passada e React

Revisao de hierarquia, proximidade, alvos, contraste, estados e identidade
Fortalaka. Removidos atalhos duplicados da Home; campos de senha ampliados;
erros tecnicos mantidos nos logs com mensagens amigaveis na tela.
Revisao react-best-practices: hooks e cleanup preservados, chaves estaveis,
sem dependencias novas; views internas montadas para evitar novas consultas.
Abrir/fechar avaliacoes atualiza a consulta pessoal apenas apos a mutacao.

## Validacao reproduzivel

`tests/navigation.test.mjs` cobre o fluxo real com PostgreSQL isolado e ambas
as roles. `tests/visual-remodel.test.mjs` usa Playwright e Chrome CDP, componentes
reais e a mesma fixture local; salva capturas e report.json em pasta temporaria.
Viewports: 360x800, 375x812, 390x844, 430x932 e 1280x900. Verifica tabs, teclado,
targets, imagens, overflow, erros de console/rede e consultas desnecessarias.
As rotas de autenticacao podem ser verificadas com o segundo argumento URL.

Os MCPs Playwright/Chrome DevTools nao foram expostos nesta sessao. A validacao
equivalente usa a biblioteca Playwright e o protocolo CDP local, sem credenciais
nem alteracoes de dados em producao. Falha de avatar intencional na fixture
valida o fallback; nao representa falha de imagem do app em producao.

## Resultado verificado

- Build e lint aprovados; 56 testes unitarios de dominio aprovados.
- Navegacao completa aprovada com PostgreSQL local: ambas roles, inscricao,
  painel contextual, sorteio, placar, encerramento, avaliacao e privacidade.
- 152 capturas aprovadas nas cinco resolucoes. Console sem erros/warnings
  inesperados; rede sem falhas inesperadas; avatar ausente proposital tem fallback.
- Sem nova consulta ao alternar as views de partidas; Avaliar/Progresso
  compartilham uma leitura pessoal. Notas nao enviadas permanecem ao atualizar.
- Suites de ranking visual, artilharia, inscricao, perfil e SQL local aprovadas.
- Quatro testes adicionais de Avaliar/Progresso aprovados: consulta compartilhada,
  erro, vazio e preservacao da nota ainda nao enviada ao atualizar o estado.
- Seis commits remotos encontrados no fetch foram integrados sem force-push.
  O painel do organizador existente e seus testes foram preservados e refinados.

## Arquivos da remodelagem

Comparacao com a master remota recebida antes da entrega:

```text
docs/remodelagem-visual.md
src/app/cadastro/page.tsx
src/app/globals.css
src/app/login/page.tsx
src/components/app/FortalakaApp.tsx
src/components/auth/AuthShell.tsx
src/components/auth/LoginForm.tsx
src/components/auth/ResetPasswordForm.tsx
src/components/auth/SignupForm.tsx
src/components/players/PlayerAvatar.tsx
src/components/players/PlayerPerformance.tsx
src/components/players/ProfilePhoto.tsx
src/components/players/StatisticsViews.tsx
src/components/ratings/EvaluationAdminPanel.tsx
src/components/ratings/EvaluationArea.tsx
src/components/ratings/EvaluationScreen.tsx
src/components/results/PostRoundSummary.tsx
src/components/results/ResultsScreen.tsx
src/components/results/RoundShareCard.tsx
src/components/rounds/MatchesPanel.tsx
src/components/rounds/OrganizerPanel.tsx
src/components/rounds/OwnRegistration.tsx
src/components/rounds/RachaScreen.tsx
src/components/rounds/RoundForm.tsx
src/components/rounds/RoundProgress.tsx
src/components/rounds/RoundSummary.tsx
src/components/teams/TeamsScreen.tsx
src/components/ui/ScreenState.tsx
src/components/ui/ViewTabs.tsx
tests/navigation.test.mjs
tests/visual-remodel.test.mjs
tests/evaluation-views.test.mjs
```
