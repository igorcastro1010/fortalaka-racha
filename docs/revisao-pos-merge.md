# Revisão após merge — 06/10/2026

Trabalho realizado diretamente na master, a partir de cc0e622. Sem deploy, commit ou alteração de dados reais nesta revisão.

## Problemas encontrados e correções

- O salvamento apagava times e inseria o novo conjunto em requisições separadas. Uma falha intermediária podia perder a distribuição anterior. Agora uma RPC valida e substitui tudo numa transação, com bloqueio da rodada e versão para concorrência.
- A confirmação alterava times e rodada separadamente, permitindo estados parciais. Agora confirma os mesmos IDs e vínculos numa transação, sem recriar times.
- O fallback local podia mostrar uma distribuição mesmo sem confirmar a leitura do banco; havia dados mockados durante carregamento/erro. Agora somente a leitura persistida publica o resultado, sem antecipar estado vazio ou contagem zero antes da consulta.
- A ação de novo sorteio estava bloqueada após confirmação. Agora aceita o aviso e persiste nova distribuição como rascunho, ocultando-a de jogadores até confirmação.
- A leitura de fotos por join dependia de abrir profiles de outras pessoas, incompatível com a RLS atual. RPCs retornam somente fotos de participantes da rodada, preservando a privacidade dos demais campos.
- Avatar não tinha fallback de imagem quebrada e era menor que o solicitado. Agora é circular, 40–44px, cover, com iniciais ao falhar.
- Não havia upload próprio completo na tela Perfil. Agora valida arquivo e identidade, envia ao bucket avatars e salva profiles.avatar_url; erro não publica sucesso.
- Falhas ao carregar a rodada podiam ficar sem tratamento. Agora exibem erro; a escolha da última rodada usa os mesmos critérios de data/criação/ID em Racha e Times.
- Documentação e testes ainda descreviam a versão antiga de 20 jogadores e rascunho local. Foram atualizados para a distribuição dinâmica e persistida.

## Arquivos alterados

- src/components/app/FortalakaApp.tsx
- src/components/players/PlayerAvatar.tsx
- src/components/players/ProfilePhoto.tsx (novo)
- src/components/rounds/RachaScreen.tsx
- src/components/teams/TeamsScreen.tsx
- src/lib/rounds/repository.ts
- src/lib/teams/draw.ts
- src/lib/teams/repository.ts
- supabase/validacao-sorteio-avatars.sql (novo)
- tests/sorteio.test.mjs
- tests/sorteio-sql.test.mjs
- tests/preview-sorteio.mjs
- docs/especificacao-sorteio-times.md
- docs/instalacao-sorteio-times.md
- docs/revisao-pos-merge.md (este relatório)

## Validação

- Build e lint aprovados.
- Oito testes de distribuição: 4/8/10/13/20/23, equilíbrio, IDs únicos, fotos, troca e composição inválida.
- Dez cenários em PostgreSQL isolado com os scripts reais: persistência, nova sessão, reroll, troca, confirmação sem recriar IDs, rejeição atômica de participantes inválidos, concorrência, permissões de jogador, fotos sem liberar e-mails e Storage limitado à pasta própria. Migração executada duas vezes nesse banco para validar reexecução.
- Navegador com componentes reais e PostgreSQL isolado: adicionar jogador à lista, fechar, sortear nove linhas em 5+4, sair e voltar, recarregar, sortear novamente, trocar entre times, sair e voltar, confirmar, recarregar e fechar/abrir navegador. Jogador comum vê times confirmados sem gestão.
- Foto válida na lista em 44px e no time em 40px, cover; perfil sem foto e imagem com HTTP 404 usam iniciais. Upload próprio e URL recarregados após refresh.
- API abortada no navegador: mensagem de carregamento falho correta, sem falso estado vazio; tentar novamente recupera os times.

Não foram criadas contas de teste no Supabase real. A prévia usa identidades falsas e adaptadores locais de auth/Storage; não substitui a verificação do serviço remoto após instalação. O Node emite aviso sobre detecção automática de módulo ao importar TypeScript nos testes; os testes passam e não foi alterado o tipo de módulo do projeto.

## Pendências reais

**SQL pendente no Supabase: SIM.** Executar supabase/validacao-sorteio-avatars.sql depois das estruturas existentes, conforme docs/instalacao-sorteio-times.md.

**Storage pendente: SIM.** O mesmo SQL configura bucket e policies. Revisar policies antigas que possam permitir escrita em fotos de terceiros, porque policies permissivas são combinadas por OR. Validar upload real depois da instalação.

Não há tabela jogadores nesta arquitetura: manter profiles.avatar_url como fonte única evita duplicação. A RLS de profiles continua protegendo alterações de role/active e de fotos alheias.

O roteiro completo de teste manual A–F, instalação e consulta de policies está em docs/instalacao-sorteio-times.md. Nenhuma regra de avaliação de goleiros foi implementada.
