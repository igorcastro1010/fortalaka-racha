# Pagamentos da Rodada

**Objetivo:** exigir PIX ou Dinheiro na inscricao, sem tratar a escolha como recebimento.

**Arquitetura:** campos financeiros aditivos no participante, RPCs autenticadas e protecao no banco para escrita direta. Configuracao PIX unica com RLS. Frontend reutiliza a inscricao e a lista existentes; nenhuma integracao bancaria automatica.

**Decisoes:** valor individual opcional, cadastrado pelo organizador, obrigatorio para dar baixa. Total recebido soma apenas baixas reais; pendencias de participantes removidos/ausentes nao sao cobrancas ativas. Recebimentos existentes continuam no caixa mesmo apos saida. Legado sem forma fica identificado como nao informado.

- [x] Migration idempotente e testes PostgreSQL/RLS isolados.
- [x] Repositorio e resumo financeiro em centavos, com testes.
- [x] Escolha obrigatoria, card PIX e alteracao sem mudar ordem.
- [x] Gestao financeira e configuracoes PIX para organizadores.
- [x] Testes mobile, regressao, build/lint e revisao final (incluindo Realtime/PWA da master atualizada).
- [x] Revalidacao final e atualizacao Graphify antes do commit.
- [ ] Commit e push apenas dos arquivos desta tarefa; sem deploy manual.

**Revisao Apple Design:** aplicar principios web de hierarquia, controles de pelo menos 44 px, escolhas rotuladas, estados de carregamento e erro acessiveis. Manter preto/branco/vermelho; dispensar modal na escolha de pagamento. Revisar 360, 375, 390 e 430 px.

**Entrega do banco:** migration versionada, sem dados sinteticos ou alteracoes na producao durante testes. Coordenar aplicacao com frontend compativel; o frontend antigo nao envia a escolha obrigatoria.
