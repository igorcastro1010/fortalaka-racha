# Entrega do pacote de evolução — 29/10/2026

## Complemento solicitado: novos commits

Após os dez commits originais, o usuário solicitou novos commits. Foram acrescentadas correções independentes, com testes de regressão:

- `79251ac`: preserva médias válidas na comparação quando a consulta do outro jogador falha. A privacidade e o mínimo de avaliações continuam iguais.
- `b6423fe`: atualiza o sino quando a página volta a ficar visível no celular, mantendo o bloqueio de consultas em segundo plano e a proteção contra requests simultâneos.
- `515be31`: respeita palavras inteiras nos nomes dos cards, acomoda sobrenomes sem espaços e limita o texto com reticências sem quebrar pares Unicode.
- Este complemento recebe um commit próprio de documentação. O total passa a 14 commits nesta sequência de trabalho.

O usuário informou que aplicou o SQL no Supabase depois da entrega original. Essa informação foi registrada; a aplicação e os fluxos autenticados remotos ainda não foram verificados nesta etapa. Não foi criada ou aplicada outra migration.

Validação deste complemento: build e lint aprovados; sete testes unitários relevantes aprovados; suíte de navegador do pacote aprovada, incluindo falha parcial de médias, retomada de visibilidade, PNG 1080×1920, compartilhamento/download, notificações e cinco larguras. Graphify atualizado localmente. Os testes novos reproduziram as falhas antes das correções. As alterações locais anteriores de package.json, package-lock.json e skills continuam preservadas fora dos commits.

As seções abaixo preservam o registro da entrega original. O status de SQL pendente nelas descreve aquele momento anterior à informação do usuário.

## Resultado e limites

A–D implementadas. E implementada como central persistida com migration e testes locais. **SQL remoto pendente: `supabase/notificacoes.sql`**. A central só receberá/persistirá avisos na produção depois da aplicação dessa migration. Nenhuma migration foi executada no Supabase remoto nesta tarefa.

Push de celular não implementado: faltam infraestrutura de envio, VAPID e subscriptions configuradas. Não há pedido de permissão ao abrir o app nem dependência da Notification API. Sem notas, eventos ou conquistas fictícias no produto.

O pedido atual autorizou deploy no final e substituiu a restrição do anexo. Permanecemos na `master`, sem criar branch. A master remota mais recente foi integrada antes de publicar o pacote.

## Checklist solicitado

| Nº | Item | Resultado |
|---|---|---|
| 1 | find-skills usado | SIM |
| 2 | Skills encontradas | Catálogo e resultados em [pacote-evolucao.md](pacote-evolucao.md) |
| 3 | Skills instaladas | Nenhuma nesta tarefa |
| 4 | Graphify | SIM: query, explain, path e update local |
| 5 | apple-design | SIM: análise inicial e revisão final |
| 6 | react-best-practices | SIM: revisão dos cinco blocos e ajustes finais |
| 7 | Painel contextual | OK em testes locais |
| 8 | Próxima ação | OK: lista, sorteio, revisão, partidas, avaliações |
| 9 | Confirmações | OK: lista, novo sorteio, times e confirmações existentes de partidas/rodada/avaliações/remoção |
| 10 | Feedback | OK: estados de envio, sucesso, falha e cancelamento |
| 11 | Comparação | OK: `/comparar?jogadorA=…&jogadorB=…`; IDs diferentes |
| 12 | Overall | OK: RPC existente e mínimo de duas avaliações |
| 13 | Estatísticas | OK: jogos/gols/assistências/vitórias e razões sem dividir por zero |
| 14 | Radar | Alternativa prevista: comparação atributo por atributo, legível no mobile |
| 15 | Privacidade | OK: sem notas individuais, e-mails ou avaliadores; atributos mantêm permissão próprio/organizador |
| 16 | Conquistas | OK: marcos derivados e prêmios de rodada sob demanda |
| 17 | Regras objetivas | OK: limites exatos, partidas/rodadas finalizadas, empates compartilhados |
| 18 | Perfil | OK: dados da mesma leitura de estatísticas |
| 19 | Perfil público | OK: integração com a rota e componente existentes |
| 20 | Badges | OK: ícones consistentes, marcos conquistados e progresso discreto |
| 21 | Resultado em imagem | OK |
| 22 | Artilharia em imagem | OK: Top 5 |
| 23 | Ranking em imagem | OK: Top 5 e filtro da tela |
| 24 | Preview | OK: PNG 1080×1920; preservado após revalidação idêntica |
| 25 | Web Share | Caminho de arquivos testado com API simulada; envio real em Android/WhatsApp não testado |
| 26 | Fallback | OK: salvar PNG e orientação quando compartilhamento não suportado |
| 27 | Central | OK local; aguarda SQL para funcionar em produção |
| 28 | Não lidas | OK: contagem própria e badge |
| 29 | Marcar lidas | OK: individual/todas, incluindo páginas antigas |
| 30 | Deep links | Rodada atual encaminha à aba; rodada antiga abre histórico correspondente |
| 31 | Push | NÃO |
| 32 | Permission flow | Não se aplica: push não ativado; nenhuma permissão é solicitada |
| 33 | RLS | OK no PostgreSQL isolado: A não lê/marca avisos do B; inativos/anônimos bloqueados |
| 34 | Subscriptions | Não criadas; não há implementação parcial de push |
| 35 | 360×800 | OK em testes locais |
| 36 | 375×812 | OK em testes locais |
| 37 | 390×844 | OK em testes locais |
| 38 | 430×932 | OK em testes locais |
| 39 | Desktop | OK em testes locais |
| 40 | Playwright | MCP usado; suites de navegação, perfil, ranking, histórico e pacote executadas |
| 41 | Console | Sem erros/warnings nas páginas Next e novas telas inspecionadas; testes observam erros de runtime |
| 42 | Network | Sem 4xx/5xx nas inspeções locais e no smoke público de produção; falhas sintéticas de avatar têm fallback; Supabase autenticado remoto não foi testado |
| 43 | Build | OK: `npm run build` |
| 44 | Lint | OK: `npm run lint`, sem warnings |
| 45 | Testes | Ver execução final abaixo |
| 46 | Migrations | `supabase/notificacoes.sql` |
| 47 | Tabelas/colunas | `notifications` e seus índices, criados somente no ambiente de teste nesta tarefa |
| 48 | RLS | Uma policy nova na tabela nova; policies operacionais anteriores preservadas |
| 49 | SQL | PENDENTE no Supabase remoto; aplicado/reaplicado e testado em PGlite isolado |
| 50 | Histórico removido | NÃO; nenhum dado remoto foi alterado |
| 51 | Arquivos | Lista completa abaixo |
| 52–53 | Commits/hashes | Lista abaixo; commits separados por funcionalidade e correções |
| 54 | Push | OK: `origin/master`, sem force-push |
| 55 | Git status | Alterações anteriores em package.json, package-lock.json, apple-design e skills-lock.json preservadas fora dos commits |
| 56 | Deploy | Evidência final abaixo |

