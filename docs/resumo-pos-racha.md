# Resumo pós-racha

Disponível em Resultados somente quando a rodada está finalizada e a leitura das partidas terminou sem erro. A edição de resultados, a fila e as permissões anteriores continuam no painel de partidas.

## Fonte única

`getRoundShareSummary(roundId, source)` recebe o snapshot identificado de `ler_partidas_rodada(p_racha)`. Filtra partidas finalizadas, elimina duplicatas e ordena cronologicamente. A UI e `buildRoundShareTextFromSummary(summary)` recebem a mesma estrutura; `buildRoundShareText(roundId, source)` permanece compatível com a API anterior.

- Participantes: jogadores únicos que efetivamente participaram das partidas finalizadas, com nome e avatar já retornados pela RPC.
- Gols totais e média: placares dessas partidas. Sem jogos, a média é `null`.
- Artilharia e assistências: eventos individuais registrados. Não precisam somar o placar, conforme a regra existente que admite gol sem autor.
- Vitórias: participação na partida e pertencimento ao time vencedor. Empates não somam vitórias.
- Artilharia: `summary.topScorers` traz no máximo cinco jogadores com gols, em ordem decrescente e estável nos empates; posições empatadas continuam compartilhadas. Nome e avatar vêm da mesma fonte. Tela e WhatsApp consomem esse mesmo ranking; `goals` permanece como alias compatível. Sem gols atribuídos, a seção fica oculta.
- Assistências, vitórias e notas mantêm o TOP 3 com posições compartilhadas, incluindo todos os empatados na terceira posição. Nenhuma fórmula de MVP foi criada.
- Maiores notas: overall **histórico** dos participantes, fornecido pela RPC existente `ler_estatisticas_jogadores`, com pelo menos duas respostas e nota válida. A legenda informa explicitamente que não é uma nota exclusiva da rodada. Não são usados gols, assistências ou vitórias globais no resumo.

O componente faz uma única leitura agregada de notas por montagem da rodada, sem N+1 ou consulta individual. Não consulta avaliadores. Ao atualizar as partidas, o resumo é remontado com os dados persistidos e as notas são relidas.

## Estados e compartilhamento

Rodada aberta não apresenta resumo final. Finalizada sem partidas apresenta mensagem específica, sem cards de números ou líderes vazios. Artilharia, assistências e notas insuficientes ficam ocultas. Participantes são expansíveis e usam `PlayerAvatar`.

O compartilhamento existente continua com Web Share, cancelamento silencioso, fallback via link codificado do WhatsApp, cópia e preview. O card usa modo compacto depois das seções do resumo. As ações do navegador não foram reimplementadas.

## Validação local

- Build de produção e lint: aprovados.
- 23 testes unitários de resumo/WhatsApp: aprovados, incluindo limite de cinco, 1/3/mais de 5 jogadores, singular/plural, ordem estável, mesma lista no WhatsApp, placares versus eventos, exclusões de outras rodadas/partidas não finalizadas e privacidade das notas.
- `node tests/post-round-summary.test.mjs <node_modules com esbuild e playwright>`: componente real com dados sintéticos locais; Playwright valida 360/375/390/430 px, nomes longos, avatares, alinhamento, ausência de overflow, zero gols oculto e ranking compartilhado. Requer build prévio e Chromium instalado pelo Playwright; capturas ficam no diretório temporário do sistema.
- Navegação com componentes reais e PostgreSQL isolado: aprovada, incluindo resumo somente após finalizar, números, seções vazias, nota 88 após duas respostas, nova rodada sem resumo antigo e compartilhamento preservado.
- Sete cenários PostgreSQL de estatísticas/RLS, dez do fluxo sem posições, doze testes de sorteio e teste do repositório de participantes: aprovados.
- Playwright MCP: rodada local finalizada com 10 participantes, 1 partida, 1 gol, média 1,0, artilharia, assistência, vitórias empatadas e overall 88. Dados sintéticos apenas no banco local.
- 360×800, 375×812, 390×844 e 430×932: sem overflow horizontal; ações de 44–48 px; participantes expansíveis.
- Preview, link do WhatsApp, Web Share e clipboard simulados receberam exatamente a mesma mensagem. Nenhuma mensagem externa enviada.
- Rodada vazia simulada na resposta local: sem números/líderes, compartilhamento desabilitado.
- Chrome DevTools MCP, perfil de jogador isolado: 10 chamadas de leitura HTTP 200; nenhum erro/aviso de console. A fixture tem um avatar propositalmente inexistente para testar fallback, que retorna 404 se expandido; não é uma falha de RPC.
- Graphify atualizado localmente e ignorado pelo Git.

Nenhum SQL novo, alteração de RLS ou escrita no Supabase remoto é necessário para esta feature.
