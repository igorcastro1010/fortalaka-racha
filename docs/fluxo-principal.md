# Fluxo principal do RACHA FORTALAKA

Implementado na `master`, sem deploy e sem alterações no Supabase remoto.

## SQL pendente: SIM

Executar o arquivo completo `supabase/fluxo-principal.sql` no SQL Editor do Supabase, depois das migrações existentes, nesta ordem de dependências:

1. `schema.sql`
2. `sorteio-times.sql`
3. `validacao-sorteio-avatars.sql`
4. `partidas-estatisticas.sql`
5. `avaliacoes.sql`
6. `finalizar-rodada.sql`
7. `entrada-avaliacoes.sql`
8. **Nova:** `fluxo-principal.sql`

Não reaplicar os arquivos antigos se já estiverem instalados. A migração nova foi executada apenas em PostgreSQL local isolado. Ela pode ser reaplicada sem alterar rodadas, fila, resultados, inscrições, composições ou avaliações existentes; isso foi testado com dados preenchidos.

## Navegação e operação

- **Início:** resumo real da rodada, data, horário, endereço, inscritos, inscrição pessoal e atalhos.
- **Racha:** criação/edição dos dados, lista, ajustes administrativos, fechamento/reabertura da lista e encerramento do racha.
- **Times:** sorteio, ajustes de linha e goleiros, confirmação e visualização da composição persistida.
- **Avaliação:** controles de abrir/fechar para organizadores; avaliação de companheiros para jogadores.
- **Resultados:** confronto atual, placar, participação, gols, assistências, fila, próxima partida e histórico. Ranking é uma subaba; Perfil permanece no avatar do header.

O jogador entra como Linha ou Goleiro sem escolher o próprio nome. O banco usa `auth.uid()`. Sair marca a inscrição como removida; reentrar reutiliza a mesma inscrição. Jogadores só alteram a própria inscrição durante a lista aberta. Os cinco organizadores têm as mesmas permissões e podem ajustar manualmente a lista fechada. Após começar uma partida, os ajustes da lista não substituem times nem participação histórica.

Fechar a lista aceita qualquer quantidade, inclusive zero. Antes de iniciar partidas, é possível reabrir a lista. O sorteio usa `ceil(linhas/5)`, distribui a linha com diferença máxima de um e trata goleiros separadamente. Goleiros ausentes/excedentes geram aviso, sem bloquear o sorteio. Trocar um goleiro já associado troca os goleiros entre os dois times.

Confirmar os times persiste a fila por número dos times. Em Resultados, **INICIAR PRIMEIRA PARTIDA** usa os dois primeiros. A criação da primeira partida muda o estado para `em_andamento`. Só existe uma partida aberta por rodada.

- Vitória: vencedor fica, perdedor vai ao fim, próximo da fila entra.
- Empate: os dois saem e vão ao fim; os próximos dois entram. Com três times, entra o aguardando e um dos que saíram; com dois, ocorre revanche.
- A fila funciona com dois, três, quatro, cinco ou mais times e fica salva no Supabase. Correções de resultados recalculam a fila pelo histórico enquanto o racha estiver em andamento. Ao encerrar, a fila fica preservada.
- O botão **ATUALIZAR PARTIDAS E FILA** permite buscar mudanças de outros organizadores quando não há edição em curso. Versões antigas são recusadas no banco.

Placar e eventos são manuais, não negativos. Ao atingir dois gols, o app pergunta se deve finalizar; **CONTINUAR** mantém a partida aberta. Os sete minutos e a duração total são controlados externamente. Gols sem autor não impedem salvar ou finalizar. Jogos/vitórias contam apenas participação em partidas finalizadas; as estatísticas e médias existentes continuam derivadas dos dados reais.

Em Racha, **FINALIZAR RACHA** fica desabilitado até existir uma partida finalizada. A confirmação preserva os dados, grava `finalizada_at`/`updated_at`, bloqueia novas partidas e sorteio e remove a ação de finalizar novamente. Não abre avaliações automaticamente. Depois, o organizador abre a aba **Avaliação** e toca em **ABRIR AVALIAÇÕES**.

A avaliação existente foi reaproveitada: somente companheiros elegíveis do próprio time, sem autoavaliação/adversários, critérios 1–5, envio/edição sem duplicatas, autoria protegida e exibição de médias. O radar/overall continuam exigindo duas respostas, conforme a regra anterior. `PlayerAvatar` continua com 40–44 px nas listas.

## Segurança incremental

- RLS de inscrição própria: inserir/alterar/remover somente a inscrição autenticada, com lista aberta; organizadores mantêm gerenciamento administrativo.
- Trigger valida identidade imutável, tipos/estados permitidos e preservação da lista finalizada.
- Novas rodadas nascem abertas com avaliações fechadas.
- Composições substituídas ficam inativas, preservadas e ocultas da leitura normal dos jogadores.
- Fila permite leitura por conta ativa e escrita somente pelas RPCs administrativas.
- Criação/salvamento de partidas, sorteio e confirmação validam role, rodada e versão no banco. Escrita/exclusão direta em partidas/eventos/participações é revogada.
- Nenhuma tabela ou dado histórico é apagado pela migração. A substituição de eventos de uma partida corrigida continua usando o mecanismo de atualização já existente.

## Validação

`npm run build` e `npm run lint` passaram. Todas as suítes existentes passaram, incluindo sorteio, médias, estatísticas, avaliações, finalização e navegação.

`tests/fluxo-principal.test.mjs` cobre criação/autorização, os cinco organizadores, inscrição própria, saída/reentrada, bloqueio da lista fechada, times/goleiros persistidos, vitória, empate, versões antigas, fila dinâmica, encerramento, preservação, avaliações separadas, médias/overall e reaplicação da migração com dados existentes.

`tests/navigation.test.mjs` usa componentes reais e PostgreSQL local: inscrição como goleiro/linha, saída/reentrada, sorteio/confirmação, partida, confirmação dos dois gols, encerramento, avaliação, edição sem duplicata, remontagem para verificar persistência, Perfil/Ranking e criação de uma nova rodada com data/horário/endereço.

No navegador, Racha/Times/placar foram conferidos em 360 px; placar e confirmação também em 390 e 430 px, sem rolagem horizontal. Nenhum dado de teste foi inserido no Supabase remoto.

## Arquivos

Criados:

- `src/components/rounds/OwnRegistration.tsx`
- `src/components/rounds/RoundForm.tsx`
- `supabase/fluxo-principal.sql`
- `tests/fluxo-principal.test.mjs`
- `docs/fluxo-principal.md`

Modificados:

- `src/components/app/FortalakaApp.tsx`
- `src/components/results/ResultsScreen.tsx`
- `src/components/rounds/MatchesPanel.tsx`
- `src/components/rounds/RachaScreen.tsx`
- `src/components/rounds/RoundSummary.tsx`
- `src/components/teams/TeamsScreen.tsx`
- `src/lib/matches/repository.ts`
- `src/lib/rounds/repository.ts`
- `src/lib/teams/draw.ts`
- `src/lib/teams/repository.ts`
- `tests/navigation.test.mjs`
- `tests/preview-sorteio.mjs`
- `tests/sorteio.test.mjs`
