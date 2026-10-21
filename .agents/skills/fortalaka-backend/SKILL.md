---
name: fortalaka-backend
description: Alterar backend, Supabase, SQL, RLS e regras de negocio do RACHA FORTALAKA preservando dados, autorizacao e persistencia.
---

# Backend do RACHA FORTALAKA

## Antes de editar

- Consulte Graphify primeiro, conforme AGENTS.md. Localize tabelas, RPCs, policies e repositorios afetados; abra apenas o SQL e os arquivos necessarios. Nao duplique RPCs ou policies existentes.
- Leia os guias locais de Next.js em node_modules/next/dist/docs/ antes de escrever codigo Next.js.
- Stack: Next.js App Router, TypeScript, Supabase Auth, Database, Storage e RLS; SQL incremental.
- As regras abaixo sao as diretrizes de negocio fornecidas pelo responsavel. Ha legado de posicoes/goleiros na master: nao o trate como requisito nem declare sua remocao concluida. Corrija divergencias somente dentro do escopo solicitado, preservando dados antigos.

## Dados e seguranca

- Supabase e a fonte de verdade; estado React serve a interface, nao a persistencia principal. Recarregamento deve recuperar inscricoes, ajustes, sorteio e fila.
- Preserve dados e compatibilidade com registros antigos. Prefira migrations/SQL incremental; nao use DROP destrutivo sem necessidade demonstrada e autorizacao para perda de dados.
- Entidades: profiles, jogadores, rachas, racha_participantes, times, time_jogadores, partidas, partida_jogadores, eventos_partida e avaliacoes. Confira a existencia e o papel de cada uma no SQL antes de usa-la; nao crie tabela apenas por constar nesta lista.
- Regras criticas devem existir no banco/RLS/RPC, nao apenas no frontend. Jogador altera somente dados proprios permitidos; organizador tem poderes operacionais completos, sem ampliar acesso a secrets ou autoria privada das notas.
- Preserve Auth e policies de Storage. Nunca exponha secrets, service-role keys ou secret keys em NEXT_PUBLIC, cliente, logs ou commits.

## Regras de negocio

- **Lista:** organizador cria rodada e abre lista; jogador autenticado entra diretamente ao clicar ENTRAR NA LISTA, sem escolher posicao. App nao controla goleiros. Jogador gerencia apenas a propria inscricao enquanto aberta; organizador pode ajustar participantes. Fechar com qualquer quantidade, sem minimo de 20.
- **Sorteio:** quantidade dinamica de times, alvo de aproximadamente cinco jogadores por time, distribuicao o mais equilibrada possivel e nenhuma logica de goleiro. Persistir sorteio e ajustes no Supabase; confirmar nao recria times.
- **Partidas:** sem timer no app. Regra real de sete minutos OU dois gols, com tempo controlado externamente e placar manual. Aos dois gols, apenas sugerir finalizacao; nunca finalizar automaticamente.
- **Fila:** vencedor permanece, perdedor vai ao fim e primeiro da fila entra. No empate, ambos saem e vao ao fim; entram os dois primeiros da fila. Suportar quantidade variavel de times e persistir a fila no Supabase. Conferir comportamento com fila insuficiente antes de alterar a transicao; nao inventar times.
- **Finalizacao do racha:** organizador encerra manualmente, sem controle de 1h30. Preservar partidas, eventos, times e lista; bloquear novas partidas apos finalizar, inclusive no banco.
- **Avaliacoes:** organizador abre depois do racha; jogador avalia apenas companheiros do proprio time, nunca a si ou adversarios. Passe, Chute, Velocidade, Defesa e Fisico, escala de 1 a 5. Preservar privacidade da autoria nas consultas, RPCs e RLS.
- **Estatisticas:** jogos, gols, assistencias e vitorias derivados de partidas reais. Nao duplicar totais manuais no jogador; perfil e ranking usam dados reais.

## Verificacao

Verifique os caminhos afetados como jogador e organizador, incluindo acesso negado, persistencia apos recarga e dados antigos. Use testes existentes pertinentes e conclua com fortalaka-release; relate SQL preparado separadamente de SQL efetivamente aplicado.
