# Performance V1.1

Escopo autorizado: otimizar autenticação, leituras, navegação e sincronização; commits locais pequenos, sem push/deploy e sem SQL/RLS.

## Desenho e decisões

- Manter as RPCs e suas verificações de versão/autorização. Cache é apenas para apresentação; leituras dos repositórios continuam frescas por padrão. Invalidação acontece antes e depois de mutações, inclusive falhas ambíguas de rede.
- Distinguir sessão inválida, perfil inexistente/inativo e falha temporária. O proxy renova a sessão mas deixa páginas públicas decidir seu destino; erros transitórios não viram logout.
- Um hub Realtime invalida domínios específicos, sem confiar nos payloads como dados. Sem polling para domínios cobertos por canal saudável; domínios sem publicação usam reconciliação lenta. Falhas de transporte usam backoff limitado e retomada revalida.
- Cache em memória no navegador, com TTL, deduplicação, geração contra respostas antigas e cancelamento. Nunca compartilhar memória de usuário entre requisições SSR; limpar em mudança de sessão/logout.
- Preservar estado das telas visitadas com React Activity: efeitos suspensos quando ocultas. Não manter leitores ocultos ativos.
- Alternativas descartadas: cache persistente (risco de sessão/dados antigos); biblioteca nova de consultas (desnecessária); manter polling global (não resolve objetivo).

## Plano e registro

- [x] Autenticação: regressões de sessão inválida, erro temporário e perfil ausente; corrigir redirecionamentos e recuperação.
- [x] Hub: regressões de invalidação específica, conexão saudável, backoff, perda/retomada de eventos e cleanup.
- [x] Cache: deduplicação, TTL, troca de sessão, invalidação concorrente, cancelamento; leituras críticas sempre frescas.
- [x] Integração: telas/subáreas ocultas suspensas, leituras paralelas e navegação sem nova carga válida.
- [x] Validar lint, typecheck, build e suítes disponíveis; comparar contagens determinísticas, documentar limites; atualizar Graphify e revisar commits.

## Riscos que os testes devem cobrir

Troca de usuário durante leitura; evento recebido durante consulta; retorno de resposta anterior à mutação; socket conectado sem publicação de uma tabela; rascunho aberto enquanto outro aparelho altera dados. Dados de cache nunca podem autorizar pagamentos, presença, sorteio ou placar.

## Medição

Medição em 16/11/2026. Base de código: 3bb4950. Os resultados abaixo distinguem contagem determinística, tráfego local e estimativas por inspeção.

| Cenário | Antes | Depois | Evidência/limite |
| --- | --- | --- | --- |
| Ciclos operacionais do hub em 60 s, canal saudável | 12 (intervalo fixo de 5 s) | 0 | Relógio controlado, tests/performance-live.test.mjs; não equivale ao total de requests |
| Reconciliação de dados sem publicação Realtime | Integrada ao polling global | 2/min | Intervalo de 30 s para ratings, notifications, profile e payments |
| Voltar Racha → Home dentro de 30 s sem alteração | Sem medição de navegador comparável | 0 novas leituras de rodada/avatars/times/partidas | tests/performance-browser.test.mjs; cache determinístico também comprova reutilização |
| Home organizador ociosa, viewport 390×844, 60.014 ms | Não medida no navegador antes | 12 requests | Janela real local, PostgreSQL isolado + transporte de eventos de teste; duas de cada: notifications, ler_times_rodada, ler_progresso_avaliacoes, rachas, racha_participantes, avatars_da_rodada |
| Polling de partidas nessa janela | Hub anterior acionava a cada 5 s | 0 requests | Socket de teste saudável; partidas ocultas não têm leitor ativo |
| Perfil já visitado e oculto nessa janela | Efeitos permaneciam montados; PlayerPerformance tinha intervalo próprio de 15 s | 0 leituras de foto/médias/estatísticas | Medição de requests e Activity; nenhum intervalo próprio de 15 s permanece |
| Recarregamento ao trocar abas | Sem medição comparável antes | 1 única entrada de navegação de documento | Teste mantém o mesmo documento, preservando estado |
| LCP, INP e latência de carregamento em celular real | Não medidos | Não medidos | Sem aparelho físico ou comparação equivalente em produção |

A estimativa de pelo menos 60 requests/min da auditoria V1.0 vinha da inspeção do código e não contabilizava todos os indicadores do organizador. Ela NÃO é um benchmark medido; não foi usada para afirmar redução percentual. As 12 requests/min atuais não incluem frames do canal, tráfego de assets, retomada de foco, mutações, erros ou reconexões. A conexão inicial e a reconexão fazem uma reconciliação completa intencional para cobrir eventos perdidos.

## Resultado implementado

