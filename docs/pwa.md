# PWA do Fortalaka

## Escopo aprovado — 30/10/2026

Instalação mobile/desktop com manifest nativo do Next.js 16.3.8, escudo oficial, experiência offline limitada e atualização explícita. Manter Next.js/Vercel/Supabase, master e todas as regras atuais. Não alterar SQL, RLS, auth, roles ou recursos do racha. O pedido atual autoriza deploy ao final, substituindo a proibição do anexo.

## Auditoria e decisões

Graphify query/explain/path localizaram RootLayout, proxy, navegação e configuração. Antes desta tarefa: sem manifest, service worker, viewport/theme-color PWA ou biblioteca de PWA; metadata já tinha ícone JPEG e apple icon JPEG. Escudo oficial 640×640 disponível: suficiente para gerar 192/512 sem ampliar a fonte.

- Manifest: `/manifest.webmanifest`, `name: Racha Fortalaka`, `short_name: FORTALAKA`, descrição oficial, `id/start_url/scope: /`, standalone, orientação livre para respeitar acessibilidade e tablets.
- Ícones PNG 192/512, maskable 192/512, Apple 180 e favicon ICO, todos derivados do arquivo oficial, sem redesenhar ou deformar.
- Worker próprio em `/sw.js`. Cache exclusivamente de arquivos públicos enumerados, com pedidos sem credenciais. Nenhum HTML privado, RSC, API, autenticação, avaliações, resultados, notificações ou endpoint Supabase no cache.
- Navegação: rede, sem recorrer ao cache HTTP; falha de rede entrega documento offline público. Não considerar HTTP 401/403/500 como resposta offline nem esconder falhas do servidor.
- Atualizações: novo worker aguarda; a pessoa escolhe Atualizar. Nenhum reload automático que descarte placares/formulários. Caches antigos só são removidos quando a versão nova ativa.
- Instalação: botão somente quando o navegador oferece evento ou Safari iOS permite instrução contextual. Recusa fica registrada no dispositivo. Sem pedido de permissão de notificações.
- Feedback online/offline no fluxo da página, safe areas, labels e foco. Sem sobrepor a bottom navigation.

## Etapas e commits

1. Auditoria e política de cache (este documento).
2. Geração reproduzível e validação dos ícones.
3. Manifest e metadata nativos.
4. Documento offline e acesso público dos recursos PWA.
5. Service worker e testes de isolamento do cache.
6. Registro/atualização controlada no layout — `adiciona suporte PWA ao Fortalaka`.
7. Feedback de conectividade.
8. Instalação discreta, recusa e orientação iOS.
9. Testes de navegador, atualização e segurança da sessão/cache.
10. Relatório de validação e deploy.

Cada etapa leva somente os arquivos próprios ao staging. Alterações anteriores em package.json/package-lock.json e skills ficam preservadas fora dos commits. Build e testes de navegador executados sequencialmente para não disputar `.next` ou portas locais.

## Skills e referências

find-skills usado: SIM. Consultados https://skills.sh/ e buscas por Next.js PWA, service worker e offline/web app manifest. Resultados incluem `just-mpm/conformai@nextjs-pwa` (65 instalações), `juanmorales1810/pwa-service-worker@pwa-service-worker` (26), `alinaqi/maggy@pwa-development` (4,1K), `secondsky/claude-skills@progressive-web-app` (510), `joe-bell/skills@apple-web-app` (206). Não instaladas: documentação nativa atual e skills existentes já atendem o escopo, sem dependência extra.

Skills usadas: Graphify, find-skills, fortalaka-ui, fortalaka-release, apple-design, vercel/react-best-practices e Playwright. Guias da versão instalada: progressive-web-apps, manifest e generateViewport. Fundamentos HIG: accessibility/layout/typography/color/buttons/app-icons/feedback/privacy; princípios traduzidos para web, sem imitação de iOS.

## Validação planejada

Testar assets/manifest sem sessão, registro/scope, cache enumerado, navegação privada offline, requests com Authorization, RSC/API/Supabase sem cache, atualização aguardando aceite, instalação e recusa, offline/restauração, 360/375/390/430 e desktop. Autenticação real não será feita sem sessão autorizada; fluxos sensíveis podem ser validados com dados locais isolados. Emulação não equivale a instalação física no Android/iPhone.
