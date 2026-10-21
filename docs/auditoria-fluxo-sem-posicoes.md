# Auditoria e conclusão do fluxo sem posições

Conjunto funcional revisado na `master` para publicação por commit e push em 21/10/2026. Sem deploy ou execução de SQL remoto. A configuração local do Graphify permanece preservada fora desta publicação.

## Auditoria antes das alterações

As consultas Graphify localizaram lista/inscrição, sorteio, partidas/fila, encerramento, avaliações e ranking/perfil. As leituras foram direcionadas aos arquivos retornados.

| Área | Estado encontrado e decisão |
| --- | --- |
| Autenticação | Supabase Auth com login, cadastro, recuperação e sessão; login verifica profile ativo. Mantida. Não foi feito login no provedor remoto nesta auditoria. |
| Profiles/jogadores | `auth.uid()` corresponde a `profiles.id`; perfil guarda identidade/role/avatar, sem totais esportivos editáveis. Mantido. |
| Lista | Inscrição própria, saída lógica, unicidade e ajustes administrativos já existiam. A escolha Linha/Goleiro contrariava o novo pedido. |
| Estados | Aberto, lista fechada, times confirmados, em andamento e finalizado já existiam, com validação no banco. Mantidos. |
| Sorteio/times | Quantidade dinâmica, equilíbrio, ajustes, rascunho persistido, versão contra conflito e confirmação sem recriar times já existiam. Retirado apenas o tratamento separado de goleiros. |
| Partidas/resultados | Placar, participação, gols, assistências, histórico, sugestão dos dois gols e finalização manual já existiam. Mantidos sem cronômetro. |
| Fila | Persistência no Supabase e rotação por vitória/empate já implementadas. Mantidas. |
| Finalização | Organizadores encerram após pelo menos uma partida finalizada; preservam dados e bloqueiam novas partidas/sorteios. Mantida. |
| Avaliações | Aba própria, abertura após encerramento, fechamento, 1–5, companheiros, edição sem duplicata e autoria protegida. Mantidas; botão de fechamento ganhou texto explícito. |
| Ranking/perfil | Dados reais derivados de partidas e médias; ranking por overall decrescente. Mantidos. A nota/radar continuam exigindo duas respostas, conforme regra anterior. |
| Avatares | `PlayerAvatar` de 40–44 px, foto com fallback para iniciais e armazenamento na pasta do próprio usuário. Mantidos. |
| RLS | Banco protege inscrição própria, roles, composição, resultados, avaliações e avatar. Mantido o controle existente; novas inscrições comuns passam a usar apenas categoria interna `linha`. |
| Duplicação | Resultados e avaliações já estavam separados de Racha. O mesmo componente de inscrição é reutilizado em Home/Racha intencionalmente. |
| Código morto | `ParticipantEditor.tsx` exigia dois goleiros fixos, mas não tinha importadores. `src/data/mock.ts` também não tinha importadores. Ambos foram removidos após conferir grafo e referências em `src`/`tests`. |

## Correções implementadas

- **ENTRAR NA LISTA** inscreve imediatamente o usuário autenticado, sem modal ou posição. Inscrito vê **VOCÊ ESTÁ NA LISTA** e pode sair enquanto a lista estiver aberta.
- Removidos contadores, opções, cards, associações, avisos e funções de distribuição/troca de goleiros.
- Home mostra Participantes/Suplentes e tem atalho **VER TIMES**, além dos atalhos existentes para Racha, Resultados e Avaliação.
- Gestão em Racha mantém adicionar/remover, participante/suplente e confirmado/ausente/removido.
- **FECHAR AVALIAÇÕES** identifica explicitamente o controle administrativo.
- Ao reabrir a lista, uma fila preservada não oferece iniciar partida até os times estarem confirmados novamente; o banco já bloqueava a gravação.
- Não foram recriados fila, partidas, estatísticas, autenticação, avaliação ou navegação que já funcionavam.

