# Pacote de evolução — 29/10/2026

## Escopo e decisões

Implementar A–E na master, preservando as cinco abas e regras atuais. Um commit e push por funcionalidade, com commits adicionais apenas para correções ou documentação verificável. O pedido atual autoriza deploy ao final, substituindo a restrição do anexo.

- A: evoluir `buildOrganizerOverview`, sem outra máquina de estados. Distinguir sorteio, revisão e partidas; confirmar operações que substituem composição ou bloqueiam inscrições.
- B: `/comparar?jogadorA=…&jogadorB=…`, dados da RPC agregada existente; seleção distinta, métricas ausentes como `--`, atributos lado a lado no mobile. A RPC detalhada mantém a permissão existente (próprio jogador ou organizador). Perfil público reutiliza `/perfil/[jogadorId]`.
- C: marcos objetivos derivados das estatísticas; premiações de rodada somente com partidas finalizadas. Sem persistir totais duplicados ou inventar datas de conquista.
- D: Canvas nativo 1080×1920; resultado, artilharia, ranking filtrado e destaques, preview antes de compartilhar/salvar. Reusar snapshot de `round-share`. Avatares com CORS e fallback de iniciais.
- E: central persistida com acesso por destinatário, eventos gerados no banco e idempotência; migration incremental testada em PostgreSQL isolado. Não simular push sem backend, chaves e subscriptions reais.

## Validação por etapa

1. Testes de comportamento antes das mudanças de regra.
2. Revisão React: efeitos canceláveis, ausência de N+1, props tipadas, estados vazio/erro, labels e foco.
3. Build/lint e testes pertinentes. Playwright em dados sintéticos locais; Chrome DevTools para console/network.
4. Conferência mobile 360×800, 375×812, 390×844, 430×932 e desktop.
5. Graphify update local; revisar staging específico, commit e push.

## Skills

Find-skills usado: SIM. Consultado o leaderboard de https://skills.sh/ e buscas por gamification, badges/achievements, sports statistics, comparison UI, social sharing, image/card generation, web push/PWA, Next.js/mobile/accessibility.

Encontradas: `wondelai/skills@drive-motivation` (5,3K), `omer-metin/skills-for-antigravity@gamification-loops` (571), `capawesome-team/skills@capacitor-push-notifications` (1,2K), `curiositech/some_claude_skills@pwa-expert` (547), `secondsky/claude-skills@push-notification-setup` (424), `kostja94/marketing-skills@open-graph` (1,2K), `alonw0/web-asset-generator@web-asset-generator` (950), `software-mansion/argent@argent-create-flow` (25,4K), além de resultados de estatísticas esportivas sem aderência aos dados locais.

Esses resultados não foram instalados nem recomendados como dependência: Capacitor não é a plataforma do projeto; geração de assets e padrões de UI já estão cobertos. Nenhuma skill nova instalada nesta tarefa.

Usadas: find-skills, Graphify, fortalaka-ui, fortalaka-backend, fortalaka-release, apple-design e vercel/react-best-practices; orientações de planejamento, testes e Playwright.

## Identidade visual

Preto #0a0a0a, branco #ffffff, superfície #f3f3f4, texto auxiliar #52525b e vermelho #dc2626. Branco sobre vermelho tem contraste aproximado 4,8:1. Tipografia e escudo existentes, controles de pelo menos 44px, foco visível, texto e ícones para diferenciar estados. Princípios HIG aplicados à web, sem imitar controles iOS.

## Estado inicial preservado

Alterações anteriores: package.json/package-lock.json (OmniRoute), .agents/skills/apple-design e skills-lock.json. Excluídas dos commits do pacote.

Antes do primeiro push, a master remota foi integrada: já continha a remodelagem visual, perfil público e histórico. Os conflitos foram resolvidos preservando esses recursos e usando `useConfirmation` e os estilos `fk-*` existentes.

## Revisão visual e React

Aplicação web: usamos os fundamentos das HIG, sem impor convenções nativas iOS. Referências locais consultadas de apple-design: accessibility, layout, typography, color, designing-for-ios, cross-platform, buttons, notifications, feedback e charting-data.

- `buttons.md › Style`: “Keep the number of prominent buttons to one or two per view.” O painel conserva uma próxima ação primária; atalhos ficam em detalhes.
- `notifications.md › Best practices`: “Avoid sending multiple notifications for the same thing”. Eventos têm chave única por destinatário, sem avisos por gol.
- `color.md › Inclusive color`: “Avoid relying solely on color”. Notificações têm texto Lida/Não lida; conquistas têm nome, descrição e ícone.
- A comparação usa atributos por linha, sem radar sobreposto pequeno. Os valores ausentes permanecem `--`.
- UI em 360/375/390/430 e desktop: controles de 44–48px, foco visível, nomes longos quebram, sem overflow. Reduced motion e navegação por teclado preservados.
- Revisão React por bloco: nenhuma biblioteca nova de UI ou imagens, geração Canvas carregada sob demanda, sem consulta por linha do ranking, efeitos com descarte, histórico de conquistas sob demanda.
- Segunda revisão: corrigida perda do preview em revalidação idêntica e habilitada marcação global quando há páginas anteriores. Testes reproduziram ambos os casos.

## Migração da central

`supabase/notificacoes.sql` cria apenas `notifications`, índices, a policy própria e RPC de marcar lidas. Triggers de comunicação observam rodadas, rascunhos e partidas, sem substituir RPCs operacionais existentes. Reaplicável, sem backfill e sem remoção de histórico.

Aplicação remota: NÃO executada nesta tarefa. Dependências: schema/sorteio, partidas, avaliações, finalizar-rodada e fluxo principal existentes. Sem isso, o sino não inventa contadores e a central apresenta indisponibilidade com tentativa novamente.

Push: NÃO implementado. Não foi criada subscription, chave VAPID, service worker ou permissão fictícia. A central funciona sem Notification API após a migration ser aplicada.
