# Presenca real por rodada

## Operacao

Racha > Gestao > Presenca dos jogadores. Somente organizadores ativos podem
registrar Presente ou Faltou, inclusive na rodada atual finalizada. Inscricao,
pagamento e presenca sao independentes. Nao conferida nao equivale a falta:
mantem compatibilidade com o historico existente e exige conferencia humana.

Faltou bloqueia novas avaliacoes enviadas e recebidas. A confirmacao informa a
quantidade total de notas afetadas. A RPC compara novamente a quantidade sob
lock da rodada; se houver mudanca, exige atualizar e confirmar novamente.
Notas sao movidas para o arquivo restrito `correcoes_presenca` antes de sair de
`avaliacoes`, na mesma transacao. O arquivo registra autor, data e valores
originais. A aplicacao nao tem permissao direta de editar a presenca ou o arquivo.

Ausencia nao gera zero. Overall continua usando as notas ativas. Estatisticas
individuais e o helper V1.2 excluem a rodada ausente; assim nao ha conquistas de
presenca por mera inscricao. Registros originais de partidas, eventos e equipes
nao sao apagados. O resumo de partidas continua sendo o registro dos jogos:
participacoes incorretas nos jogos devem ser corrigidas no editor de partidas.

Se houver gols/assistencias positivos, registrar falta e bloqueado: o organizador
deve conferir/corrigir primeiro esses eventos. Novos eventos positivos para quem
faltou tambem sao bloqueados. Selecionar Presente posteriormente nao restaura
avaliacoes arquivadas: novas respostas precisam respeitar abertura e elegibilidade.

## Instalacao

SQL incremental e reaplicavel: `supabase/presenca-rodada.sql`, apos SQLs atuais
de avaliacoes, V1.2 e detalhes de avaliacoes. CLI Supabase nao disponivel neste
ambiente; entregue como SQL versionado no padrao dos scripts existentes.
Nao foi aplicado em producao. Nao faz backfill nem altera presencas reais.
Alerrandro e Hamilton ainda precisam ser marcados apos a aplicacao/publicacao.

As novas tabelas possuem RLS e nenhum grant direto a anon/authenticated; as RPCs
verificam organizador ativo. O helper booleano de ausencia e legivel por contas
autenticadas para suportar a view de estatisticas; nao expoe notas arquivadas.
Atualizacoes sinalizam `rachas.updated_at` para reutilizar o realtime existente.
Nao ha novo polling. A tela carrega somente ao expandir e permite atualizar.

## Validacao

`node tests/avaliacoes.test.mjs <diretorio com @electric-sql/pglite>` verifica
permissoes, confirmacao de quantidade, bloqueio dos dois lados, arquivo,
idempotencia, exclusao de estatisticas e preservacao dos dados nao afetados.
Nao executar testes sinteticos no Supabase de producao.

Rollback exige restaurar as definicoes anteriores das funcoes/views e remover a
UI nova. Nao apagar tabelas de auditoria nem restaurar notas automaticamente.
