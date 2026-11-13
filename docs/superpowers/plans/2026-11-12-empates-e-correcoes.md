# Empates, pendencias de avaliacao e correcoes

## Design aprovado
- Empate com dois ou mais times aguardando: entram os proximos dois.
- Com um aguardando: organizador informa vencedor dos penaltis alternados.
- Sem aguardando: permanecem os dois. Penaltis nao alteram placar nem estatisticas.
- Apenas organizadores consultam quem ainda nao terminou as avaliacoes.
- Apos encerrar: corrigir placar/gols/assistencias sem alterar participacao,
  status da partida, times, fila ou avaliacoes existentes.

## Plano de implementacao
1. SQL incremental: vencedor dos penaltis, validacao atomica, fila compativel
   com historico, RPC restrita de pendencias. Testes PostgreSQL isolados.
2. Reutilizar editor de partidas e progresso das avaliacoes. Confirmacao
   contextual do empate e selecao explicita do vencedor; erros amigaveis.
3. Testar permissoes, versoes obsoletas, fila, estatisticas e preservacao.
4. Build, lint, testes relevantes, Graphify e revisao de diff.
5. Commit/push apenas dos arquivos desta tarefa. Sem deploy ou SQL remoto.

## Entrega e validacao
- Implementado: `supabase/empates-e-correcoes.sql`, repositorios e telas.
- SQL incremental, reaplicavel e sem exclusao de dados. Aplicar depois de
  `fluxo-sem-posicoes.sql` e `avaliacoes-elegibilidade.sql`, antes de publicar
  o frontend. SQL remoto PENDENTE; nao houve deploy nesta tarefa.
- A RPC antiga continua valida, com bloqueio de empate sem vencedor quando
  existe um time aguardando. Empates legados mantem a ordem anterior.
- Vencedor dos penaltis fica persistido separado do placar e dos eventos.
- Edicao disponivel no resumo e no historico, reutilizando o editor existente.
- PGlite: 5 grupos novos de cenarios, ACL, versao obsoleta, reaplicacao,
  resultados, fila, participacao e preservacao das avaliacoes.
- Regressao: fluxo-principal (9 grupos) e navegacao completa aprovados.
- Playwright + CDP: empates 0/1/2 aguardando, correcao, pendencias e restricao
  por perfil; 360/375/390/430 px sem overflow nem erros de console.
- Build e lint aprovados. Apple Design: radios explicitos, nomes legiveis,
  controles de toque e confirmacao contextual. React: leituras com descarte
  de respostas antigas, nenhuma nota individual no payload de pendencias.
- Limites: banco isolado; concorrencia validada por versao, nao por duas
  conexoes simultaneas. Nao testado em aparelho fisico ou banco de producao.
