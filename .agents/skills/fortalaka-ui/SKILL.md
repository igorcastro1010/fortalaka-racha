---
name: fortalaka-ui
description: Criar ou ajustar frontend, design e UX mobile do RACHA FORTALAKA mantendo identidade esportiva, navegacao e componentes existentes.
---

# UI do RACHA FORTALAKA

## Antes de editar

Consulte Graphify primeiro, conforme AGENTS.md, e localize os componentes reutilizaveis antes de abrir arquivos. Preserve PlayerAvatar e os padroes existentes; nao duplique componentes. Leia os guias locais de Next.js antes de escrever codigo do framework. Conclua com fortalaka-release.

## Identidade e formato

- Preto, branco e vermelho; visual esportivo, moderno e premium, sem aspecto de dashboard administrativo generico.
- Mobile-first, largura principal aproximada de 360-430px; no desktop, shell centralizado com aparencia de app.
- Respeite safe areas de iPhone, inclusive espaco da navegacao inferior. Use alvos de toque confortaveis, pouco texto durante o racha e hierarquia visual forte.
- Confira telas estreitas e desktop: texto legivel, sem sobreposicao, corte de botoes ou rolagem horizontal acidental. Preserve estados de carregamento, vazio, erro e acao em andamento.

## Responsabilidade das telas

| Area | Conteudo |
| --- | --- |
| Inicio | Resumo, proxima rodada, status, inscricao e atalhos; sem gestao pesada. |
| Racha | Rodada, participantes, fechar/reabrir lista e finalizar racha; sem sorteio, placar ou formulario de avaliacao. |
| Times | Sorteio, ajustes e confirmacao; sem goleiros. |
| Resultados | Partida atual, placar, fila, proxima partida, gols, assistencias e historico. Ranking pode ser uma subarea. |
| Avaliacao | Progresso, avaliar meu time, formulario e abrir/fechar para organizadores. |
| Perfil | Acesso pelo avatar/header; apresentacao de atleta com avatar, nota geral, radar e estatisticas reais. |

Mantenha a navegacao principal Inicio, Racha, Times, Avaliacao e Resultados. Inscricao deve ser direta, sem escolha de posicao; nao reproduza controles legados de goleiro. Trate divergencias encontradas apenas no escopo da tarefa e use fortalaka-backend quando houver regras ou persistencia envolvidas.

## Componentes e interacao

- Avatar em listas de 40-44px: foto circular quando disponivel, iniciais como fallback.
- Prefira acoes compactas, menus de contexto, cards curtos e botoes principais destacados; bottom sheets quando beneficiarem o fluxo.
- Evite tabelas grandes no celular, formularios longos, selects sempre expostos, excesso de cards administrativos, texto apertado, informacoes duplicadas e modais desnecessarios.
- Perfil/player card usa dados reais; nao invente notas ou estatisticas para preencher estados vazios.
- Verifique navegacao de ida e volta, acessibilidade dos controles e visibilidade das acoes por papel; esconder um botao nao substitui autorizacao no banco.