## SQL pendente no Supabase: SIM

Executar **`supabase/fluxo-sem-posicoes.sql`**, depois do `fluxo-principal.sql` que o usuário já informou ter aplicado. Não é necessário reaplicar as migrações anteriores.

A migração substitui apenas as funções relevantes e ajusta duas policies existentes. Não remove tabelas, colunas, enumerações, rodadas ou dados.

**RLS alterada: SIM.** Novas inscrições próprias usam `tipo='linha'`, identidade autenticada, profile ativo e rodada aberta. Inscrições legadas podem sair; tentativas de alterar terceiros continuam bloqueadas. O backend normaliza a entrada pela RPC, independentemente da posição enviada por um cliente antigo. O parâmetro antigo permanece na assinatura para compatibilidade.

`goleiro` continua aceito pelo schema para registros antigos, mas não existe escolha ou gerenciamento dessa posição no app. Participantes legados confirmados e vinculados a um profile são elegíveis como participantes comuns. Ausentes, removidos, suplentes e inscrições sem jogador vinculado não entram no novo sorteio.

Composições antigas já jogadas/finalizadas permanecem intactas, inclusive quando tinham seis integrantes contando o antigo goleiro. O leitor exibe todos como participantes comuns. O alvo máximo de cinco aplica-se aos novos sorteios, sem reescrever o passado.

O teste de upgrade criou uma rodada com a versão anterior, jogou e finalizou uma partida, aplicou a nova migração e conferiu a preservação dos registros. A reaplicação da migração também preservou os dados. Nenhum SQL foi executado em produção nesta tarefa.

## Como testar manualmente

1. **Lista:** organizador cria uma rodada. Com jogador comum, entrar com um toque, sair e entrar novamente; conferir uma única inscrição. Fechar a lista como organizador: jogador não entra/sai. Reabrir e repetir. A reabertura normal continua restrita ao período anterior às partidas, para preservar a composição do racha iniciado.
2. **Sorteio:** usar 5, 10, 13, 15, 18, 20 ou 23 participantes. Fechar lista, sortear, ajustar dois integrantes de times distintos, sair/voltar e confirmar. Conferir distribuição equilibrada, sem posições e sem duplicar IDs. Cinco participantes formam um time; partidas exigem dois times.
3. **Partida/fila:** em Resultados, iniciar primeira partida. Marcar participação, gols/assistências e placar. Ao chegar a dois gols, CONTINUAR não encerra; FINALIZAR encerra. Também é possível finalizar manualmente pelo tempo externo. Vitória mantém o vencedor; empate manda os dois ao final. Iniciar próxima usa a fila salva. Atualizar a página preserva a composição e o histórico.
4. **Encerrar racha:** em Racha, após uma partida finalizada, FINALIZAR RACHA → confirmar. Conferir status finalizado, lista/times/fila/histórico preservados, sem novas partidas nem sorteio.
5. **Avaliação:** na aba Avaliação, organizador abre explicitamente. Jogador vê só companheiros elegíveis, sem ele próprio ou adversários. Enviar/editar 1–5 mantém uma avaliação por colega. Organizador fecha em FECHAR AVALIAÇÕES: nova gravação é recusada pelo banco e as médias continuam disponíveis.
6. **Ranking/perfil:** conferir jogo/gol/assistência/vitória de partidas finalizadas com participação; duas avaliações válidas liberam médias/radar/overall. Média dos cinco critérios ×20 produz o overall /100. Ranking mantém ordem decrescente e não revela autores das notas.

## Validação executada

