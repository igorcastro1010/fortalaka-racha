# RACHA FORTALAKA — sorteio de times

A rodada usa `rachas` e `racha_participantes`. Apenas participantes com `tipo = linha`, `status = confirmado` e `jogador_id` associado a um perfil entram no sorteio. Goleiros fixos (`tipo = goleiro`), suplentes, ausentes e removidos ficam fora. Os goleiros permanecem numa seção separada.

Não existe limite fixo de 20 jogadores. Formar `ceil(N / 5)` times, com até cinco jogadores cada, diferença máxima de uma pessoa e sem duplicatas.

| Jogadores | Tamanhos dos times |
| --- | --- |
| 4 | 4 |
| 8 | 4, 4 |
| 10 | 5, 5 |
| 13 | 5, 4, 4 |
| 20 | 5, 5, 5, 5 |
| 23 | 5, 5, 5, 4, 4 |

## Persistência

Fechar a lista antes do sorteio. Sorteio, novo sorteio e troca manual são salvos imediatamente como rascunho numa transação PostgreSQL. A leitura do banco é a fonte de verdade ao navegar, recarregar e abrir outra sessão.

Novo sorteio substitui o anterior sem duplicar vínculos. A confirmação valida o conjunto persistido e altera o status dos mesmos times, preservando IDs e jogadores. Versões desatualizadas são rejeitadas. Editar participantes exige reabrir a lista e invalida os times anteriores quando a composição muda.

Novo sorteio de times confirmados exige aceitar o aviso existente. O novo rascunho fica oculto para jogadores comuns até nova confirmação. Rodadas finalizadas não podem ser alteradas.

## Permissões e fotos

Somente organizadores ativos gerenciam rodada, sorteio, trocas e confirmação. Jogadores comuns visualizam somente times confirmados. RLS e RPCs validam permissões; escrita direta em `times` e `time_jogadores` é bloqueada.

`profiles.avatar_url` é a única fonte da foto: o participante existente referencia `profiles.id`. Não criar outra tabela de jogadores nem duplicar a URL. RPCs fornecem apenas as fotos dos participantes, sem abrir acesso aos e-mails de outros perfis.

Avatar circular de 40–44px, `object-fit: cover`, usando iniciais quando ausente ou com erro. Em Perfil, cada usuário ativo envia sua própria foto ao bucket `avatars`, na pasta do próprio ID. PNG/JPEG/WebP, até 2 MiB.

## Loading e escopo

Não antecipar estado vazio antes da consulta. Se falhar, mostrar `Não foi possível carregar os times desta rodada.` e permitir tentar novamente. Falha ao salvar não publica sucesso nem aplica apenas uma distribuição local.

Não implementar avaliação de goleiros, ranking ou avaliação dos jogadores de linha nesta etapa. Instalação e testes em `instalacao-sorteio-times.md`.
