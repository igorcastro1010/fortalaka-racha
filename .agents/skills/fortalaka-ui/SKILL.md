---
name: fortalaka-ui
description: Criar ou ajustar frontend, layout, design e UX mobile do RACHA FORTALAKA mantendo identidade esportiva, navegação e componentes existentes.
---

# UI do Fortalaka

## Começar pelo existente

- Leia `AGENTS.md` e consulte Graphify conforme a integração existente. Localize componentes reutilizáveis antes de criar outro. Para código Next.js, confira o guia local pertinente.
- Pontos atuais: `src/components/app/FortalakaApp.tsx`, `rounds/`, `teams/`, `ratings/`, `results/` e `players/`.
- Preserve funcionalidades e regras fora da tela solicitada. Não resolva um ajuste visual com mudanças em autenticação, SQL ou ranking; se isso for necessário, aplique também `fortalaka-backend`.

## Identidade e ergonomia

- Preto, branco e vermelho; visual de atleta/esporte, moderno e premium, sem aparência de dashboard administrativo genérico.
- Mobile-first: conferir 360, 390 e 430 px. No desktop, shell de app centralizado, aproximadamente 430 px de largura máxima.
- Respeitar safe areas de iPhone, inclusive espaço inferior para bottom navigation. Botões fáceis de tocar, ações principais destacadas, hierarquia forte e texto curto durante o racha.
- Preferir cards compactos, menus de contexto e ações recolhidas; bottom sheets quando ajudarem. Evitar tabelas largas, formulários longos, selects sempre expostos, excesso de cards administrativos, texto apertado, informação repetida e modais dispensáveis.
- Reutilizar `PlayerAvatar`: circular, 40–44 px em listas; foto quando disponível, iniciais sem foto ou em falha de carregamento. Nomes longos devem caber sem empurrar métricas ou ações para fora da tela.
- Perfil/player card com estilo de atleta: avatar, overall, radar e estatísticas reais. Não inserir mock para substituir dados disponíveis; tratar carregamento, vazio e erro explicitamente.

## Responsabilidade de cada área

| Área | Conteúdo |
| --- | --- |
| Início | Próxima rodada, status, inscrição pessoal e atalhos; somente resumo, sem gestão pesada. |
| Racha | Dados da rodada, participantes, fechar/reabrir lista e finalizar racha; sem sorteio, placar ou formulário de avaliação. |
| Times | Participantes aptos, sorteio, ajustes e confirmação; sem controle de goleiros, resultados ou avaliações. |
| Avaliação | Progresso, AVALIAR MEU TIME e formulário; abrir/fechar somente para organizadores. |
| Resultados | Partida atual, placar, fila, próxima partida, gols, assistências e histórico; Ranking como subárea existente. |

Manter as cinco abas Início/Racha/Times/Avaliação/Resultados. Perfil continua no avatar/header; não lotar a bottom navigation.

## Conferir a alteração

- A inscrição é de um toque, sem escolher posição. Não reintroduzir goleiros ou cronômetros. Placar aos dois gols apenas sugere finalizar; manter confirmação de encerramento do racha.
- Conferir roles, estados bloqueados, feedback de envio/erro e prevenção de clique duplicado; esconder controles administrativos do jogador comum sem substituir a proteção do banco.
- Validar navegação e ações afetadas, foco/labels de controles e diálogos, avatares, nomes/estatísticas e ausência de rolagem horizontal nas três larguras.
- Ao editar várias TSX, usar a revisão React pertinente disponível; depois executar `fortalaka-release`. Entregar os arquivos alterados e evidência visual quando houver conferência no navegador.