- `npm run build`: passou.
- `npm run lint`: passou.
- Suítes existentes: sorteio, sorteio SQL, médias, médias SQL, partidas/estatísticas, avaliações, finalizar rodada, fluxo principal anterior e navegação passaram.
- `tests/fluxo-sem-posicoes.test.mjs`: nove cenários, incluindo RLS, cinco organizadores, legado, IDs persistidos, quantidades variáveis, fila, encerramento, fechar avaliações, médias, privacidade e upgrade sem perda de registros.
- Navegação com componentes reais e PostgreSQL local: entrar/sair sem posição, fechar/reabrir, sortear/confirmar, partida, dois gols, encerramento, avaliação/edição, fechamento e criação da próxima rodada passaram.
- Navegador com banco isolado: entrada/saída de um toque; Times sem goleiros e sem rolagem horizontal a 360/390/430 px; primeira partida e controle negativo do placar conferidos. Nenhum dado de teste foi criado no Supabase remoto.
- Autenticação do provedor, policies efetivamente instaladas e operação completa em produção não foram testadas ao vivo; as conclusões de segurança vieram do código e PostgreSQL local.

## Arquivos desta tarefa

Modificados:

- `src/components/app/FortalakaApp.tsx`
- `src/components/ratings/EvaluationAdminPanel.tsx`
- `src/components/rounds/MatchesPanel.tsx`
- `src/components/rounds/OwnRegistration.tsx`
- `src/components/rounds/RachaScreen.tsx`
- `src/components/teams/TeamsScreen.tsx`
- `src/lib/rounds/repository.ts`
- `src/lib/teams/draw.ts`
- `src/lib/teams/repository.ts`
- `tests/navigation.test.mjs`
- `tests/preview-sorteio.mjs`
- `tests/sorteio.test.mjs`

Criados:

- `supabase/fluxo-sem-posicoes.sql`
- `tests/fluxo-sem-posicoes.test.mjs`
- `docs/auditoria-fluxo-sem-posicoes.md`

Removidos por ausência de uso comprovada:

- `src/components/teams/ParticipantEditor.tsx`
- `src/data/mock.ts`

## Revisão para publicação — 21/10/2026

Os 17 caminhos funcionais acima são publicados como um conjunto: 12 arquivos modificados, duas exclusões e três arquivos novos. A correção de contagem de participantes já commitada em `a374e85` foi preservada, sem duplicação ou reversão. A confirmação de saída, os ajustes de autenticação e o DOCTYPE do preview, de commits anteriores, também permanecem intactos.

Validações repetidas nesta revisão:

- `npm run build` e `npm run lint`: OK.
- Sorteio e médias TypeScript: 13 testes OK.
- Scripts isolados: sorteio SQL, médias SQL, partidas/estatísticas, avaliações, finalizar rodada, fluxo principal, fluxo sem posições, navegação, auth-profile e times-participantes: OK.
- O preview real é exercitado pelo teste de navegação, que inicia o servidor e usa os componentes e PostgreSQL isolado. Nenhum teste desta revisão cria dados no Supabase real.
- Busca de referências aos arquivos excluídos: nenhum uso encontrado no código/testes.
- SQL revisado: substituição incremental de funções e alteração de duas policies existentes, sem DROP destrutivo. Jogador continua restrito à inscrição própria e organizador mantém gestão; tipos legados e histórico são preservados. Testes cobrem reaplicação e upgrade com partidas antigas.

**SQL PENDENTE NO SUPABASE: SIM.** Aplicar `supabase/fluxo-sem-posicoes.sql` após `supabase/fluxo-principal.sql`, antes de publicar o frontend deste conjunto. Nenhum SQL remoto foi executado nesta tarefa.

Fora deste commit, com conteúdo preservado:

- `.gitignore`
- `AGENTS.md`
- `docs/graphify.md`
- `.codex/skills/graphify/.graphify_version`
- `.codex/skills/graphify/SKILL.md`
- `.codex/skills/graphify/references/extraction-spec.md`

`graphify-out/` continua local e ignorado. A referência a `goleiro` em tipos/SQL/testes legados existe somente para compatibilidade; a UI e o sorteio atual não controlam essa posição. O resultado Git e o hash da publicação são informados na entrega da tarefa.
