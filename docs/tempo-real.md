# Atualização entre aparelhos

## Comportamento

Uma alteração salva por um organizador passa a ser lida pelos outros aparelhos sem recarregar a página: rodada/lista, composição dos times, partidas, placar e fila. As telas de estatísticas, progresso de avaliações e contador de notificações também revalidam suas leituras.

Um canal compartilhado do Supabase recebe mudanças das oito tabelas operacionais. Os eventos são agrupados por 300 ms e usados apenas para disparar consultas existentes, autenticadas e protegidas por RLS. Nenhum payload do socket vira dado da tela. As regras de gravação e versões concorrentes permanecem no banco.

Há uma consulta de recuperação a cada cinco segundos enquanto o app está visível e online. Ela cobre eventos perdidos, falha no socket e a configuração ainda não habilitada do Realtime. A latência real também depende da rede e do tempo das consultas; cinco segundos é o intervalo, não uma garantia de prazo máximo. Ao voltar ao app ou recuperar a conexão, uma nova leitura é agendada.

Avaliações individuais, perfis e notificações não são adicionados à publicação. Essas áreas continuam usando suas consultas/RPCs autorizadas. Em particular, a autoria das notas não é transmitida pelo canal.

## Ativação no Supabase

**SQL pendente: SIM**, salvo se as oito tabelas já estiverem publicadas. Não há conector administrativo do Supabase nesta sessão; a aplicação remota não foi verificada nem executada.

Execute **`supabase/realtime-operacao.sql`** no SQL Editor do projeto correto. É incremental/idempotente, exige as tabelas e RLS já habilitadas e não muda dados, policies, grants ou REPLICA IDENTITY. O SELECT ao final deve retornar:

```text
eventos_partida
fila_times
partida_jogadores
partidas
racha_participantes
rachas
time_jogadores
times
```

Sem essa etapa, o app já sincroniza pela consulta periódica. Com a publicação habilitada, as alterações operacionais também disparam a leitura por evento. Não remover tabelas de uma publicação existente nem desativar RLS para resolver problemas de entrega.

Referência oficial consultada: [Supabase — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes). A publicação e a autorização de leitura são requisitos da entrega de eventos; eventos de exclusão têm limitações próprias de RLS/filtros. O app sempre relê os dados autorizados e não usa a linha excluída como conteúdo.

## Proteção de edição

- Placar/eventos em rascunho e ajustes de times pausam a aplicação de atualização automática nessa tela.
- A rodada pai não muda enquanto um placar ou avaliação está em edição, evitando desmontar o formulário quando outra rodada é criada.
- Data/horário/endereço em edição ou salvamento também pausam a sincronização da rodada. **Descartar alterações** retoma a leitura.
- O estado de abertura das avaliações continua sendo relido para respeitar um encerramento remoto, preservando as notas digitadas.
- Respostas tardias são descartadas após troca de contexto, início de edição ou leitura mais recente. Nenhuma atualização automática recarrega a página ou envia um formulário.
- Conflitos de gravação de partidas/times continuam submetidos às versões e validações existentes; o rascunho não sobrepõe silenciosamente uma gravação concorrente.

## Validação

Testes locais, com dados fictícios e sem escrita remota:

- `live-refresh.test.mjs`: canal único, oito tabelas, agrupamento, fallback, pausa offline/oculta, retomada, consultas sem sobreposição e cleanup.
- `live-sql.test.mjs`: publicação executada duas vezes, RLS obrigatória, dados preservados, ausência de policies novas e exclusão de tabelas sensíveis.
- `live-browser.test.mjs`: sessões independentes, lista/times/placar sem reload, formulário de rodada preservado, resposta antiga descartada e nova rodada aguardando fechamento do rascunho de placar.
- `navigation.test.mjs`: cinco abas, roles, partidas, encerramento e avaliações sem duplicação. A execução com JSDOM pode emitir avisos de `act` por timers de atualização; asserções funcionais aprovadas.
- Playwright MCP confirmou fechamento de lista aparecendo na sessão do jogador sem nova navegação. Eventos do Supabase foram testados com transporte isolado; entrega no projeto remoto depende de aplicar/conferir o SQL.

Executar build antes dos testes de navegador que usam CSS de `.next`, sem paralelismo. Esta entrega preserva as alterações locais anteriores de dependências e skills.
