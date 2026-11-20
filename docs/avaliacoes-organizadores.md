# Consulta de notas por rodada

Em Avaliação > Progresso > Detalhes das avaliações, organizadores ativos
podem selecionar uma rodada e consultar quem avaliou quem, notas de 1 a 5
e pares pendentes. Filtros por avaliador e avaliado não alteram os registros.

Esta é uma exceção administrativa ao anonimato entre jogadores, solicitada
pelo responsável pelo projeto. Jogadores comuns continuam sem acesso às
notas enviadas por outras pessoas. Não há edição administrativa de notas.

## Segurança e dados

- RPC `ler_detalhes_avaliacoes(uuid)` exige `auth.uid()` e `is_organizer` ativo.
- EXECUTE revogado de PUBLIC e anon; RLS da tabela permanece inalterada.
- Retorna somente pares e notas da rodada solicitada, sem e-mails.
- Pendências usam a mesma função de time elegível das avaliações existentes.
- Notas já registradas permanecem consultáveis mesmo após mudança de elegibilidade.
- Nenhuma nota, média ou autoria é alterada pela migration.
- Carregamento sob demanda, cancelamento ao fechar e atualização pelos eventos existentes;
  sem polling novo e sem persistência das notas em localStorage.
- Seletor mostra as 100 rodadas mais recentes e a rodada atual.

## Migration e reversão

`supabase/migrations/20261120012502_detalhes_avaliacoes_organizador.sql`
foi validada duas vezes no PostgreSQL isolado e aplicada em produção com autorização.
Reversão: remover a integração de interface e executar
`drop function public.ler_detalhes_avaliacoes(uuid);`.

## Validação

- `tests/avaliacoes.test.mjs`: notas, nomes, rodada, pendências sem zero,
  ausência de dados, acesso negado para jogador/inativo/anon, idempotência e dados preservados.
- Lint, TypeScript e build Webpack aprovados.
- Build Turbopack local falhou ao iniciar subprocesso de CSS.
- Fixture visual isolada: `tests/preview-evaluation-details.mjs`.
- Verificação visual não concluída: IAB indisponível e conector Chrome com erro.
