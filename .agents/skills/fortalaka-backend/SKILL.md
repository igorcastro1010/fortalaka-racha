---
name: fortalaka-backend
description: Alterar backend, Supabase, SQL, RLS ou regras de negócio do RACHA FORTALAKA preservando persistência, segurança e histórico. Usar também em auditorias dessas áreas.
---

# Backend do Fortalaka

## Antes de editar

- Leia o `AGENTS.md` da raiz e consulte Graphify conforme suas instruções. Identifique tabelas, RPCs, policies, chamadores e testes afetados; abra apenas os trechos necessários.
- Stack: Next.js App Router, TypeScript, Supabase Auth/Database/Storage e RLS. Para código Next.js, leia o guia pertinente em `node_modules/next/dist/docs/`.
- Supabase é a fonte de verdade. Estado React é rascunho de interface, não persistência de rodada, composição, fila ou avaliação.
- Identidade operacional: `auth.uid()` vinculado a `profiles.id`. “Jogadores” é o conceito de domínio; confirme se há tabela `jogadores` no schema instalado antes de criar ou consultar uma.
- Entidades existentes: `profiles`, `rachas`, `racha_participantes`, `times`, `time_jogadores`, `partidas`, `partida_jogadores`, `eventos_partida`, `avaliacoes` e `fila_times`.
- Confira SQL em `supabase/` e repositórios em `src/lib/rounds`, `teams`, `matches` e `ratings`. Não duplique RPC/policy. Arquivo SQL no Git não prova aplicação no Supabase.

## Invariantes operacionais

- **Lista:** organizador cria rodada aberta; ENTRAR NA LISTA inscreve imediatamente o jogador autenticado, sem posição ou modal. Entrada/saída própria só enquanto aberta; organizador ajusta participantes/suplentes/ausentes. Fechar aceita qualquer quantidade, inclusive zero; nunca exigir 20.
- **Sem goleiros:** app não escolhe, distribui ou controla goleiros. Preserve registros legados sem apagar histórico; trate participantes antigos elegíveis conforme a compatibilidade existente, sem restabelecer uma posição especial.
- **Sorteio:** quantidade dinâmica, alvo máximo de cinco por time e diferença de tamanho até um. Persistir rascunho e ajustes; confirmar os mesmos times sem duplicá-los. Proteger versões contra gravações concorrentes e composição de rodadas iniciadas/finalizadas.
- **Partidas:** placar manual não negativo; sete minutos OU dois gols, tempo externo. Ao atingir dois gols, sugerir finalização e aguardar confirmação. Sem timer ou encerramento automático. Gols/assistências individuais não precisam somar exatamente o placar; admitir gol sem autor.
- **Fila:** vencedor permanece, perdedor vai ao fim e primeiro aguardando entra. Empate leva ambos ao fim e entram os próximos dois; funcionar com quantidade variável de times. Persistir a fila, não calculá-la apenas em `useState`.
- **Encerramento:** organizador finaliza manualmente, sem controlar 1h30. Manter a exigência existente de uma partida finalizada; preservar lista, times, fila, partidas e eventos, bloquear novas partidas e sorteio normal. Avaliações não abrem automaticamente.
- **Avaliações:** organizador abre após finalizar o racha e pode fechar. Autoria vem do usuário autenticado; somente companheiros elegíveis, nunca ele próprio ou adversários. Passe, Chute, Velocidade, Defesa e Físico, inteiros 1–5; permitir edição sem duplicatas apenas enquanto abertas. Não revelar quem deu cada nota.
- **Estatísticas:** jogos e vitórias vêm de partidas finalizadas com participação; gols/assistências dos eventos válidos. Separar agregações de participação/eventos para evitar multiplicação por JOIN. Não duplicar totais manuais no jogador. Perfil/ranking usam dados reais; overall é média dos cinco critérios ×20. Preserve a regra existente de duas respostas para exibir nota/radar, salvo pedido expresso.

## Banco e segurança

- Validar regras sensíveis no banco/RLS, além da UI: jogador administra somente inscrição própria permitida, avaliações próprias elegíveis e foto própria; resultados/times são de leitura. Organizadores ativos têm gestão operacional, respeitando estados e preservação histórica.
- Em Storage, manter escrita restrita à pasta do próprio usuário e validações de imagem existentes. Não ampliar leitura de profiles/e-mails para resolver avatar.
- Preferir SQL incremental novo e idempotente; preservar schema e dados antigos. Não fazer DROP destrutivo nem reescrever migrations instaladas como atalho.
- Nunca expor secrets, imprimir `.env.local` ou colocar secret keys em `NEXT_PUBLIC_*`. Não aplicar SQL remoto sem autorização da tarefa.
- Testar autorização e falha atômica, persistência após recarga, concorrência quando afetada e estatísticas/compatibilidade relevantes. Usar banco isolado para testes com dados sintéticos.
- Antes de entregar, usar `fortalaka-release`. Informar SQL pendente **SIM/NÃO**, arquivo exato, dependências e se RLS mudou; separar implementação local de SQL realmente aplicado.