## Validação final

Build e lint aprovados após as correções, sem warnings de lint. **As 29 suites passaram** na execução sequencial final. A execução anterior identificou testes que precisavam confirmar as novas ações e um conflito de leitura de CSS com build concorrente; todos foram corrigidos e revalidados. A suíte visual produziu 141 capturas em cinco viewports e ambas as roles.

Testes de segurança usam PostgreSQL/PGlite e dados fictícios locais. MCP Playwright verificou os fluxos novos e cinco larguras; Chrome DevTools verificou console, rede, imagens e ausência de overflow. Login Next.js local: 200, sem erros; visitantes redirecionados ao login nas rotas protegidas. Não houve login, alteração de rodada real ou cadastro fictício em produção.

Segunda auditoria visual: preservadas as cinco abas, estilo esportivo e componentes existentes; sem tabela horizontal. A suíte visual existente cobre ambas as roles, teclado, alvos de toque, imagens, foco, reduced motion e histórico. Capturas e bancos de teste ficam fora do Git.

## Commits

| Hash | Mensagem |
|---|---|
| c4cc20c | melhora fluxo do organizador |
| aef9e11 | preserva confirmações após integrar atualização da master |
| 8e9a7a9 | adiciona comparação de jogadores |
| fee9f47 | adiciona conquistas de jogadores |
| fc56486 | adiciona cards visuais compartilháveis |
| f268898 | adiciona central de notificações |
| fc2b9a9 | preserva preview e permite ler avisos de páginas antigas |
| 7d60714 | preserva parâmetros de navegação e valida confirmações |
| 4f31eea | documenta arquitetura e skills do pacote de evolução |

O décimo commit registra este relatório; seu hash fica no histórico Git e na entrega do chat. Nenhuma alteração de runtime foi feita após o deploy.

## Publicação

Projeto conferido: `fortalaka-racha`, ID `prj_MyTNmYLDPvQ6P7sM2F0CqZW9dbE4`, equipe `team_cQVpAONaQOgTakETKfyhcUtC`. Deploy da revisão Git `4f31eeab32f942987c5257de5e85420449a7b718`, excluindo os arquivos locais anteriores não commitados.

**Deploy realizado: SIM. Status READY.** ID `dpl_Cm4fJ3eFPtisSrm5azieJEiZJaX4`. URL pública: https://fortalaka-racha.vercel.app. Alias de produção aplicado sem erro.

Smoke em produção, sem login: página de login em 360/375/390/430 e desktop sem overflow; comparação, notificações e perfil protegido redirecionam ao login, com resposta final 200, sem erros de runtime ou falhas 4xx/5xx nas navegações observadas. Nenhum fluxo autenticado real foi executado. Deploy não executa SQL do Supabase.

## Arquivos do pacote

```text
docs/pacote-evolucao.md
docs/relatorio-evolucao.md
src/app/comparar/page.tsx
src/app/notificacoes/page.tsx
src/app/page.tsx
src/app/rodadas/[id]/page.tsx
src/components/app/FortalakaApp.tsx
src/components/notifications/NotificationBell.tsx
src/components/notifications/NotificationCenter.tsx
src/components/notifications/NotificationRound.tsx
src/components/players/PlayerAchievements.tsx
src/components/players/PlayerComparison.tsx
src/components/players/PublicPlayerProfile.tsx
src/components/players/StatisticsViews.tsx
src/components/results/PostRoundSummary.tsx
src/components/results/VisualShareCard.tsx
src/components/rounds/OrganizerPanel.tsx
src/components/rounds/RachaScreen.tsx
src/components/teams/TeamsScreen.tsx
src/lib/notifications/repository.ts
src/lib/players/achievement-repository.ts
src/lib/players/achievements.ts
src/lib/players/comparison.ts
src/lib/results/render-visual-card.ts
src/lib/results/visual-card.ts
src/lib/rounds/organizer-overview.ts
supabase/notificacoes.sql
tests/achievements.test.mjs
tests/comparison.test.mjs
tests/evolution-ui.test.mjs
tests/navigation.test.mjs
tests/notifications-sql.test.mjs
tests/organizer-overview.test.mjs
tests/preview-sorteio.mjs
tests/public-profile-ui.test.mjs
tests/visual-card.test.mjs
tests/visual-remodel.test.mjs
```
