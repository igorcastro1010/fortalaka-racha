# Correcao da entrada na lista

O frontend chama `setOwnRegistration` -> RPC `inscricao_rodada`.
O SQL anterior usa `ON CONFLICT (racha_id,jogador_id) WHERE jogador_id IS NOT NULL`.
Ele funciona com o indice parcial de `sorteio-times.sql`; o erro 42P10 significa que o banco nao encontrou indice arbitro compativel com a funcao instalada. Codigo local correto nao comprova instalacao no remoto.

## Aplicar no Supabase

1. Execute o conteudo integral de `supabase/auditoria-inscricao-lista.sql` no SQL Editor. E somente leitura: mostra indices, definicao real da RPC e IDs duplicados por rodada/jogador.
2. Se houver duplicatas, pare. Nao exclua nem escolha apenas o registro mais recente: confira status, suplencia, referencias de `time_jogadores.participante_id`, partidas e historico para planejar conciliacao especifica. Compartilhe o resultado da auditoria para construir a correcao desse conjunto de dados.
3. Sem duplicatas, execute o conteudo integral de `supabase/correcao-inscricao-lista.sql`, apos `fluxo-sem-posicoes.sql`. A transacao bloqueia gravacoes durante a verificacao, cria/valida um indice unico completo e reinstala somente a RPC de inscricao sem posicoes. Se o bloqueio nao for obtido em cinco segundos, aguarde e tente novamente.
4. Execute novamente a auditoria; confirme indice e funcao. Teste entrada, recarga, saida e reentrada com conta autorizada. O deploy do frontend e uma etapa separada.

O indice completo protege `(racha_id,jogador_id)` inclusive contra a versao antiga da RPC sem predicado. Valores nulos continuam distintos: participantes historicos sem perfil nao sao apagados ou unidos. O indice parcial antigo e preservado.

Nenhuma policy/RLS muda, nenhum dado e apagado e a identidade continua vindo de `auth.uid()`. A RPC conserva a verificacao de perfil ativo, a lista aberta, o bloqueio da rodada e a saida por status removido. Erros tecnicos ficam no console; a UI exibe mensagem amigavel e bloqueia cliques repetidos.

SQL pendente no remoto: **SIM** ate que a aplicacao e a auditoria sejam confirmadas. Nao houve acesso ao catalogo remoto nesta tarefa.