1. Auth diferencia erro temporário (tela com tentativa novamente), perfil ausente/inativo e sessão inválida. /login não redireciona cegamente só porque existe usuário Auth. Cookies de renovação são preservados nos redirecionamentos.
2. Realtime invalida oito tabelas operacionais já publicadas. Uma consulta SELECT de configuração confirmou a publicação; nenhuma alteração remota foi executada. Eventos agrupados em 300 ms, fila de invalidação durante leitura e retries de erro evitam perder atualizações. Falha de canal: fallback 10/20/40/60 s; sucesso restaura Realtime. Foco/online/visibilidade reconciliam novamente.
3. React Activity suspende efeitos das abas e subáreas ocultas preservando formulários, filtros e edições. O cabeçalho permanece montado durante navegação entre abas.
4. Cache somente em memória do navegador, por identidade da sessão, TTL 30 s, limite de entradas concluídas e deduplicação. Troca de usuário/logout, eventos e gravações invalidam entradas. SSR não compartilha esse cache. AbortSignal e sequências impedem respostas antigas ou canceladas de aplicar estado, inclusive hits de cache em microtask.
5. Participantes e avatars são consultados em paralelo após identificar a rodada. Home/painel/times reaproveitam leituras compartilhadas; notificações e inscrições invalidam apenas os domínios necessários. RPC desconhecida conserva invalidação ampla.
6. Cache serve exclusivamente à apresentação. Sorteio, ajustes e confirmação de times conferem estado/versão em leitura fresca e mantêm a validação de versão da RPC. Pagamentos fazem preflight fresco, bloqueiam conflito/indisponibilidade e continuam autorizados pela RPC. Presença, placares e avaliações continuam gravados pelo servidor, sem replay nem cache de transporte.
7. Cargas e erros mantêm feedback local e navegação disponível. Cancelamentos normais ao ocultar componentes não são registrados como erro.

## Validação executada

- npm run lint: passou, sem avisos na execução final.
- npx --no-install tsc --noEmit --incremental false: passou. O build final também executou TypeScript.
- npm run build: tentou com Turbopack, mas falhou por PANIC na comunicação de subprocesso durante processamento CSS, também fora do sandbox. Esse comando NÃO foi considerado aprovado.
- npm run build -- --webpack: passou na execução final, compilação 11,6 s, TypeScript 4,6 s, 10 páginas geradas. São tempos de build local, não de carregamento do aplicativo.
- 39 scripts Node de regras, repositórios, Auth, cache, hub, transporte, SQL em PostgreSQL isolado e recursos PWA: passaram. Incluem pagamento fresco, versões, permissões, sorteio, inscrições, partidas, avaliações, notificações e push.
- tests/push-edge.test.mjs: passou com Deno já disponível no cache local, pois depende desse runtime; execução direta em Node não é válida. Nenhuma dependência adicionada ao projeto.
- tests/evaluation-views.test.mjs: 6/6 testes passaram, incluindo erros, confirmação, prevenção de duplicata e rascunho preservado.
- tests/navigation.test.mjs: passou no fluxo completo de cinco abas, perfis, partida, encerramento, avaliações e nova rodada, usando React real e PostgreSQL isolado.
- 14 scripts de navegador passaram: empates-browser, evolution-ui, inscricao-ui, live-browser, notifications-ui, pagamentos-ui, performance-browser, post-round-summary, public-profile-ui, push-browser, pwa-browser, ranking-ui, round-history-ui e visual-remodel. A regressão visual gerou 141 capturas em cinco viewports; pagamentos/ranking/perfil também verificaram viewports mobile e console/rede.
- tests/live-browser.test.mjs: duas sessões sincronizadas sem reload, edição preservada, resposta antiga descartada e nova rodada após fechar edição. O teste usa eventos locais no adaptador isolado; não prova entrega do WebSocket em aparelhos físicos/produção.
- tests/pwa-production.test.mjs: passou contra Next compilado em localhost:3022. Manifest, assets públicos, headers do service worker, metadata e redirects de rotas protegidas sem sessão conferidos. Sem login nem gravação no Supabase.
- graphify update .: passou, AST local, saída ignorada. Revisão independente final não apontou novos defeitos concretos.

Os 57 arquivos de teste do projeto foram executados com os runtimes apropriados; não existe script npm test/typecheck no package.json. Browser/JS DOM usam esbuild, Playwright, jsdom e PGlite já presentes no cache deste PC, sem alterar package.json/lock. Servidores, bundles, banco de teste e capturas ficam em diretórios temporários, fora do Git. Os fixtures agora simulam invalidação/cancelamento e eventos, e leem CSS tanto do Webpack como do Turbopack; seletores antigos foram ajustados à súmula atual e à preservação de telas. A contagem inicial da navegação separa leituras concluídas por sessão das consultas abortadas durante troca de usuário; a contagem bruta de requests é feita no teste de performance. Essa distinção corrigiu uma oscilação observada na asserção antiga de inicialização. As correções de teste não adicionam controles artificiais ao aplicativo.

Para repetir: definir o caminho local de dependências como argumento e executar node tests/<nome>.test.mjs <diretório-com-package.json-e-node_modules>. Os fixtures de navegador usam a porta 3011 e devem rodar sequencialmente. performance-browser aceita --minute; pwa-production aceita URL do Next iniciado após build. push-edge requer deno run --node-modules-dir=none --allow-env. Os testes de banco usam PGlite local; nunca executar fixtures contra o banco real.

