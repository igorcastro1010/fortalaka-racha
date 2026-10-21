# Compartilhamento do resultado da rodada

Disponível em Resultados quando o estado persistido é `finalizado`, tanto para jogador
quanto para organizador com acesso à leitura. Não aparece durante a rodada nem enquanto
há uma edição de partida ainda não salva.

## Fonte e cálculos

- Reutiliza `ler_partidas_rodada(p_racha)` já carregada por MatchesPanel. Sem nova query,
  RPC, tabela, policy ou SQL. Essa RPC limita as partidas por `p.racha_id = p_racha` e
  retorna gols/assistências somados dos eventos de cada partida/jogador.
- O snapshot contém o roundId da consulta; `buildRoundShareText(roundId, source)` rejeita
  um snapshot identificado como pertencente a outra rodada.
- Apenas partidas `finalizada`, ordenadas por createdAt; sem createdAt usa finalizadaAt,
  e sem datas preserva a ordem estável. A entrada não é modificada.
- Gols e assistências: somam os eventos registrados de quem participou. Não são inferidos
  do placar. Gol sem autor continua sem autor no resumo.
- Vitórias: uma por participação em partida vencida; empates e ausências não contam.
  Não utiliza estatísticas históricas, ranking geral, overall ou avaliações.
- TOP 3 por quantidade, sem desempate inventado. Empatados recebem a mesma colocação;
  empatados na terceira posição são incluídos, mesmo ultrapassando três nomes.
- "Participantes em campo" conta jogadores distintos que participaram das partidas
  finalizadas, não o total de inscritos/suplentes.
- Não gera seções de gols/assistências/vitórias sem dados. Sem partidas, o preview contém
  apenas marca, data disponível e "Racha finalizado."; compartilhar/copiar ficam desabilitados.

## Ações e UX

- Card compacto, modal VER RESUMO, ação principal vermelha COMPARTILHAR NO WHATSAPP
  e ação secundária COPIAR RESULTADO.
- Com Web Share API: usa `navigator.share({text})`. Cancelar é silencioso.
- Sem Web Share: link normal `https://wa.me/?text=...`, codificado com encodeURIComponent,
  target blank e noopener/noreferrer. Não depende de window.open nem envia automaticamente.
- Se o compartilhamento nativo falhar, mostra um link explícito ABRIR WHATSAPP e mantém
  a cópia disponível. Bloqueio de nova aba pelo navegador não gera exceção na aplicação.
- Clipboard API copia a mesma mensagem; sem API ou permissão, orienta copiar pelo preview.
- Não há seleção de destinatário, acesso a contatos, envio automático ou escrita no Supabase.

## Validação

- `npm run build`: passou.
- `npm run lint`: passou, sem warnings.
- `node --experimental-strip-types --test tests/round-share.test.mjs`: 17 testes passaram.
  Inclui conteúdo, ordem, gols, assistências, vitórias, empates, vazios, caracteres especiais,
  encoding, estados inválidos, isolamento por rodada, Web Share, cancelamento e clipboard.
- `node tests/navigation.test.mjs <diretório das dependências de teste>`: passou, incluindo
  aparecer após finalização, preview e ausência do resumo na rodada nova.
- `node tests/partidas-estatisticas.test.mjs <diretório das dependências de teste>`:
  sete cenários PostgreSQL passaram.
- Playwright MCP, componentes reais + PostgreSQL isolado em 127.0.0.1:3011: fluxo de
  finalização, card, preview, cópia, Web Share simulada, cancelamento, falhas e URL de fallback.
  Navegação para wa.me foi interceptada antes de rede externa; nenhuma mensagem enviada.
- Cópia real no Chromium também validada: Windows converte LF para CRLF no clipboard;
  após normalizar as quebras, o texto lido é idêntico ao preview/link.
- Cenário legado de rodada finalizada sem partidas simulado por resposta de rede local,
  sem alterar banco: ações desabilitadas e nenhuma seção vazia de resultados.
- Mobile 360×800, 375×812, 390×844 e 430×932: card/modal sem overflow; ações de 44–48 px.
- Chrome DevTools MCP: sem erros JavaScript no cenário inspecionado; API local HTTP 200.
  404 de missing.png no fixture é intencional para testar avatar, não falha da feature.
- Revisão React: novos componentes fora do render, sem novos fetches/effects de dados,
  browser APIs apenas em handlers, feedback acessível e modal com foco/fechamento nativos.

Capturas locais fora do Git: `%TEMP%/fortalaka-playwright-mcp/resumo-whatsapp-card.png`
e `resumo-whatsapp-preview.png`. Dados sintéticos apenas no PostgreSQL isolado.

SQL pendente: NÃO. Supabase/RLS alterados: NÃO. Deploy: NÃO.
