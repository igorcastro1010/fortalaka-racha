# Auditoria visual e UX — 21/10/2026

## Escopo e segurança

Trabalho na master, partindo de bfc5d60. Somente apresentação e feedback visual.
Nenhuma alteração em SQL, Supabase, repositories, permissões, ordenação do ranking,
cálculo de médias, regras de sorteio ou transições de estado. Nenhuma dependência nova.
Não houve deploy nem escrita de dados reais.

Playwright MCP percorreu os componentes reais com PostgreSQL/PGlite isolado em
127.0.0.1:3011. Login foi verificado no Next.js local. A sessão autenticada existente
no Chrome também permitiu leituras do app local conectado ao Supabase: 6 participantes,
avaliações fechadas, progresso 0 de 0 e Perfil de Igão com overall 60 e duas avaliações.
Os MCPs têm perfis separados; não receberam cookies nem credenciais da sessão real.

## Problemas encontrados e tratamento

- Home repetia data/status e participantes em vários cards. Agora tem um card principal,
  inscrição contextual, atalhos e progresso Lista → Times → Racha → Avaliação.
- Header duplicado na implementação da Home: reutilizado AppHeader.
- Navegação inferior alta e foco inconsistente: estado ativo escuro, cinco itens,
  targets de 60 px, foco visível e safe areas preservadas.
- Controles pequenos em menus de participantes e eventos: mínimo de 44 px de altura.
- Times repetia nome/número e status bruto: identificação pelo nome e número da camisa,
  composição com rótulo explícito de rascunho/confirmado e estado vazio contextual.
- Resultados: placar maior, fila em cartões numerados e estado vazio com orientação.
  Participação, gols e assistências ficam recolhidos; os mesmos handlers continuam ativos.
- Avaliação: menos títulos/cards repetidos ao entrar na lista pessoal, linhas compactas,
  cinco critérios com botões de 48 px e feedback anunciado ao enviar.
  Controles administrativos permanecem no painel inicial, acessível pelo botão de voltar.
- Perfil: avatar maior, overall, estatísticas antes do radar, preto/branco/vermelho,
  mantendo placeholders e mínimo de duas respostas históricas.
- Ranking: cards menores, ordinais e destaque top 3, mesmas métricas e ordenação.
- Loading e vazio: componentes reutilizáveis LoadingCards e EmptyState.
- Preload: a tela transitória loading.tsx não prioriza o escudo; LogoMark usa eager/high
  quando solicitado, sem o priority depreciado do Next Image. Login ficou mais compacto.

## Validação visual

| Tela | 360×800 | 375×812 | 390×844 | 430×932 |
|---|---|---|---|---|
| Login | OK | OK | OK | OK |
| Início | OK | OK | OK | OK |
| Racha | OK | OK | OK | OK |
| Times | OK | OK | OK | OK |
| Avaliação | OK | OK | OK | OK |
| Resultados | OK | OK | OK | OK |
| Ranking | OK | OK | OK | OK |
| Perfil | OK | OK | OK | OK |

Sem overflow horizontal ou títulos cortados nas medições. Botões e summaries visíveis
medidos com pelo menos 44 px de altura. Navegação inferior funcional.
O formulário de avaliação aberto foi verificado nas quatro larguras: 25 botões de nota,
sem controles administrativos para jogador. Estados vazios, lista fechada, times confirmados,
placar em edição, fila com três times e avaliações abertas foram exercitados apenas no banco isolado.

Comparação do mesmo conjunto inicial de dados em 390 px:

| Tela | Altura antes | Altura depois |
|---|---:|---:|
| Início | 1184 px | 877 px |
| Ranking | 2731 px | 2584 px |

Capturas antes/depois e traces ficam fora do Git, em
`%TEMP%/fortalaka-playwright-mcp/`, com prefixos `antes-`, `final-`,
`depois-form-avaliacao` e `ux-antes/depois-trace`.

## Console, rede e performance

- Chrome DevTools MCP: sem erros JavaScript no cenário inspecionado.
- Login local: warning de preload do escudo não reapareceu após a correção.
- HTTP 404 em missing.png é intencional no fixture para verificar fallback de avatar;
  não é falha de Supabase, RPC ou RLS. Sem novas falhas de API observadas no teste isolado.
- Trace local de laboratório após alterações: LCP 247 ms, CLS 0.00, sem throttling.
  Não representa performance de produção nem prova ganho estatístico.
- Queries/polling existentes preservados; nenhuma biblioteca ou cache novo foi adicionado.
- Safe area é validada pelo CSS existente; não equivale a teste físico em iPhone/Safari.

## Qualidade e revisão

- `npm run build`: passou.
- `npm run lint`: passou, sem warnings.
- `node tests/navigation.test.mjs "%TEMP%/fortalaka-round-tests"`: passou.
  Exercita navegação, roles, lista, times, partida, finalização, avaliação/edição sem
  duplicatas, consulta fechada e Perfil/Ranking com overall 88 no banco isolado.
- Teste existente adaptado somente ao novo texto de vazio e à cor do radar.
- Revisão React: componentes novos fora dos renders, valores de apresentação derivados
  do estado existente, sem effects de sincronização adicionais nem novas dependências.
- Graphify atualizado localmente; grafo permanece ignorado.
- SQL pendente desta tarefa: NÃO. RLS alterada: NÃO.

## Arquivos alterados

- `src/app/globals.css`: foco, toque, reduced motion e limites de dialog.
- `src/app/loading.tsx`: remove prioridade do escudo transitório.
- `src/components/app/FortalakaApp.tsx`: Home consolidada, header/nav e Perfil.
- `src/components/auth/LoginForm.tsx`: somente espaçamento, tipografia e tamanho do escudo.
- `src/components/brand/LogoMark.tsx`: carregamento e sizes corretos.
- `src/components/players/PlayerAvatar.tsx`: variante grande reutilizável.
- `src/components/players/PlayerPerformance.tsx`: card de atleta e radar vermelho.
- `src/components/players/StatisticsViews.tsx`: Ranking compacto e estatísticas embutidas.
- `src/components/ratings/EvaluationAdminPanel.tsx`: progresso/loading/vazio.
- `src/components/ratings/EvaluationArea.tsx`: remove repetição durante consulta pessoal.
- `src/components/ratings/EvaluationScreen.tsx`: lista compacta e feedback acessível.
- `src/components/rounds/MatchesPanel.tsx`: placar, fila, eventos expansíveis e targets.
- `src/components/rounds/OwnRegistration.tsx`: apresentação compacta e feedback.
- `src/components/rounds/RachaScreen.tsx`: controles acessíveis e estados.
- `src/components/rounds/RoundSummary.tsx`: resumo compacto e skeleton.
- `src/components/rounds/RoundProgress.tsx`: progresso visual da rodada, novo.
- `src/components/teams/TeamsScreen.tsx`: identificação, estados e feedback.
- `src/components/ui/ScreenState.tsx`: vazio/loading compartilhados, novo.
- `tests/navigation.test.mjs`: adaptação das duas expectativas visuais existentes.
- `docs/auditoria-ui-mobile.md`: este relatório.

Entrega Git: commit com a mensagem `melhora interface e experiência mobile`, seguido de push.
O hash e o estado final são informados na entrega da tarefa. Deploy não autorizado nesta tarefa.