## Limitações e pendências

- Falha ambiental do build padrão Turbopack continua pendente; Webpack validou o código e não houve mudança permanente de configuração de build.
- Homologação com conta real em dois celulares, reconexão móvel e instalação/atualização PWA no dispositivo continua pendente de publicação autorizada. Não se mediu LCP/INP nem ganho percentual de velocidade.
- Tabelas auxiliares sem publicação Realtime sincronizam por reconciliação de até 30 s enquanto visíveis. O fallback de canal degradado chega a 60 s, além do tempo de rede. Não se alterou publicação, RLS ou permissões.
- Preflight de pagamento é leitura fresca, mas não é atomicamente condicionado à gravação: uma alteração concorrente entre SELECT e RPC ainda depende das garantias existentes no servidor. Eliminar integralmente essa janela exigiria contrato transacional/versionado no banco, fora do escopo autorizado. Nenhuma confirmação é decidida pelo cache.
- O service worker existente não foi modificado; os testes PWA conferem que cache/offline públicos e recursos protegidos continuam com as regras existentes.
- SQL pendente: NÃO. RLS/políticas/estrutura/permissões alteradas: NÃO. Dados de produção alterados: NÃO. Dependências do projeto adicionadas: NÃO. Push/merge/deploy: NÃO.
- Alterações locais anteriores preservadas: .agents/skills/apple-design/, .agents/skills/find-skills/, skills-lock.json e supabase/.temp/.

## Arquivos alterados

A lista abaixo é o escopo exato desde 3bb4950; os arquivos de testes não listados foram apenas executados.



- `docs/performance-v1.1.md`
- `src/app/error.tsx`
- `src/app/login/page.tsx`
- `src/components/app/FortalakaApp.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/live/useLiveRefresh.ts`
- `src/components/live/useViewData.ts`
- `src/components/notifications/NotificationBell.tsx`
- `src/components/players/PlayerPerformance.tsx`
- `src/components/players/ProfilePhoto.tsx`
- `src/components/players/StatisticsViews.tsx`
- `src/components/ratings/EvaluationAdminPanel.tsx`
- `src/components/ratings/EvaluationArea.tsx`
- `src/components/ratings/EvaluationScreen.tsx`
- `src/components/results/ResultsScreen.tsx`
- `src/components/rounds/MatchesPanel.tsx`
- `src/components/rounds/OrganizerPanel.tsx`
- `src/components/rounds/RachaScreen.tsx`
- `src/components/rounds/RoundFinance.tsx`
- `src/components/rounds/useCurrentRound.ts`
- `src/components/teams/TeamsScreen.tsx`
- `src/lib/auth/get-profile.ts`
- `src/lib/auth/session-error.ts`
- `src/lib/live/cache.ts`
- `src/lib/live/read-signal.ts`
- `src/lib/live/reads.ts`
- `src/lib/live/refresh.ts`
- `src/lib/live/transport.ts`
- `src/lib/matches/repository.ts`
- `src/lib/notifications/repository.ts`
- `src/lib/payments/repository.ts`
- `src/lib/ratings/repository.ts`
- `src/lib/rounds/repository.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/teams/repository.ts`
- `tests/auth-profile.test.mjs`
- `tests/auth-proxy.test.mjs`
- `tests/built-css.mjs`
- `tests/empates-browser.test.mjs`
- `tests/evaluation-views.test.mjs`
- `tests/evolution-ui.test.mjs`
- `tests/fixture-client.mjs`
- `tests/inscricao-ui.test.mjs`
- `tests/live-browser.test.mjs`
- `tests/live-refresh.test.mjs`
- `tests/navigation.test.mjs`
- `tests/notifications-ui.test.mjs`
- `tests/pagamentos-ui.test.mjs`
- `tests/payment-freshness.test.mjs`
- `tests/performance-browser.test.mjs`
- `tests/performance-live.test.mjs`
- `tests/performance-transport.test.mjs`
- `tests/post-round-summary.test.mjs`
- `tests/preview-sorteio.mjs`
- `tests/public-profile-ui.test.mjs`
- `tests/push-browser.test.mjs`
- `tests/pwa-browser.test.mjs`
- `tests/ranking-ui.test.mjs`
- `tests/session-cache.test.mjs`
- `tests/visual-remodel.test.mjs`

## Commits locais

- 5dc0ccc — autenticação e recuperação de sessão.
- d945589 — hub e cache por sessão.
- 17e4cd8 — concorrência, retries e invalidação específica.
- 6ed9d17 — leituras paralelas, compartilhadas e canceláveis.
- 9759b8e — suspensão de leitores ocultos e navegação preservada.
- 1a25e3d — preflight fresco de pagamentos.
- 6ec00ca — cancelamento esperado ao ocultar telas.
- Commit final de testes/relatório: consultar git log; sem publicação.
