# Correção mobile e notificações — 17/11/2026

Base: commit c434c56, publicado antes deste relato. Escopo: mensagem durante carga, trabalho de renderização, avatares e acesso à central. Sem SQL/RLS/permissões ou alterações de dados reais.

## Diagnóstico comprovado

| Problema | Evidência | Arquivo/linha da correção | Impacto |
| --- | --- | --- | --- |
| Carregamento confundido com rodada inexistente | Consulta de rodada retida no teste reproduziu exatamente “Seu próximo racha começa aqui.” com skeleton visível | src/lib/rounds/home-heading.ts:1; src/components/app/FortalakaApp.tsx:188 | Estado de espera e erro explícitos; mensagem de vazio só após resposta sem rodada |
| Abas nunca abertas já tinham DOM renderizado | Na Home inicial, o DOM continha Racha, Times, Resultados, Meu perfil e Avaliação ocultos | src/components/app/FortalakaApp.tsx:62 | Montar no primeiro acesso; Activity continua suspendendo e preservando abas visitadas |
| Sino provoca navegação completa | NotificationBell usava <a href="/notificacoes">; destino espera getUser/perfil SSR antes da central buscar seus dados | src/components/notifications/NotificationBell.tsx:11; src/app/notificacoes/loading.tsx:3 | Link nativo Next, navegação client-side, prefetch parcial e fallback da rota; verificações de acesso mantidas |
| Avatares baixam originais grandes | PlayerAvatar tinha unoptimized incondicional; foto de perfil ativo usada na medição: 1.847.097 bytes, 4032×3024 | src/components/players/PlayerAvatar.tsx:36; next.config.ts:7 | Otimização nativa Next só para bucket público avatars no host HTTPS configurado; URLs externas legadas continuam diretas |

A frase da Home não significava perda da rodada: a foto anterior/posterior enviada pelo usuário mostrava dados existentes. O erro estava na apresentação de round=null durante a espera.

## Antes/depois medido

- Mesmo fixture React + PostgreSQL local, Home organizador 390×844: **304 → 177 elementos DOM**; cinco títulos de abas nunca visitadas → zero. Não representa percentual de melhoria em FPS/latência.
- Uma foto pública já existente, sem alterar o Storage: **1.847.097 → 2.712 bytes**, imagem original 4032×3024 → miniatura WebP 96×128 no otimizador do Next real. A rotação EXIF é aplicada pelo otimizador. Resultado de uma amostra, não soma de todas as fotos nem benchmark do app inteiro.
- A consulta somente leitura de metadados do bucket encontrou 23 arquivos, 17.866.278 bytes no total e máximo 1.847.097 bytes. Essa soma inclui arquivos armazenados, não prova que todos sejam carregados pela lista.
- A primeira execução do teste de miniatura retornou HTTP 400 (origem não configurada); após configuração restrita, HTTP 200 e largura 96. O teste mobile também falhou antes das correções de título e montagem e passou depois.
- Não foi medida a latência do clique autenticado em notificações em produção. A remoção do carregamento completo foi verificada no código do Link nativo; não se removeu a validação SSR para obter um ganho artificial.

## Validação

- Lint e TypeScript passaram; build Webpack passou, incluindo TypeScript.
- tests/home-heading.test.mjs: carregamento, erro, vazio real, rodada conhecida durante revalidação, datas e fuso passaram.
- tests/mobile-scroll.test.mjs: Chromium com viewport mobile e CPU 4× mais lenta; WebKit 27.2 com viewport mobile. Três passagens pela lista, 12 identidades visíveis no fixture, ida/volta, carga demorada e ausência de erros de página passaram. WebKit foi baixado apenas para o cache de ferramentas do PC; nenhuma dependência do projeto foi adicionada.
- tests/avatar-optimization.test.mjs: passou contra Next compilado em localhost:3023, medindo bytes e dimensões com sharp já instalado pelo Next. Aceita URL Next e URL pública do avatar como argumentos; não contém URL ou identidade real no arquivo.
- tests/navigation.test.mjs: fluxo completo passou. O ambiente JSDOM agora fornece self para o Link nativo. Houve avisos React act(...) em atualizações assíncronas; sem falha de asserção ou exceção do aplicativo.
- tests/notifications-ui.test.mjs: leitura/não lidas, paginação, marcação individual/todas, limpeza, cancelamento e falha passaram em 360/375/390/430px.
- auth-profile, auth-proxy, session-cache, performance-live, performance-transport, payment-freshness e times-participantes passaram novamente.
- tests/pwa-production.test.mjs passou contra o Next compilado local: manifest, assets, headers e redirects sem sessão.
- Revisão independente do diff: nenhum bug concreto apontado.

Os MCPs locais Playwright/Chrome DevTools não estavam expostos nesta sessão; foram usados os navegadores e a CLI Playwright com dependências já em cache. Não houve login nem alteração de rodada real.

## Limite importante

O branco durante rolagem na foto do iPhone **não foi reproduzido** no Chromium ou WebKit de desktop. A redução de fotos enormes trata um gargalo real de transferência e decodificação; ainda não comprova que era a única causa do branco no aparelho. Não adicionar transform/translateZ, virtualização ou content-visibility sem reprodução que justifique esses ajustes. É necessária homologação no iPhone/PWA real, incluindo rolagem com a lista e as fotos atuais.

As operações críticas continuam frescas e protegidas no servidor. Não houve modificação de banco, publicação Realtime, políticas, permissões, originais de fotos ou dependências do projeto. Arquivos locais anteriores de skills e supabase/.temp foram preservados.
