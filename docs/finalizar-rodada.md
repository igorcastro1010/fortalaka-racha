# Finalizar rodada

Aplicar supabase/finalizar-rodada.sql após os scripts de validação do sorteio, partidas e avaliações (avaliacoes.sql). A migração é transacional e pode ser reaplicada. Não foi aplicada ao banco remoto.

O status usa o campo existente rachas.estado. Finalizar exige organizador ativo, times confirmados e uma partida finalizada. Atualiza updated_at, finalizada_at e versão, preservando times, participantes e resultados. Lista, sorteio, reabertura e novas partidas ficam bloqueados; correções de resultados continuam disponíveis ao organizador.

Abrir avaliações é uma ação separada, restrita ao organizador, e só funciona depois de finalizar. Avaliações antigas são preservadas; novas gravações ficam condicionadas à abertura explícita. O card existente de avaliações foi integrado ao novo fluxo, preservando envio de notas e progresso.

Teste SQL isolado: node tests/finalizar-rodada.test.mjs <diretório contendo node_modules/@electric-sql/pglite>.
