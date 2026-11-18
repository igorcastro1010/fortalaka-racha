# Gol rapido durante a partida

Fluxo aprovado: + Gol do time -> autor -> assistencia ou Sem assistencia.
Somente participantes do time escolhido aparecem; autor nao pode dar a
propria assistencia. So ajustar placar permite registrar gol sem autoria.

## Persistencia e seguranca

- Reutiliza salvar_partida_com_desempate: placar e totais individuais sao
  enviados juntos, com versao e autorizacao de organizador no banco.
- Lock imediato bloqueia duplo clique. Falha de escrita ou releitura exige
  atualizar antes de continuar; nao ha repeticao automatica.
- Desfazer restaura placar e registros do ultimo envio desta sessao apenas
  quando a versao confirma que nao houve outra edicao.
- Sem schema novo: banco conserva totais individuais, nao um vinculo novo
  entre autor e assistente por lance. Nao inventar uma timeline apos recarga.
- Sugestao aos dois gols, finalizacao, empates e fila permanecem existentes.

## Edicao

Corrigir placar e registros fica recolhido durante o jogo. Em partidas
historicas continua aberto. Corrigir autor transfere um gol entre jogadores
do mesmo time em uma escrita, preservando placar e assistencias. Ajustes
individuais nao mudam placar; ajustes do placar nao mudam registros individuais.
A participacao de rodada encerrada continua protegida.

## Validacao

- Playwright e CDP: tres toques, assistencia opcional, gol sem autor, desfazer,
  transferencia de autor, cancelamento, foco, duplo clique, falhas, conflitos,
  partidas historicas, penaltis, 360/375/390/430 px.
- PGlite: operacao atomica, repeticao com versao antiga, rollback, desfazer,
  permissao, estatisticas, empates e correcoes depois de encerrar a rodada.
- Sem consultas adicionais, polling, dependencias ou migrations.
- Nenhuma alteracao de dados ou deploy em producao nesta tarefa.
