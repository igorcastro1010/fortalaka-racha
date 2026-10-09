# Entrada para avaliações

A aba Racha mostra status e progresso pessoal do jogador, com AVALIAR MEU TIME enquanto a rodada está aberta para notas. O organizador preserva ABRIR AVALIAÇÕES e FECHAR, com o progresso geral.

Aplicar supabase/entrada-avaliacoes.sql depois de avaliacoes.sql e finalizar-rodada.sql. Essa migração acrescenta uma leitura por rodada, sem alterar notas ou regras de gravação. O jogador e o time são identificados por auth.uid() no banco; adversários e o próprio jogador são excluídos. O envio existente valida notas de 1 a 5 e atualiza a mesma avaliação quando editada, sem duplicatas.

A leitura sem ID retorna a rodada mais recente, mesmo se uma rodada antiga estiver aberta. A navegação iniciada na aba Racha mantém o ID da rodada selecionada. O estado aberto/fechado é atualizado ao voltar à janela e a cada 15 segundos enquanto ela estiver visível; o banco valida novamente a abertura no envio.

A função de leitura foi aplicada ao Supabase do RACHA FORTALAKA e sua instalação foi confirmada. A interface ainda depende de publicação do código.
